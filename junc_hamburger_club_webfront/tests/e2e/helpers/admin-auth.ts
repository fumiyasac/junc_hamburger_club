// admin 用の認証済みページを作る fixture。
// Playwright の storageState を使い、localStorage に admin token を書き込んでから navigate する。

import { Page } from '@playwright/test'
import { adminLogin } from './api'

let cachedToken: string | null = null

export async function loginAsAdmin(page: Page): Promise<void> {
  if (!cachedToken) cachedToken = await adminLogin()
  // 先にページを開く (localStorage origin が必要)
  await page.goto('/admin/login')
  await page.evaluate((token) => {
    localStorage.setItem('junc_admin_token', token)
  }, cachedToken)
}
