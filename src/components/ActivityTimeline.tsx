import Link from "next/link";
import { CalendarDays, CheckSquare, Mail, Phone } from "lucide-react";
import clsx from "clsx";
import { formatDate } from "@/lib/format";
import { ActivityCheckbox } from "./ActivityCheckbox";

export interface ActivityRow {
  id: string;
  type: "Task" | "Call" | "Email" | "Meeting";
  subject: string;
  status: string;
  priority: string;
  due_date: string | null;
  description: string | null;
  completed_at: string | null;
  created_at: string;
}

const ICON = { Task: CheckSquare, Call: Phone, Email: Mail, Meeting: CalendarDays };
const TILE = { Task: "bg-obj-activities", Call: "bg-obj-products", Email: "bg-ink-muted", Meeting: "bg-obj-campaigns" };

function Item({ a }: { a: ActivityRow }) {
  const Icon = ICON[a.type];
  const done = a.status === "Completed";
  const overdue = !done && a.due_date && a.due_date < new Date().toISOString().slice(0, 10);
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className={clsx("relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-white", TILE[a.type])} aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {(a.type === "Task" || a.type === "Meeting") && <ActivityCheckbox id={a.id} done={done} subject={a.subject} />}
          <Link href={`/activities/${a.id}`} className={clsx("link min-w-0 flex-1 truncate font-medium", done && a.type === "Task" && "line-through")}>
            {a.subject}
          </Link>
          <span className={clsx("shrink-0 text-xs", overdue ? "font-semibold text-danger" : "text-ink-muted")}>
            {formatDate(a.due_date ?? a.completed_at ?? a.created_at)}
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          {a.type === "Call" ? "You logged a call" : a.type === "Email" ? "You sent an email" : a.type === "Meeting" ? "Event" : "Task"}
          {a.priority === "High" && !done && <span className="ml-1 text-warning">· High priority</span>}
        </p>
        {a.description && <p className="mt-1 line-clamp-2 text-xs whitespace-pre-wrap text-ink">{a.description}</p>}
      </div>
    </li>
  );
}

export function ActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  const upcoming = activities
    .filter((a) => a.status !== "Completed")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const past = activities
    .filter((a) => a.status === "Completed")
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));

  if (activities.length === 0) return <p className="py-3 text-center text-ink-muted">No activities yet. Log a call or create a task above.</p>;

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 rounded-card bg-canvas px-2 py-1 text-xs font-semibold">Upcoming &amp; Overdue</h3>
        {upcoming.length ? (
          <ol className="relative before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-line">
            {upcoming.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </ol>
        ) : (
          <p className="px-2 text-xs text-ink-muted">No next steps. To get things moving, add a task or set up a meeting.</p>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h3 className="mb-2 rounded-card bg-canvas px-2 py-1 text-xs font-semibold">Past Activities</h3>
          <ol className="relative before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-line">
            {past.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
