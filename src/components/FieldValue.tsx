import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "./Badge";
import { formatValue } from "@/lib/format";
import { lookupLabel, type ObjectDef } from "@/lib/objects";

/** Renders one field of a record the way Lightning does: links for lookups, email, phone and URLs. */
export function FieldValue({
  def,
  field,
  record,
  currency,
  badge = false,
}: {
  def: ObjectDef;
  field: string;
  record: Record<string, unknown>;
  currency: string;
  badge?: boolean;
}) {
  const meta = def.fields[field];
  const value = record[field];
  if (!meta) return null;

  if (meta.type === "lookup") {
    const label = lookupLabel(def, field, record);
    if (!label) return null;
    if (field === "owner_id" || !meta.lookup) return <span>{label}</span>;
    return (
      <Link href={`/${meta.lookup}/${value}`} className="link">
        {label}
      </Link>
    );
  }
  if (value === null || value === undefined || value === "") return null;

  switch (meta.type) {
    case "email":
      return <a href={`mailto:${value}`} className="link">{String(value)}</a>;
    case "phone":
      return <a href={`tel:${String(value).replace(/\s/g, "")}`} className="link">{String(value)}</a>;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="link">
          {String(value).replace(/^https?:\/\//, "")}
        </a>
      );
    case "boolean":
      return value ? <Check className="size-4 text-success" aria-label="Yes" /> : <span className="text-ink-faint">No</span>;
    case "picklist":
      return badge ? <Badge>{String(value)}</Badge> : <span>{String(value)}</span>;
    case "textarea":
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
    default:
      return <span>{formatValue(meta, value, currency)}</span>;
  }
}
