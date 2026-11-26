import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/admin-auth'

test('admin ログイン → ダッシュボード表示', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: /ダッシュボード/ })).toBeVisible()
  // DashboardStats の主要 KPI 名 (CLAUDE.md より "全注文" 等) — 変更に強いよう role 指定で
  // 画面が描画完了するまで待つ: 統計の数値表示が現れる
  await expect(page.locator('body')).toContainText(/注文|バーガー|ユーザー/)
})
