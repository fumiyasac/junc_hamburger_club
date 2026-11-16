export function formatPrice(yen: number): string {
  return `¥${yen.toLocaleString('ja-JP')}`
}

// Local burger thumbnails live in /public/burgers/{id}.jpg (ids 1-20).
// Falls back to the API-provided imageUrl if no local asset exists.
const LOCAL_BURGER_IDS = new Set(Array.from({ length: 20 }, (_, i) => String(i + 1)))
export function resolveBurgerImage(id: string | number, fallback?: string | null): string | null {
  const key = String(id)
  if (LOCAL_BURGER_IDS.has(key)) return `/burgers/${key}.jpg`
  return fallback ?? null
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** JST 時刻を "HH:MM" で返す */
export function formatPickupTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo',
  })
}

/** JST 日付を "YYYY-MM-DD" で返す (API の date クエリ用) */
export function toJstDateKey(d: Date = new Date()): string {
  const jstMs = d.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── News カテゴリー ─────────────────────────────────────────────────────────

import type { NewsCategory } from './types'

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  store:    '店舗',
  menu:     '新メニュー',
  campaign: 'キャンペーン',
  app:      'アプリ',
}

// バッジのカテゴリー配色。カテゴリーごとに見分けがつくように Tailwind トークンで分離。
export const NEWS_CATEGORY_BADGE: Record<NewsCategory, string> = {
  store:    'bg-blue-100 text-blue-700',
  menu:     'bg-primary-light text-primary-dark',
  campaign: 'bg-secondary text-gray-800',
  app:      'bg-green-100 text-green-700',
}

export function formatNewsDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  received:   '受付済み',
  preparing:  '調理中',
  ready:      '受取可能',
  completed:  '完了',
  cancelled:  'キャンセル',
}

export const ORDER_STATUS_EMOJI: Record<string, string> = {
  received:   '📋',
  preparing:  '👨‍🍳',
  ready:      '🔔',
  completed:  '✅',
  cancelled:  '❌',
}

export const ORDER_STATUS_COLOR: Record<string, string> = {
  received:   'bg-blue-100 text-blue-700',
  preparing:  'bg-orange-100 text-orange-700',
  ready:      'bg-green-100 text-green-700',
  completed:  'bg-gray-100 text-gray-700',
  cancelled:  'bg-red-100 text-red-700',
}
