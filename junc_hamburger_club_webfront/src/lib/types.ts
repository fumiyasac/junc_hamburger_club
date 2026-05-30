export interface Category {
  id: string
  name: string
  emoji: string
  description: string | null
  displayOrder: number
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
}

export interface CartItem {
  id: string
  burgerId: string
  burgerName: string
  burgerPrice: number
  burgerImageUrl: string | null
  quantity: number
  subtotal: number
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
}

export interface Order {
  id: string
  orderNumber: string
  status: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  totalAmount: number
  taxAmount: number
  notes: string | null
  estimatedReadyAt: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
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
