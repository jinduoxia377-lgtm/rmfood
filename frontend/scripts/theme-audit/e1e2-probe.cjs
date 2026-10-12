// 阶段 E1/E2 功能实测：/settings?tab=theme 「圆角」与「配置备份」两新区块
//
// 校验：
//   ① 两个新区块渲染（h3 标题、radiogroup 选项数、导出/导入按钮）
//   ② 圆角选中：点击「圆润」→ --radius-lg 变为 20px；选中态 aria-checked 同步
//   ③ 圆角刷新持久：刷新后 --radius-lg 仍为 20px、选中态仍为「圆润」
//   ④ 半径真实生效：Tailwind rounded-lg 元素计算出的 border-radius 跟随令牌变化
//   ⑤ 导出：下载触发且 JSON 为 v2.1 快照（含 runtimeOverrides + 五选中态键，E3 起）
//   ⑥ 重置默认：--radius-lg 回到 L0 的 12px、选中态回到「标准」
//
// 运行：cd frontend && node scripts/theme-audit/e1e2-probe.cjs
const { chromium } = require('@playwright/test');

const GROUP = (label) => `[role="radiogroup"][aria-label="${label}"] [role="radio"]`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // 登录（/settings 为受保护路由）
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"], button:has-text("进入平台")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const R = {};
  const radius = () => page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--radius-lg').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--radius-lg').trim());

  // ── ① 区块渲染 ──────────────────────────────────────────────
  R.headings = await page.evaluate(() =>
    [...document.querySelectorAll('section h3')].map(h => h.textContent.trim()));
  R.radiusOptions = await page.locator(GROUP('圆角方案')).count();
  R.radiusLabels = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="圆角方案"] [role="radio"]')]
      .map(b => (b.getAttribute('aria-label') || '').replace('圆角方案', '')));
  R.exportBtn = await page.locator('button:has-text("下载 JSON 配置")').count();
  R.importTrigger = await page.locator('button:has-text("选择 JSON 配置文件")').count();
  R.fileInput = await page.locator('input[type="file"][accept*="json"]').count();
  R.radiusBaseline = await radius();

  // ── ② 圆角选中生效 ──────────────────────────────────────────
  // 同时选配色与字号，以便后面验证「导出快照含全部选中态」的完整链路
  await page.locator(GROUP('配色方案')).nth(1).click(); // 苹果蓝
  await page.waitForTimeout(500);
  await page.locator(GROUP('字体大小')).nth(2).click(); // 宽松
  await page.waitForTimeout(500);

  const before = await radius();
  await page.locator(GROUP('圆角方案')).nth(2).click(); // 圆润
  await page.waitForTimeout(700);
  R.radiusAfterClick = await radius();
  R.radiusChanged = R.radiusAfterClick !== before;
  R.checkedAfterClick = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="圆角方案"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));
  R.paletteChecked = await page.locator(GROUP('配色方案')).evaluateAll(
    els => els.map(b => b.getAttribute('aria-checked')));
  R.fontChecked = await page.locator(GROUP('字体大小')).evaluateAll(
    els => els.map(b => b.getAttribute('aria-checked')));

  // ④ 真实生效：找一个页面内 rounded-lg 元素，验证其 border-radius 跟随
  R.roundedElement = await page.evaluate(() => {
    const el = document.querySelector('.rounded-lg, [class*="rounded-lg"]');
    return el ? getComputedStyle(el).borderRadius : null;
  });

  // ── ③ 刷新持久 ──────────────────────────────────────────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  R.radiusAfterReload = await radius();
  R.checkedAfterReload = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="圆角方案"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));

  // ── ⑤ 导出 ──────────────────────────────────────────────────
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.locator('button:has-text("下载 JSON 配置")').click(),
  ]);
  R.downloadName = download.suggestedFilename();
  const fs = require('fs');
  const path = require('path');
  const tmp = path.join(require('os').tmpdir(), download.suggestedFilename());
  await download.saveAs(tmp);
  const snap = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);
  R.snap = {
    version: snap.version,
    app: snap.app,
    paletteKey: snap.paletteKey,
    fontScale: snap.fontScale,
    radiusScale: snap.radiusScale,
    // E3 新增：次色 / 强调色选中态。此场景未选，应为空串（= 视同 L0 默认）
    secondaryPaletteKey: snap.secondaryPaletteKey,
    accentPaletteKey: snap.accentPaletteKey,
    hasRuntimeOverrides: !!snap.runtimeOverrides,
    hasSettings: !!snap.settings,
    hasTheme: !!snap.theme,
    borderRadiusLg: snap.runtimeOverrides?.borderRadius?.lg,
  };

  // ── ⑥ 重置默认 ──────────────────────────────────────────────
  await page.locator('button:has-text("重置默认")').click();
  await page.waitForTimeout(700);
  R.radiusAfterReset = await radius();
  R.checkedAfterReset = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="圆角方案"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));

  R.pageErrors = errors;

  // ── 判定 ────────────────────────────────────────────────────
  const PASS = [];
  const FAIL = [];
  const check = (name, cond) => (cond ? PASS : FAIL).push(name);

  check('区块标题含「圆角」与「配置备份」',
    R.headings.includes('圆角') && R.headings.includes('配置备份'));
  check('圆角 radiogroup 有 3 个选项', R.radiusOptions === 3);
  check('圆角选项标签为 锐利/标准/圆润',
    JSON.stringify(R.radiusLabels) === JSON.stringify(['锐利', '标准', '圆润']));
  check('导出/导入控件齐备（导出按钮 + 导入按钮 + file input）',
    R.exportBtn === 1 && R.importTrigger === 1 && R.fileInput === 1);
  check('L0 基线 --radius-lg = 12px', R.radiusBaseline === '12px');
  check('点击「圆润」后 --radius-lg → 20px', R.radiusAfterClick === '20px');
  check('圆角选中态派生（恰好 1 个 aria-checked=true）',
    R.checkedAfterClick.filter(v => v === 'true').length === 1 && R.checkedAfterClick[2] === 'true');
  check('rounded-lg 元素计算值跟随令牌（20px）', R.roundedElement === '20px');
  check('刷新后 --radius-lg 仍为 20px', R.radiusAfterReload === '20px');
  check('刷新后选中态仍为「圆润」',
    R.checkedAfterReload.filter(v => v === 'true').length === 1 && R.checkedAfterReload[2] === 'true');
  check('导出文件名带日期', /^rmfood-theme-\d{4}-\d{2}-\d{2}\.json$/.test(R.downloadName));
  check('导出 JSON 为 v2.1 快照（含 runtimeOverrides + 五选中态键）',
    R.snap.version === '2.1.0' && R.snap.app === 'rmfood-theme' &&
    R.snap.hasRuntimeOverrides && R.snap.paletteKey === 'blue' &&
    R.snap.fontScale === 'relaxed' && R.snap.radiusScale === 'rounded' &&
    typeof R.snap.secondaryPaletteKey === 'string' &&
    typeof R.snap.accentPaletteKey === 'string');
  check('导出快照的 borderRadius.lg 与实际生效值一致', R.snap.borderRadiusLg === '20px');
  check('重置默认后 --radius-lg 回到 12px', R.radiusAfterReset === '12px');
  check('重置默认后选中态回到「标准」',
    R.checkedAfterReset.filter(v => v === 'true').length === 1 && R.checkedAfterReset[1] === 'true');
  check('全程无 pageerror', R.pageErrors.length === 0);

  console.log(JSON.stringify(R, null, 2));
  console.log(`\n✅ PASS ${PASS.length} / ❌ FAIL ${FAIL.length}`);
  FAIL.forEach(f => console.log('  ❌ ' + f));
  await browser.close();
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => {
  console.error('PROBE_ERROR', e);
  process.exit(2);
});
