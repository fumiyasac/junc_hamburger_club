import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { allowedNext, canTransition, OrderStatus } from '../order_status'

describe('allowedNext', () => {
  test('received → preparing, cancelled', () => {
    expect(allowedNext('received')).toEqual(['preparing', 'cancelled'])
  })
  test('preparing → ready, cancelled', () => {
    expect(allowedNext('preparing')).toEqual(['ready', 'cancelled'])
  })
  test('ready → completed のみ (キャンセル不可)', () => {
    expect(allowedNext('ready')).toEqual(['completed'])
  })
  test('completed / cancelled は終端', () => {
    expect(allowedNext('completed')).toEqual([])
    expect(allowedNext('cancelled')).toEqual([])
  })
})

describe('canTransition', () => {
  test('ready → cancelled は不可', () => {
    expect(canTransition('ready', 'cancelled')).toBe(false)
  })
  test('preparing → cancelled は可', () => {
    expect(canTransition('preparing', 'cancelled')).toBe(true)
  })
  test('完全な遷移マトリクス', () => {
    const matrix: Record<OrderStatus, OrderStatus[]> = {
      received:  ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready:     ['completed'],
      completed: [],
      cancelled: [],
    }
    for (const from of Object.keys(matrix) as OrderStatus[]) {
      for (const to of ['received','preparing','ready','completed','cancelled'] as OrderStatus[]) {
        const expected = matrix[from].includes(to)
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected)
      }
    }
  })
})

describe('Go (admin-api) の遷移表との drift 検出', () => {
  // admin-api/models/order_status.go から allowedTransitions を抽出して比較。
  // 3-source 同期 (TS user-api / Go admin-api / TS webfront) のうち
  // Go と webfront の間に食い違いがあれば 🔴。
  test('webfront の allowedTransitions が Go と一致', (ctx) => {
    const goPath = join(
      __dirname,
      '../../../../junc_hamburger_club_backend/admin-api/models/order_status.go',
    )
    if (!existsSync(goPath)) {
      // CI / Docker など backend ディレクトリが見えない環境ではスキップ
      ctx.skip()
      return
    }
    const goSrc = readFileSync(goPath, 'utf-8')
    // 以下のパターンを抽出:
    //   StatusReceived:  {StatusPreparing, StatusCancelled},
    const re = /Status(\w+):\s*\{([^}]*)\}/g
    const goMap: Record<string, string[]> = {}
    for (const m of goSrc.matchAll(re)) {
      const from = m[1].toLowerCase()
      const inner = m[2].trim()
      const list = inner === ''
        ? []
        : inner
            .split(',')
            .map((s) => s.trim().replace(/^Status/, '').toLowerCase())
            .filter(Boolean)
      goMap[from] = list
    }

    const tsMap: Record<string, string[]> = {
      received:  ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready:     ['completed'],
      completed: [],
      cancelled: [],
    }

    for (const from of Object.keys(tsMap)) {
      expect(goMap[from], `Go 側に ${from} が存在`).toBeDefined()
      expect(goMap[from], `${from} の遷移先 drift`).toEqual(tsMap[from])
    }
  })
})
