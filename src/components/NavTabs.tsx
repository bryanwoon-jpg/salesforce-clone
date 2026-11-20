"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export interface NavItem {
  href: string;
  label: string;
}

export function NavTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex h-10 items-stretch overflow-x-auto border-b-[3px] border-brand bg-surface px-2 shadow-card">
      <span className="mr-4 hidden items-center px-2 text-base font-semibold whitespace-nowrap md:flex">Sales</span>
      {items.map((item) => {
        const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex items-center px-3 whitespace-nowrap hover:bg-canvas",
              active ? "font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[3px] after:bg-brand-dark" : "text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
