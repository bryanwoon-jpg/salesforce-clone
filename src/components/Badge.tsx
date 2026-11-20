import clsx from "clsx";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-muted border-line",
  info: "bg-brand-light text-brand-dark border-brand/20",
  success: "bg-success-light text-success border-success/20",
  warning: "bg-warning-light text-warning border-warning/20",
  danger: "bg-danger-light text-danger border-danger/20",
};

// Picklist values that carry meaning get a tone; everything else stays neutral.
const VALUE_TONES: Record<string, Tone> = {
  "Closed Won": "success",
  Converted: "success",
  Completed: "success",
  Customer: "success",
  Qualified: "success",
  Hot: "danger",
  Critical: "danger",
  Escalated: "danger",
  "Closed Lost": "danger",
  Unqualified: "danger",
  Aborted: "danger",
  High: "warning",
  Warm: "warning",
  Working: "info",
  "In Progress": "info",
  Negotiation: "info",
  Proposal: "info",
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  const t = tone ?? (typeof children === "string" ? (VALUE_TONES[children] ?? "neutral") : "neutral");
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[t])}>
      {children}
    </span>
  );
}
