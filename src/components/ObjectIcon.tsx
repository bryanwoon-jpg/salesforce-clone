import {
  BarChart3,
  Box,
  Briefcase,
  Building2,
  CheckSquare,
  Crown,
  Home,
  LifeBuoy,
  Megaphone,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import type { IconName } from "@/lib/objects";

const ICONS: Record<IconName, { icon: LucideIcon; tile: string }> = {
  home: { icon: Home, tile: "bg-obj-home" },
  accounts: { icon: Building2, tile: "bg-obj-accounts" },
  contacts: { icon: UserRound, tile: "bg-obj-contacts" },
  leads: { icon: Crown, tile: "bg-obj-leads" },
  opportunities: { icon: Briefcase, tile: "bg-obj-opportunities" },
  cases: { icon: LifeBuoy, tile: "bg-obj-cases" },
  activities: { icon: CheckSquare, tile: "bg-obj-activities" },
  campaigns: { icon: Megaphone, tile: "bg-obj-campaigns" },
  products: { icon: Box, tile: "bg-obj-products" },
  reports: { icon: BarChart3, tile: "bg-obj-reports" },
  settings: { icon: Settings, tile: "bg-obj-settings" },
};

const SIZES = { sm: "size-6 rounded-[3px] [&>svg]:size-3.5", md: "size-8 rounded-card [&>svg]:size-5", lg: "size-10 rounded-card [&>svg]:size-6" };

export function ObjectIcon({ name, size = "md", className }: { name: IconName; size?: keyof typeof SIZES; className?: string }) {
  const { icon: Icon, tile } = ICONS[name];
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center text-white", tile, SIZES[size], className)} aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  );
}
