// Object metadata: one definition per CRM object drives its list view,
// record page, form, path, related lists and search. Add a field here and
// it shows up everywhere.

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | "picklist"
  | "lookup"
  | "boolean";

export type ObjectKey =
  | "accounts"
  | "contacts"
  | "leads"
  | "opportunities"
  | "cases"
  | "activities"
  | "campaigns"
  | "products";

export interface FieldDef {
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  lookup?: ObjectKey;
  /** Shown on the record but never edited in the form (set by the database). */
  readOnly?: boolean;
  /** Form field spans both columns. */
  wide?: boolean;
  defaultValue?: string;
}

export interface RelatedListDef {
  object: ObjectKey;
  /** Column on the child object pointing at this record. */
  foreignKey: string;
  title?: string;
  columns: string[];
}

export interface PathDef {
  field: string;
  open: readonly string[];
  closed: readonly string[];
  closedLabel: string;
}

export interface ObjectDef {
  key: ObjectKey;
  label: string;
  plural: string;
  icon: IconName;
  /** Columns PostgREST uses to build the record title. */
  titleColumns: string[];
  title: (r: Record<string, unknown>) => string;
  fields: Record<string, FieldDef>;
  listColumns: string[];
  searchColumns: string[];
  filterField?: string;
  defaultSort: { column: string; ascending: boolean };
  highlights: string[];
  sections: { title: string; fields: string[] }[];
  path?: PathDef;
  related: RelatedListDef[];
  /** Column on activities/notes linking them to this object. */
  activityKey?: string;
  /** When logging an activity here, also link these lookups from the record. */
  activityInherit?: string[];
  kanban?: boolean;
}

export type IconName =
  | "home"
  | "accounts"
  | "contacts"
  | "leads"
  | "opportunities"
  | "cases"
  | "activities"
  | "campaigns"
  | "products"
  | "reports"
  | "settings";

// Picklists mirror the Postgres enums in supabase/migrations.
export const PICKLISTS = {
  account_type: ["Prospect", "Customer", "Partner", "Competitor", "Other"],
  lead_source: ["Web", "Referral", "Event", "Partner", "Advertisement", "Cold Call", "Other"],
  lead_status: ["New", "Working", "Nurturing", "Qualified", "Unqualified", "Converted"],
  lead_rating: ["Hot", "Warm", "Cold"],
  opportunity_stage: [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Proposal",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
  ],
  opportunity_type: ["New Business", "Existing Business", "Renewal"],
  case_status: ["New", "Working", "Escalated", "Closed"],
  case_priority: ["Low", "Medium", "High", "Critical"],
  case_origin: ["Email", "Phone", "Web", "Chat"],
  activity_type: ["Task", "Call", "Email", "Meeting"],
  activity_status: ["Not Started", "In Progress", "Completed", "Deferred"],
  activity_priority: ["Low", "Normal", "High"],
  campaign_type: ["Email", "Event", "Webinar", "Advertisement", "Social", "Other"],
  campaign_status: ["Planned", "In Progress", "Completed", "Aborted"],
  industry: [
    "Retail",
    "Food & Beverage",
    "Fashion",
    "Electronics",
    "Grocery",
    "Healthcare",
    "Logistics",
    "Consulting",
    "Technology",
    "Financial Services",
    "Hospitality",
    "Other",
  ],
} as const;

const fullName = (r: Record<string, unknown>) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unnamed";

const owner: FieldDef = { label: "Owner", type: "lookup", readOnly: true };
const createdAt: FieldDef = { label: "Created", type: "datetime", readOnly: true };
const updatedAt: FieldDef = { label: "Last Modified", type: "datetime", readOnly: true };

