import { test, expect } from '@playwright/test'

test('/menu → /menu/1 で詳細表示', async ({ page }) => {
  // トップ経由だと Footer の popular=true リンクを掴むので直接 /menu へ
  await page.goto('/menu')
  await expect(page).toHaveURL(/\/menu$/)

  // バーガー一覧がロードされるまで待つ (¥ 表示で判断、api fetch 完了を担保)
  await expect(page.locator('main').getByText(/¥/).first()).toBeVisible()
  // main 内の最初のバーガーリンク (/menu/:id) をクリック
  await page.locator('main a[href^="/menu/"]').first().click()
  await expect(page).toHaveURL(/\/menu\/\d+/)

  // 詳細ページには価格 ¥ と「メニューに戻る」が表示されている
  await expect(page.locator('body')).toContainText('¥')
  await expect(page.getByRole('link', { name: /メニューに戻る/ })).toBeVisible()
})
