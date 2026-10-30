'use client';

import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ImagePlus, Link2, Loader2, Search, Sparkles, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { ProductImageRow } from '@/lib/types';
import { formatCount } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { bestMatch, cleanQuery, searchCommons, searchOpenFoodFacts, searchWikipedia, type ImageCandidate } from '@/lib/imageSources';
import ProductImage from '../product/ProductImage';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';

type Source = 'Commons' | 'Wikipedia' | 'Open Food Facts';

function conversion(imp: number, atc: number): string {
  return imp > 0 ? `${((atc / imp) * 100).toFixed(1)}%` : '—';
}

function Editor({ product, onClose, onSaved }: { product: ProductImageRow; onClose: () => void; onSaved: () => void }) {
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  const current = variant === 'A' ? product.imageUrl : product.imageUrlB ?? '';
  const [url, setUrl] = useState(product.hasRealImage ? product.imageUrl : '');
  const [alt, setAlt] = useState(product.imageAlt ?? product.title);
  const [query, setQuery] = useState(cleanQuery(product.title, product.brand));
  const [source, setSource] = useState<Source>(product.brand && !['Fresh', 'Fresho', 'QuickCart'].includes(product.brand) ? 'Open Food Facts' : 'Commons');
  const [results, setResults] = useState<ImageCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(variant === 'A' ? (product.hasRealImage ? product.imageUrl : '') : product.imageUrlB ?? '');
  }, [variant, product]);

  const find = async (src: Source = source, q: string = query) => {
    setLoading(true);
    setResults([]);
    try {
      const fn = src === 'Commons' ? searchCommons : src === 'Wikipedia' ? searchWikipedia : searchOpenFoodFacts;
      const r = await fn(src === 'Open Food Facts' ? `${product.brand ?? ''} ${q}`.trim() : q, 12);
      setResults(r);
      if (r.length === 0) toast.info(`No ${src} images for “${q}”. Try another source or wording.`);
    } catch {
      toast.error(`${src} is not reachable right now`);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void find(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string, close = true) => {
    setSaving(true);
    try {
      await fn();
      onSaved();
      toast.success(ok);
      if (close) onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const save = (value: string) => run(() => api.insights.setImage(product.id, value, variant), variant === 'A' ? 'Photo saved — live for every shopper' : 'Variant B saved — the A/B test is running');
  const upload = (file: File) => run(() => api.insights.uploadImage(product.id, file, variant), 'Photo uploaded & optimised');
  const saveAlt = () => run(() => api.insights.setAlt(product.id, alt), 'Alt text saved', false);
  const promote = () => run(() => api.insights.promote(product.id), 'Variant B is now the main photo');
  const endTest = () => run(() => api.insights.setImage(product.id, '', 'B'), 'A/B test ended');

  const testing = !!product.imageUrlB;
  return (
    <Modal open onClose={onClose} title={`Image · ${product.title}`} className="!max-w-3xl">
      <div className="mb-4 flex gap-1 rounded-lg bg-mint p-1 text-xs font-bold">
        {(['A', 'B'] as const).map((v) => (
          <button key={v} onClick={() => setVariant(v)} className={clsx('flex-1 rounded-md py-2', variant === v ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft')}>
            {v === 'A' ? 'Main photo (A)' : `A/B test photo (B)${testing ? ' · running' : ''}`}
          </button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-mint">
            <ProductImage src={url || current || product.imageUrl} alt={alt} size="lg" sizes="200px" />
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">{product.brand} · {product.unitQuantity}
            {product.imageWidth ? ` · ${product.imageWidth}×${product.imageHeight}px` : ''}</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={saving} className="btn-primary mt-3 w-full"><Upload size={14} /> Upload {variant === 'B' ? 'variant B' : 'photo'}</button>
          <p className="mt-1 text-center text-[10px] text-ink-muted">JPG / PNG / WEBP / AVIF · max 5 MB · resized & EXIF-stripped</p>
          {testing && (
            <div className="mt-4 rounded-lg border border-line p-3 text-[11px]">
              <p className="mb-2 font-bold">A/B results</p>
              <table className="w-full text-left">
                <thead className="text-ink-muted"><tr><th /><th>Views</th><th>Carts</th><th>CR</th></tr></thead>
                <tbody>
                  <tr><td className="font-bold">A</td><td>{formatCount(product.impressionsA)}</td><td>{formatCount(product.addToCartsA)}</td><td>{conversion(product.impressionsA, product.addToCartsA)}</td></tr>
                  <tr><td className="font-bold">B</td><td>{formatCount(product.impressionsB)}</td><td>{formatCount(product.addToCartsB)}</td><td>{conversion(product.impressionsB, product.addToCartsB)}</td></tr>
                </tbody>
              </table>
              <div className="mt-2 flex gap-2">
                <button onClick={promote} disabled={saving} className="btn-soft flex-1 px-2 py-1.5 text-[10px]">Make B main</button>
                <button onClick={endTest} disabled={saving} className="btn-outline flex-1 px-2 py-1.5 text-[10px]">End test</button>
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <label className="label" htmlFor="img-alt">Alt text (accessibility & SEO)</label>
            <div className="flex gap-2">
              <input id="img-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={250} className="input text-xs" />
              <button onClick={saveAlt} disabled={saving || !alt.trim()} className="btn-outline shrink-0">Save</button>
            </div>
          </div>
          <div>
            <label className="label">Paste an image URL ({variant === 'A' ? 'main photo' : 'variant B'})</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/product.jpg" className="input pl-9 text-xs" />
              </div>
              <button onClick={() => url.trim() && save(url.trim())} disabled={saving || !url.trim()} className="btn-soft shrink-0">{saving ? <Spinner /> : 'Save'}</button>
            </div>
          </div>
          <div>
            <label className="label">Find a free photo</label>
            <div className="mb-2 flex gap-1 rounded-lg bg-mint p-1">
              {(['Commons', 'Wikipedia', 'Open Food Facts'] as Source[]).map((s) => (
                <button key={s} onClick={() => { setSource(s); void find(s); }} className={clsx('flex-1 rounded-md py-1.5 text-[11px] font-bold', source === s ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft')}>{s}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void find(); }} className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="input text-xs" aria-label="Image search" />
              <button type="submit" className="btn-outline shrink-0"><Search size={14} /></button>
            </form>
            <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {loading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-mint" />)}
              {results.map((r) => (
                <button key={r.url} onClick={() => save(r.url)} disabled={saving} title={r.title} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-white hover:border-brand-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumb} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
                  <span className="absolute inset-x-0 bottom-0 translate-y-full bg-brand-600 py-1 text-[10px] font-bold text-white transition group-hover:translate-y-0">Use as {variant}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-muted">Commons/Wikipedia images are CC-licensed; Open Food Facts is ODbL. Credit the source in your footer or use your own photos for commercial launch.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface Match { product: ProductImageRow; candidate: ImageCandidate; keep: boolean }

function AutoMatch({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [matches, setMatches] = useState<Match[]>([]);
  const [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    setMatches([]);
    try {
      const all: ProductImageRow[] = [];
      for (let page = 0; ; page += 1) {
        const r = await api.insights.products({ missingImage: true, page, size: 200 });
        all.push(...r.content);
        if (r.last) break;
      }
      setProgress({ done: 0, total: all.length });
      let cursor = 0;
      const worker = async () => {
        while (cursor < all.length && !ctrl.signal.aborted) {
          const p = all[cursor++];
          try {
            const c = await bestMatch(p.title, p.brand, p.categorySlug, ctrl.signal);
            if (c) setMatches((m) => [...m, { product: p, candidate: c, keep: true }]);
          } catch { /* skip */ }
          setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    const items = matches.filter((m) => m.keep).map((m) => ({ productId: m.product.id, imageUrl: m.candidate.url }));
    if (!items.length) return;
    setSaving(true);
    try {
      const r = await api.insights.setImages(items);
      toast.success(`${r.saved} product images saved`);
      setMatches([]);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-sm font-bold"><Wand2 size={16} className="text-brand-600" /> Auto-match photos</p>
          <p className="text-xs text-ink-muted">Finds a free photo for every product that still shows an emoji. Review, untick bad matches, then save.</p>
        </div>
        {running ? (
          <button onClick={() => abort.current?.abort()} className="btn-outline"><Loader2 size={14} className="animate-spin" /> Stop ({progress.done}/{progress.total})</button>
        ) : (
          <button onClick={run} className="btn-primary"><Sparkles size={14} /> Auto-match missing images</button>
        )}
      </div>
      {(running || matches.length > 0) && (
        <>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mint">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <div className="mt-4 grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
            {matches.map((m, i) => (
              <button
                key={m.product.id}
                onClick={() => setMatches((all) => all.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                className={clsx('relative rounded-lg border p-2 text-left transition', m.keep ? 'border-brand-400 bg-mint/40' : 'border-line opacity-50')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.candidate.thumb} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded bg-white object-contain" />
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4">{m.product.title}</p>
                <p className="text-[9px] text-ink-muted">{m.candidate.source}</p>
                {m.keep && <CheckCircle2 size={16} className="absolute right-2 top-2 fill-white text-brand-600" />}
              </button>
            ))}
          </div>
          {!running && matches.length > 0 && (
            <button onClick={save} disabled={saving} className="btn-primary mt-4">
              {saving ? <Spinner /> : <ImagePlus size={14} />} Save {matches.filter((m) => m.keep).length} images
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function ImageManager() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductImageRow | null>(null);
  const debounced = useDebounced(q.trim(), 300);
  useEffect(() => setPage(0), [debounced, missing]);

  const key = ['admin-products', debounced, missing, page];
  const storage = useQuery({ queryKey: ['admin-storage'], queryFn: api.insights.storage, staleTime: 60_000 });
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api.insights.products({ q: debounced || undefined, missingImage: missing, page, size: 48 }),
    placeholderData: keepPreviousData,
  });

  const refreshAll = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ['products-infinite'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
    void qc.invalidateQueries({ queryKey: ['top-savers'] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-mint px-4 py-2 text-xs text-brand-800">
        <b>Storage:</b> {storage.data?.provider ?? '…'}
        <span className="text-ink-muted">· uploads are resized, EXIF-stripped and content-hashed (cache-busting); shoppers get AVIF/WebP via the image optimizer.</span>
      </div>
      <AutoMatch onDone={refreshAll} />
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="input py-2 pl-9 text-xs" />
          </div>
          <div className="flex items-center gap-3 text-xs">
            {isFetching && <Spinner className="text-brand-500" />}
            <div className="flex rounded-lg bg-mint p-1">
              {[['All products', false], ['Missing photo', true]].map(([l, v]) => (
                <button key={String(l)} onClick={() => setMissing(v as boolean)} className={clsx('rounded-md px-3 py-1.5 font-bold', missing === v ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft')}>{l as string}</button>
              ))}
            </div>
            {data && <span className="text-ink-muted">{formatCount(data.totalElements)} products</span>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {isLoading && Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-mint" />)}
          {data?.content.map((p) => (
            <button key={p.id} onClick={() => setEditing(p)} className="group rounded-lg border border-line p-2 text-left transition hover:border-brand-400 hover:shadow-card">
              <div className="relative aspect-square overflow-hidden rounded-md bg-mint">
                <ProductImage src={p.imageUrl} alt={p.title} size="md" />
                {!p.hasRealImage && <span className="absolute left-1 top-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold text-white">NO PHOTO</span>}
                {p.imageUrlB && <span className="absolute right-1 top-1 rounded bg-violet-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">A/B</span>}
                <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-1 bg-brand-600/90 py-1.5 text-[10px] font-bold text-white transition group-hover:translate-y-0"><ImagePlus size={12} /> Change</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-4">{p.title}</p>
              <p className="text-[10px] text-ink-muted">{p.categoryName}</p>
              <p className="mt-1 text-[10px] font-bold"><span className="text-brand-700">{formatCount(p.unitsSold)} sold</span> · <span className="text-ink-soft">{formatCount(p.unitsInStock)} left</span></p>
            </button>
          ))}
        </div>
        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-outline py-1.5">Prev</button>
            <span>Page {page + 1} / {data.totalPages}</span>
            <button disabled={data.last} onClick={() => setPage((p) => p + 1)} className="btn-outline py-1.5">Next</button>
          </div>
        )}
      </div>
      {editing && (
        <Editor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}
