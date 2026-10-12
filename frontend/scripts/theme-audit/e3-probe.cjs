// 阶段 E3 功能实测：/settings?tab=theme 「次色方案」「强调色方案」两个新区块
//
// 校验：
//   ① 两个新区块渲染（h3 标题、各 5 个选项）
//   ② 选次色：运行时 <style> 出现 --color-secondary-* 的 :root/.dark 双作用域块，
//      且主色 / 强调色不受牵连（按族独立）
//   ③ 选强调色：同上，次色不受牵连
//   ④ 语义族随色族走：--color-secondary-container / -surface 不再是上一模式的残留值
//   ⑤ 暗色模式：同一选择下 .dark 块给出反转后的档位与 rgba 容器
//   ⑥ 刷新持久：冷启动后运行时样式表与选中态都还原（E3 的 v7 migrate 生效）
//   ⑦ 重置默认：运行时样式表移除，回落到 L0 基线值
//
// 运行：cd frontend && node scripts/theme-audit/e3-probe.cjs
const { chromium } = require('@playwright/test');

const GROUP = (label) => `[role="radiogroup"][aria-label="${label}"] [role="radio"]`;
const STYLE_ID = 'rmfood-runtime-theme';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  // 运行时 <style> 文本；双作用域块不在 inline 上，必须从样式表读
  const runtimeCSS = () => page.evaluate((id) => {
    const el = document.getElementById(id);
    return el ? el.textContent : '';
  }, STYLE_ID);

  // 计算出的令牌值（走 :root / .dark 作用域，inline 取不到）
  const computed = (token) => page.evaluate((t) =>
    getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token);

  const checkedOf = (label) => page.locator(GROUP(label)).evaluateAll(
    bs => bs.map(b => b.getAttribute('aria-checked')));

  // ── ① 区块渲染 ──────────────────────────────────────────────
  R.headings = await page.evaluate(() =>
    [...document.querySelectorAll('section h3')].map(h => h.textContent.trim()));
  R.secondaryOptions = await page.locator(GROUP('次色方案')).count();
  R.accentOptions = await page.locator(GROUP('强调色方案')).count();
  R.secondaryLabels = await page.locator(GROUP('次色方案')).evaluateAll(
    bs => bs.map(b => (b.getAttribute('aria-label') || '').replace('次色方案', '')));
  R.accentLabels = await page.locator(GROUP('强调色方案')).evaluateAll(
    bs => bs.map(b => (b.getAttribute('aria-label') || '').replace('强调色方案', '')));
  R.checkedBefore = {
    secondary: await checkedOf('次色方案'),
    accent: await checkedOf('强调色方案'),
  };

  // ── L0 基线值（用于「不受牵连」与「重置回落」断言）─────────
  R.l0 = {
    sec500: await computed('--color-secondary-500'),
    secContainer: await computed('--color-secondary-container'),
    acc500: await computed('--color-accent-500'),
    accContainer: await computed('--color-accent-container'),
    pri500: await computed('--color-primary-500'),
  };
  R.runtimeEmptyAtStart = (await runtimeCSS()).length;

  // ── ② 选次色「天青」(#0EA5E9) ───────────────────────────────
  await page.locator(GROUP('次色方案')).nth(1).click();
  await page.waitForTimeout(500);
  let css = await runtimeCSS();
  R.afterSecondary = {
    hasRoot: css.includes(':root {'),
    hasDark: css.includes('.dark {'),
    hasSecondary500: /--color-secondary-500:\s*#0ea5e9/i.test(css),
    // 按族独立：主色与强调色不得被写入运行时覆盖
    noPrimary: !/--color-primary-/.test(css),
    noAccent: !/--color-accent-/.test(css),
    computed500: await computed('--color-secondary-500'),
    computedContainer: await computed('--color-secondary-container'),
    primaryUntouched: await computed('--color-primary-500'),
    accentUntouched: await computed('--color-accent-500'),
    checked: await checkedOf('次色方案'),
  };

  // ── ③ 再选强调色「品红」(#EC4899)：次色必须仍在 ─────────────
  await page.locator(GROUP('强调色方案')).nth(3).click();
  await page.waitForTimeout(500);
  css = await runtimeCSS();
  R.afterAccent = {
    hasAccent500: /--color-accent-500:\s*#ec4899/i.test(css),
    secondaryStillThere: /--color-secondary-500:\s*#0ea5e9/i.test(css),
    noPrimary: !/--color-primary-/.test(css),
    computedAcc500: await computed('--color-accent-500'),
    computedAccContainer: await computed('--color-accent-container'),
    secondaryKept: await computed('--color-secondary-500'),
    primaryUntouched: await computed('--color-primary-500'),
    checked: await checkedOf('强调色方案'),
  };

  // ── ④⑤ 切到暗色模式：.dark 块给出反转值 ────────────────────
  await page.locator('button:has-text("深色")').first().click();
  await page.waitForTimeout(700);
  css = await runtimeCSS();
  const darkBlock = css.includes('.dark {') ? css.slice(css.indexOf('.dark {')) : '';
  R.afterDark = {
    htmlHasDark: await page.evaluate(() => document.documentElement.classList.contains('dark')),
    // 暗色块的容器是 rgba（L0 dark.css 的写法），亮色块是实色 hex
    darkContainerIsRgba: /--color-secondary-container:\s*rgba\(/.test(darkBlock),
    darkSecondary500: /--color-secondary-500:\s*#0ea5e9/i.test(darkBlock),
    darkAccent500: /--color-accent-500:\s*#ec4899/i.test(darkBlock),
    darkBlockLen: darkBlock.length,
    computedSec500Dark: await computed('--color-secondary-500'),
    computedAcc500Dark: await computed('--color-accent-500'),
    computedSecContainerDark: await computed('--color-secondary-container'),
    // 暗色 600 档应比亮色浅（档位反转）
    dark600: await computed('--color-secondary-600'),
  };

  // ── ⑥ 刷新持久（冷启动回放 + v7 migrate）──────────────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  css = await runtimeCSS();
  R.afterReload = {
    runtimeStillThere: css.length,
    secondary500: /--color-secondary-500:\s*#0ea5e9/i.test(css),
    accent500: /--color-accent-500:\s*#ec4899/i.test(css),
    checkedSecondary: await checkedOf('次色方案'),
    checkedAccent: await checkedOf('强调色方案'),
    computedSec500: await computed('--color-secondary-500'),
    computedAcc500: await computed('--color-accent-500'),
    localStorageVersion: await page.evaluate(() => {
      const raw = localStorage.getItem('rmfood-theme-storage');
      return raw ? JSON.parse(raw).version : null;
    }),
  };

  // ── ⑦ 重置默认 ──────────────────────────────────────────────
  await page.locator('button:has-text("重置默认")').first().click();
  await page.waitForTimeout(600);
  R.afterReset = {
    runtimeRemoved: (await runtimeCSS()).length,
    secondary500: await computed('--color-secondary-500'),
    accent500: await computed('--color-accent-500'),
    checkedSecondary: await checkedOf('次色方案'),
    checkedAccent: await checkedOf('强调色方案'),
  };

  R.pageErrors = errors;

  await browser.close();

  // ── 判定 ────────────────────────────────────────────────────
  const A = [];
  const chk = (name, cond, got) => A.push({ name, ok: !!cond, got });
  chk('① 次色区块 5 个选项', R.secondaryOptions === 5, R.secondaryOptions);
  chk('① 强调色区块 5 个选项', R.accentOptions === 5, R.accentOptions);
  chk('① 两个新区块标题已渲染',
    R.headings.includes('次色方案') && R.headings.includes('强调色方案'), R.headings);
  chk('① 初始无运行时样式表', R.runtimeEmptyAtStart === 0, R.runtimeEmptyAtStart);
  chk('① 初始高亮默认项（未选择 = 视同 L0 默认，与主色的 || \'green\' 一致）',
    R.checkedBefore.secondary[0] === 'true' && R.checkedBefore.accent[0] === 'true', R.checkedBefore);
  chk('② 选次色：运行时块双作用域', R.afterSecondary.hasRoot && R.afterSecondary.hasDark);
  chk('② 选次色：--color-secondary-500 = 天青锚点', R.afterSecondary.hasSecondary500);
  chk('② 选次色：计算值已换色', R.afterSecondary.computed500.toLowerCase() === '#0ea5e9',
    R.afterSecondary.computed500);
  chk('② 选次色：主色不受牵连', R.afterSecondary.noPrimary, 'noPrimary');
  chk('② 选次色：强调色不受牵连', R.afterSecondary.noAccent, 'noAccent');
  chk('② 选次色：主色 500 仍为 L0',
    R.afterSecondary.primaryUntouched === R.l0.pri500,
    R.afterSecondary.primaryUntouched);
  chk('② 选次色：选中态高亮第 2 项', R.afterSecondary.checked[1] === 'true',
    R.afterSecondary.checked);
  chk('③ 选强调色：--color-accent-500 = 品红锚点', R.afterAccent.hasAccent500);
  chk('③ 选强调色：次色覆盖仍保留（累计）', R.afterAccent.secondaryStillThere);
  chk('③ 选强调色：主色不受牵连', R.afterAccent.noPrimary, 'noPrimary');
  chk('③ 选强调色：次色计算值仍在', R.afterAccent.secondaryKept.toLowerCase() === '#0ea5e9',
    R.afterAccent.secondaryKept);
  chk('③ 选强调色：强调色计算值已换', R.afterAccent.computedAcc500.toLowerCase() === '#ec4899',
    R.afterAccent.computedAcc500);
  chk('③ 选强调色：选中态高亮第 4 项', R.afterAccent.checked[3] === 'true',
    R.afterAccent.checked);
  chk('④⑤ 暗色模式：html.dark 生效', R.afterDark.htmlHasDark);
  chk('④⑤ 暗色块：次色容器为 rgba 形态', R.afterDark.darkContainerIsRgba,
    R.afterDark.computedSecContainerDark);
  chk('④⑤ 暗色块：次色 500 锚点仍在', R.afterDark.darkSecondary500);
  chk('④⑤ 暗色块：强调色 500 锚点仍在', R.afterDark.darkAccent500);
  chk('④⑤ 暗色块非空', R.afterDark.darkBlockLen > 100, R.afterDark.darkBlockLen);
  chk('⑥ 刷新后运行时样式表保留', R.afterReload.runtimeStillThere > 100,
    R.afterReload.runtimeStillThere);
  chk('⑥ 刷新后次色覆盖保留', R.afterReload.secondary500);
  chk('⑥ 刷新后强调色覆盖保留', R.afterReload.accent500);
  chk('⑥ 刷新后选中态还原',
    R.afterReload.checkedSecondary[1] === 'true' && R.afterReload.checkedAccent[3] === 'true',
    { s: R.afterReload.checkedSecondary, a: R.afterReload.checkedAccent });
  chk('⑥ 刷新后次色计算值保持', R.afterReload.computedSec500.toLowerCase() === '#0ea5e9',
    R.afterReload.computedSec500);
  chk('⑥ 刷新后强调色计算值保持', R.afterReload.computedAcc500.toLowerCase() === '#ec4899',
    R.afterReload.computedAcc500);
  chk('⑥ 持久化版本已升到 v7', R.afterReload.localStorageVersion === 7,
    R.afterReload.localStorageVersion);
  chk('⑦ 重置后运行时样式表移除', R.afterReset.runtimeRemoved === 0, R.afterReset.runtimeRemoved);
  chk('⑦ 重置后次色回落 L0', R.afterReset.secondary500 === R.l0.sec500,
    R.afterReset.secondary500);
  chk('⑦ 重置后强调色回落 L0', R.afterReset.accent500 === R.l0.acc500,
    R.afterReset.accent500);
  chk('⑦ 重置后选中态回到默认项（海洋蓝 / 生物紫）',
    R.afterReset.checkedSecondary[0] === 'true' && R.afterReset.checkedAccent[0] === 'true',
    R.afterReset);
  chk('全程无 pageerror', errors.length === 0, errors);

  console.log('\n══ E3 实测结果 ══');
  for (const a of A) console.log(`  ${a.ok ? '✅' : '❌'} ${a.name}${a.got !== undefined ? `  ← ${JSON.stringify(a.got)}` : ''}`);
  const bad = A.filter(a => !a.ok);
  console.log(`\n  ${A.length - bad.length}/${A.length} 通过`);
  if (bad.length) {
    console.log('\n── 失败详情 ──');
    console.log(JSON.stringify(R, null, 2));
    process.exitCode = 1;
  }
})();
