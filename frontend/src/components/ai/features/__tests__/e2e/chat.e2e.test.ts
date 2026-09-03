import { test, expect, loginAs, navigateToAIChat, sendMessage } from './fixtures';

test.describe('AI Chat E2E - 基准测试流程', () => {
  test('完整流程: 登录 → 打开 AI 页面 → 发送消息 → 验证响应', async ({ page }) => {
    await loginAs(page, 'admin');
    
    await navigateToAIChat(page);
    
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    await sendMessage(page, '你好，请介绍一下活性肽');
    
    const assistantMessage = page.locator('[data-testid="assistant-message"]');
    await expect(assistantMessage).toBeVisible();
    await expect(assistantMessage).toContainText(/活性肽|peptide/i);
  });

  test('登录后应显示用户信息', async ({ adminPage }) => {
    await expect(adminPage.locator('[data-testid="user-avatar"]')).toBeVisible();
    await expect(adminPage.locator('text=admin')).toBeVisible();
  });

  test('AI 聊天页面应包含输入框和发送按钮', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const chatInput = authenticatedPage.locator('[data-testid="chat-input"]');
    const sendButton = authenticatedPage.locator('[data-testid="send-button"]');
    
    await expect(chatInput).toBeVisible();
    await expect(sendButton).toBeVisible();
  });

  test('发送多条消息应正确显示对话历史', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await sendMessage(authenticatedPage, '第一条消息');
    await sendMessage(authenticatedPage, '第二条消息');
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    const count = await messages.count();
    
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('流式响应应逐步显示内容', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    await input.fill('请详细说明胶原蛋白肽的作用机制');
    await authenticatedPage.keyboard.press('Enter');
    
    const streamingIndicator = authenticatedPage.locator('[data-testid="streaming-indicator"]');
    await expect(streamingIndicator).toBeVisible({ timeout: 5000 });
    
    const assistantMessage = authenticatedPage.locator('[data-testid="assistant-message"]');
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    await expect(streamingIndicator).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe('视觉回归测试', () => {
  test('聊天页面截图对比', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await expect(authenticatedPage.locator('[data-testid="chat-container"]')).toHaveScreenshot(
      'chat-page-initial.png',
      { maxDiffPixelRatio: 0.01 }
    );
  });

  test('发送消息后的页面状态', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    await sendMessage(authenticatedPage, '测试消息');
    
    await expect(authenticatedPage.locator('[data-testid="chat-container"]')).toHaveScreenshot(
      'chat-page-with-messages.png',
      { maxDiffPixelRatio: 0.01 }
    );
  });
});
