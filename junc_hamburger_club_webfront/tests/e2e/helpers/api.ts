// User API / Admin API を直接叩くヘルパ。
// E2E の fixture (global-setup) とテストの中で使う。

const USER_API = process.env.E2E_USER_API_URL ?? 'http://localhost:3100/api/v1'
const ADMIN_API = process.env.E2E_ADMIN_API_URL ?? 'http://localhost:8081/api/v1/admin'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@junc-hamburger.com'
// シークレットはハードコードしない。.env の ADMIN_PASSWORD_HASH に対応する平文を env で渡す。
const ADMIN_PASSWORD_PLAIN = process.env.E2E_ADMIN_PASSWORD_PLAIN ?? 'admin1234'

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok || !body || body.success === false) {
    throw new Error(
      `${init?.method ?? 'GET'} ${url} failed: ${res.status} ${JSON.stringify(body)}`,
    )
  }
  return body.data as unknown
}

export interface UserTokens {
  accessToken: string
  refreshToken: string
  userId: string
  email: string
}

/** 毎回ユニークな test@...@example.com で register + accessToken 取得 */
export async function registerTestUser(): Promise<UserTokens> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const password = 'password123'
  const data = (await request(`${USER_API}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name: 'E2E', email, password }),
  })) as {
    accessToken: string
    refreshToken: string
    user: { id: string; email: string }
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    email: data.user.email,
  }
}

/** admin login で JWT を取得 */
export async function adminLogin(): Promise<string> {
  const data = (await request(`${ADMIN_API}/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD_PLAIN }),
  })) as { token: string }
  return data.token
}

/** カート追加 → 注文作成 (Idempotency-Key 付き)。時刻依存を避けるため pickupAt は pickup-slots から取る */
export async function createReceivedOrder(accessToken: string): Promise<{ id: string; orderNumber: string }> {
  // 利用可能なスロットを取得。
  // 今日は lead_time で全埋まりのことがあるため、7 日先まで順に探す。
  let slot: string | undefined
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const dateKey = d.toISOString().slice(0, 10)
    const resp = (await request(`${USER_API}/pickup-slots?date=${dateKey}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })) as { slots: Array<{ startAt: string; available: boolean }> }
    const found = resp.slots.find((s) => s.available)?.startAt
    if (found) { slot = found; break }
  }
  if (!slot) throw new Error('no available pickup slot within 7 days for E2E')

  // バーガー 1 の必須オプション (パティ系) を 1 つ選ぶ
  const burger = (await request(`${USER_API}/burgers/1`)) as {
    optionGroups: Array<{ isRequired: boolean; options: Array<{ id: string; isAvailable: boolean }> }>
  }
  const requiredOptionIds = burger.optionGroups
    .filter((g) => g.isRequired)
    .map((g) => g.options.find((o) => o.isAvailable)?.id)
    .filter((id): id is string => !!id)

  await request(`${USER_API}/cart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ burgerId: '1', quantity: 1, selectedOptionIds: requiredOptionIds }),
  })

  const idemKey = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const order = (await request(`${USER_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Idempotency-Key': idemKey,
    },
    body: JSON.stringify({ pickupAt: slot }),
  })) as { id: string; orderNumber: string }

  return { id: order.id, orderNumber: order.orderNumber }
}

export { USER_API, ADMIN_API }
