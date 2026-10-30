/* Data contracts mirroring the Spring Boot DTOs (com.quickcommerce.dto.*). BigDecimal travels as number. */

export type Role = 'ROLE_CUSTOMER' | 'ROLE_STORE_ADMIN' | 'ROLE_DELIVERY_PARTNER';

export interface ApiError {
  timestamp?: string;
  status: number;
  error?: string;
  message: string;
  path?: string;
  fieldErrors?: Record<string, string>;
}

/* ---------- Auth ---------- */
export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: Role;
  provider: string;
  storeId?: number | null;
  storeName?: string | null;
}
export interface AuthResponse { user: UserResponse; accessTokenExpiresInSeconds: number }
export interface RegisterRequest { fullName: string; email: string; phoneNumber?: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface ProvidersResponse { oauthProviders: string[] }
export interface MessageResponse { message: string }

/* ---------- Stores & addresses ---------- */
export interface DarkStore {
  id: number;
  storeCode: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
}
export interface StoreMatch {
  store: DarkStore;
  distanceKm: number;
  etaMinutes: number;
  serviceable: boolean;
  locationLabel: string;
}
export interface AddressRequest {
  label?: string;
  contactName?: string;
  contactPhone?: string;
  /** Flat / house no. + building */
  line1: string;
  /** Street / area */
  line2?: string;
  locality?: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  geocodeSource?: string | null;
  makeDefault: boolean;
}
export interface Address {
  id: number;
  label?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  line1: string;
  line2?: string | null;
  locality?: string | null;
  landmark?: string | null;
  city: string;
  state?: string | null;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  fullText: string;
  formattedAddress?: string | null;
  geocodeSource?: string | null;
  warning?: string | null;
}

/* ---------- Geo (autocomplete / geocoding proxy) ---------- */
export interface PlaceSuggestion {
  id: string;
  primaryText: string;
  secondaryText: string;
  latitude?: number | null;
  longitude?: number | null;
  source: 'google' | 'photon';
}
export interface GeoAddress {
  line1?: string | null;
  line2?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
  source: string;
  placeId?: string | null;
}

/* ---------- Catalog ---------- */
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  department: string;
  themeColor?: string | null;
}
export interface ProductCard {
  id: number;
  title: string;
  brand?: string | null;
  unitQuantity: string;
  mrp: number;
  salePrice: number;
  discountPercent: number;
  imageUrl: string;
  rating: number;
  categorySlug: string;
  categoryName: string;
  stockQuantity: number;
  stockStatus: StockStatus;
  badges: string[];
  /** Units sold at this dark store. stockQuantity is what's left of the store's limit. */
  soldCount: number;
  imageAlt?: string | null;
  /** Optional A/B test photo. */
  imageUrlB?: string | null;
}
export interface ProductDetail {
  product: ProductCard;
  description?: string | null;
  attributes?: Record<string, unknown> | null;
  frequentlyBoughtTogether: ProductCard[];
  similar: ProductCard[];
}
export interface Suggestion {
  id: number;
  title: string;
  brand?: string | null;
  imageUrl: string;
  categoryName: string;
  salePrice: number;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
export type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name' | 'discount';

/* ---------- Cart / checkout ---------- */
export interface CartItemRequest { productId: number; quantity: number }
export interface QuoteRequest {
  storeId: number;
  items: CartItemRequest[];
  couponCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
export interface QuoteLine {
  productId: number;
  title: string;
  imageUrl: string;
  unitQuantity: string;
  mrp: number;
  unitPrice: number;
  requestedQuantity: number;
  availableQuantity: number;
  lineTotal: number;
  inStock: boolean;
}
export interface CouponResult { code: string; applied: boolean; message: string; discount: number }
export interface Quote {
  lines: QuoteLine[];
  itemsMrp: number;
  subtotal: number;
  productSavings: number;
  couponDiscount: number;
  deliveryFee: number;
  handlingFee: number;
  total: number;
  amountForFreeDelivery: number;
  coupon?: CouponResult | null;
  allInStock: boolean;
  etaMinutes: number;
}
export interface CouponView {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minCartValue: number;
  maxDiscount?: number | null;
}
export type PaymentMethod = 'RAZORPAY' | 'PHONEPE' | 'UPI' | 'STRIPE' | 'MOCK_ONLINE' | 'CASH_ON_DELIVERY';
export interface CheckoutRequest {
  storeId: number;
  items: CartItemRequest[];
  couponCode?: string | null;
  addressId?: number | null;
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  paymentMethod: PaymentMethod;
}
export type PaymentMode = 'STRIPE' | 'RAZORPAY' | 'PHONEPE' | 'UPI' | 'MOCK' | 'NONE';
export interface RazorpayCheckout {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefillName?: string | null;
  prefillEmail?: string | null;
  prefillContact?: string | null;
  themeColor: string;
  preferredMethod?: 'upi' | null;
  testMode: boolean;
}
export interface PhonePeCheckout { redirectUrl: string; merchantOrderId: string; sandbox: boolean }
export interface UpiCheckout {
  uri: string;
  appUris: Record<string, string>;
  vpa: string;
  payeeName: string;
  amount: number;
  reference: string;
  sandboxAutoConfirm: boolean;
}
export interface PaymentSession {
  mode: PaymentMode;
  gateway: string;
  stripeClientSecret?: string | null;
  razorpay?: RazorpayCheckout | null;
  phonepe?: PhonePeCheckout | null;
  upi?: UpiCheckout | null;
  expiresAt?: string | null;
}
export interface CheckoutResponse {
  order: Order;
  paymentMode: PaymentMode;
  stripeClientSecret?: string | null;
  reservationExpiresAt?: string | null;
  payment: PaymentSession;
}
export interface PaymentConfig {
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayTestMode: boolean;
  razorpayKeyId?: string | null;
  phonepeEnabled: boolean;
  phonepeSandbox: boolean;
  upiEnabled: boolean;
  upiMode: 'RAZORPAY' | 'DIRECT' | 'DISABLED';
  mockEnabled: boolean;
  codEnabled: boolean;
}
export interface PaymentStatus {
  orderId: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentMethod: PaymentMethod;
  gateway: string;
  paymentState?: string | null;
  refundStatus?: string | null;
  message?: string | null;
  reservationExpiresAt?: string | null;
}
export interface PaymentTransactionView {
  id: number;
  gateway: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  status: string;
  amount: number;
  refundId?: string | null;
  refundAmount?: number | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Orders ---------- */
export type OrderStatus =
  | 'CREATED'
  | 'ORDER_PLACED'
  | 'PACKING_IN_PROGRESS'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'CANCELLED';
export interface OrderItem {
  productId: number;
  title: string;
  imageUrl: string;
  unitQuantity: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}
export interface StatusEvent { status: OrderStatus; note?: string | null; at: string }
export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  handlingFee: number;
  totalAmount: number;
  couponCode?: string | null;
  deliveryAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  storeId: number;
  storeName: string;
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  riderLatitude?: number | null;
  riderLongitude?: number | null;
  riderLocationAt?: string | null;
  deliveryAgentName?: string | null;
  deliveryAgentPhone?: string | null;
  deliveryLandmark?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  paymentReference?: string | null;
  refundStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
  paidAt?: string | null;
  deliveredAt?: string | null;
  reservationExpiresAt?: string | null;
  cancelReason?: string | null;
  items: OrderItem[];
  timeline: StatusEvent[];
}
export interface TrackingUpdate {
  orderId: number;
  status: OrderStatus;
  riderLatitude?: number | null;
  riderLongitude?: number | null;
  distanceRemainingKm?: number | null;
  etaMinutes?: number | null;
  agentName?: string | null;
  at: string;
  /** When the rider's GPS fix was taken — used for stale-location warnings. */
  locationAt?: string | null;
}

/* ---------- Admin ---------- */
export interface InventoryRow {
  inventoryId: number;
  productId: number;
  title: string;
  brand?: string | null;
  imageUrl: string;
  categoryName: string;
  unitQuantity: string;
  mrp: number;
  salePrice: number;
  stockQuantity: number;
  available: boolean;
  productActive: boolean;
  lowStock: boolean;
  soldCount: number;
}
export interface InventoryUpdateRequest {
  stockQuantity?: number;
  salePrice?: number;
  available?: boolean;
  productActive?: boolean;
}
export interface LowStockAlert { storeId: number; productId: number; title: string; stockQuantity: number }
export interface Agent { id: number; name: string; phone?: string | null; busy: boolean }
export interface RevenuePoint { period: string; revenue: number; orders: number }
export interface TopSku { productId: number; title: string; imageUrl: string; units: number; revenue: number }
export interface Dashboard {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  activeOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  series: RevenuePoint[];
  topSkus: TopSku[];
}
export type AdminAction = 'pack' | 'assign' | 'deliver' | 'cancel' | 'verify-payment' | 'reject-payment';
export type AnalyticsRange = 'daily' | 'weekly' | 'monthly';

/* ---------- Stats / insights ---------- */
export interface PlatformStats {
  registeredUsers: number;
  activeSessions: number;
  loginsToday: number;
  newUsersToday: number;
  products: number;
  categories: number;
  darkStores: number;
  unitsSold: number;
  unitsInStock: number;
  outOfStockSkus: number;
  ordersPlaced: number;
  ordersDelivered: number;
  generatedAt: string;
}
export interface AdminUserRow {
  id: number;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: Role;
  provider: string;
  createdAt: string;
  lastLoginAt?: string | null;
  loginCount: number;
  loggedIn: boolean;
  orders: number;
  totalSpent: number;
}
export interface ProductImageRow {
  id: number;
  title: string;
  brand?: string | null;
  categoryName: string;
  categorySlug: string;
  unitQuantity: string;
  imageUrl: string;
  hasRealImage: boolean;
  unitsSold: number;
  unitsInStock: number;
  imageAlt?: string | null;
  imageUrlB?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  impressionsA: number;
  addToCartsA: number;
  impressionsB: number;
  addToCartsB: number;
}
export type UserFilter = 'all' | 'loggedIn' | 'customers';
