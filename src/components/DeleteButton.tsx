"use client";

import { useState, useTransition } from "react";
import { deleteRecord } from "@/app/(app)/actions";
import { Modal } from "./Modal";
import type { ObjectKey } from "@/lib/objects";

export function DeleteButton({ objectKey, recordId, label }: { objectKey: ObjectKey; recordId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn">Delete</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${label}`}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteRecord(objectKey, recordId);
                  if (res?.error) setError(res.error);
                })
              }
              className="btn btn-danger"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        {error ? <p role="alert" className="text-danger">{error}</p> : <p>Are you sure you want to delete this {label.toLowerCase()}?</p>}
      </Modal>
    </>
  );
}
