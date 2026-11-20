import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/context";
import { OBJECTS, getObject, selectFor, type ObjectDef } from "@/lib/objects";
import { ObjectIcon } from "@/components/ObjectIcon";
import { FieldValue } from "@/components/FieldValue";
import { Card, EmptyState } from "@/components/Card";
import { Tabs } from "@/components/Tabs";
import { DeleteButton } from "@/components/DeleteButton";
import { RecordPath } from "@/components/RecordPath";
import { ConvertButton, ConvertLeadProvider } from "@/components/ConvertLead";
import { ActivityComposer } from "@/components/ActivityComposer";
import { ActivityTimeline, type ActivityRow } from "@/components/ActivityTimeline";
import { NotesPanel, type NoteRow } from "@/components/NotesPanel";
import { LineItems, type LineItemRow } from "@/components/LineItems";
import { CampaignMembers, type MemberRow } from "@/components/CampaignMembers";

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadRecord(def: ObjectDef, id: string) {
  const { supabase } = await getContext();
  const { data } = await supabase.from(def.key).select(selectFor(def)).eq("id", id).maybeSingle();
  return data as unknown as Row | null;
}

export async function generateMetadata({ params }: { params: Promise<{ object: string; id: string }> }): Promise<Metadata> {
  const { object, id } = await params;
  const def = getObject(object);
  if (!def || !UUID.test(id)) return { title: "Not found" };
  const record = await loadRecord(def, id);
  return { title: record ? `${def.title(record)} | ${def.label}` : "Not found" };
}

