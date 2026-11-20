import { ObjectIcon } from "./ObjectIcon";
import type { IconName } from "@/lib/objects";

/** Lightning-style card: icon, title, optional count and actions, then body. */
export function Card({
  title,
  icon,
  count,
  actions,
  children,
  footer,
  className = "",
}: {
  title: string;
  icon?: IconName;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        {icon && <ObjectIcon name={icon} size="sm" />}
        <h2 className="flex-1 text-sm font-bold">
          {title}
          {count !== undefined && <span className="ml-1 font-normal text-ink-muted">({count})</span>}
        </h2>
        {actions}
      </header>
      <div className="px-4 pb-3">{children}</div>
      {footer && <footer className="border-t border-line px-4 py-2 text-center text-[13px]">{footer}</footer>}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-ink-muted">{children}</p>;
}
