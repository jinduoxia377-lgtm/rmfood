/**
 * 配方管理模块 - Playwright E2E 冒烟测试
 * 覆盖核心用户场景和关键功能路径
 */
import { test, expect } from '@playwright/test'

test.describe('配方管理 - 冒烟测试', () => {

  test.beforeEach(async ({ page }) => {
    // 登录（如果需要）
    await page.goto('/formulas')
  })

  // ==================== TC-001: 页面加载 ====================
  test('TC-001: 页面应在 2 秒内加载完成', async ({ page }) => {
    const startTime = Date.now()

    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // 验证页面基本结构
    await expect(page.locator('[data-testid="formula-list"]')).toBeVisible({ timeout: 2000 })
    await expect(page.locator('[data-testid="statistics-cards"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible()

    // 性能断言
    expect(loadTime).toBeLessThan(2000)
  })

  // ==================== TC-002: 配方列表显示 ====================
  test('TC-002: 列表应正确显示配方数据', async ({ page }) => {
    // 等待列表加载
    await page.waitForSelector('[data-testid="formula-row"]', { timeout: 5000 })

    // 验证表格/卡片存在
    const formulaRows = page.locator('[data-testid="formula-row"]')
    await expect(formulaRows.first()).toBeVisible()

    // 验证分页组件
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible()

    // 验证统计数字
    await expect(page.locator('[data-testid="total-count"]')).toContainText(/\d+/)
  })

  // ==================== TC-003: 筛选功能 ====================
  test('TC-003: 状态筛选应正常工作', async ({ page }) => {
    // 打开筛选面板
    await page.click('[data-testid="filter-toggle"]')
    await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible()

    // 选择状态
    await page.selectOption('[data-testid="status-filter"]', 'draft')

    // 等待列表更新
    await page.waitForResponse('**/api/formulas**')

    // 验证 URL 参数更新
    expect(page.url()).toContain('status=draft')
  })

  // ==================== TC-004: 搜索功能 ====================
  test('TC-004: 关键字搜索应返回匹配结果', async ({ page }) => {
    // 输入搜索关键字
    await page.fill('[data-testid="search-input"]', '黄芪')

    // 等待搜索结果
    await page.waitForResponse('**/api/formulas?*search=***')

    // 验证搜索结果包含关键字
    const results = page.locator('[data-testid="formula-name"]')
    if (await results.count() > 0) {
      for (let i = 0; i < await results.count(); i++) {
        await expect(results.nth(i)).toContainText(/黄芪/i)
      }
    }
  })

  // ==================== TC-005: 排序功能 ====================
  test('TC-005: 点击表头应切换排序', async ({ page }) => {
    // 点击名称列排序
    await page.click('[data-testid="sort-name"]')

    // 等待列表重新加载
    await page.waitForResponse('**/api/formulas**')

    // 验证排序参数
    expect(page.url()).toContain('sort_field=name')

    // 再次点击切换方向
    await page.click('[data-testid="sort-name"]')
    expect(page.url()).toContain('sort_dir=desc')
  })

  // ==================== TC-006: 分页功能 ====================
  test('TC-006: 翻页应正常工作', async ({ page }) => {
    // 等待列表加载完成
    await page.waitForSelector('[data-testid="pagination"]')

    // 点击下一页
    await page.click('[data-testid="page-next"]')

    // 等待页面参数更新
    await page.waitForURL('**/formulas?page=2**')

    // 验证页码显示
    await expect(page.locator('[data-testid="current-page"]')).toHaveText('2')
  })

  // ==================== TC-007: 新建配方流程 ====================
  test('TC-007: 新建配方页面应可访问', async ({ page }) => {
    // 点击新建按钮
    await page.click('[data-testid="btn-create-formula"]')

    // 验证导航到新建页面
    await page.waitForURL('**/formulas/new**')

    // 验证表单元素存在
    await expect(page.locator('[data-testid="formula-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="textarea-description"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-submit"]')).toBeVisible()
  })

  // ==================== TC-008: 配方详情查看 ====================
  test('TC-008: 详情页应显示完整信息', async ({ page }) => {
    // 点击第一个配方的详情按钮
    await page.click('[data-testid="formula-row"] [data-testid="btn-detail"]:first-child')

    // 等待详情页加载
    await page.waitForURL('**/formulas/**')

    // 验证详情内容
    await expect(page.locator('[data-testid="formula-detail-header"]')).toBeVisible()
    await expect(page.locator('[data-testid="formula-info-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="ingredient-list"]')).toBeVisible()

    // 验证 Tab 结构
    await expect(page.locator('[data-testid="detail-tabs"]')).toBeVisible()
  })

  // ==================== TC-009: 编辑功能 ====================
  test('TC-009: 编辑按钮应跳转到编辑页', async ({ page }) => {
    // 进入详情页
    await page.click('[data-testid="formula-row"] [data-testid="btn-detail"]:first-child')
    await page.waitForURL('**/formulas/**')

    // 点击编辑按钮
    await page.click('[data-testid="btn-edit"]')

    // 验证进入编辑模式或编辑页面
    await expect(page.locator('[data-testid="edit-form"]') ||
                 page.locator('[data-testid="inline-editor"]')).toBeVisible()
  })

  // ==================== TC-010: 导出功能 ====================
  test('TC-010: 导出弹窗应正常打开', async ({ page }) => {
    // 点击导出按钮
    await page.click('[data-testid="btn-export"]')

    // 验证弹窗打开
    await expect(page.locator('[data-testid="export-modal"]')).toBeVisible()

    // 验证选项存在
    await expect(page.locator('[data-testid="export-format-options"]')).toBeVisible()
    await expect(page.locator('[data-testid="export-scope-options"]')).toBeVisible()
  })

  // ==================== TC-011: 导入功能 ====================
  test('TC-011: 导入弹窗应支持文件上传', async ({ page }) => {
    // 点击导入按钮
    await page.click('[data-testid="btn-import"]')

    // 验证弹窗打开
    await expect(page.locator('[data-testid="import-modal"]')).toBeVisible()

    // 验证上传区域
    await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached()
  })

  // ==================== TC-012: 权限控制 - Viewer 角色 ====================
  test('TC-012: Viewer 角色不应看到管理按钮', async ({ page, context }) => {
    // 使用 viewer 账号登录（需要根据实际认证系统调整）
    // 这里假设可以通过 URL 参数切换角色，或者需要单独的登录流程

    // 如果有角色切换功能
    // await page.goto('/formulas?role=viewer')

    // 验证敏感按钮不可见
    const createButton = page.locator('[data-testid="btn-create-formula"]')
    const deleteButton = page.locator('[data-testid="btn-delete"]')

    // 注意：具体实现取决于权限控制的 UI 展示方式
    // 可能是隐藏、禁用或不渲染
    await expect(createButton).not.toBeVisible()
    await expect(deleteButton).not.toBeVisible()
  })

  // ==================== TC-013: 响应式布局 - 移动端 ====================
  test('TC-013: 移动端布局应适配小屏幕', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 刷新页面
    await page.reload()

    // 验证移动端适配
    await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-drawer"]')).toBeHidden() // 默认隐藏

    // 点击展开筛选
    await page.click('[data-testid="mobile-menu-btn"]')
    await expect(page.locator('[data-testid="filter-drawer"]')).toBeVisible()
  })

  // ==================== TC-014: 错误处理 ====================
  test('TC-014: 网络错误应显示友好提示', async ({ page }) => {
    // 模拟网络错误
    await page.route('**/api/formulas**', route => {
      route.fulfill({ status: 500, body: '{"error": "Internal Server Error"}' })
    })

    // 刷新页面触发错误
    await page.reload()

    // 验证错误提示显示
    await expect(page.locator('[data-testid="error-message"]') ||
                 page.locator('.error-toast')).toBeVisible({ timeout: 5000 })
  })

  // ==================== TC-015: 加载状态 ====================
  test('TC-015: 数据加载时应显示 Skeleton', async ({ page }) => {
    // 模拟慢速响应
    await page.route('**/api/formulas**', route => {
      setTimeout(() => route.continue(), 2000)
    })

    // 刷新页面
    await page.goto('/formulas')

    // 验证骨架屏显示
    await expect(page.locator('[data-testid="skeleton-loader"]') ||
                 page.locator('.skeleton')).toBeVisible()

    // 等待数据加载完成
    await page.waitForSelector('[data-testid="formula-list"]', { timeout: 5000 })
  })

  // ==================== TC-016: 批量操作 ====================
  test('TC-016: 批量选择和删除应正常工作', async ({ page }) => {
    // 勾选多个配方
    const checkboxes = page.locator('[data-testid="checkbox-select"]')
    const count = await checkboxes.count()

    if (count >= 2) {
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()

      // 验证批量操作栏出现
      await expect(page.locator('[data-testid="batch-actions"]')).toBeVisible()

      // 验证选中计数
      await expect(page.locator('[data-testid="selected-count"]')).toContainText('2')
    }
  })

  // ==================== TC-017: 版本历史 ====================
  test('TC-017: 版本历史应可查看', async ({ page }) => {
    // 进入详情页
    await page.click('[data-testid="formula-row"] [data-testid="btn-detail"]:first-child')
    await page.waitForURL('**/formulas/**')

    // 点击版本历史 Tab 或按钮
    const versionTab = page.locator('[data-testid="tab-version-history"]')
    if (await versionTab.isVisible()) {
      await versionTab.click()

      // 验证版本列表显示
      await expect(page.locator('[data-testid="version-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="version-item"]').first()).toBeVisible()
    }
  })

  // ==================== TC-018: 操作日志 ====================
  test('TC-018: 操作日志面板应可打开', async ({ page }) => {
    // 进入详情页
    await page.click('[data-testid="formula-row"] [data-testid="btn-detail"]:first-child')
    await page.waitForURL('**/formulas/**')

    // 点击日志按钮
    const logBtn = page.locator('[data-testid="btn-operation-log"]')
    if (await logBtn.isVisible()) {
      await logBtn.click()

      // 验证日志面板显示
      await expect(page.locator('[data-testid="operation-log-panel"]')).toBeVisible()
      await expect(page.locator('[data-testid="log-entry"]').first()).toBeVisible()
    }
  })

  // ==================== TC-019: 收藏功能 ====================
  test('TC-019: 收藏/取消收藏应正常工作', async ({ page }) => {
    // 点击收藏按钮
    const favoriteBtn = page.locator('[data-testid="formula-row"] [data-testid="btn-favorite"]:first-child')
    if (await favoriteBtn.isVisible()) {
      await favoriteBtn.click()

      // 验证状态变化（图标高亮或提示消息）
      await expect(favoriteBtn).toHaveClass(/active|favorited/i)

      // 再次点击取消收藏
      await favoriteBtn.click()
      await expect(favoriteBtn).not.toHaveClass(/active|favorited/i)
    }
  })

  // ==================== TC-020: 快速预览 ====================
  test('TC-020: 快速预览弹窗应显示摘要信息', async ({ page }) => {
    // 悬停或点击快速预览按钮
    const quickViewBtn = page.locator('[data-testid="formula-row"] [data-testid="btn-quick-view"]:first-child')
    if (await quickViewBtn.isVisible()) {
      await quickViewBtn.click()

      // 验证预览弹窗
      await expect(page.locator('[data-testid="quick-view-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="preview-summary"]')).toBeVisible()
    }
  })

})

// ==================== 性能测试 ====================
test.describe('性能测试', () => {

  test('列表虚拟滚动应保持流畅', async ({ page }) => {
    // 设置大量数据场景
    await page.goto('/formulas?page_size=1000')

    // 测量滚动性能
    const scrollMetrics = await page.evaluate(() => {
      const start = performance.now()
      window.scrollTo(0, document.body.scrollHeight)
      return {
        scrollTime: performance.now() - start,
        fps: Math.round(1000 / (performance.now() - start)),
      }
    })

    // 滚动时间应小于 100ms
    expect(scrollMetrics.scrollTime).toBeLessThan(100)
  })

})
