"use client";

import { Path } from "./Path";
import { useOpenConvert } from "./ConvertLead";
import type { ObjectKey, PathDef } from "@/lib/objects";

/** Path wired to the Convert dialog when shown on a lead. */
export function RecordPath(props: { objectKey: ObjectKey; recordId: string; path: PathDef; current: string }) {
  const openConvert = useOpenConvert();
  return <Path {...props} onConvert={props.objectKey === "leads" ? openConvert : undefined} />;
}
