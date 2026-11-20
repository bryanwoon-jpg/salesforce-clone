import { getContext } from "./context";
import { OBJECTS, formFields, type ObjectDef } from "./objects";

export interface LookupOption {
  id: string;
  label: string;
}

/** Options for every editable lookup field on the object, scoped to the active org. */
export async function lookupOptions(def: ObjectDef): Promise<Record<string, LookupOption[]>> {
  const { supabase, org } = await getContext();
  const fields = formFields(def).filter((f) => def.fields[f]!.type === "lookup" && def.fields[f]!.lookup);
  const entries = await Promise.all(
    fields.map(async (f) => {
      const target = OBJECTS[def.fields[f]!.lookup!];
      const { data } = await supabase
        .from(target.key)
        .select(`id,${target.titleColumns.join(",")}`)
        .eq("org_id", org.id)
        .order(target.titleColumns[target.titleColumns.length - 1]!, { ascending: true })
        .limit(500);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return [f, rows.map((r) => ({ id: r.id as string, label: target.title(r) }))] as const;
    }),
  );
  return Object.fromEntries(entries);
}
