// T-F1a 验证：对话区暗色样式必须由**应用设置**驱动，而非操作系统偏好
// 两个判别性场景：
//   A) OS=dark + 应用=light  → 必须为浅色（修复前会被 OS 拖成暗色）
//   B) OS=light + 应用=dark  → 必须为暗色（修复前 .dark.chat-unified 是死规则，暗色不生效）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });

async function run(osScheme, appMode, route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: osScheme });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2800);
  // 登录以进入需要鉴权的页面
  const pw = await page.$('input[type="password"]');
  if (pw) {
    await page.fill('#rhine-username, input[type="text"]', 'admin');
    await page.fill('#rhine-password, input[type="password"]', 'admin123');
    await page.locator('button[type="submit"], button:has-text("登录")').first().click();
    try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 40000 }); } catch {}
    await page.waitForTimeout(2500);
  }
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const r = await page.evaluate(async (m) => {
    const st = await import('/src/stores/themeStore.ts');
    st.useThemeStore.getState().setPresetTheme(m);
    await new Promise(r => setTimeout(r, 450));
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();

    // 造 .chat-unified 结构，验证原本死掉的 .dark.chat-unified 规则是否复活
    const wrap = document.createElement('div');
    wrap.className = 'chat-unified';
    const cell = document.createElement('div');
    cell.className = 'chat-md-table-wrapper';
    wrap.appendChild(cell);
    document.body.appendChild(wrap);
    const border = getComputedStyle(cell).borderColor;
    wrap.remove();

    return {
      'OS 偏好': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      应用模式: m,
      'html.dark': document.documentElement.classList.contains('dark'),
      '--empty-state-bg-primary': g('--empty-state-bg-primary') || '(未加载)',
      '表格边框色(.chat-unified 内)': border,
    };
  }, appMode);
  await ctx.close();
  return r;
}

const A = await run('dark', 'light-default', '/ai');
const B = await run('light', 'dark-default', '/ai');

console.log('══ 场景 A：OS=dark + 应用=light（应表现为浅色）══');
for (const [k, v] of Object.entries(A)) console.log(`   ${k.padEnd(30)} ${v}`);
console.log('\n══ 场景 B：OS=light + 应用=dark（应表现为暗色）══');
for (const [k, v] of Object.entries(B)) console.log(`   ${k.padEnd(30)} ${v}`);

const errs = [];
const isLightBorder = (c) => /rgb\(226,\s*232,\s*240\)/.test(String(c));
const isDarkBorder = (c) => !isLightBorder(c) && /rgb\(/.test(String(c));

if (!isLightBorder(A['表格边框色(.chat-unified 内)'])) {
  errs.push(`A: 应用=light 但表格边框=${A['表格边框色(.chat-unified 内)']} → 仍被 OS 暗色影响`);
}
if (!isDarkBorder(B['表格边框色(.chat-unified 内)'])) {
  errs.push(`B: 应用=dark 但表格边框=${B['表格边框色(.chat-unified 内)']} → 暗色未生效（死规则未复活）`);
}
if (A['--empty-state-bg-primary'] === '(未加载)') {
  errs.push('提示：--empty-state-* 未加载到该路由，改用静态检查兜底');
}

console.log('\n── 判定 ──');
const real = errs.filter(e => !e.startsWith('提示'));
if (real.length) { for (const e of real) console.log('  ❌ ' + e); }
else console.log('  ✅ 对话区暗色样式完全由应用设置驱动（OS 不再影响；原自作用域死规则已复活）');
for (const e of errs.filter(x => x.startsWith('提示'))) console.log('  ℹ️  ' + e);

fs.writeFileSync('D:/RMFOODFP/temp/theme-tf1a-verify.json', JSON.stringify({ A, B, errs }, null, 2), 'utf8');
await browser.close();
process.exit(real.length ? 1 : 0);
