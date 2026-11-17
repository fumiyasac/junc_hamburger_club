'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminOrderApi } from '@/lib/api'
import { AdminOrder } from '@/lib/types'
import { formatDate, formatPickupTime, formatPrice, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, toJstDateKey } from '@/lib/utils'
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
  const [pickupDate, setPickupDate] = useState('') // '' = 全日
  const [sort, setSort] = useState<'created_at' | 'pickup_at'>('created_at')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminOrderApi.list(token, {
        status: selectedStatus || undefined,
        pickupDate: pickupDate || undefined,
        sort,
      })
      setOrders(result.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token, selectedStatus, pickupDate, sort])

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

  // "受け取り時刻を過ぎても ready/completed になっていない" = 強調対象
  function isOverdue(order: AdminOrder): boolean {
    if (!order.pickupAt) return false
    if (order.status === 'ready' || order.status === 'completed' || order.status === 'cancelled') return false
    return new Date(order.pickupAt).getTime() < Date.now()
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-black mb-6">注文管理</h1>

        {/* ステータスフィルタ */}
        <div className="flex gap-2 mb-4 flex-wrap">
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

        {/* 受け取り日フィルタ + ソート */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <label className="text-sm text-gray-600">受け取り日:</label>
          <input
            type="date"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          {pickupDate && (
            <button onClick={() => setPickupDate('')} className="text-xs text-gray-500 hover:underline">
              クリア
            </button>
          )}
          <button
            onClick={() => setPickupDate(toJstDateKey())}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            本日
          </button>
          <span className="mx-2 text-gray-300">|</span>
          <label className="text-sm text-gray-600">並び順:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'created_at' | 'pickup_at')}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="created_at">受付時刻 (新しい順)</option>
            <option value="pickup_at">受け取り時刻 (早い順)</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const overdue = isOverdue(order)
              return (
                <div
                  key={order.id}
                  className={`card p-5 ${overdue ? 'bg-red-50 border-2 border-red-300' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-lg">{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {order.userName} ({order.userEmail})
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        受付: {formatDate(order.createdAt)}
                      </div>
                      {order.pickupAt && (
                        <div className={`text-sm mt-1 font-bold ${overdue ? 'text-red-600' : 'text-primary'}`}>
                          🕒 受け取り予定: {formatDate(order.pickupAt)} ({formatPickupTime(order.pickupAt)})
                          {overdue && <span className="ml-2 text-xs">超過</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xl text-primary">{formatPrice(order.totalAmount)}</div>
                      <span className={`badge ${ORDER_STATUS_COLOR[order.status]} mt-1`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600 space-y-1">
                    {(order.items ?? []).map((item) => (
                      <div key={item.id}>
                        <span className="font-semibold">{item.burgerName} ×{item.quantity}</span>
                        {item.options && item.options.length > 0 && (
                          <ul className="ml-4 text-xs text-gray-500">
                            {item.options.map((o) => (
                              <li key={o.id}>
                                └ {o.groupName}: {o.optionName}
                                {o.priceDelta > 0 && ` (+${Math.round(o.priceDelta)}円)`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
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
              )
            })}
            {orders.length === 0 && (
              <div className="text-center py-20 text-gray-400">注文がありません</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
