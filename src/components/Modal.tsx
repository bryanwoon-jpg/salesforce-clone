"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Native <dialog> modal: focus trapping and Escape handling come from the browser. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-card bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/50`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="relative border-b border-line px-6 py-4 text-center">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded p-1 text-ink-muted hover:bg-canvas" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-alt px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
