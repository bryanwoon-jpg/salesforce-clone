"use client";

import { useActionState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { saveRecord, type FormState } from "@/app/(app)/actions";
import { inputValue } from "@/lib/format";
import { OBJECTS, type ObjectKey } from "@/lib/objects";
import type { LookupOption } from "@/lib/lookups";

export function RecordForm({
  objectKey,
  recordId,
  values,
  lookups,
  cancelHref,
  returnTo,
}: {
  objectKey: ObjectKey;
  recordId: string | null;
  values: Record<string, unknown>;
  lookups: Record<string, LookupOption[]>;
  cancelHref: string;
  returnTo?: string;
}) {
  const def = OBJECTS[objectKey];
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveRecord.bind(null, objectKey, recordId), {});
  const errors = state.fieldErrors ?? {};

  // datetime-local has no timezone: send it as an ISO instant from the browser's zone.
  function submit(formData: FormData) {
    for (const [name, meta] of Object.entries(def.fields)) {
      if (meta.type !== "datetime" || meta.readOnly) continue;
      const v = formData.get(name);
      if (typeof v === "string" && v) formData.set(name, new Date(v).toISOString());
    }
    return formAction(formData);
  }

  const sections = def.sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => !def.fields[f]?.readOnly) }))
    .filter((s) => s.fields.length > 0);

  return (
    <form action={submit} noValidate className="card">
      <div className="border-b border-line px-6 py-4 text-center">
        <h1 className="text-lg font-semibold">{recordId ? `Edit ${def.title(values)}` : `New ${def.label}`}</h1>
      </div>

      <div className="space-y-6 px-6 py-5">
        {state.error && (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger-light px-3 py-2 text-danger">
            {state.error}
          </p>
        )}
        {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

        {sections.map((section) => (
          <fieldset key={section.title}>
            <legend className="mb-3 w-full rounded-card bg-canvas px-3 py-1.5 text-sm font-semibold">{section.title}</legend>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-1 md:grid-cols-2">
              {section.fields.map((name) => {
                const meta = def.fields[name]!;
                const id = `f-${name}`;
                const err = errors[name];
                const common = {
                  id,
                  name,
                  "aria-invalid": err ? true : undefined,
                  "aria-describedby": err ? `${id}-err` : undefined,
                  className: clsx("input", err && "border-danger focus:border-danger focus:ring-danger"),
                };
                const current = inputValue(meta, values[name]);
                return (
                  <div key={name} className={clsx(meta.wide && "md:col-span-2")}>
                    {meta.type === "boolean" ? (
                      <label className="flex h-8 items-center gap-2 pt-5">
                        <input type="checkbox" name={name} defaultChecked={current === "true"} className="size-4 accent-brand" />
                        {meta.label}
                      </label>
                    ) : (
                      <>
                        <label htmlFor={id} className="label">
                          {meta.required && <abbr title="required" className="mr-0.5 text-danger no-underline">*</abbr>}
                          {meta.label}
                        </label>
                        {meta.type === "textarea" ? (
                          <textarea {...common} rows={4} defaultValue={current} />
                        ) : meta.type === "picklist" ? (
                          <select {...common} defaultValue={current}>
                            {!meta.required && <option value="">--None--</option>}
                            {meta.options?.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : meta.type === "lookup" ? (
                          <select {...common} defaultValue={current}>
                            <option value="">--None--</option>
                            {(lookups[name] ?? [])
                              .filter((o) => !(name === "parent_account_id" && o.id === recordId))
                              .map((o) => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))}
                          </select>
                        ) : (
                          <input
                            {...common}
                            type={
                              { email: "email", phone: "tel", url: "url", date: "date", datetime: "datetime-local", number: "number", currency: "number", percent: "number" }[
                                meta.type as string
                              ] ?? "text"
                            }
                            step={meta.type === "currency" ? "0.01" : meta.type === "number" || meta.type === "percent" ? "1" : undefined}
                            min={meta.type === "currency" || meta.type === "number" || meta.type === "percent" ? 0 : undefined}
                            max={meta.type === "percent" ? 100 : undefined}
                            required={meta.required}
                            defaultValue={current}
                          />
                        )}
                        {err && (
                          <p id={`${id}-err`} className="mt-1 text-xs text-danger">
                            {err}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 flex justify-center gap-2 border-t border-line bg-surface-alt px-6 py-3">
        <Link href={cancelHref} className="btn">Cancel</Link>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
