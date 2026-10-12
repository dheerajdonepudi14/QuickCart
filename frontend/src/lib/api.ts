import type {
  Address, AddressRequest, AdminAction, Agent, AnalyticsRange, ApiError, AuthResponse, Category, CheckoutRequest,
  CheckoutResponse, CouponView, Dashboard, DarkStore, InventoryRow, InventoryUpdateRequest, LoginRequest,
  MessageResponse, Order, Page, PaymentConfig, ProductCard, ProductDetail, ProvidersResponse, Quote, QuoteRequest,
  RegisterRequest, SortKey, StoreMatch, Suggestion, TrackingUpdate, UserResponse,
  PlatformStats, AdminUserRow, ProductImageRow, UserFilter, PaymentSession, PaymentStatus, PaymentTransactionView,
  PlaceSuggestion, GeoAddress,
} from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export class HttpError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Internal: prevents infinite refresh loops. */
  retried?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/** Single-flight refresh so a burst of 401s triggers only one /refresh-token call. */
let refreshing: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(buildUrl('/api/v1/auth/refresh-token'), { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => { refreshing = null; }, 0);
      });
  }
  return refreshing;
}

const NO_REFRESH = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh-token', '/api/v1/auth/logout'];

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, retried, headers: extraHeaders } = opts;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(extraHeaders ?? {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new HttpError(0, 'Cannot reach the QuickCart server. Is the backend running on ' + API_URL + '?');
  }

  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, { ...opts, retried: true });
  }

  if (!res.ok) {
    let payload: Partial<ApiError> = {};
    try { payload = (await res.json()) as Partial<ApiError>; } catch { /* non-JSON error */ }
    throw new HttpError(res.status, payload.message || res.statusText || 'Request failed', payload.fieldErrors);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Multipart upload (keeps the browser-generated boundary header). */
export async function uploadFile<T>(path: string, file: File, field = 'file', extra: Record<string, string> = {}): Promise<T> {
  const body = new FormData();
  body.append(field, file);
  Object.entries(extra).forEach(([k, v]) => body.append(k, v));
  const send = () => fetch(buildUrl(path), { method: 'POST', credentials: 'include', body });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = ((await res.json()) as Partial<ApiError>).message ?? msg; } catch { /* ignore */ }
    throw new HttpError(res.status, msg || 'Upload failed');
  }
  return (await res.json()) as T;
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';

