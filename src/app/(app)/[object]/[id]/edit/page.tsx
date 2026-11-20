import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getContext } from "@/lib/context";
import { getObject } from "@/lib/objects";
import { lookupOptions } from "@/lib/lookups";
import { RecordForm } from "@/components/RecordForm";

export async function generateMetadata({ params }: { params: Promise<{ object: string }> }): Promise<Metadata> {
  const def = getObject((await params).object);
  return { title: def ? `Edit ${def.label}` : "Not found" };
}

export default async function EditRecordPage({ params }: { params: Promise<{ object: string; id: string }> }) {
  const { object, id } = await params;
  const def = getObject(object);
  if (!def || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getContext();
  const { data } = await supabase.from(def.key).select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <RecordForm
        objectKey={def.key}
        recordId={id}
        values={data as Record<string, unknown>}
        lookups={await lookupOptions(def)}
        cancelHref={`/${def.key}/${id}`}
      />
    </div>
  );
}
