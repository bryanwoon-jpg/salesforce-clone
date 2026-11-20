import type { FieldDef } from "./objects";

const LOCALE = "en-SG";

export function formatCurrency(value: unknown, currency = "SGD", compact = false): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isNaN(n) ? "" : new Intl.NumberFormat(LOCALE).format(n);
}

export function formatDate(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  // Plain dates (YYYY-MM-DD) are calendar days, not instants: avoid timezone shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });
}

/** Plain-text value for a non-lookup field. */
export function formatValue(field: FieldDef, value: unknown, currency = "SGD"): string {
  if (value === null || value === undefined || value === "") return "";
  switch (field.type) {
    case "currency":
      return formatCurrency(value, currency);
    case "number":
      return formatNumber(value);
    case "percent":
      return `${formatNumber(value)}%`;
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDateTime(value);
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

/** Value for an <input> default. */
export function inputValue(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return field.defaultValue ?? "";
  if (field.type === "datetime") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(value);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
