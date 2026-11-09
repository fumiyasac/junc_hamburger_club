// src/app/(admin)/admin/reviews/page.tsx
//
// 一覧ページの定型。既存 admin/burgers/page.tsx をベースにしている。

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminReviewApi } from '@/lib/api'
import { Review } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminReviewsPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchReviews = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminReviewApi.list(token)
      setReviews(result.reviews)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  async function deleteReview(id: string) {
    if (!token) return
    if (!confirm('このレビューを削除しますか？')) return
    try {
      await adminReviewApi.delete(token, id)
      await fetchReviews()
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
          <h1 className="text-2xl font-black">レビュー管理</h1>
          <span className="text-gray-500 text-sm">全 {reviews.length} 件</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">バーガー</th>
                  <th className="text-center px-4 py-3">評価</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">コメント</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">投稿日時</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 font-bold">{r.burgerId}</td>
                    <td className="px-4 py-3 text-center">★ {r.rating}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 max-w-md truncate">
                      {r.comment ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteReview(r.id)}
                        className="text-primary hover:underline"
                      >
                        削除
                      </button>
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
