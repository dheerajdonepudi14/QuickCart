'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { InventoryRow, InventoryUpdateRequest } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import ProductImage from '../product/ProductImage';
import Spinner from '../ui/Spinner';

const LOW = 10;

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx('relative h-5 w-9 rounded-full transition', on ? 'bg-brand-500' : 'bg-zinc-300')}
    >
      <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

function Row({ row, onSaved }: { row: InventoryRow; onSaved: (r: InventoryRow) => void }) {
  const [stock, setStock] = useState(String(row.stockQuantity));
  const [price, setPrice] = useState(String(row.salePrice));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setStock(String(row.stockQuantity)); setPrice(String(row.salePrice)); }, [row.stockQuantity, row.salePrice]);

  const dirty = Number(stock) !== row.stockQuantity || Number(price) !== Number(row.salePrice);

  const save = async (patch: InventoryUpdateRequest) => {
    setSaving(true);
    try {
      const updated = await api.admin.updateInventory(row.inventoryId, patch);
      onSaved(updated);
      toast.success(`${row.title} updated`, { duration: 1200 });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const s = Number(stock);
    const p = Number(price);
    if (!Number.isInteger(s) || s < 0) return toast.error('Stock must be a whole number ≥ 0');
    if (!(p >= 1)) return toast.error('Price must be at least ₹1');
    if (p > Number(row.mrp)) toast.warning('Sale price is above MRP');
    void save({ stockQuantity: s, salePrice: p });
  };

  const low = row.stockQuantity < LOW;
  return (
    <tr className={clsx('text-xs', low && 'bg-amber-50/40', !row.productActive && 'opacity-60')}>
      <td className="py-2.5 pl-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 rounded-md bg-mint"><ProductImage src={row.imageUrl} alt={row.title} size="xs" /></span>
          <div className="min-w-0">
            <p className="max-w-[260px] truncate font-semibold">{row.title}</p>
            <p className="text-[11px] text-ink-muted">{row.brand ? `${row.brand} · ` : ''}{row.unitQuantity}</p>
          </div>
        </div>
      </td>
      <td className="text-ink-soft">{row.categoryName}</td>
      <td className="font-bold text-brand-700">{row.soldCount}</td>
      <td>
        <div className="flex items-center gap-2">
          <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submit()} className={clsx('input w-20 py-1.5 text-xs', low && 'border-amber-300')} inputMode="numeric" aria-label="Stock quantity" />
          {row.stockQuantity === 0 ? <span className="chip bg-red-50 text-danger">OUT</span> : low ? <span className="chip bg-amber-100 text-amber-800"><AlertTriangle size={10} /> LOW</span> : null}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <span className="text-ink-muted">₹</span>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submit()} className="input w-24 py-1.5 text-xs" inputMode="decimal" aria-label="Sale price" />
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">MRP {formatPrice(row.mrp)}</p>
      </td>
      <td><Toggle on={row.available} onChange={(v) => save({ available: v })} label="Available in this store" /></td>
      <td><Toggle on={row.productActive} onChange={(v) => save({ productActive: v })} label="Product active (all stores)" /></td>
      <td className="pr-4 text-right">
        <button onClick={submit} disabled={!dirty || saving} className="btn-primary px-3 py-1.5">{saving ? <Spinner /> : <Save size={13} />} Save</button>
      </td>
    </tr>
  );
}

export default function InventoryGrid({ storeId, refreshKey }: { storeId: number; refreshKey: number }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(0);
  const debounced = useDebounced(q.trim(), 300);
  useEffect(() => setPage(0), [debounced, lowOnly, storeId]);

  const key = ['inventory', storeId, debounced, lowOnly, page, refreshKey];
  const { data, isLoading, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.inventory(storeId, { q: debounced || undefined, lowStock: lowOnly, page, size: 25 }),
    placeholderData: keepPreviousData,
  });

  const onSaved = (r: InventoryRow) => {
    qc.setQueryData(key, (old: typeof data) => old && { ...old, content: old.content.map((x) => (x.inventoryId === r.inventoryId ? r : x)) });
    void qc.invalidateQueries({ queryKey: ['analytics', storeId] });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, brand…" className="input pl-9 py-2 text-xs" />
        </div>
        <div className="flex items-center gap-4">
          {isFetching && <Spinner className="text-brand-500" />}
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <Toggle on={lowOnly} onChange={setLowOnly} label="Low stock only" /> Low stock only (&lt; {LOW})
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-mint/60 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            <tr><th className="py-2.5 pl-4">Product</th><th>Category</th><th>Sold</th><th>Stock left</th><th>Sale price</th><th>In store</th><th>Active</th><th className="pr-4" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <tr><td colSpan={8} className="py-10 text-center"><Spinner className="text-brand-500" /></td></tr>}
            {data?.content.map((r) => <Row key={r.inventoryId} row={r} onSaved={onSaved} />)}
            {data && data.content.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-ink-muted">No SKUs match.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs">
          <span className="text-ink-muted">{data.totalElements} SKUs · page {data.page + 1} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="icon-btn" aria-label="Previous page"><ChevronLeft size={14} /></button>
            <button disabled={data.last} onClick={() => setPage((p) => p + 1)} className="icon-btn" aria-label="Next page"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