/* ------------------------------ Endpoint map ------------------------------ */
export const api = {
  auth: {
    register: (b: RegisterRequest) => request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: b }),
    login: (b: LoginRequest) => request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: b }),
    logout: () => request<MessageResponse>('/api/v1/auth/logout', { method: 'POST' }),
    me: () => request<UserResponse>('/api/v1/auth/me'),
    providers: () => request<ProvidersResponse>('/api/v1/auth/providers'),
    /** Short-lived token for the STOMP CONNECT frame (refreshes the session first if needed). */
    wsToken: () => request<{ token: string; expiresInSeconds: number }>('/api/v1/auth/ws-token'),
    oauthUrl: (provider: string) => `${API_URL}/oauth2/authorization/${provider}`,
  },
  stores: {
    list: () => request<DarkStore[]>('/api/v1/stores'),
    nearest: (lat: number, lng: number) => request<StoreMatch>('/api/v1/stores/nearest', { query: { lat, lng } }),
    byPincode: (pin: string) => request<StoreMatch>(`/api/v1/stores/by-pincode/${encodeURIComponent(pin)}`),
  },
  addresses: {
    list: () => request<Address[]>('/api/v1/me/addresses'),
    create: (b: AddressRequest) => request<Address>('/api/v1/me/addresses', { method: 'POST', body: b }),
    remove: (id: number) => request<void>(`/api/v1/me/addresses/${id}`, { method: 'DELETE' }),
  },
  catalog: {
    categories: () => request<Category[]>('/api/v1/catalog/categories'),
    products: (storeId: number, p: { category?: string; q?: string; sort?: SortKey; page?: number; size?: number }) =>
      request<Page<ProductCard>>(`/api/v1/catalog/stores/${storeId}/products`, { query: p }),
    topSavers: (storeId: number, limit = 12) =>
      request<ProductCard[]>(`/api/v1/catalog/stores/${storeId}/top-savers`, { query: { limit } }),
    suggest: (storeId: number, q: string, signal?: AbortSignal) =>
      request<Suggestion[]>(`/api/v1/catalog/stores/${storeId}/suggest`, { query: { q }, signal }),
    product: (storeId: number, productId: number) =>
      request<ProductDetail>(`/api/v1/catalog/stores/${storeId}/products/${productId}`),
  },
  checkout: {
    quote: (b: QuoteRequest) => request<Quote>('/api/v1/checkout/quote', { method: 'POST', body: b }),
    coupons: () => request<CouponView[]>('/api/v1/checkout/coupons'),
    /** idempotencyKey makes retries of the same checkout return the same order. */
    place: (b: CheckoutRequest, idempotencyKey?: string) =>
      request<CheckoutResponse>('/api/v1/checkout', {
        method: 'POST',
        body: b,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }),
  },
  payments: {
    config: () => request<PaymentConfig>('/api/v1/payments/config'),
    mockConfirm: (orderId: number, success: boolean) =>
      request<Order>(`/api/v1/payments/mock/${orderId}/confirm`, { method: 'POST', body: { success } }),
    verifyStripe: (orderId: number) => request<Order>(`/api/v1/payments/stripe/${orderId}/verify`, { method: 'POST' }),
    verifyRazorpay: (orderId: number, b: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
      request<Order>(`/api/v1/payments/razorpay/${orderId}/verify`, { method: 'POST', body: b }),
    status: (orderId: number) => request<PaymentStatus>(`/api/v1/payments/${orderId}/status`),
    session: (orderId: number) => request<PaymentSession>(`/api/v1/payments/${orderId}/session`, { method: 'POST' }),
    upiSubmitted: (orderId: number, utr?: string) =>
      request<PaymentStatus>(`/api/v1/payments/upi/${orderId}/submitted`, { method: 'POST', body: { utr: utr ?? '' } }),
    transactions: (orderId: number) => request<PaymentTransactionView[]>(`/api/v1/payments/${orderId}/transactions`),
  },
  geo: {
    autocomplete: (q: string, p: { lat?: number | null; lng?: number | null; sessionToken?: string }, signal?: AbortSignal) =>
      request<PlaceSuggestion[]>('/api/v1/geo/autocomplete', { query: { q, lat: p.lat, lng: p.lng, sessionToken: p.sessionToken }, signal }),
    place: (placeId: string, sessionToken?: string) =>
      request<GeoAddress>(`/api/v1/geo/place/${encodeURIComponent(placeId)}`, { query: { sessionToken } }),
    reverse: (lat: number, lng: number, signal?: AbortSignal) => request<GeoAddress>('/api/v1/geo/reverse', { query: { lat, lng }, signal }),
  },
  orders: {
    mine: (page = 0) => request<Order[]>('/api/v1/orders', { query: { page } }),
    get: (id: number) => request<Order>(`/api/v1/orders/${id}`),
    cancel: (id: number, reason?: string) => request<Order>(`/api/v1/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
    tracking: (id: number) => request<TrackingUpdate>(`/api/v1/orders/${id}/tracking`),
  },
  delivery: {
    pushLocation: (orderId: number, latitude: number, longitude: number) =>
      request<TrackingUpdate>(`/api/v1/delivery/orders/${orderId}/location`, { method: 'POST', body: { latitude, longitude } }),
    myOrders: () => request<Order[]>('/api/v1/delivery/orders'),
    delivered: (orderId: number) => request<Order>(`/api/v1/delivery/orders/${orderId}/delivered`, { method: 'POST' }),
  },
  admin: {
    stores: () => request<DarkStore[]>('/api/v1/admin/stores'),
    inventory: (storeId: number, p: { q?: string; lowStock?: boolean; page?: number; size?: number }) =>
      request<Page<InventoryRow>>(`/api/v1/admin/stores/${storeId}/inventory`, { query: p }),
    updateInventory: (inventoryId: number, b: InventoryUpdateRequest) =>
      request<InventoryRow>(`/api/v1/admin/inventory/${inventoryId}`, { method: 'PATCH', body: b }),
    orders: (storeId: number, scope: 'live' | 'history') =>
      request<Order[]>(`/api/v1/admin/stores/${storeId}/orders`, { query: { scope } }),
    agents: (storeId: number) => request<Agent[]>(`/api/v1/admin/stores/${storeId}/agents`),
    act: (orderId: number, action: AdminAction, extra: { agentId?: number; reason?: string } = {}) =>
      request<Order>(`/api/v1/admin/orders/${orderId}/actions`, { method: 'POST', body: { action, ...extra } }),
    analytics: (storeId: number, range: AnalyticsRange) =>
      request<Dashboard>(`/api/v1/admin/stores/${storeId}/analytics`, { query: { range } }),
  },
  stats: () => request<PlatformStats>('/api/v1/stats'),
  insights: {
    users: (p: { q?: string; filter?: UserFilter; page?: number; size?: number }) =>
      request<{ content: AdminUserRow[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean }>(
        '/api/v1/admin/users', { query: p }),
    products: (p: { q?: string; missingImage?: boolean; page?: number; size?: number }) =>
      request<{ content: ProductImageRow[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean }>(
        '/api/v1/admin/products', { query: p }),
    setImage: (productId: number, imageUrl: string, variant: 'A' | 'B' = 'A') =>
      request<{ imageUrl: string }>(`/api/v1/admin/products/${productId}/image`, { method: 'PATCH', body: { imageUrl, variant } }),
    setAlt: (productId: number, alt: string) =>
      request<{ imageAlt: string }>(`/api/v1/admin/products/${productId}/image`, { method: 'PATCH', body: { alt } }),
    promote: (productId: number) => request<{ imageUrl: string }>(`/api/v1/admin/products/${productId}/image/promote`, { method: 'POST' }),
    storage: () => request<{ provider: string }>('/api/v1/admin/storage'),
    setImages: (items: { productId: number; imageUrl: string }[]) =>
      request<{ saved: number }>('/api/v1/admin/products/images', { method: 'PATCH', body: { items } }),
    uploadImage: (productId: number, file: File, variant: 'A' | 'B' = 'A') =>
      uploadFile<{ imageUrl: string }>(`/api/v1/admin/products/${productId}/image`, file, 'file', { variant }),
  },
  events: {
    images: (events: { productId: number; variant: 'A' | 'B'; type: 'impression' | 'add_to_cart' }[]) =>
      request<{ recorded: number }>('/api/v1/events/images', { method: 'POST', body: { events } }),
  },
  newsletter: (email: string) => request<MessageResponse>('/api/v1/newsletter', { method: 'POST', body: { email } }),
};