export default async function RecordPage({ params }: { params: Promise<{ object: string; id: string }> }) {
  const { object, id } = await params;
  const def = getObject(object);
  if (!def || !UUID.test(id)) notFound();
  const ctx = await getContext();
  const { supabase, org } = ctx;

  const record = await loadRecord(def, id);
  if (!record) notFound();
  const title = def.title(record);
  const currency = org.currency;

  // ---- Related data, fetched in parallel ----
  const relatedPromise = Promise.all(
    def.related.map(async (rel) => {
      const child = OBJECTS[rel.object];
      const cols = [...child.titleColumns, ...rel.columns];
      const { data, count } = await supabase
        .from(child.key)
        .select(selectFor(child, cols), { count: "exact" })
        .eq(rel.foreignKey, id)
        .order("created_at", { ascending: false })
        .limit(10);
      return { rel, child, rows: (data ?? []) as unknown as Row[], count: count ?? 0 };
    }),
  );

  const key = def.activityKey;
  const activitiesPromise = key
    ? supabase
        .from("activities")
        .select("id,type,subject,status,priority,due_date,description,completed_at,created_at")
        .eq(key, id)
        .limit(100)
    : Promise.resolve({ data: [] });
  const notesPromise = key
    ? supabase
        .from("notes")
        .select("id,title,body,created_at,author:profiles!notes_owner_id_fkey(full_name)")
        .eq(key, id)
        .order("created_at", { ascending: false })
        .limit(50)
    : Promise.resolve({ data: [] });

  const lineItemsPromise =
    def.key === "opportunities"
      ? Promise.all([
          supabase
            .from("opportunity_line_items")
            .select("id,product_id,quantity,unit_price,discount_pct,total_price,product:products(name)")
            .eq("opportunity_id", id)
            .order("created_at"),
          supabase.from("products").select("id,name,unit_price,product_code").eq("org_id", org.id).eq("is_active", true).order("name"),
        ])
      : null;

  const membersPromise =
    def.key === "campaigns"
      ? Promise.all([
          supabase
            .from("campaign_members")
            .select("id,status,lead:leads(id,first_name,last_name,company),contact:contacts(id,first_name,last_name,account:accounts!contacts_account_id_fkey(name))")
            .eq("campaign_id", id)
            .order("created_at"),
          supabase.from("leads").select("id,first_name,last_name,company").eq("org_id", org.id).neq("status", "Converted").order("last_name").limit(300),
          supabase.from("contacts").select("id,first_name,last_name").eq("org_id", org.id).order("last_name").limit(300),
        ])
      : null;

  const accountsPromise =
    def.key === "leads"
      ? supabase.from("accounts").select("id,name").eq("org_id", org.id).order("name").limit(500)
      : null;

  const [related, activitiesRes, notesRes, lineItemsRes, membersRes, accountsRes] = await Promise.all([
    relatedPromise,
    activitiesPromise,
    notesPromise,
    lineItemsPromise,
    membersPromise,
    accountsPromise,
  ]);

  const activities = (activitiesRes.data ?? []) as ActivityRow[];
  const notes: NoteRow[] = ((notesRes.data ?? []) as unknown as (NoteRow & { author: { full_name: string | null } | null })[]).map(
    (n) => ({ ...n, author: n.author?.full_name ?? null }),
  );

  // Links used when logging activities/notes from this record.
  const links: Record<string, string> = {};
  if (key) links[key] = id;
  for (const f of def.activityInherit ?? []) {
    const v = record[f];
    if (typeof v === "string") links[f] = v;
  }

  const isLead = def.key === "leads";
  const converted = isLead && record.status === "Converted";

  // ---- Details tab ----
  const details = (
    <div className="space-y-5">
      {def.sections.map((s) => (
        <section key={s.title}>
          <h3 className="mb-2 rounded-card bg-canvas px-3 py-1.5 text-sm font-semibold">{s.title}</h3>
          <dl className="grid grid-cols-1 gap-x-8 px-1 md:grid-cols-2">
            {s.fields.map((f) => (
              <div key={f} className={`border-b border-line py-2 ${def.fields[f]?.wide ? "md:col-span-2" : ""}`}>
                <dt className="text-xs text-ink-muted">{def.fields[f]?.label}</dt>
                <dd className="min-h-5 break-words">
                  <FieldValue def={def} field={f} record={record} currency={currency} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );

  // ---- Related tab ----
  const relatedCards: React.ReactNode[] = [];

  if (lineItemsRes) {
    const [items, products] = lineItemsRes;
    const rows: LineItemRow[] = ((items.data ?? []) as unknown as (LineItemRow & { product: { name: string } | null })[]).map((i) => ({
      ...i,
      product: i.product?.name ?? "Product",
    }));
    relatedCards.push(
      <Card key="products" title="Products" icon="products" count={rows.length}>
        <LineItems
          opportunityId={id}
          items={rows}
          currency={currency}
          products={(products.data ?? []).map((p) => ({
            id: p.id as string,
            label: p.product_code ? `${p.name} (${p.product_code})` : (p.name as string),
            price: Number(p.unit_price),
          }))}
        />
      </Card>,
    );
  }

  if (membersRes) {
    const [mem, leads, contacts] = membersRes;
    type M = {
      id: string;
      status: string;
      lead: { id: string; first_name: string | null; last_name: string; company: string } | null;
      contact: { id: string; first_name: string | null; last_name: string; account: { name: string } | null } | null;
    };
    const members: MemberRow[] = ((mem.data ?? []) as unknown as M[]).map((m) => {
      const p = m.lead ?? m.contact!;
      return {
        id: m.id,
        status: m.status,
        kind: m.lead ? "lead" : "contact",
        memberId: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        company: m.lead ? m.lead.company : (m.contact?.account?.name ?? null),
      };
    });
    const candidates = [
      ...(leads.data ?? []).map((l) => ({
        value: `lead:${l.id}`,
        label: `${[l.first_name, l.last_name].filter(Boolean).join(" ")} (Lead, ${l.company})`,
      })),
      ...(contacts.data ?? []).map((c) => ({
        value: `contact:${c.id}`,
        label: `${[c.first_name, c.last_name].filter(Boolean).join(" ")} (Contact)`,
      })),
    ];
    relatedCards.push(
      <Card key="members" title="Campaign Members" icon="contacts" count={members.length}>
        <CampaignMembers campaignId={id} members={members} candidates={candidates} />
      </Card>,
    );
  }

  for (const { rel, child, rows, count } of related) {
    const newHref = `/${child.key}/new?${rel.foreignKey}=${id}${
      def.key === "accounts" || !record.account_id ? "" : `&account_id=${record.account_id}`
    }&return_to=${encodeURIComponent(`/${def.key}/${id}`)}`;
    relatedCards.push(
      <Card
        key={`${rel.object}-${rel.foreignKey}`}
        title={rel.title ?? child.plural}
        icon={child.icon}
        count={count}
        actions={
          <Link href={newHref} className="btn btn-sm" aria-label={`New ${child.label}`}>
            <Plus className="size-3.5" /> New
          </Link>
        }
        footer={
          count > rows.length ? (
            <Link href={`/${child.key}`} className="link">View All</Link>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState>None yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id as string} className="py-2">
                <Link href={`/${child.key}/${r.id}`} className="link font-medium">{child.title(r)}</Link>
                <dl className="mt-0.5 grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
                  {rel.columns.map((c) => (
                    <div key={c} className="contents">
                      <dt className="text-ink-muted">{child.fields[c]?.label}:</dt>
                      <dd className="truncate">
                        <FieldValue def={child} field={c} record={r} currency={currency} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>,
    );
  }

  const tabs = relatedCards.length
    ? [
        { label: "Related", content: <div className="space-y-3">{relatedCards}</div> },
        { label: "Details", content: details },
      ]
    : [{ label: "Details", content: details }];

  const page = (
    <div className="space-y-3">
      {/* Highlights panel */}
      <section className="card">
        <div className="flex flex-wrap items-start gap-3 px-4 py-3">
          <ObjectIcon name={def.icon} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">{def.label}</p>
            <h1 className="truncate text-xl leading-tight font-bold">{title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLead && !converted && <ConvertButton />}
            <Link href={`/${def.key}/${id}/edit`} className="btn">Edit</Link>
            <DeleteButton objectKey={def.key} recordId={id} label={def.label} />
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-2 border-t border-line px-4 py-3">
          {def.highlights.map((f) => (
            <div key={f} className="min-w-0">
              <dt className="text-xs text-ink-muted">{def.fields[f]?.label}</dt>
              <dd className="max-w-64 truncate">
                <FieldValue def={def} field={f} record={record} currency={currency} badge />
              </dd>
            </div>
          ))}
        </dl>
        {converted && (
          <p className="border-t border-line bg-success-light px-4 py-2 text-success">
            This lead was converted. See the{" "}
            {typeof record.converted_contact_id === "string" && (
              <Link href={`/contacts/${record.converted_contact_id}`} className="font-semibold underline">contact</Link>
            )}
            {typeof record.converted_opportunity_id === "string" && (
              <>
                {" "}and{" "}
                <Link href={`/opportunities/${record.converted_opportunity_id}`} className="font-semibold underline">opportunity</Link>
              </>
            )}
            .
          </p>
        )}
      </section>

      {def.path && !converted && (
        <RecordPath objectKey={def.key} recordId={id} path={def.path} current={String(record[def.path.field])} />
      )}

      <div className={key ? "grid grid-cols-1 gap-3 lg:grid-cols-3" : ""}>
        <div className="card lg:col-span-2">
          <Tabs tabs={tabs} />
        </div>
        {key && (
          <aside className="space-y-3">
            <Card title="Activity" icon="activities">
              <ActivityComposer links={links} />
              <div className="mt-4 border-t border-line pt-3">
                <ActivityTimeline activities={activities} />
              </div>
            </Card>
            <Card title="Notes" count={notes.length}>
              <NotesPanel notes={notes} links={links} />
            </Card>
          </aside>
        )}
      </div>
    </div>
  );

  if (!isLead) return page;
  return (
    <ConvertLeadProvider
      leadId={id}
      company={String(record.company ?? "")}
      converted={converted}
      accounts={(accountsRes?.data ?? []).map((a) => ({ id: a.id as string, label: a.name as string }))}
    >
      {page}
    </ConvertLeadProvider>
  );
}
