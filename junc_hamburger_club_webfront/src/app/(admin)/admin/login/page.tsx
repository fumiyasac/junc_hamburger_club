'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminAuthApi } from '@/lib/api'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setLoggedIn } = useAdminAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await adminAuthApi.login(email, password)
      setLoggedIn(result.token)
      router.push('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚙️</div>
          <h1 className="text-2xl font-black text-white">JUNC Admin</h1>
          <p className="text-gray-400 text-sm mt-1">管理者ログイン</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1 text-gray-300">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                placeholder="admin@junc-hamburger.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-gray-300">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/30 p-3 rounded-xl">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
