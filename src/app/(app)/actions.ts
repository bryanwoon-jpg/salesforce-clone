"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { formFields, getObject, type ObjectDef } from "@/lib/objects";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireObject(key: string): ObjectDef {
  const def = getObject(key);
  if (!def) throw new Error(`Unknown object: ${key}`);
  return def;
}

function requireId(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid record id");
  return id;
}

function friendly(message: string): string {
  if (message.includes("row-level security")) return "You don't have permission to do that.";
  if (message.includes("violates foreign key")) return "This record is referenced by other records and can't be changed that way.";
  if (message.includes("violates check constraint")) return "One of the values isn't allowed. Check the fields and try again.";
  return message;
}

/** Turns submitted form data into a typed payload using the object's field metadata. */
function parsePayload(def: ObjectDef, formData: FormData) {
  const payload: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};

  for (const name of formFields(def)) {
    const field = def.fields[name]!;
    const raw = formData.get(name);
    const text = typeof raw === "string" ? raw.trim() : "";

    if (field.type === "boolean") {
      payload[name] = raw === "on" || raw === "true";
      continue;
    }
    if (!formData.has(name)) continue;

    if (text === "") {
      if (field.required) fieldErrors[name] = `${field.label} is required.`;
      else payload[name] = null;
      continue;
    }

    switch (field.type) {
      case "number":
      case "currency":
      case "percent": {
        const n = Number(text.replace(/,/g, ""));
        if (Number.isNaN(n)) fieldErrors[name] = `${field.label} must be a number.`;
        else if (field.type === "percent" && (n < 0 || n > 100)) fieldErrors[name] = `${field.label} must be between 0 and 100.`;
        else if (n < 0) fieldErrors[name] = `${field.label} can't be negative.`;
        else payload[name] = field.type === "number" || field.type === "percent" ? Math.round(n) : n;
        break;
      }
      case "picklist":
        if (field.options && !field.options.includes(text)) fieldErrors[name] = `Choose a valid ${field.label.toLowerCase()}.`;
        else payload[name] = text;
        break;
      case "lookup":
        if (!UUID.test(text)) fieldErrors[name] = `Choose a valid ${field.label.toLowerCase()}.`;
        else payload[name] = text;
        break;
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) fieldErrors[name] = "Enter a valid email address.";
        else payload[name] = text;
        break;
      case "url":
        payload[name] = /^https?:\/\//i.test(text) ? text : `https://${text}`;
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fieldErrors[name] = `${field.label} must be a date.`;
        else payload[name] = text;
        break;
      case "datetime": {
        const d = new Date(text);
        if (Number.isNaN(d.getTime())) fieldErrors[name] = `${field.label} must be a date and time.`;
        else payload[name] = d.toISOString();
        break;
      }
      default:
        payload[name] = text;
    }
  }
  return { payload, fieldErrors };
}

export async function saveRecord(
  objectKey: string,
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const def = requireObject(objectKey);
  const { supabase, org } = await getContext();
  const { payload, fieldErrors } = parsePayload(def, formData);
  if (Object.keys(fieldErrors).length) return { error: "Review the errors on this page.", fieldErrors };

  let recordId = id;
  if (id) {
    const { error } = await supabase.from(def.key).update(payload).eq("id", requireId(id));
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await supabase
      .from(def.key)
      .insert({ ...payload, org_id: org.id })
      .select("id")
      .single();
    if (error) return { error: friendly(error.message) };
    recordId = data.id as string;
  }

  revalidatePath(`/${def.key}`);
  const returnTo = formData.get("return_to");
  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) redirect(returnTo);
  redirect(`/${def.key}/${recordId}`);
}

export async function deleteRecord(objectKey: string, id: string): Promise<FormState> {
  const def = requireObject(objectKey);
  const { supabase, org } = await getContext();
  const { error, count } = await supabase
    .from(def.key)
    .delete({ count: "exact" })
    .eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  if (!count) return { error: "Only the record owner or an admin can delete this record." };
  revalidatePath(`/${def.key}`);
  redirect(`/${def.key}`);
}

