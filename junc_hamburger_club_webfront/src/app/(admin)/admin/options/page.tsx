'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { adminOptionsApi } from '@/lib/api'
import type { OptionGroup } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

type GroupForm = {
  id: string | null
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  displayOrder: number
}

type OptionForm = {
  id: string | null
  groupId: string
  name: string
  priceDelta: number
  isAvailable: boolean
  displayOrder: number
}

const emptyGroup: GroupForm = { id: null, name: '', isRequired: false, minSelect: 0, maxSelect: 1, displayOrder: 0 }
const emptyOption = (groupId: string): OptionForm => ({
  id: null, groupId, name: '', priceDelta: 0, isAvailable: true, displayOrder: 0,
})

export default function AdminOptionsPage() {
  const { token, isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()
  const [groups, setGroups] = useState<OptionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null)
  const [optionForm, setOptionForm] = useState<OptionForm | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin/login')
  }, [isLoading, isAuthenticated, router])

  const fetchGroups = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await adminOptionsApi.listGroups(token)
      setGroups(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  async function saveGroup() {
    if (!token || !groupForm) return
    if (groupForm.minSelect > groupForm.maxSelect) {
      alert('最小選択数は最大選択数以下にしてください')
      return
    }
    const payload = {
      name: groupForm.name,
      isRequired: groupForm.isRequired,
      minSelect: groupForm.minSelect,
      maxSelect: groupForm.maxSelect,
      displayOrder: groupForm.displayOrder,
    }
    try {
      if (groupForm.id) await adminOptionsApi.updateGroup(token, groupForm.id, payload)
      else await adminOptionsApi.createGroup(token, payload)
      setGroupForm(null)
      await fetchGroups()
    } catch (err) {
      alert(String(err))
    }
  }

  async function saveOption() {
    if (!token || !optionForm) return
    if (optionForm.priceDelta < 0) {
      alert('価格差分は 0 以上にしてください')
      return
    }
    const payload = {
      groupId: optionForm.groupId,
      name: optionForm.name,
      priceDelta: optionForm.priceDelta,
      isAvailable: optionForm.isAvailable,
      displayOrder: optionForm.displayOrder,
    }
    try {
      if (optionForm.id) await adminOptionsApi.updateOption(token, optionForm.id, payload)
      else await adminOptionsApi.createOption(token, payload)
      setOptionForm(null)
      await fetchGroups()
    } catch (err) {
      alert(String(err))
    }
  }

  async function toggleOption(id: string) {
    if (!token) return
    try {
      await adminOptionsApi.toggleAvailability(token, id)
      await fetchGroups()
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
          <h1 className="text-2xl font-black">オプション管理</h1>
          <button
            onClick={() => setGroupForm({ ...emptyGroup })}
            className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark"
          >
            + グループ追加
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-black text-lg">{g.name}</h2>
                      {g.isRequired && <span className="badge bg-primary text-white text-xs">必須</span>}
                      <span className="text-xs text-gray-500">
                        選択数 {g.minSelect}〜{g.maxSelect} / 表示順 {g.displayOrder}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGroupForm({
                        id: g.id, name: g.name, isRequired: g.isRequired,
                        minSelect: g.minSelect, maxSelect: g.maxSelect, displayOrder: g.displayOrder,
                      })}
                      className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => setOptionForm(emptyOption(g.id))}
                      className="px-2 py-1 text-xs rounded-lg bg-primary-light text-primary-dark font-medium"
                    >
                      + オプション追加
                    </button>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">名称</th>
                      <th className="text-right px-3 py-2">価格差分</th>
                      <th className="text-center px-3 py-2">表示順</th>
                      <th className="text-center px-3 py-2">在庫</th>
                      <th className="text-center px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.options.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{o.name}</td>
                        <td className="px-3 py-2 text-right">
                          {o.priceDelta > 0 ? `+${formatPrice(o.priceDelta)}` : '±0'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{o.displayOrder}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`badge ${o.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {o.isAvailable ? '販売中' : '売切'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => setOptionForm({
                              id: o.id, groupId: g.id, name: o.name, priceDelta: o.priceDelta,
                              isAvailable: o.isAvailable, displayOrder: o.displayOrder,
                            })}
                            className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-medium mr-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => toggleOption(o.id)}
                            className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                          >
                            {o.isAvailable ? '売切にする' : '再開'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {g.options.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                          オプションがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                オプショングループがまだありません。「+ グループ追加」から作成してください
              </div>
            )}
          </div>
        )}

        {groupForm && (
          <Modal title={groupForm.id ? 'グループ編集' : 'グループ追加'} onClose={() => setGroupForm(null)}>
            <div className="space-y-3">
              <Field label="名称">
                <input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupForm.isRequired}
                    onChange={(e) => setGroupForm({ ...groupForm, isRequired: e.target.checked })}
                  />
                  必須
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="最小選択">
                  <input type="number" min={0} value={groupForm.minSelect}
                    onChange={(e) => setGroupForm({ ...groupForm, minSelect: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </Field>
                <Field label="最大選択">
                  <input type="number" min={0} value={groupForm.maxSelect}
                    onChange={(e) => setGroupForm({ ...groupForm, maxSelect: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </Field>
                <Field label="表示順">
                  <input type="number" value={groupForm.displayOrder}
                    onChange={(e) => setGroupForm({ ...groupForm, displayOrder: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </Field>
              </div>
            </div>
            <ModalFooter onCancel={() => setGroupForm(null)} onSave={saveGroup} />
          </Modal>
        )}

        {optionForm && (
          <Modal title={optionForm.id ? 'オプション編集' : 'オプション追加'} onClose={() => setOptionForm(null)}>
            <div className="space-y-3">
              <Field label="名称">
                <input
                  value={optionForm.name}
                  onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="価格差分 (円, 0 以上)">
                  <input type="number" min={0} value={optionForm.priceDelta}
                    onChange={(e) => setOptionForm({ ...optionForm, priceDelta: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </Field>
                <Field label="表示順">
                  <input type="number" value={optionForm.displayOrder}
                    onChange={(e) => setOptionForm({ ...optionForm, displayOrder: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={optionForm.isAvailable}
                  onChange={(e) => setOptionForm({ ...optionForm, isAvailable: e.target.checked })}
                />
                販売中
              </label>
            </div>
            <ModalFooter onCancel={() => setOptionForm(null)} onSave={saveOption} />
          </Modal>
        )}
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6">
      <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold">
        キャンセル
      </button>
      <button onClick={onSave} className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark font-bold">
        保存
      </button>
    </div>
  )
}
