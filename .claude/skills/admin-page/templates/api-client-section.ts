// src/lib/api.ts の "// ── Admin API ──" セクションに追加する雛形。
// 既存の adminBurgerApi / adminOrderApi と同じスタイル。
//
// request<T> ヘルパーと authHeader(token) は既に src/lib/api.ts 内に定義されている前提。

export const adminReviewApi = {
  list: (token: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<{
      reviews: import('./types').Review[]
      pagination: import('./types').PaginationMeta
    }>(`${ADMIN_API}/reviews${qs}`, { headers: authHeader(token) })
  },

  get: (token: string, id: string) =>
    request<import('./types').Review>(`${ADMIN_API}/reviews/${id}`, {
      headers: authHeader(token),
    }),

  delete: (token: string, id: string) =>
    request<unknown>(`${ADMIN_API}/reviews/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    }),
}

// 対応する型を src/lib/types.ts に追加 (ID は必ず string):
//
// export interface Review {
//   id: string
//   userId: string
//   burgerId: string
//   rating: number
//   comment: string | null
//   createdAt: string
// }
