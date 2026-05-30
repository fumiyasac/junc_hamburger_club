'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminOrderApi } from '@/lib/api'
import { AdminOrder } from '@/lib/types'
import { formatDate, formatPrice, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/lib/utils'
import AdminSidebar from '@/components/admin/AdminSidebar'

const STATUSES = ['', 'received', 'preparing', 'ready', 'completed', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  '': '全て', received: '受付済み', preparing: '調理中',
  ready: '受取可能', completed: '完了', cancelled: 'キャンセル',
}

export default function AdminOrdersPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedStatus, setSelectedStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminOrderApi.list(token, selectedStatus || undefined)
      setOrders(result.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token, selectedStatus])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function updateStatus(orderId: string, status: string) {
    if (!token) return
    try {
      await adminOrderApi.updateStatus(token, orderId, status)
      await fetchOrders()
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-black mb-6">注文管理</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                selectedStatus === s ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-bold text-lg">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      {order.userName} ({order.userEmail})
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{formatDate(order.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xl text-primary">{formatPrice(order.totalAmount)}</div>
                    <span className={`badge ${ORDER_STATUS_COLOR[order.status]} mt-1`}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-600">
                  {(order.items ?? []).map((item) => (
                    <span key={item.id} className="mr-3">{item.burgerName} ×{item.quantity}</span>
                  ))}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  {['received', 'preparing', 'ready', 'completed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(order.id, s)}
                      disabled={order.status === s}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        order.status === s
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white border border-gray-200 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-20 text-gray-400">注文がありません</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
