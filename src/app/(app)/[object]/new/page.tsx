import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getObject, formFields } from "@/lib/objects";
import { lookupOptions } from "@/lib/lookups";
import { param, type SearchParams } from "@/lib/query";
import { RecordForm } from "@/components/RecordForm";

export async function generateMetadata({ params }: { params: Promise<{ object: string }> }): Promise<Metadata> {
  const def = getObject((await params).object);
  return { title: def ? `New ${def.label}` : "Not found" };
}

export default async function NewRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ object: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const def = getObject((await params).object);
  if (!def) notFound();
  const sp = await searchParams;

  // Prefill from the query string, e.g. /contacts/new?account_id=… from an account's related list.
  const values: Record<string, unknown> = {};
  for (const f of formFields(def)) {
    const v = param(sp, f);
    if (v) values[f] = v;
  }
  if (def.key === "opportunities" && !values.close_date) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    values.close_date = d.toISOString().slice(0, 10);
  }
  const returnTo = param(sp, "return_to");

  return (
    <div className="mx-auto max-w-4xl">
      <RecordForm
        objectKey={def.key}
        recordId={null}
        values={values}
        lookups={await lookupOptions(def)}
        cancelHref={returnTo && returnTo.startsWith("/") ? returnTo : `/${def.key}`}
        returnTo={returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : undefined}
      />
    </div>
  );
}