/** Inline update of one picklist field (Path, Kanban). */
export async function updatePicklist(objectKey: string, id: string, field: string, value: string): Promise<FormState> {
  const def = requireObject(objectKey);
  const meta = def.fields[field];
  if (!meta || meta.type !== "picklist" || !meta.options?.includes(value)) return { error: "Invalid value." };
  if (objectKey === "leads" && value === "Converted") return { error: "Use Convert to convert a lead." };
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from(def.key)
    .update({ [field]: value })
    .eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/${def.key}`, "layout");
  return {};
}

export async function convertLead(
  leadId: string,
  input: { accountId: string | null; createOpportunity: boolean; opportunityName: string },
): Promise<FormState & { result?: { account_id: string; contact_id: string; opportunity_id: string | null } }> {
  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: requireId(leadId),
    p_account_id: input.accountId ? requireId(input.accountId) : null,
    p_create_opportunity: input.createOpportunity,
    p_opportunity_name: input.opportunityName || null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  return { result: data as { account_id: string; contact_id: string; opportunity_id: string | null } };
}

// ---------------------------------------------------------------------
// Activities and notes (record page timeline)
// ---------------------------------------------------------------------

const LINK_KEYS = ["lead_id", "contact_id", "account_id", "opportunity_id", "case_id", "campaign_id"] as const;

function linksFrom(formData: FormData) {
  const links: Record<string, string> = {};
  for (const k of LINK_KEYS) {
    const v = formData.get(k);
    if (typeof v === "string" && UUID.test(v)) links[k] = v;
  }
  return links;
}

export async function logActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const type = String(formData.get("type") ?? "Task");
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate = String(formData.get("due_date") ?? "") || null;
  if (!["Task", "Call", "Email", "Meeting"].includes(type)) return { error: "Invalid activity type." };
  if (!subject) return { error: "Subject is required.", fieldErrors: { subject: "Subject is required." } };

  // Calls and emails are logged after they happen; tasks and meetings are planned.
  const logged = type === "Call" || type === "Email";
  const { error } = await supabase.from("activities").insert({
    org_id: org.id,
    type,
    subject,
    description,
    due_date: dueDate ?? (logged ? new Date().toISOString().slice(0, 10) : null),
    status: logged ? "Completed" : "Not Started",
    ...linksFrom(formData),
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  return {};
}

export async function setActivityDone(id: string, done: boolean): Promise<FormState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase
    .from("activities")
    .update({ status: done ? "Completed" : "Not Started" })
    .eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  return {};
}

export async function addNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  if (!title) return { error: "Title is required.", fieldErrors: { title: "Title is required." } };
  const { error } = await supabase.from("notes").insert({ org_id: org.id, title, body, ...linksFrom(formData) });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteNote(id: string): Promise<FormState> {
  const { supabase, org } = await getContext();
  const { error, count } = await supabase
    .from("notes")
    .delete({ count: "exact" })
    .eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  if (!count) return { error: "Only the note's author or an admin can delete it." };
  revalidatePath("/", "layout");
  return {};
}

// ---------------------------------------------------------------------
// Opportunity products and campaign members
// ---------------------------------------------------------------------

export async function addLineItem(opportunityId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const priceRaw = String(formData.get("unit_price") ?? "").trim();
  const discount = Number(formData.get("discount_pct") ?? 0);
  if (!UUID.test(productId)) return { error: "Choose a product." };
  if (!(quantity > 0)) return { error: "Quantity must be more than 0." };
  if (discount < 0 || discount > 100) return { error: "Discount must be between 0 and 100." };

  let unitPrice = priceRaw === "" ? NaN : Number(priceRaw);
  if (Number.isNaN(unitPrice)) {
    const { data } = await supabase.from("products").select("unit_price").eq("id", productId).single();
    unitPrice = Number(data?.unit_price ?? 0);
  }
  const { error } = await supabase.from("opportunity_line_items").insert({
    org_id: org.id,
    opportunity_id: requireId(opportunityId),
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    discount_pct: discount,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

export async function removeLineItem(id: string, opportunityId: string): Promise<FormState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("opportunity_line_items").delete().eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

export async function addCampaignMember(campaignId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const member = String(formData.get("member") ?? "");
  const [kind, memberId] = member.split(":");
  const status = String(formData.get("status") ?? "Sent");
  if (!memberId || !UUID.test(memberId) || (kind !== "lead" && kind !== "contact")) return { error: "Choose a lead or contact." };
  if (!["Sent", "Responded", "Attended"].includes(status)) return { error: "Invalid status." };
  const { error } = await supabase.from("campaign_members").insert({
    org_id: org.id,
    campaign_id: requireId(campaignId),
    [kind === "lead" ? "lead_id" : "contact_id"]: memberId,
    status,
  });
  if (error) return { error: error.code === "23505" ? "Already a member of this campaign." : friendly(error.message) };
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function removeCampaignMember(id: string, campaignId: string): Promise<FormState> {
  const { supabase, org } = await getContext();
  const { error } = await supabase.from("campaign_members").delete().eq("id", requireId(id));
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

// ---------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------

export async function switchOrg(orgId: string) {
  const { supabase } = await getContext();
  await supabase.rpc("set_active_org", { p_org_id: requireId(orgId) });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await getContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Organization name is required." };
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_seed_demo: formData.get("seed_demo") === "on",
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "SGD").trim().toUpperCase();
  if (!name) return { error: "Organization name is required." };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Currency must be a 3-letter code, like SGD." };
  const { error, count } = await supabase
    .from("organizations")
    .update({ name, currency }, { count: "exact" })
    .eq("id", org.id);
  if (error) return { error: friendly(error.message) };
  if (!count) return { error: "Only admins can change organization settings." };
  revalidatePath("/", "layout");
  return {};
}

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await getContext();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "user");
  if (!email) return { error: "Enter the user's email." };
  if (!["admin", "manager", "user"].includes(role)) return { error: "Invalid role." };
  const { error } = await supabase.rpc("add_org_member", { p_org_id: org.id, p_email: email, p_role: role });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/settings");
  return {};
}
