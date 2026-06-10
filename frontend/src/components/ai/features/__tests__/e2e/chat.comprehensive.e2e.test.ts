import { test, expect, loginAs, navigateToAIChat, sendMessage, logout, countMessages, waitForStreamingComplete, simulateNetworkError, restoreNetwork } from './fixtures';

test.describe('完整用户流程测试', () => {
  test('完整流程: 登录 → 导航 → 发送消息 → 查看历史 → 退出', async ({ page }) => {
    await loginAs(page, 'admin');
    
    await navigateToAIChat(page);
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    
    await sendMessage(page, '你好，请问什么是活性肽？');
    await waitForStreamingComplete(page);
    
    const messagesCount = await countMessages(page);
    expect(messagesCount).toBeGreaterThanOrEqual(2);
    
    const lastMessage = page.locator('[data-testid="assistant-message"]').last();
    await expect(lastMessage).toContainText(/活性肽/i);
    
    await logout(page);
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  test('流程: 用户角色登录并使用AI助手', async ({ userPage }) => {
    await navigateToAIChat(userPage);
    
    await sendMessage(userPage, '请推荐一些适合运动后恢复的配方');
    await waitForStreamingComplete(userPage);
    
    const messages = userPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe('50轮多轮对话测试', () => {
  test('50轮连续对话测试', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    for (let i = 1; i <= 50; i++) {
      const message = `第 ${i} 轮对话: 请解释蛋白质粉的种类和适用人群`;
      await sendMessage(authenticatedPage, message);
      await waitForStreamingComplete(authenticatedPage);
      
      const messagesCount = await countMessages(authenticatedPage);
      expect(messagesCount).toBe(i * 2);
      
      if (i % 10 === 0) {
        console.log(`已完成 ${i} 轮对话`);
      }
    }
    
    const finalCount = await countMessages(authenticatedPage);
    expect(finalCount).toBe(100);
    
    const allMessages = authenticatedPage.locator('[data-testid="message"]');
    await expect(allMessages).toHaveCount(100);
  });

  test('多轮上下文保持测试', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await sendMessage(authenticatedPage, '我想了解胶原蛋白肽');
    await waitForStreamingComplete(authenticatedPage);
    
    await sendMessage(authenticatedPage, '它有什么功效？');
    await waitForStreamingComplete(authenticatedPage);
    
    await sendMessage(authenticatedPage, '适合什么人群？');
    await waitForStreamingComplete(authenticatedPage);
    
    await sendMessage(authenticatedPage, '每天推荐摄入量是多少？');
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="assistant-message"]');
    const count = await messages.count();
    expect(count).toBe(4);
    
    const lastResponse = messages.last();
    await expect(lastResponse).toContainText(/摄入|剂量|每日/i);
  });
});

test.describe('错误场景和恢复测试', () => {
  test('网络错误场景处理', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await simulateNetworkError(authenticatedPage);
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    await input.fill('测试消息');
    await authenticatedPage.keyboard.press('Enter');
    
    await expect(authenticatedPage.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    
    await restoreNetwork(authenticatedPage);
    
    await sendMessage(authenticatedPage, '恢复后测试');
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });

  test('超时错误处理', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await authenticatedPage.route('**/api/chat', (route) => {
      setTimeout(() => route.continue(), 60000);
    });
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    await input.fill('测试超时');
    await authenticatedPage.keyboard.press('Enter');
    
    await expect(authenticatedPage.locator('[data-testid="timeout-error"]')).toBeVisible({ timeout: 35000 });
    
    await authenticatedPage.unroute('**/api/chat');
  });

  test('空消息输入验证', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const sendButton = authenticatedPage.locator('[data-testid="send-button"]');
    
    await authenticatedPage.keyboard.press('Enter');
    
    expect(await sendButton.isDisabled()).toBe(true);
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    await input.fill('   ');
    
    expect(await sendButton.isDisabled()).toBe(true);
    
    await input.fill('有效消息');
    expect(await sendButton.isEnabled()).toBe(true);
  });

  test('系统错误恢复后继续聊天', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    await sendMessage(authenticatedPage, '第一条正常消息');
    await waitForStreamingComplete(authenticatedPage);
    
    await simulateNetworkError(authenticatedPage);
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    await input.fill('触发错误的消息');
    await authenticatedPage.keyboard.press('Enter');
    
    await expect(authenticatedPage.locator('[data-testid="error-message"]')).toBeVisible();
    
    await restoreNetwork(authenticatedPage);
    
    await sendMessage(authenticatedPage, '恢复后的消息');
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBe(4);
  });
});

test.describe('响应式布局测试', () => {
  test('桌面端布局验证', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1280, height: 720 });
    await navigateToAIChat(authenticatedPage);
    
    await expect(authenticatedPage.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="chat-container"]')).toHaveCSS('width', /80%/);
  });

  test('平板端布局验证', async ({ tabletPage }) => {
    await navigateToAIChat(tabletPage);
    
    await expect(tabletPage.locator('[data-testid="chat-container"]')).toBeVisible();
    const chatWidth = await tabletPage.locator('[data-testid="chat-container"]').evaluate(el => getComputedStyle(el).width);
    expect(parseInt(chatWidth)).toBeGreaterThan(700);
  });

  test('移动端布局验证', async ({ mobilePage }) => {
    await navigateToAIChat(mobilePage);
    
    await expect(mobilePage.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    await expect(mobilePage.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(mobilePage.locator('[data-testid="send-button"]')).toBeVisible();
    
    const inputWidth = await mobilePage.locator('[data-testid="chat-input"]').evaluate(el => getComputedStyle(el).width);
    expect(parseInt(inputWidth)).toBeLessThan(375);
  });

  test('响应式侧边栏折叠', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1280, height: 720 });
    await navigateToAIChat(authenticatedPage);
    
    await expect(authenticatedPage.locator('[data-testid="sidebar"]')).toBeVisible();
    
    await authenticatedPage.setViewportSize({ width: 700, height: 720 });
    await expect(authenticatedPage.locator('[data-testid="sidebar"]')).not.toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
  });

  test('移动端消息气泡自适应', async ({ mobilePage }) => {
    await navigateToAIChat(mobilePage);
    
    await sendMessage(mobilePage, '这是一条比较长的测试消息，用于验证移动端消息气泡是否能够正确自适应显示，不会超出屏幕宽度');
    await waitForStreamingComplete(mobilePage);
    
    const userMessage = mobilePage.locator('[data-testid="user-message"]').last();
    const messageWidth = await userMessage.evaluate(el => el.getBoundingClientRect().width);
    
    expect(messageWidth).toBeLessThan(350);
  });
});

test.describe('边界情况测试', () => {
  test('超长消息处理', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const longMessage = 'a'.repeat(5000);
    await sendMessage(authenticatedPage, longMessage);
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });

  test('特殊字符处理', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\\\'"';
    await sendMessage(authenticatedPage, `测试特殊字符: ${specialChars}`);
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });

  test('连续快速发送消息', async ({ authenticatedPage }) => {
    await navigateToAIChat(authenticatedPage);
    
    const input = authenticatedPage.locator('[data-testid="chat-input"]');
    
    for (let i = 1; i <= 5; i++) {
      await input.fill(`快速消息 ${i}`);
      await authenticatedPage.keyboard.press('Enter');
    }
    
    await waitForStreamingComplete(authenticatedPage);
    
    const messages = authenticatedPage.locator('[data-testid="message"]');
    expect(await messages.count()).toBe(10);
  });
});