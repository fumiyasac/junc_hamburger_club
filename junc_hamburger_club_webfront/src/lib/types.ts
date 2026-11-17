export interface Category {
  id: string
  name: string
  emoji: string
  description: string | null
  displayOrder: number
}

export interface Option {
  id: string
  name: string
  priceDelta: number
  isAvailable: boolean
  displayOrder: number
}

export interface OptionGroup {
  id: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  displayOrder: number
  options: Option[]
}

export interface Burger {
  id: string
  categoryId: string
  categoryName: string
  categoryEmoji: string
  name: string
  description: string
  price: number
  imageUrl: string | null
  rating: number
  reviewCount: number
  isPopular: boolean
  isAvailable: boolean
  calories: number | null
  ingredients: string[]
  tags: string[]
  // 詳細取得 (GET /burgers/:id) でのみ含まれる
  optionGroups?: OptionGroup[]
}

export interface OrderItemOptionSnapshot {
  id: string
  optionId: string | null
  groupName: string
  optionName: string
  priceDelta: number
}

export interface CartItemOption {
  id: string
  groupName: string
  name: string
  priceDelta: number
}

export interface CartItem {
  id: string
  burgerId: string
  burgerName: string
  burgerPrice: number
  burgerImageUrl: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  options: CartItemOption[]
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  tax: number
  total: number
}

export interface OrderItem {
  id: string
  burgerId: string
  burgerName: string
  burgerImageUrl: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  options?: OrderItemOptionSnapshot[]
}

export interface Order {
  id: string
  orderNumber: string
  status: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  totalAmount: number
  taxAmount: number
  notes: string | null
  estimatedReadyAt: string | null
  pickupAt: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

export interface PickupSettings {
  id: string
  storeId: string
  slotIntervalMin: number
  slotCapacity: number
  leadTimeMin: number
  lookaheadDays: number
  openTime: string          // 'HH:MM:SS'
  closeTime: string
  closedWeekdays: string    // CSV "0,6"
}

export type PickupSlotReason = 'lead_time' | 'out_of_hours' | 'full' | 'past' | 'past_lookahead'

export interface PickupSlot {
  startAt: string
  available: boolean
  remaining: number
  reason: PickupSlotReason | null
}

export interface PickupSlotList {
  date: string
  closed: boolean
  closedReason: 'closed_weekday' | 'past' | 'past_lookahead' | null
  slots: PickupSlot[]
}

// ── 管理画面向け枠サマリ ──────────────────────────────────────
// 注意: user-api の GET /pickup-slots (選択可否) と admin-api の GET /pickup-slots (生カウンタ)
// はパスは同じだが返却形状が異なる。クライアント側で混同しないよう別型を分けている。
// 詳細は docs/pickup_slot_rules.md 参照。
export interface AdminPickupSlotSummary {
  startAt: string
  reservedCount: number
  capacity: number
}

export interface AdminPickupSlotList {
  date: string
  closed: boolean
  closedReason: string | null
  slots: AdminPickupSlotSummary[]
}

export interface User {
  id: string
  name: string
  email: string
  profileImageUrl: string | null
  createdAt: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  pages: number
}

export type NewsCategory = 'store' | 'menu' | 'campaign' | 'app'

export interface NewsListItem {
  id: string
  title: string
  category: NewsCategory
  excerpt: string
  publishedAt: string
}

export interface News {
  id: string
  title: string
  category: NewsCategory
  body: string
  publishedAt: string
  createdAt: string
  updatedAt: string
}

// Admin-specific
export interface AdminUser extends User {
  isActive: boolean
  updatedAt: string
}

export interface AdminOrder extends Order {
  userId: number
  userName: string
  userEmail: string
}

export interface DashboardStats {
  totalOrders: number
  todayOrders: number
  totalRevenue: number
  todayRevenue: number
  activeOrders: number
  totalUsers: number
  totalBurgers: number
  popularBurgers: { name: string; count: number }[]
}
