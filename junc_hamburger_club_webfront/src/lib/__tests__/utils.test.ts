import { describe, test, expect } from 'vitest'
import {
  formatPrice,
  resolveBurgerImage,
  toJstDateKey,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_EMOJI,
  NEWS_CATEGORY_LABEL,
  NEWS_CATEGORY_BADGE,
} from '../utils'

describe('formatPrice', () => {
  test('基本', () => { expect(formatPrice(980)).toBe('¥980') })
  test('0 円', () => { expect(formatPrice(0)).toBe('¥0') })
  test('千区切り', () => { expect(formatPrice(1234567)).toBe('¥1,234,567') })
  test('小数は toLocaleString 任せ', () => { expect(formatPrice(99.5)).toMatch(/^¥99/) })
})

describe('resolveBurgerImage', () => {
  test('id 1-20 はローカル画像', () => {
    expect(resolveBurgerImage(1)).toBe('/burgers/1.jpg')
    expect(resolveBurgerImage('20')).toBe('/burgers/20.jpg')
  })
  test('id 21 以上は fallback', () => {
    expect(resolveBurgerImage(21, 'https://x/y.jpg')).toBe('https://x/y.jpg')
    expect(resolveBurgerImage(999)).toBeNull()
  })
  test('fallback が null でもエラーなし', () => {
    expect(resolveBurgerImage(100, null)).toBeNull()
  })
})

describe('toJstDateKey', () => {
  test('UTC 15:00 → JST 00:00 は翌日扱い', () => {
    // 2026-01-02 00:00 JST ≒ 2026-01-01 15:00 UTC
    const d = new Date(Date.UTC(2026, 0, 1, 15, 0, 0))
    expect(toJstDateKey(d)).toBe('2026-01-02')
  })
  test('UTC 14:59 → まだ JST 23:59 の同日', () => {
    const d = new Date(Date.UTC(2026, 0, 1, 14, 59, 0))
    expect(toJstDateKey(d)).toBe('2026-01-01')
  })
  test('デフォルト引数で現在時刻', () => {
    expect(toJstDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('ORDER_STATUS_* マップの網羅', () => {
  const STATUSES = ['received', 'preparing', 'ready', 'completed', 'cancelled']
  test.each(STATUSES)('%s がラベル・色・絵文字に存在', (s) => {
    expect(ORDER_STATUS_LABEL[s]).toBeDefined()
    expect(ORDER_STATUS_COLOR[s]).toBeDefined()
    expect(ORDER_STATUS_EMOJI[s]).toBeDefined()
  })
})

describe('NEWS_CATEGORY_* マップの網羅', () => {
  const CATS = ['store', 'menu', 'campaign', 'app'] as const
  test.each(CATS)('%s がラベル・バッジに存在', (c) => {
    expect(NEWS_CATEGORY_LABEL[c]).toBeDefined()
    expect(NEWS_CATEGORY_BADGE[c]).toBeDefined()
  })
})
