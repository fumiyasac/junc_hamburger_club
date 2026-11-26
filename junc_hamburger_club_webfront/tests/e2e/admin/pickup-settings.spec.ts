import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/admin-auth'

test('受け取り枠設定: 画面表示 → 保存', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/pickup-settings')

  // 画面が表示されるまで待つ (いずれかのラベルが見えること)
  await expect(page.getByText('1 枠の定員 (件)')).toBeVisible()

  // 保存ボタンを押す (値変更なしでも後続エンドポイントの到達を確認)
  const saveBtn = page.getByRole('button', { name: /^保存$/ })
  await expect(saveBtn).toBeVisible()
  await saveBtn.click()

  // 成功メッセージを待つ
  await expect(page.getByText(/保存しました/)).toBeVisible({ timeout: 10_000 })
})
