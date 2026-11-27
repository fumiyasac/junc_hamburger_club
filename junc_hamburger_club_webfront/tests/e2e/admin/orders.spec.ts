import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/admin-auth'
import { registerTestUser, createReceivedOrder } from '../helpers/api'

test('注文の received → preparing 遷移、ready 行に cancelled ボタンが出ない', async ({ page }) => {
  // Arrange: テストユーザー + received 状態の注文を 1 件
  const user = await registerTestUser()
  const order = await createReceivedOrder(user.accessToken)

  // admin で一覧表示
  await loginAsAdmin(page)
  await page.goto('/admin/orders')

  const card = page.getByTestId(`order-card-${order.id}`)
  await expect(card).toBeVisible()

  // received 状態なので preparing / cancelled ボタンが見える、ready ボタンは見えない
  await expect(card.getByTestId('status-btn-preparing')).toBeVisible()
  await expect(card.getByTestId('status-btn-cancelled')).toBeVisible()
  await expect(card.getByTestId('status-btn-ready')).toHaveCount(0)

  // preparing に遷移
  await card.getByTestId('status-btn-preparing').click()

  // 更新後、同じカードで ready と cancelled のボタンに変わる
  const updatedCard = page.getByTestId(`order-card-${order.id}`)
  await expect(updatedCard.getByTestId('status-btn-ready')).toBeVisible()
  await expect(updatedCard.getByTestId('status-btn-cancelled')).toBeVisible()
})
