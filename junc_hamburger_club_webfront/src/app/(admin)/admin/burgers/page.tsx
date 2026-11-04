'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminBurgerApi } from '@/lib/api'
import { Burger } from '@/lib/types'
import { formatPrice, resolveBurgerImage } from '@/lib/utils'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminBurgersPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [burgers, setBurgers] = useState<Burger[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchBurgers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminBurgerApi.list(token)
      setBurgers(result.burgers)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchBurgers() }, [fetchBurgers])

  async function toggleAvailability(id: string) {
    if (!token) return
    try {
      await adminBurgerApi.toggleAvailability(token, id)
      await fetchBurgers()
    } catch (err) {
      console.error(err)
    }
  }

  async function deleteBurger(id: string, name: string) {
    if (!token) return
    if (!confirm(`「${name}」を削除しますか？`)) return
    try {
      await adminBurgerApi.delete(token, id)
      await fetchBurgers()
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">バーガー管理</h1>
          <span className="text-gray-500 text-sm">全 {burgers.length} 品</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">商品</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">カテゴリ</th>
                  <th className="text-right px-4 py-3">価格</th>
                  <th className="text-center px-4 py-3">評価</th>
                  <th className="text-center px-4 py-3">状態</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {burgers.map((burger) => (
                  <tr key={burger.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {resolveBurgerImage(burger.id, burger.imageUrl) ? (
                            <Image src={resolveBurgerImage(burger.id, burger.imageUrl)!} alt={burger.name} fill className="object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-lg">🍔</div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold">{burger.name}</div>
                          {burger.isPopular && (
                            <span className="badge bg-primary-light text-primary text-xs">人気</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                      {burger.categoryEmoji} {burger.categoryName}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      {formatPrice(burger.price)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      ⭐ {burger.rating.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${burger.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {burger.isAvailable ? '販売中' : '停止中'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleAvailability(burger.id)}
                          className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                        >
                          {burger.isAvailable ? '停止' : '再開'}
                        </button>
                        <button
                          onClick={() => deleteBurger(burger.id, burger.name)}
                          className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
