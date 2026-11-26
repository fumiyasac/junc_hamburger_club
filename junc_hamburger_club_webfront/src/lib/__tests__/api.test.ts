import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { burgerApi, ApiError } from '../api'

// fetch をグローバルに差し替え。各テストの前に初期化。
function mockFetchOnce(status: number, body: unknown): void {
  const ok = status >= 200 && status < 300
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
  // Response だけだと res.ok / res.status は自動的に埋まるので上書き不要
  void ok
}

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

describe('request 成功系', () => {
  test('{success:true,data} を返すと data をそのまま取り出す', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        burgers: [{ id: '1', name: 'テスト' }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      },
    })
    const result = await burgerApi.list()
    expect(result.burgers).toHaveLength(1)
    expect(result.burgers[0].id).toBe('1')
  })
})

describe('request エラー系 (ApiError への変換)', () => {
  test('{success:false,error:{code,message,details}} は ApiError を throw', async () => {
    mockFetchOnce(404, {
      success: false,
      error: {
        code: 'BURGER_NOT_FOUND',
        message: '指定のバーガーが見つかりません',
        details: { burgerId: '9999' },
      },
    })
    await expect(burgerApi.get('9999')).rejects.toSatisfy((e: unknown) => {
      if (!(e instanceof ApiError)) return false
      return (
        e.code === 'BURGER_NOT_FOUND' &&
        e.message === '指定のバーガーが見つかりません' &&
        (e.details as { burgerId: string }).burgerId === '9999' &&
        e.httpStatus === 404
      )
    })
  })

  test('401 TOKEN_EXPIRED → code 保持', async () => {
    mockFetchOnce(401, {
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'トークンの有効期限が切れています' },
    })
    await expect(burgerApi.get('1')).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === 'TOKEN_EXPIRED',
    )
  })

  test('details なしでも ApiError に変換できる', async () => {
    mockFetchOnce(400, {
      success: false,
      error: { code: 'CART_EMPTY', message: 'カートが空です' },
    })
    await expect(burgerApi.get('1')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ApiError &&
        e.code === 'CART_EMPTY' &&
        e.details === undefined,
    )
  })
})

describe('request 形式不正のフォールバック', () => {
  test('JSON パース失敗 → INTERNAL_ERROR の ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('not json', { status: 500 }),
    ))
    await expect(burgerApi.get('1')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ApiError && e.code === 'INTERNAL_ERROR' && e.httpStatus === 500,
    )
  })

  test('success:false だが error オブジェクトが欠落 → INTERNAL_ERROR', async () => {
    mockFetchOnce(500, { success: false })
    await expect(burgerApi.get('1')).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === 'INTERNAL_ERROR',
    )
  })
})

describe('request 通信失敗 (fetch 例外)', () => {
  test('fetch が reject すると例外が伝播', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network down')))
    await expect(burgerApi.get('1')).rejects.toThrow('network down')
  })
})
