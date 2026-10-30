const loaded = new Map<string, Promise<void>>();

/** Loads a third-party script once (e.g. Razorpay Checkout.js). */
export function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('No document'));
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loaded.delete(src);
      reject(new Error(`Could not load ${src}. Check your internet connection or ad-blocker.`));
    };
    document.body.appendChild(el);
  });
  loaded.set(src, p);
  return p;
}
