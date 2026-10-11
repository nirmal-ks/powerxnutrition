export type CategorySlug =
  | "whey-protein"
  | "mass-gainer"
  | "pre-workout"
  | "creatine"
  | "amino-acids"
  | "glutamine"
  | "fat-burners"
  | "omega-3"
  | "vitamins"
  | "healthy-food";

export interface Variant {
  /** Stable id within the product, e.g. "1-kg" */
  id: string;
  /** Size / pack label shown to customers, e.g. "1 kg" */
  label: string;
  /** Flavour / variant, e.g. "Double Rich Chocolate" (empty when not applicable) */
  flavour?: string;
  price: number;
  mrp: number;
  stock: number;
  sku?: string;
  barcode?: string;
  /** Low-stock alert threshold */
  minStock?: number;
  /** Admin only — weighted-average purchase cost. Never sent to the storefront. */
  cost?: number | null;
  /** Database id of the variant (admin) */
  dbId?: string;
}

export type ImageStatus = "IMAGE_PENDING" | "REVIEW_REQUIRED" | "APPROVED";
export type PublicationStatus = "draft" | "published" | "archived";

export interface Product {
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  description: string;
  /** Approved photo: path under /public (e.g. /products/x.jpg) or a full https URL. Empty = clean placeholder. */
  image: string;
  variants: Variant[];
  featured: boolean;
  /** true when published (visible in the store) */
  active: boolean;
  sort: number;
  /** Database id (admin) */
  id?: string;
  imageStatus?: ImageStatus;
  status?: PublicationStatus;
  hsn?: string;
  /** GST % set by the owner; null = not set */
  gstRate?: number | null;
  supplierId?: string | null;
  trackExpiry?: boolean;
}

export interface CartItem {
  slug: string;
  variantId: string;
  name: string;
  brand: string;
  variantLabel: string;
  image: string;
  price: number;
  mrp: number;
  qty: number;
  maxQty: number;
}

export type PaymentMethod = "cod" | "upi" | "whatsapp" | "razorpay";
export type OrderStatus = "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "verifying" | "paid" | "refunded";

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  slug: string;
  variantId: string;
  name: string;
  variantLabel: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  /** Coupon discount in ₹ (already subtracted from total). */
  discount?: number;
  couponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** UPI transaction reference entered by the customer after paying */
  utr?: string;
  /** Customer's device location at checkout (required for COD, which is limited to a radius around the shop). */
  location?: { lat: number; lng: number; distanceKm: number };
  status: OrderStatus;
  notes?: string;
  /** Internal note — never sent to the customer. */
  adminNotes?: string;
  /** Courier / tracking info the customer can see on the Track Order page. */
  tracking?: string;
  /** Bill number once the sale is recorded in the books (stock deducted). */
  billNo?: string;
  /** Razorpay order id when paying online through the gateway. */
  gatewayOrderId?: string;
}

/** What a customer may see about their own order (no internal notes or exact location). */
export type PublicOrder = Omit<Order, "adminNotes" | "location">;

export interface Coupon {
  /** Upper-case code customers type, e.g. "FIRST10" */
  code: string;
  type: "percent" | "flat";
  /** % off (1–90) or ₹ off */
  value: number;
  /** Minimum cart subtotal in ₹ (0 = none) */
  minOrder: number;
  /** Cap for % coupons in ₹ (0 = no cap) */
  maxDiscount: number;
  /** Last valid day, "YYYY-MM-DD" (India time). Empty = never expires. */
  expiresAt?: string;
  /** Total uses allowed (0 = unlimited) */
  usageLimit: number;
  used: number;
  /** Each mobile number can use it only once */
  oncePerCustomer: boolean;
  /** Listed as a tappable offer at checkout */
  showAtCheckout: boolean;
  active: boolean;
  /** Short line shown to customers, e.g. "10% off your first order" */
  description?: string;
  createdAt: string;
}

/** Safe to send to any visitor (no usage counts). */
export type PublicCoupon = Pick<Coupon, "code" | "type" | "value" | "minOrder" | "maxDiscount" | "expiresAt" | "description">;

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  slug: string;
  name: string;
  /** 1–5 */
  rating: number;
  title?: string;
  text: string;
  createdAt: string;
  status: ReviewStatus;
  /** The mobile number has an order containing this product */
  verified: boolean;
  /** Never shown publicly — used for the verified-buyer check */
  phone?: string;
  /** Shop's public reply */
  reply?: string;
}

export type PublicReview = Omit<Review, "phone" | "status">;

export interface RatingSummary {
  average: number;
  count: number;
  /** counts for 5★ … 1★ */
  stars: [number, number, number, number, number];
}
