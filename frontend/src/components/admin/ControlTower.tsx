'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCircle2, MapPin, PackageCheck, Phone, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { AdminAction, Agent, Order, OrderStatus } from '@/lib/types';
import { formatDateTime, formatPrice, STATUS_LABEL, STATUS_TONE, timeAgo } from '@/lib/format';
import Spinner from '../ui/Spinner';
import ProductImage from '../product/ProductImage';
import { FleetMap } from '../maps';

const COLUMNS: { title: string; statuses: OrderStatus[]; tone: string }[] = [
  { title: 'New orders', statuses: ['ORDER_PLACED', 'CREATED'], tone: 'border-sky-300' },
  { title: 'Packing', statuses: ['PACKING_IN_PROGRESS'], tone: 'border-violet-300' },
  { title: 'Out for delivery', statuses: ['OUT_FOR_DELIVERY'], tone: 'border-orange-300' },
];

function OrderCard({ order, agents, onAct, busy }: { order: Order; agents: Agent[]; onAct: (o: Order, a: AdminAction, extra?: { agentId?: number; reason?: string }) => void; busy: boolean }) {
  const [agentId, setAgentId] = useState<number | ''>('');
  const free = agents.filter((a) => !a.busy);
  const units = order.items.reduce((a, i) => a + i.quantity, 0);
  return (
    <div className="animate-pop rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-extrabold">#{order.orderNumber}</p>
          <p className="text-[11px] text-ink-muted">{timeAgo(order.createdAt)} · {order.customerName ?? 'Customer'}</p>
        </div>
        <span className={clsx('chip', STATUS_TONE[order.status])}>{STATUS_LABEL[order.status]}</span>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-ink-soft">
        {order.items.slice(0, 4).map((i) => (
          <li key={i.productId} className="flex justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className="h-5 w-5 shrink-0 rounded bg-mint"><ProductImage src={i.imageUrl} alt="" size="xs" /></span><span className="truncate">{i.title}</span></span><b className="shrink-0">×{i.quantity}</b></li>
        ))}
        {order.items.length > 4 && <li className="text-[11px] text-ink-muted">+{order.items.length - 4} more items</li>}
      </ul>
      <p className="mt-2 flex items-start gap-1 text-[11px] text-ink-muted"><MapPin size={11} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{order.deliveryAddress}</span></p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-ink-muted">{units} units · {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Prepaid'}</span>
        <b>{formatPrice(order.totalAmount)}</b>
      </div>
      {order.deliveryAgentName && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700"><Bike size={12} /> {order.deliveryAgentName}</p>
      )}

      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {order.status === 'CREATED' && order.paymentMethod === 'UPI' && (
          <div className="space-y-2 rounded-lg bg-amber-50 p-2">
            <p className="text-[11px] font-semibold text-amber-800">
              Awaiting UPI payment{order.paymentReference ? ` · ref ${order.paymentReference}` : ''}. Verify ₹{order.totalAmount} in your bank / UPI app.
            </p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => onAct(order, 'verify-payment')} className="btn-primary flex-1 py-1.5"><CheckCircle2 size={13} /> Payment received</button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Why is the payment being rejected?', 'Payment not received');
                  if (reason !== null) onAct(order, 'reject-payment', { reason });
                }}
                className="btn-outline flex-1 py-1.5 text-danger"
              >
                Not received
              </button>
            </div>
          </div>
        )}
        {order.status === 'CREATED' && order.paymentMethod !== 'UPI' && (
          <p className="text-[11px] text-ink-muted">Waiting for {order.paymentMethod.replace('_', ' ').toLowerCase()} payment…</p>
        )}
        {order.status === 'ORDER_PLACED' && (
          <button disabled={busy} onClick={() => onAct(order, 'pack')} className="btn-primary w-full py-2"><PackageCheck size={14} /> Mark packed</button>
        )}
        {order.status === 'PACKING_IN_PROGRESS' && (
          <div className="flex gap-2">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')} className="input py-1.5 text-xs" aria-label="Delivery agent">
              <option value="">{free.length ? `Auto: ${free[0]?.name}` : 'No free riders'}</option>
              {free.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button disabled={busy} onClick={() => {
                const chosen = agentId || free[0]?.id;
                if (!chosen) { toast.error('All riders are busy right now'); return; }
                onAct(order, 'assign', { agentId: chosen });
              }} className="btn-primary shrink-0 px-3 py-2"><Bike size={14} /> Assign</button>
          </div>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <button disabled={busy} onClick={() => onAct(order, 'deliver')} className="btn-soft w-full py-2"><CheckCircle2 size={14} /> Mark delivered</button>
        )}
        {(order.status === 'ORDER_PLACED' || order.status === 'PACKING_IN_PROGRESS' || order.status === 'CREATED') && (
          <button
            disabled={busy}
            onClick={() => {
              const reason = window.prompt('Reason for cancellation (shown to customer):', 'Item damaged at store');
              if (reason !== null) onAct(order, 'cancel', { reason });
            }}
            className="flex w-full items-center justify-center gap-1 text-[11px] font-bold text-danger hover:underline"
          >
            <XCircle size={12} /> Cancel order
          </button>
        )}
      </div>
    </div>
  );
}

