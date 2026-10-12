'use client';

import dynamic from 'next/dynamic';

const Loading = ({ h }: { h: number }) => <div className="w-full animate-pulse rounded-xl bg-mint" style={{ height: h }} />;

/** Leaflet touches `window`, so maps are client-only. */
export const TrackingMap = dynamic(() => import('./TrackingMap'), { ssr: false, loading: () => <Loading h={400} /> });
export const AddressMapPicker = dynamic(() => import('./AddressMapPicker'), { ssr: false, loading: () => <Loading h={280} /> });
export const FleetMap = dynamic(() => import('./FleetMap'), { ssr: false, loading: () => <Loading h={340} /> });
