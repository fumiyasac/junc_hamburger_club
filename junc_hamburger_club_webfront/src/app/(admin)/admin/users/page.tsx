'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminUserApi } from '@/lib/api'
import { AdminUser } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminUsersPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminUserApi.list(token)
      setUsers(result.users)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleUser(id: string) {
    if (!token) return
    try {
      await adminUserApi.toggle(token, id)
      await fetchUsers()
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
          <h1 className="text-2xl font-black">ユーザー管理</h1>
          <span className="text-gray-500 text-sm">全 {users.length} 人</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">ユーザー</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">メール</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">登録日</th>
                  <th className="text-center px-4 py-3">状態</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleUser(user.id)}
                        className="px-3 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                      >
                        {user.isActive ? '無効化' : '有効化'}
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
