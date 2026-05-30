'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setLoggedIn } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = isLogin
        ? await authApi.login(email, password)
        : await authApi.register(name, email, password)

      setLoggedIn(result.user, result.token)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-2xl font-black">JUNC Hamburger Club</h1>
          <p className="text-gray-500 mt-1">
            {isLogin ? 'ログインして注文を始めよう' : '新規会員登録'}
          </p>
        </div>

        <div className="card p-6">
          {/* Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${isLogin ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
            >
              ログイン
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${!isLogin ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold mb-1">お名前</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                  placeholder="田中 太郎"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                placeholder="tanaka@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                placeholder="8文字以上"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '処理中...' : isLogin ? 'ログイン' : '登録する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
