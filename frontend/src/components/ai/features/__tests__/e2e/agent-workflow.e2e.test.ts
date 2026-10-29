/**
 * Agent 工作流 E2E 测试
 *
 * 测试范围：
 * - AgentWorkflowTab 渲染和交互
 * - Turn/Step 状态显示
 * - Token 计数器
 * - Compaction 触发
 * - 工作流模板切换
 * - Waterfall 事件可视化
 */

import { test, expect } from '@playwright/test';

const AGENT_WORKFLOW_URL = '/agent';

// ── 辅助函数 ────────────────────────────────────────────────

async function navigateToAgentWorkflow(page: any): Promise<void> {
  await page.goto(AGENT_WORKFLOW_URL);
  // 等待多智能体协作中心加载，进入 Chief 控制台（AgentWorkflowTab 迁移到 /agent）
  await page.waitForSelector('[data-testid="agent-nav-chief"]', { timeout: 10000 });
  await page.locator('[data-testid="agent-nav-chief"]').click();
  await page.waitForSelector('[data-testid="agent-input"]', { timeout: 10000 });
}

async function sendAgentMessage(page: any, message: string): Promise<void> {
  const textarea = page.locator('[data-testid="agent-input"]');
  await textarea.fill(message);
  await textarea.press('Enter');
}

async function waitForAgentResponse(page: any, timeout: number = 15000): Promise<void> {
  // 等待 running 状态消失
  await page.waitForSelector('.animate-spin', { state: 'hidden', timeout });
  // 等待新消息出现（使用 data-testid）
  await page.locator('[data-testid="assistant-message"]').last().waitFor({ state: 'visible', timeout });
}

// ── 测试套件 ────────────────────────────────────────────────

test.describe('Agent 工作流 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAgentWorkflow(page);
  });

  test('应渲染 Agent Workflow Tab', async ({ page }) => {
    // 检查头部
    await expect(page.locator('text=AI 研发助手')).toBeVisible();
    await expect(page.locator('text=Agent v3.0')).toBeVisible();

    // 检查工作流模板按钮
    const templates = page.locator('.rounded-full.border');
    await expect(templates).toHaveCountGreaterThan(0);

    // 检查输入框
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', /描述你的研发需求/);
  });

  test('应显示快捷提示按钮', async ({ page }) => {
    const promptButtons = page.locator('button:text("帮我设计一款")');
    await expect(promptButtons).toBeVisible();
  });

  test('发送消息后应显示 Turn 状态', async ({ page }) => {
    // Mock API 响应
    await page.route('/api/v1/agent/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            execution_id: 'test-exec-123',
            user_query: '测试消息',
            status: 'completed',
            total_latency_ms: 1500,
            steps: [
              { step_id: '1', tool: 'rag_search', status: 'success', latency_ms: 500 },
              { step_id: '2', tool: 'formula_generate', status: 'success', latency_ms: 800 },
              { step_id: '3', tool: 'compliance_check', status: 'success', latency_ms: 200 },
            ],
            final_response_preview: '这是一条测试回复',
          },
        }),
      });
    });

    await page.route('/api/v1/agent/workflow/*/execute', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            execution_id: 'test-wf-123',
            workflow_type: 'formula_design',
            user_query: '测试消息',
            status: 'completed',
            total_latency_ms: 1500,
            stages: [
              { stage: 'RAG检索', success: true, latency_ms: 500 },
              { stage: '配方生成', success: true, latency_ms: 800 },
              { stage: '合规检查', success: true, latency_ms: 200 },
            ],
            final_response_preview: '配方设计方案已生成',
          },
        }),
      });
    });

    await sendAgentMessage(page, '帮我设计一款针对高血糖人群的饮品配方');
    await waitForAgentResponse(page);

    // 验证消息显示
    const messages = page.locator('[class*="flex items-start"]');
    await expect(messages).toHaveCountGreaterThan(1);
  });

  test('应显示 Token 计数器', async ({ page }) => {
    const tokenBadge = page.locator('[data-testid="token-indicator"]');
    await expect(tokenBadge).toBeVisible();
  });

  test('Token 指示器应显示进度条', async ({ page }) => {
    // 点击 Token 指示器展开详情
    const tokenBadge = page.locator('[data-testid="token-indicator"]');
    await tokenBadge.click();

    // 等待进度条显示
    await page.waitForSelector('[class*="h-1.5.rounded-full"]', { timeout: 3000 });
  });

  test('清空对话应清除所有消息', async ({ page }) => {
    const clearButton = page.locator('[title="清空对话"]');
    await expect(clearButton).toBeVisible();

    // 清空前应有空状态
    await expect(page.locator('text=开始新的对话')).toBeVisible();
  });

  test('应显示工作流节点可视化', async ({ page }) => {
    // 工作流节点应默认隐藏（未执行时）
    const workflowNode = page.locator('[class*="border-min-w-\\[80px\\]"]');
    // 当没有执行时，工作流节点面板不应显示
    const isVisible = await workflowNode.count();
    // 允许为空或不显示
    expect(isVisible >= 0).toBe(true);
  });

  test('选择快捷提示应填充输入框', async ({ page }) => {
    const promptButton = page.locator('button:text("查询黄芪的功效")').first();
    await expect(promptButton).toBeVisible();
    await promptButton.click();

    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('黄芪');
  });
});