export default function ControlTower({ storeId, live, onChanged, store }: { storeId: number; live: Order[]; onChanged: (o: Order) => void; store?: { lat: number; lng: number; name: string } }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const agents = useQuery({ queryKey: ['agents', storeId], queryFn: () => api.admin.agents(storeId), refetchInterval: 15_000 });
  const history = useQuery({ queryKey: ['history', storeId], queryFn: () => api.admin.orders(storeId, 'history'), enabled: showHistory });

  const act = async (o: Order, action: AdminAction, extra: { agentId?: number; reason?: string } = {}) => {
    setBusyId(o.id);
    try {
      const updated = await api.admin.act(o.id, action, extra);
      onChanged(updated);
      toast.success(`#${o.orderNumber} → ${STATUS_LABEL[updated.status]}`);
      void qc.invalidateQueries({ queryKey: ['agents', storeId] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {store && <FleetMap store={[store.lat, store.lng]} storeName={store.name} orders={live} />}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = live.filter((o) => col.statuses.includes(o.status));
          return (
            <div key={col.title} className={clsx('rounded-2xl border-t-4 bg-[#F6F9F6] p-3', col.tone)}>
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="font-display text-sm font-bold">{col.title}</p>
                <span className="chip bg-white text-ink-soft">{list.length}</span>
              </div>
              <div className="space-y-3">
                {list.length === 0 && <p className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-muted">Nothing here</p>}
                {list.map((o) => <OrderCard key={o.id} order={o} agents={agents.data ?? []} onAct={act} busy={busyId === o.id} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-bold">Delivery fleet</p>
          <span className="text-[11px] text-ink-muted">{(agents.data ?? []).filter((a) => !a.busy).length} free / {(agents.data ?? []).length}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(agents.data ?? []).map((a) => (
            <span key={a.id} className={clsx('chip border', a.busy ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-brand-200 bg-mint text-brand-700')}>
              <Bike size={12} /> {a.name} · {a.busy ? 'On delivery' : 'Available'}
              {a.phone && <a href={`tel:${a.phone}`} className="ml-1 opacity-70 hover:opacity-100" aria-label={`Call ${a.name}`}><Phone size={11} /></a>}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <button onClick={() => setShowHistory((v) => !v)} className="font-display text-sm font-bold text-brand-700 hover:underline">
          {showHistory ? 'Hide' : 'Show'} completed & cancelled orders
        </button>
        {showHistory && (
          <div className="mt-4 overflow-x-auto">
            {history.isLoading ? <Spinner className="text-brand-500" /> : (
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[10px] uppercase text-ink-muted"><tr><th className="py-2">Order</th><th>Customer</th><th>Placed</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(history.data ?? []).map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 font-bold">#{o.orderNumber}</td>
                      <td>{o.customerName}</td>
                      <td>{formatDateTime(o.createdAt)}</td>
                      <td><span className={clsx('chip', STATUS_TONE[o.status])}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="text-right font-bold">{formatPrice(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