export const OBJECTS: Record<ObjectKey, ObjectDef> = {
  accounts: {
    key: "accounts",
    label: "Account",
    plural: "Accounts",
    icon: "accounts",
    titleColumns: ["name"],
    title: (r) => String(r.name ?? "Unnamed"),
    fields: {
      name: { label: "Account Name", type: "text", required: true },
      type: { label: "Type", type: "picklist", options: PICKLISTS.account_type, defaultValue: "Prospect" },
      industry: { label: "Industry", type: "picklist", options: PICKLISTS.industry },
      website: { label: "Website", type: "url" },
      phone: { label: "Phone", type: "phone" },
      annual_revenue: { label: "Annual Revenue", type: "currency" },
      employees: { label: "Employees", type: "number" },
      parent_account_id: { label: "Parent Account", type: "lookup", lookup: "accounts" },
      billing_street: { label: "Billing Street", type: "text", wide: true },
      billing_city: { label: "Billing City", type: "text" },
      billing_state: { label: "Billing State", type: "text" },
      billing_postal_code: { label: "Billing Postal Code", type: "text" },
      billing_country: { label: "Billing Country", type: "text" },
      description: { label: "Description", type: "textarea", wide: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["name", "type", "industry", "billing_city", "phone", "owner_id"],
    searchColumns: ["name", "website", "billing_city"],
    filterField: "type",
    defaultSort: { column: "name", ascending: true },
    highlights: ["type", "industry", "phone", "website", "owner_id"],
    sections: [
      {
        title: "Account Information",
        fields: ["name", "type", "industry", "parent_account_id", "website", "phone", "annual_revenue", "employees"],
      },
      {
        title: "Address Information",
        fields: ["billing_street", "billing_city", "billing_state", "billing_postal_code", "billing_country"],
      },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    related: [
      { object: "contacts", foreignKey: "account_id", columns: ["title", "email", "phone"] },
      { object: "opportunities", foreignKey: "account_id", columns: ["stage", "amount", "close_date"] },
      { object: "cases", foreignKey: "account_id", columns: ["status", "priority", "created_at"] },
    ],
    activityKey: "account_id",
  },

  contacts: {
    key: "contacts",
    label: "Contact",
    plural: "Contacts",
    icon: "contacts",
    titleColumns: ["first_name", "last_name"],
    title: fullName,
    fields: {
      salutation: { label: "Salutation", type: "picklist", options: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."] },
      first_name: { label: "First Name", type: "text" },
      last_name: { label: "Last Name", type: "text", required: true },
      account_id: { label: "Account Name", type: "lookup", lookup: "accounts" },
      title: { label: "Title", type: "text" },
      department: { label: "Department", type: "text" },
      email: { label: "Email", type: "email" },
      phone: { label: "Phone", type: "phone" },
      mobile: { label: "Mobile", type: "phone" },
      lead_source: { label: "Lead Source", type: "picklist", options: PICKLISTS.lead_source },
      birthdate: { label: "Birthdate", type: "date" },
      mailing_street: { label: "Mailing Street", type: "text", wide: true },
      mailing_city: { label: "Mailing City", type: "text" },
      mailing_country: { label: "Mailing Country", type: "text" },
      description: { label: "Description", type: "textarea", wide: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["last_name", "account_id", "title", "email", "phone", "owner_id"],
    searchColumns: ["first_name", "last_name", "email", "title"],
    filterField: "lead_source",
    defaultSort: { column: "last_name", ascending: true },
    highlights: ["title", "account_id", "phone", "email", "owner_id"],
    sections: [
      {
        title: "Contact Information",
        fields: [
          "salutation",
          "first_name",
          "last_name",
          "account_id",
          "title",
          "department",
          "email",
          "phone",
          "mobile",
          "lead_source",
          "birthdate",
        ],
      },
      { title: "Address Information", fields: ["mailing_street", "mailing_city", "mailing_country"] },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    related: [
      { object: "opportunities", foreignKey: "contact_id", columns: ["stage", "amount", "close_date"] },
      { object: "cases", foreignKey: "contact_id", columns: ["status", "priority", "created_at"] },
    ],
    activityKey: "contact_id",
    activityInherit: ["account_id"],
  },

  leads: {
    key: "leads",
    label: "Lead",
    plural: "Leads",
    icon: "leads",
    titleColumns: ["first_name", "last_name"],
    title: fullName,
    fields: {
      salutation: { label: "Salutation", type: "picklist", options: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."] },
      first_name: { label: "First Name", type: "text" },
      last_name: { label: "Last Name", type: "text", required: true },
      company: { label: "Company", type: "text", required: true },
      title: { label: "Title", type: "text" },
      email: { label: "Email", type: "email" },
      phone: { label: "Phone", type: "phone" },
      status: { label: "Lead Status", type: "picklist", options: PICKLISTS.lead_status, required: true, defaultValue: "New" },
      rating: { label: "Rating", type: "picklist", options: PICKLISTS.lead_rating },
      lead_source: { label: "Lead Source", type: "picklist", options: PICKLISTS.lead_source },
      industry: { label: "Industry", type: "picklist", options: PICKLISTS.industry },
      annual_revenue: { label: "Annual Revenue", type: "currency" },
      employees: { label: "Employees", type: "number" },
      city: { label: "City", type: "text" },
      country: { label: "Country", type: "text" },
      campaign_id: { label: "Campaign", type: "lookup", lookup: "campaigns" },
      description: { label: "Description", type: "textarea", wide: true },
      converted_at: { label: "Converted", type: "datetime", readOnly: true },
      converted_account_id: { label: "Converted Account", type: "lookup", lookup: "accounts", readOnly: true },
      converted_contact_id: { label: "Converted Contact", type: "lookup", lookup: "contacts", readOnly: true },
      converted_opportunity_id: { label: "Converted Opportunity", type: "lookup", lookup: "opportunities", readOnly: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["last_name", "company", "status", "rating", "email", "owner_id"],
    searchColumns: ["first_name", "last_name", "company", "email"],
    filterField: "status",
    defaultSort: { column: "created_at", ascending: false },
    highlights: ["title", "company", "phone", "email", "owner_id"],
    sections: [
      {
        title: "Lead Information",
        fields: ["salutation", "first_name", "last_name", "company", "title", "email", "phone", "status", "rating", "lead_source", "campaign_id"],
      },
      { title: "Company Information", fields: ["industry", "annual_revenue", "employees", "city", "country"] },
      { title: "Description", fields: ["description"] },
      {
        title: "Conversion",
        fields: ["converted_at", "converted_account_id", "converted_contact_id", "converted_opportunity_id"],
      },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    path: {
      field: "status",
      open: ["New", "Working", "Nurturing", "Qualified"],
      closed: ["Converted", "Unqualified"],
      closedLabel: "Converted",
    },
    related: [],
    activityKey: "lead_id",
  },

  opportunities: {
    key: "opportunities",
    label: "Opportunity",
    plural: "Opportunities",
    icon: "opportunities",
    titleColumns: ["name"],
    title: (r) => String(r.name ?? "Unnamed"),
    fields: {
      name: { label: "Opportunity Name", type: "text", required: true },
      account_id: { label: "Account Name", type: "lookup", lookup: "accounts" },
      contact_id: { label: "Primary Contact", type: "lookup", lookup: "contacts" },
      stage: { label: "Stage", type: "picklist", options: PICKLISTS.opportunity_stage, required: true, defaultValue: "Prospecting" },
      amount: { label: "Amount", type: "currency" },
      probability: { label: "Probability (%)", type: "percent" },
      close_date: { label: "Close Date", type: "date", required: true },
      type: { label: "Type", type: "picklist", options: PICKLISTS.opportunity_type, defaultValue: "New Business" },
      lead_source: { label: "Lead Source", type: "picklist", options: PICKLISTS.lead_source },
      campaign_id: { label: "Primary Campaign", type: "lookup", lookup: "campaigns" },
      next_step: { label: "Next Step", type: "text", wide: true },
      description: { label: "Description", type: "textarea", wide: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["name", "account_id", "stage", "amount", "close_date", "owner_id"],
    searchColumns: ["name", "next_step"],
    filterField: "stage",
    defaultSort: { column: "close_date", ascending: true },
    highlights: ["account_id", "close_date", "amount", "probability", "owner_id"],
    sections: [
      {
        title: "Opportunity Information",
        fields: ["name", "account_id", "contact_id", "type", "lead_source", "campaign_id", "close_date", "stage", "probability", "amount", "next_step"],
      },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    path: {
      field: "stage",
      open: ["Prospecting", "Qualification", "Needs Analysis", "Proposal", "Negotiation"],
      closed: ["Closed Won", "Closed Lost"],
      closedLabel: "Closed",
    },
    related: [],
    activityKey: "opportunity_id",
    activityInherit: ["account_id", "contact_id"],
    kanban: true,
  },

  cases: {
    key: "cases",
    label: "Case",
    plural: "Cases",
    icon: "cases",
    titleColumns: ["case_number", "subject"],
    title: (r) => `${r.case_number ? `#${r.case_number} ` : ""}${r.subject ?? ""}`.trim() || "Case",
    fields: {
      case_number: { label: "Case Number", type: "text", readOnly: true },
      subject: { label: "Subject", type: "text", required: true, wide: true },
      account_id: { label: "Account Name", type: "lookup", lookup: "accounts" },
      contact_id: { label: "Contact Name", type: "lookup", lookup: "contacts" },
      status: { label: "Status", type: "picklist", options: PICKLISTS.case_status, required: true, defaultValue: "New" },
      priority: { label: "Priority", type: "picklist", options: PICKLISTS.case_priority, required: true, defaultValue: "Medium" },
      origin: { label: "Case Origin", type: "picklist", options: PICKLISTS.case_origin, defaultValue: "Email" },
      type: { label: "Type", type: "picklist", options: ["Problem", "Question", "Feature Request"] },
      description: { label: "Description", type: "textarea", wide: true },
      closed_at: { label: "Closed", type: "datetime", readOnly: true },
      owner_id: owner,
      created_at: { label: "Opened", type: "datetime", readOnly: true },
      updated_at: updatedAt,
    },
    listColumns: ["case_number", "subject", "account_id", "status", "priority", "created_at"],
    searchColumns: ["subject"],
    filterField: "status",
    defaultSort: { column: "created_at", ascending: false },
    highlights: ["priority", "status", "account_id", "contact_id", "owner_id"],
    sections: [
      {
        title: "Case Information",
        fields: ["case_number", "subject", "account_id", "contact_id", "status", "priority", "origin", "type"],
      },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "closed_at", "updated_at"] },
    ],
    path: {
      field: "status",
      open: ["New", "Working", "Escalated"],
      closed: ["Closed"],
      closedLabel: "Closed",
    },
    related: [],
    activityKey: "case_id",
    activityInherit: ["account_id", "contact_id"],
  },

  activities: {
    key: "activities",
    label: "Activity",
    plural: "Activities",
    icon: "activities",
    titleColumns: ["subject"],
    title: (r) => String(r.subject ?? "Activity"),
    fields: {
      subject: { label: "Subject", type: "text", required: true, wide: true },
      type: { label: "Type", type: "picklist", options: PICKLISTS.activity_type, required: true, defaultValue: "Task" },
      status: { label: "Status", type: "picklist", options: PICKLISTS.activity_status, required: true, defaultValue: "Not Started" },
      priority: { label: "Priority", type: "picklist", options: PICKLISTS.activity_priority, required: true, defaultValue: "Normal" },
      due_date: { label: "Due Date", type: "date" },
      start_at: { label: "Start", type: "datetime" },
      end_at: { label: "End", type: "datetime" },
      lead_id: { label: "Lead", type: "lookup", lookup: "leads" },
      contact_id: { label: "Contact", type: "lookup", lookup: "contacts" },
      account_id: { label: "Account", type: "lookup", lookup: "accounts" },
      opportunity_id: { label: "Opportunity", type: "lookup", lookup: "opportunities" },
      case_id: { label: "Case", type: "lookup", lookup: "cases" },
      description: { label: "Comments", type: "textarea", wide: true },
      completed_at: { label: "Completed", type: "datetime", readOnly: true },
      owner_id: { label: "Assigned To", type: "lookup", readOnly: true },
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["subject", "type", "status", "priority", "due_date", "account_id"],
    searchColumns: ["subject", "description"],
    filterField: "status",
    defaultSort: { column: "due_date", ascending: true },
    highlights: ["type", "status", "priority", "due_date", "owner_id"],
    sections: [
      { title: "Activity Information", fields: ["subject", "type", "status", "priority", "due_date", "start_at", "end_at"] },
      { title: "Related To", fields: ["lead_id", "contact_id", "account_id", "opportunity_id", "case_id"] },
      { title: "Comments", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "completed_at", "created_at", "updated_at"] },
    ],
    related: [],
  },

  campaigns: {
    key: "campaigns",
    label: "Campaign",
    plural: "Campaigns",
    icon: "campaigns",
    titleColumns: ["name"],
    title: (r) => String(r.name ?? "Unnamed"),
    fields: {
      name: { label: "Campaign Name", type: "text", required: true },
      type: { label: "Type", type: "picklist", options: PICKLISTS.campaign_type, defaultValue: "Email" },
      status: { label: "Status", type: "picklist", options: PICKLISTS.campaign_status, required: true, defaultValue: "Planned" },
      start_date: { label: "Start Date", type: "date" },
      end_date: { label: "End Date", type: "date" },
      budgeted_cost: { label: "Budgeted Cost", type: "currency" },
      actual_cost: { label: "Actual Cost", type: "currency" },
      expected_revenue: { label: "Expected Revenue", type: "currency" },
      description: { label: "Description", type: "textarea", wide: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["name", "type", "status", "start_date", "end_date", "budgeted_cost"],
    searchColumns: ["name"],
    filterField: "status",
    defaultSort: { column: "start_date", ascending: false },
    highlights: ["type", "status", "start_date", "end_date", "expected_revenue"],
    sections: [
      { title: "Campaign Information", fields: ["name", "type", "status", "start_date", "end_date"] },
      { title: "Planning", fields: ["budgeted_cost", "actual_cost", "expected_revenue"] },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    related: [
      { object: "leads", foreignKey: "campaign_id", title: "Leads", columns: ["company", "status", "email"] },
      { object: "opportunities", foreignKey: "campaign_id", title: "Influenced Opportunities", columns: ["stage", "amount", "close_date"] },
    ],
    activityKey: "campaign_id",
  },

  products: {
    key: "products",
    label: "Product",
    plural: "Products",
    icon: "products",
    titleColumns: ["name"],
    title: (r) => String(r.name ?? "Unnamed"),
    fields: {
      name: { label: "Product Name", type: "text", required: true },
      product_code: { label: "Product Code", type: "text" },
      family: { label: "Product Family", type: "picklist", options: ["Licenses", "Services", "Hardware", "Support", "Other"] },
      unit_price: { label: "List Price", type: "currency", required: true },
      is_active: { label: "Active", type: "boolean", defaultValue: "true" },
      description: { label: "Description", type: "textarea", wide: true },
      owner_id: owner,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    listColumns: ["name", "product_code", "family", "unit_price", "is_active"],
    searchColumns: ["name", "product_code"],
    filterField: "family",
    defaultSort: { column: "name", ascending: true },
    highlights: ["product_code", "family", "unit_price", "is_active"],
    sections: [
      { title: "Product Information", fields: ["name", "product_code", "family", "unit_price", "is_active"] },
      { title: "Description", fields: ["description"] },
      { title: "System Information", fields: ["owner_id", "created_at", "updated_at"] },
    ],
    related: [],
  },
};

export const NAV_OBJECTS: ObjectKey[] = [
  "accounts",
  "contacts",
  "leads",
  "opportunities",
  "cases",
  "activities",
  "campaigns",
  "products",
];

export function getObject(key: string): ObjectDef | null {
  return (OBJECTS as Record<string, ObjectDef>)[key] ?? null;
}

/** Editable fields in form order (section order, skipping read-only). */
export function formFields(def: ObjectDef): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of def.sections) {
    for (const f of s.fields) {
      if (!seen.has(f) && !def.fields[f]?.readOnly) {
        seen.add(f);
        out.push(f);
      }
    }
  }
  return out;
}

/**
 * PostgREST select string with lookups embedded, e.g.
 * `*, account_id__ref:accounts!contacts_account_id_fkey(id,name)`.
 */
export function selectFor(def: ObjectDef, columns?: string[]): string {
  const cols = columns ?? Object.keys(def.fields);
  const parts = ["*"];
  for (const c of cols) {
    const f = def.fields[c];
    if (f?.type !== "lookup") continue;
    if (c === "owner_id") {
      parts.push(`owner_id__ref:profiles!${def.key}_owner_id_fkey(id,full_name)`);
    } else if (f.lookup) {
      const target = OBJECTS[f.lookup];
      parts.push(`${c}__ref:${target.key}!${def.key}_${c}_fkey(id,${target.titleColumns.join(",")})`);
    }
  }
  return parts.join(",");
}

/** Display text for a lookup value from its embedded reference. */
export function lookupLabel(def: ObjectDef, field: string, record: Record<string, unknown>): string | null {
  const ref = record[`${field}__ref`] as Record<string, unknown> | null | undefined;
  if (!ref) return null;
  if (field === "owner_id") return (ref.full_name as string) ?? "User";
  const target = def.fields[field]?.lookup;
  return target ? OBJECTS[target].title(ref) : null;
}
