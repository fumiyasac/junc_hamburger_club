const USER_API = process.env.NEXT_PUBLIC_USER_API_URL ?? 'http://localhost:3000/api/v1'
const ADMIN_API = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:8080/api/v1/admin'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`)
  }
  return json.data as T
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ── Public / User API ──────────────────────────────────────────────────

export const burgerApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<{ burgers: import('./types').Burger[]; pagination: import('./types').PaginationMeta }>(
      `${USER_API}/burgers${qs}`
    )
  },
  get: (id: string) =>
    request<import('./types').Burger>(`${USER_API}/burgers/${id}`),
  search: (q: string) =>
    request<import('./types').Burger[]>(`${USER_API}/burgers/search?q=${encodeURIComponent(q)}`),
  categories: () =>
    request<import('./types').Category[]>(`${USER_API}/burgers/categories`),
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: import('./types').User }>(`${USER_API}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: import('./types').User }>(`${USER_API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
}

export const cartApi = {
  get: (token: string) =>
    request<import('./types').Cart>(`${USER_API}/cart`, { headers: authHeader(token) }),
  add: (token: string, burgerId: string, quantity = 1) =>
    request<import('./types').CartItem>(`${USER_API}/cart`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ burgerId, quantity }),
    }),
  update: (token: string, itemId: string, quantity: number) =>
    request<unknown>(`${USER_API}/cart/${itemId}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({ quantity }),
    }),
  remove: (token: string, itemId: string) =>
    request<unknown>(`${USER_API}/cart/${itemId}`, {
      method: 'DELETE',
      headers: authHeader(token),
    }),
  clear: (token: string) =>
    request<unknown>(`${USER_API}/cart`, { method: 'DELETE', headers: authHeader(token) }),
}

export const orderApi = {
  create: (token: string, notes?: string) =>
    request<import('./types').Order>(`${USER_API}/orders`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ notes }),
    }),
  list: (token: string) =>
    request<import('./types').Order[]>(`${USER_API}/orders`, { headers: authHeader(token) }),
  get: (token: string, orderId: string) =>
    request<import('./types').Order>(`${USER_API}/orders/${orderId}`, { headers: authHeader(token) }),
}

export const userApi = {
  me: (token: string) =>
    request<import('./types').User>(`${USER_API}/users/me`, { headers: authHeader(token) }),
}

// ── Admin API ─────────────────────────────────────────────────────────

export const adminAuthApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string } }>(`${ADMIN_API}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
}

export const adminBurgerApi = {
  list: (token: string, page = 1) =>
    request<{ burgers: import('./types').Burger[]; pagination: import('./types').PaginationMeta }>(
      `${ADMIN_API}/burgers?page=${page}`,
      { headers: authHeader(token) }
    ),
  get: (token: string, id: string) =>
    request<import('./types').Burger>(`${ADMIN_API}/burgers/${id}`, { headers: authHeader(token) }),
  create: (token: string, data: unknown) =>
    request<{ id: number }>(`${ADMIN_API}/burgers`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(data),
    }),
  update: (token: string, id: string, data: unknown) =>
    request<unknown>(`${ADMIN_API}/burgers/${id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(data),
    }),
  toggleAvailability: (token: string, id: string) =>
    request<unknown>(`${ADMIN_API}/burgers/${id}/availability`, {
      method: 'PUT',
      headers: authHeader(token),
    }),
  delete: (token: string, id: string) =>
    request<unknown>(`${ADMIN_API}/burgers/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    }),
}

export const adminOrderApi = {
  list: (token: string, status?: string, page = 1) => {
    const qs = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })
    return request<{ orders: import('./types').AdminOrder[]; pagination: import('./types').PaginationMeta }>(
      `${ADMIN_API}/orders?${qs}`,
      { headers: authHeader(token) }
    )
  },
  get: (token: string, id: string) =>
    request<import('./types').AdminOrder>(`${ADMIN_API}/orders/${id}`, { headers: authHeader(token) }),
  updateStatus: (token: string, id: string, status: string) =>
    request<unknown>(`${ADMIN_API}/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({ status }),
    }),
}

export const adminUserApi = {
  list: (token: string, page = 1) =>
    request<{ users: import('./types').AdminUser[]; pagination: import('./types').PaginationMeta }>(
      `${ADMIN_API}/users?page=${page}`,
      { headers: authHeader(token) }
    ),
  get: (token: string, id: string) =>
    request<import('./types').AdminUser>(`${ADMIN_API}/users/${id}`, { headers: authHeader(token) }),
  toggle: (token: string, id: string) =>
    request<unknown>(`${ADMIN_API}/users/${id}/toggle`, {
      method: 'PUT',
      headers: authHeader(token),
    }),
}

export const adminDashboardApi = {
  stats: (token: string) =>
    request<import('./types').DashboardStats>(`${ADMIN_API}/dashboard`, { headers: authHeader(token) }),
}
