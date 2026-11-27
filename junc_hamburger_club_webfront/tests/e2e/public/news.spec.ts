import { test, expect } from '@playwright/test'

test('/news 一覧 → 詳細に遷移できる', async ({ page }) => {
  await page.goto('/news')
  await expect(page.getByRole('heading', { name: 'お知らせ', exact: true })).toBeVisible()

  // 記事リンクは href が /news/:id のいずれかにマッチする
  const articleLink = page.locator('a[href^="/news/"]').first()
  await expect(articleLink).toBeVisible()
  await articleLink.click()
  await expect(page).toHaveURL(/\/news\/\d+/)
})

test('/news/9999 (存在しない ID) の現状挙動を記録', async ({ page }) => {
  const res = await page.goto('/news/9999')
  // 現状の挙動: notFound() で Next.js の 404 ページが出る、または通常のエラー画面。
  const status = res?.status()
  if (status !== null && status !== undefined) {
    expect([200, 404]).toContain(status)
  }
})
