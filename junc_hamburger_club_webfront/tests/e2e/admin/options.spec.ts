import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/admin-auth'

test('オプション: 売り切れ ← → 再開 のトグル', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/options')

  // 最初に見える在庫あり badge のうち 1 つを操作対象にする
  // (トグル後に戻すので、どのオプションを選ぶかはテスト内でも気にしない)
  const availableBadge = page.locator('[data-testid^="option-availability-"]').filter({ hasText: '販売中' }).first()
  await expect(availableBadge).toBeVisible()

  // badge の testid から option ID を取り出す
  const testid = await availableBadge.getAttribute('data-testid')
  const optionId = testid?.replace(/^option-availability-/, '')
  if (!optionId) throw new Error('option id not found from testid')

  const toggleBtn = page.getByTestId(`toggle-availability-${optionId}`)

  // 売切にする
  await toggleBtn.click()
  await expect(page.getByTestId(`option-availability-${optionId}`)).toHaveText('売切')

  // 再開
  await toggleBtn.click()
  await expect(page.getByTestId(`option-availability-${optionId}`)).toHaveText('販売中')
})
