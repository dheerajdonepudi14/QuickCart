import L from 'leaflet';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Rounded label pin, e.g. "🏬 QuickCart Koramangala". */
export function pillPin(emoji: string, label: string, dotColor: string): L.DivIcon {
  return L.divIcon({
    className: 'qc-divicon',
    html: `<div class="qc-pin"><span class="qc-dot" style="background:${dotColor}">${emoji}</span>${esc(label)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function riderPin(): L.DivIcon {
  return L.divIcon({
    className: 'qc-divicon qc-moving',
    html: '<div class="qc-rider">🛵</div>',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
