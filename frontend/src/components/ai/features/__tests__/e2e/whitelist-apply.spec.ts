/**
 * 白名单申请流程 e2e 测试（Playwright）
 *
 * 前置条件：前端 dev server（localhost:3000）与后端服务均已启动。
 * 运行：pnpm test:e2e -- whitelist-apply.spec.ts
 *
 * 覆盖：登录页「申请准入」入口 → 申请页 → 表单提交 → 邮箱验证步骤。
 */
import { test, expect } from '@playwright/test'

test.describe('白名单申请流程', () => {
  test('登录页入口 → 申请页 → 提交表单 → 邮箱验证步骤', async ({ page }) => {
    // 1. 登录页（未登录公开路由）
    await page.goto('/login')

    // 2. 点击「申请准入」入口，跳转独立申请页
    await page.getByRole('link', { name: '申请准入' }).click()
    await expect(page).toHaveURL(/\/whitelist-apply/)
    await expect(page.getByRole('heading', { name: '申请白名单' })).toBeVisible()

    // 3. 填写申请表单
    const email = `e2e_${Date.now()}@example.com`
    await page.getByLabel('邮箱').fill(email)
    await page.getByLabel(/姓名/).fill('E2E 用户')
    await page.getByLabel(/单位/).fill('测试单位')
    await page.getByLabel(/申请理由/).fill('e2e 全链路测试')
    await page.getByLabel(/我已阅读并同意/).check()

    // 4. 提交申请
    await page.getByRole('button', { name: '提交申请' }).click()

    // 5. 进入邮箱验证步骤（6 位验证码输入框出现）
    await expect(page.getByLabel('6 位验证码')).toBeVisible({ timeout: 10000 })
  })
})