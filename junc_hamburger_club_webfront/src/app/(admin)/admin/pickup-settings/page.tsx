'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminPickupApi } from '@/lib/api'
import { PickupSettings } from '@/lib/types'
import AdminSidebar from '@/components/admin/AdminSidebar'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default function AdminPickupSettingsPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const [settings, setSettings] = useState<PickupSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const s = await adminPickupApi.getSettings(token)
      setSettings(s)
    } catch (err) {
      console.error(err)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!token || !settings) return
    setSaving(true)
    setMessage(null)
    try {
      await adminPickupApi.updateSettings(token, {
        slotIntervalMin: settings.slotIntervalMin,
        slotCapacity: settings.slotCapacity,
        leadTimeMin: settings.leadTimeMin,
        lookaheadDays: settings.lookaheadDays,
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        closedWeekdays: settings.closedWeekdays,
      })
      setMessage({ kind: 'ok', text: '保存しました' })
      await load()
    } catch (err) {
      setMessage({ kind: 'err', text: String((err as Error).message ?? err) })
    } finally {
      setSaving(false)
    }
  }

  function toggleWeekday(idx: number) {
    if (!settings) return
    const current = new Set(settings.closedWeekdays.split(',').filter((s) => s))
    const key = String(idx)
    if (current.has(key)) current.delete(key); else current.add(key)
    const sorted = Array.from(current).map(Number).sort((a, b) => a - b).join(',')
    setSettings({ ...settings, closedWeekdays: sorted })
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-black mb-6">受け取り枠設定</h1>

        {!settings ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="card p-6 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="枠の間隔 (分)">
                <input
                  type="number"
                  value={settings.slotIntervalMin}
                  onChange={(e) => setSettings({ ...settings, slotIntervalMin: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="1 枠の定員 (件)">
                <input
                  type="number"
                  value={settings.slotCapacity}
                  onChange={(e) => setSettings({ ...settings, slotCapacity: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="調理リードタイム (分)">
                <input
                  type="number"
                  value={settings.leadTimeMin}
                  onChange={(e) => setSettings({ ...settings, leadTimeMin: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="予約可能日数 (当日含む)">
                <input
                  type="number"
                  value={settings.lookaheadDays}
                  onChange={(e) => setSettings({ ...settings, lookaheadDays: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="営業開始時刻">
                <input
                  type="time"
                  step="60"
                  value={settings.openTime.slice(0, 5)}
                  onChange={(e) => setSettings({ ...settings, openTime: e.target.value + ':00' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="営業終了時刻">
                <input
                  type="time"
                  step="60"
                  value={settings.closeTime.slice(0, 5)}
                  onChange={(e) => setSettings({ ...settings, closeTime: e.target.value + ':00' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
            </div>

            <div className="mt-5">
              <label className="text-sm font-bold text-gray-700 block mb-2">定休日</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const active = settings.closedWeekdays.split(',').includes(String(idx))
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleWeekday(idx)}
                      className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${
                        active
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                選択した曜日が定休日になり、受け取り枠は生成されません (現値: &quot;{settings.closedWeekdays}&quot;)
              </p>
            </div>

            {message && (
              <div
                className={`mt-5 p-3 rounded-lg text-sm ${
                  message.kind === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary px-6 py-2"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => load()}
                disabled={saving}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                変更を破棄
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-bold text-gray-700 block mb-1">{label}</label>
      {children}
    </div>
  )
}
