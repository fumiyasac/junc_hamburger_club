'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminBurgerApi, adminOptionsApi } from '@/lib/api'
import type { Burger, OptionGroup } from '@/lib/types'

export default function AdminBurgerOptionsPage() {
  const params = useParams<{ id: string }>()
  const burgerId = params.id
  const router = useRouter()
  const { token, isLoading, isAuthenticated } = useAdminAuth()

  const [burger, setBurger] = useState<Burger | null>(null)
  const [groups, setGroups] = useState<OptionGroup[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [b, gs, link] = await Promise.all([
        adminBurgerApi.get(token, burgerId),
        adminOptionsApi.listGroups(token),
        adminOptionsApi.listBurgerGroups(token, burgerId),
      ])
      setBurger(b)
      setGroups(gs)
      setSelected(new Set(link.groupIds))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token, burgerId])

  useEffect(() => { fetchAll() }, [fetchAll])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function save() {
    if (!token) return
    setSaving(true)
    try {
      await adminOptionsApi.setBurgerGroups(token, burgerId, Array.from(selected))
      alert('保存しました')
    } catch (err) {
      alert(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <Link href="/admin/burgers" className="text-primary font-bold mb-4 inline-block hover:underline">
          ← バーガー管理に戻る
        </Link>

        <h1 className="text-2xl font-black mb-2">オプショングループ紐付け</h1>
        {burger && <p className="text-gray-600 mb-6">{burger.name}</p>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="card p-6 max-w-2xl">
            <p className="text-sm text-gray-500 mb-4">
              このバーガーで提供するオプショングループにチェックを入れてください
            </p>
            <div className="space-y-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggle(g.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{g.name}</span>
                      {g.isRequired && <span className="badge bg-primary text-white text-xs">必須</span>}
                      <span className="text-xs text-gray-500">
                        選択数 {g.minSelect}〜{g.maxSelect}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {g.options.map((o) => o.name).join(' / ') || '(オプションなし)'}
                    </div>
                  </div>
                </label>
              ))}
              {groups.length === 0 && (
                <p className="text-gray-400 text-center py-10">
                  オプショングループがまだありません
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={save}
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
