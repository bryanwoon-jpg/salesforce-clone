"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { addLineItem, removeLineItem, type FormState } from "@/app/(app)/actions";
import { formatCurrency, formatNumber } from "@/lib/format";

export interface LineItemRow {
  id: string;
  product_id: string;
  product: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total_price: number;
}

export function LineItems({
  opportunityId,
  items,
  products,
  currency,
}: {
  opportunityId: string;
  items: LineItemRow[];
  products: { id: string; label: string; price: number }[];
  currency: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addLineItem.bind(null, opportunityId), {});
  const [removing, startRemove] = useTransition();
  const [adding, setAdding] = useState(false);
  const [price, setPrice] = useState("");
  const prev = useRef(false);

  useEffect(() => {
    if (prev.current && !pending && !state.error) setAdding(false);
    prev.current = pending;
  }, [pending, state.error]);

  const total = items.reduce((s, i) => s + Number(i.total_price), 0);

  return (
    <div>
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="py-1.5 pr-2 font-semibold">Product</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Quantity</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Sales Price</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Discount</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Total</th>
                <th className="w-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-line">
                  <td className="py-1.5 pr-2"><Link href={`/products/${i.product_id}`} className="link">{i.product}</Link></td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(i.quantity)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(i.unit_price, currency)}</td>
                  <td className="py-1.5 pr-2 text-right">{Number(i.discount_pct) ? `${formatNumber(i.discount_pct)}%` : ""}</td>
                  <td className="py-1.5 pr-2 text-right font-medium">{formatCurrency(i.total_price, currency)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => startRemove(async () => void (await removeLineItem(i.id, opportunityId)))}
                      className="rounded p-0.5 text-ink-faint hover:text-danger"
                      aria-label={`Remove ${i.product}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-1.5 pr-2 text-right text-xs text-ink-muted">Amount (rolls up to the opportunity)</td>
                <td className="py-1.5 pr-2 text-right font-bold">{formatCurrency(total, currency)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        !adding && <p className="py-2 text-center text-ink-muted">No products yet. Adding products sets the amount automatically.</p>
      )}

      {adding ? (
        <form action={action} className="mt-3 grid grid-cols-2 gap-2 rounded-card border border-line p-3 md:grid-cols-5">
          {state.error && <p role="alert" className="col-span-full text-xs text-danger">{state.error}</p>}
          <div className="col-span-2">
            <label htmlFor="li-product" className="label">Product</label>
            <select
              id="li-product"
              name="product_id"
              required
              className="input"
              onChange={(e) => setPrice(String(products.find((p) => p.id === e.target.value)?.price ?? ""))}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="li-qty" className="label">Quantity</label>
            <input id="li-qty" name="quantity" type="number" min="1" step="1" defaultValue="1" className="input" />
          </div>
          <div>
            <label htmlFor="li-price" className="label">Sales Price</label>
            <input id="li-price" name="unit_price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="li-disc" className="label">Discount %</label>
            <input id="li-disc" name="discount_pct" type="number" min="0" max="100" step="0.01" defaultValue="0" className="input" />
          </div>
          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn btn-sm">Cancel</button>
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add Product"}</button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setAdding(true)} disabled={products.length === 0} className="btn btn-sm">Add Products</button>
        </div>
      )}
    </div>
  );
}
