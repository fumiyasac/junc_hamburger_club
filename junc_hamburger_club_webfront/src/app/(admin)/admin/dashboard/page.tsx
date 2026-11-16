'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminDashboardApi, adminPickupApi } from '@/lib/api'
import { DashboardStats, AdminPickupSlotList } from '@/lib/types'
import { formatPrice, formatPickupTime, toJstDateKey } from '@/lib/utils'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function DashboardPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pickupSlots, setPickupSlots] = useState<AdminPickupSlotList | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (token) {
      adminDashboardApi.stats(token)
        .then(setStats)
        .catch(console.error)
      adminPickupApi.slots(token, toJstDateKey())
        .then(setPickupSlots)
        .catch(console.error)
    }
  }, [token])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>
  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-black mb-6">ダッシュボード</h1>

        {stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard title="本日の注文" value={stats.todayOrders} unit="件" color="bg-blue-500" />
              <StatCard title="本日の売上" value={formatPrice(stats.todayRevenue)} color="bg-primary" />
              <StatCard title="進行中の注文" value={stats.activeOrders} unit="件" color="bg-orange-500" />
              <StatCard title="総会員数" value={stats.totalUsers} unit="人" color="bg-accent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="font-bold text-lg mb-4">累計統計</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">総注文数</span>
                    <span className="font-bold">{stats.totalOrders.toLocaleString()} 件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">総売上</span>
                    <span className="font-bold">{formatPrice(stats.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">メニュー数</span>
                    <span className="font-bold">{stats.totalBurgers} 品</span>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="font-bold text-lg mb-4">人気バーガー TOP5</h2>
                <div className="space-y-3">
                  {(stats.popularBurgers ?? []).map((b, i) => (
                    <div key={b.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-400 w-5">{i + 1}</span>
                        <span className="text-sm">{b.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{b.count} 個</span>
                    </div>
                  ))}
                  {(!stats.popularBurgers || stats.popularBurgers.length === 0) && (
                    <p className="text-gray-400 text-sm">データなし</p>
                  )}
                </div>
              </div>
            </div>

            {/* 本日の受け取り予定タイムライン */}
            <div className="card p-6 mt-6">
              <h2 className="font-bold text-lg mb-4">本日の受け取り予定</h2>
              {pickupSlots === null ? (
                <p className="text-gray-400 text-sm">読み込み中...</p>
              ) : pickupSlots.closed ? (
                <p className="text-gray-400 text-sm">本日は営業時間外です (reason: {pickupSlots.closedReason})</p>
              ) : pickupSlots.slots.length === 0 ? (
                <p className="text-gray-400 text-sm">本日の枠はありません</p>
              ) : (
                <PickupTimeline slots={pickupSlots.slots} />
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        )}
      </main>
    </div>
  )
}

function PickupTimeline({ slots }: { slots: AdminPickupSlotList['slots'] }) {
  // 混雑度: 0 → 空、50%未満 → 緑、80%未満 → 黄、それ以上 → 赤
  function cellColor(reserved: number, capacity: number): string {
    if (reserved === 0) return 'bg-gray-50 text-gray-400'
    const r = reserved / capacity
    if (r < 0.5) return 'bg-green-100 text-green-800'
    if (r < 0.8) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {slots.map((slot) => (
          <div
            key={slot.startAt}
            className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-bold ${cellColor(slot.reservedCount, slot.capacity)}`}
          >
            <span>{formatPickupTime(slot.startAt)}</span>
            <span className="mt-1">
              {slot.reservedCount}/{slot.capacity}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-gray-500 flex gap-3 flex-wrap">
        <span>空: 白</span>
        <span className="text-green-700">50%未満: 緑</span>
        <span className="text-yellow-700">80%未満: 黄</span>
        <span className="text-red-700">80%以上: 赤</span>
      </div>
    </div>
  )
}

function StatCard({ title, value, unit, color }: {
  title: string
  value: string | number
  unit?: string
  color: string
}) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 ${color} rounded-xl mb-3 flex items-center justify-center`} />
      <div className="text-2xl font-black">
        {value}{unit && <span className="text-sm font-semibold text-gray-500 ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </div>
  )
}
