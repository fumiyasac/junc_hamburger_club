// 注文ステータス遷移表 (admin-api models/order_status.go と完全同期)
// 正本: docs/error_codes.md

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  'received', 'preparing', 'ready', 'completed', 'cancelled',
] as const;

// ready からのキャンセルは不可 (調理完了のため廃棄発生、現状禁止)
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  received:  ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready:     ['completed'],
  completed: [],
  cancelled: [],
};

export function allowedNext(current: OrderStatus): OrderStatus[] {
  return allowedTransitions[current] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedNext(from).includes(to);
}

export function isValidOrderStatus(s: string): s is OrderStatus {
  return (ALL_ORDER_STATUSES as readonly string[]).includes(s);
}
