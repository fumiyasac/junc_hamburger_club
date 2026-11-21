// user-api src/lib/order_status.ts / admin-api models/order_status.go と完全同期
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  received:  ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready:     ['completed'],
  completed: [],
  cancelled: [],
}

export function allowedNext(current: OrderStatus): OrderStatus[] {
  return allowedTransitions[current] ?? []
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedNext(from).includes(to)
}