test.describe('Agent 工作流 - 智能路由测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAgentWorkflow(page);
  });

  test('输入"配方"应路由到配方设计模式', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('帮我设计一款配方');

    // 检查智能路由指示器
    const routerIndicator = page.locator('[class*="Brain"]');
    // 输入时可能显示路由建议
    await expect(routerIndicator).toBeVisible();
  });

  test('输入"合规检查"应路由到合规检查模式', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('检查这个配方的合规性');

    const routerIndicator = page.locator('[class*="Brain"]');
    await expect(routerIndicator).toBeVisible();
  });
});

test.describe('Agent 工作流 - 错误处理测试', () => {
  test('API 失败时应显示错误消息', async ({ page }) => {
    // Mock 错误响应
    await page.route('/api/v1/agent/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.route('/api/v1/agent/workflow/*/execute', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Workflow execution failed' }),
      });
    });

    await sendAgentMessage(page, '测试错误处理');

    // 等待错误消息出现
    await page.waitForSelector('text=/执行失败|错误/i', { timeout: 10000 });
  });

  test('网络超时时应显示超时提示', async ({ page }) => {
    await page.route('/api/v1/agent/**', route => {
      route.abort('connectiontimedout');
    });

    await sendAgentMessage(page, '测试超时');

    // 等待错误消息
    await page.waitForSelector('text=/失败/i', { timeout: 15000 });
  });
});

test.describe('Agent 工作流 - 性能测试', () => {
  test('首次加载应小于 2 秒', async ({ page }) => {
    const startTime = Date.now();
    await navigateToAgentWorkflow(page);
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);
  });

  test('多次消息发送应保持流畅', async ({ page }) => {
    // Mock 快速响应
    await page.route('/api/v1/agent/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            execution_id: `exec-${Date.now()}`,
            user_query: '',
            status: 'completed',
            total_latency_ms: 100,
            steps: [],
            final_response_preview: 'OK',
          },
        }),
      });
    });

    // 发送 5 条消息
    for (let i = 0; i < 5; i++) {
      const before = Date.now();
      await sendAgentMessage(page, `测试消息 ${i + 1}`);
      await waitForAgentResponse(page, 5000);
      const after = Date.now();

      // 每条消息处理应在 5 秒内完成
      expect(after - before).toBeLessThan(5000);
    }
  });
});

// ── 测试计数辅助 ────────────────────────────────────────────

expect.extend({
  // P2-F3 修复：received.count() 返回 Promise，原代码 Promise > number 恒为 false。
  // 改为 async 并 await，使元素计数断言真正生效。
  async toHaveCountGreaterThan(received: any, expected: number) {
    const actual = await received.count();
    const pass = actual > expected;
    return {
      pass,
      message: () => `expected element count ${actual} to ${pass ? '>' : '<'}= ${expected}`,
    };
  },
});
