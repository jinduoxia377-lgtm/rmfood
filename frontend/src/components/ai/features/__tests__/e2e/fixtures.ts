import { test as base, expect, Page } from '@playwright/test';

type TestUser = {
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'user';
};

const TEST_USERS: Record<string, TestUser> = {
  admin: {
    username: 'admin',
    password: 'Admin@123456',
    email: 'admin@rmfood.com',
    role: 'admin',
  },
  user: {
    username: 'testuser',
    password: 'Test@123456',
    email: 'testuser@rmfood.com',
    role: 'user',
  },
};

interface AuthenticatedFixtures {
  authenticatedPage: Page;
  adminPage: Page;
  userPage: Page;
  mobilePage: Page;
  tabletPage: Page;
}

async function performLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  
  await page.waitForSelector('input#username', { timeout: 15000 });
  
  await page.fill('input#username', user.username);
  await page.fill('input#password', user.password);
  
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

export const test = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await performLogin(page, TEST_USERS.user);
    
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await performLogin(page, TEST_USERS.admin);
    
    await use(page);
    await context.close();
  },

  userPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await performLogin(page, TEST_USERS.user);
    
    await use(page);
    await context.close();
  },

  mobilePage: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    
    await performLogin(page, TEST_USERS.user);
    
    await use(page);
    await context.close();
  },

  tabletPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    
    await performLogin(page, TEST_USERS.user);
    
    await use(page);
    await context.close();
  },
});

export { expect };
export { TEST_USERS };

export async function loginAs(
  page: Page,
  userType: keyof typeof TEST_USERS = 'admin'
): Promise<void> {
  const user = TEST_USERS[userType];
  await performLogin(page, user);
}

export async function navigateToAIChat(page: Page): Promise<void> {
  await page.click('text=AI 助手');
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 5000 });
}

export async function sendMessage(
  page: Page,
  message: string,
  options?: { waitForResponse?: boolean; timeout?: number }
): Promise<void> {
  const input = page.locator('[data-testid="chat-input"]');
  await input.fill(message);
  await page.keyboard.press('Enter');
  
  if (options?.waitForResponse !== false) {
    await page.waitForSelector('[data-testid="assistant-message"]', {
      timeout: options?.timeout ?? 30000,
    });
  }
}

export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<void> {
  await page.screenshot({
    path: `test-screenshots/${name}-${Date.now()}.png`,
    fullPage: options?.fullPage ?? false,
  });
}

export async function logout(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('text=退出登录');
  await page.waitForURL('**/login**', { timeout: 5000 });
}

export async function countMessages(page: Page): Promise<number> {
  const messages = page.locator('[data-testid="message"]');
  return await messages.count();
}

export async function waitForStreamingComplete(page: Page): Promise<void> {
  const streamingIndicator = page.locator('[data-testid="streaming-indicator"]');
  await expect(streamingIndicator).not.toBeVisible({ timeout: 30000 });
}

export async function simulateNetworkError(page: Page): Promise<void> {
  await page.route('**/api/**', (route) => {
    route.abort('failed');
  });
}

export async function restoreNetwork(page: Page): Promise<void> {
  await page.unroute('**/api/**');
}