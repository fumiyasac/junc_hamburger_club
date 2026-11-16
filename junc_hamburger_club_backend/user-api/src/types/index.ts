import { Request } from 'express';

export interface AuthPayload {
  userId: number;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface BurgerRow {
  id: number;
  category_id: number;
  category_name: string;
  category_emoji: string;
  name: string;
  description: string;
  price: string;
  image_url: string | null;
  rating: string;
  review_count: number;
  is_popular: number;
  is_available: number;
  calories: number | null;
  created_at: Date;
  updated_at: Date;
  ingredients: string | null;
  tags: string | null;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  profile_image_url: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface CartItemRow {
  id: number;
  user_id: number;
  burger_id: number;
  quantity: number;
  burger_name: string;
  burger_price: string;
  burger_image_url: string | null;
  burger_is_available: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderRow {
  id: number;
  user_id: number;
  order_number: string;
  status: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total_amount: string;
  tax_amount: string;
  notes: string | null;
  estimated_ready_at: Date | null;
  pickup_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PickupSettingsRow {
  id: number;
  store_id: number;
  slot_interval_min: number;
  slot_capacity: number;
  lead_time_min: number;
  lookahead_days: number;
  open_time: string;  // 'HH:MM:SS'
  close_time: string;
  closed_weekdays: string;  // '' or '0,6' CSV
  updated_at: Date;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  burger_id: number;
  quantity: number;
  unit_price: string;
  subtotal: string;
  burger_name: string;
  burger_image_url: string | null;
}

export type NewsCategory = 'store' | 'menu' | 'campaign' | 'app';

export interface NewsRow {
  id: number;
  title: string;
  category: NewsCategory;
  body: string;
  published_at: Date;
  created_at: Date;
  updated_at: Date;
}
