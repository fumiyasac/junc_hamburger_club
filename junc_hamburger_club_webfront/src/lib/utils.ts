export function formatPrice(yen: number): string {
  return `¥${yen.toLocaleString('ja-JP')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
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
