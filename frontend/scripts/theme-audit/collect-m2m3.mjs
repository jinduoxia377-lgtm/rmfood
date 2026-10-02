// §17.11 M2/M3 复测数据采集
// 采集当前主题系统的关键运行时指标，写入 temp/theme-m2m3-verify.json
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = 'http://127.0.0.1:3000';
const OUT = 'D:/RMFOODFP/temp/theme-m2m3-verify.json';

// 简单 Playwright 驱动（与 theme-gate.mjs 相同的浏览器模式）
let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  console.error('@playwright/test 不可用');
  process.exit(1);
}

const results = {
  collectedAt: new Date().toISOString(),
  baseUrl: BASE,
  htmlInlineProps: null,
  presetModes: {},
  contrastChecks: [],
  gateResult: null,
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

async function applyPreset(presetId) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate((id) => {
    const root = document.documentElement;
    // 直接通过 Zustand store 的持久化键设置
    try {
      const raw = localStorage.getItem('rmfood-theme-storage');
      const cur = raw ? JSON.parse(raw) : { state: {} };
      cur.state = cur.state || {};
      cur.state.activeThemeId = id;
      cur.version = 4;
      localStorage.setItem('rmfood-theme-storage', JSON.stringify(cur));
    } catch {}
    location.reload();
  }, presetId);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function measureInlineProps() {
  // 等 data-mode / data-theme 落定（reload 后 store 异步初始化）
  await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') !== null, { timeout: 15000 });
  await page.waitForTimeout(400);
  return await page.evaluate(() => {
    const root = document.documentElement;
    const inline = root.getAttribute('style') || '';
    const propCount = (inline.match(/--[a-z0-9-]+:\s*[^;]+/gi) || []).length;
    const sampleVars = ['--color-primary', '--color-primary-contrast-text', '--color-success', '--color-error', '--color-warning', '--color-info', '--z-modal-backdrop', '--ease-standard'];
    const cs = getComputedStyle(root);
    const vals = {};
    sampleVars.forEach(v => { vals[v] = cs.getPropertyValue(v).trim() || null; });
    const hexToRgb = (h) => {
      if (!h) return null;
      const m = h.match(/^#?([0-9a-f]{6})$/i);
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    };
    const lum = ([r, g, b]) => {
      const [rs, gs, bs] = [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    const contrast = (c1, c2) => {
      const [l1, l2] = [lum(c1), lum(c2)].sort((a, b) => a - b);
      return (l2 + 0.05) / (l1 + 0.05);
    };
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const primaryRgb = hexToRgb(vals['--color-primary']);
    const bgRgb = hexToRgb(bodyBg.replace(/rgba?\(([^)]+)\)/, (m, a) => {
      const [r, g, b] = a.split(',').map(x => parseInt(x.trim()));
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }));
    const contrastPrimary = primaryRgb && bgRgb ? contrast(primaryRgb, bgRgb) : null;
    return { propCount, vals, contrastPrimary, mode: root.getAttribute('data-mode'), bodyBg };
  });
}

// 1. 内置纯净预设 light-default
console.log('── 采集 light-default（内置纯净）──');
await applyPreset('light-default');
results.presetModes['light-default'] = await measureInlineProps();
console.log('  内联自定义属性数:', results.presetModes['light-default'].propCount, '（T-B2b 后应为 0）');
console.log('  --color-primary:', results.presetModes['light-default'].vals['--color-primary'], 'mode:', results.presetModes['light-default'].mode);

// 2. 暗色内置预设 dark-default
console.log('── 采集 dark-default（内置纯净暗色）──');
await applyPreset('dark-default');
results.presetModes['dark-default'] = await measureInlineProps();
console.log('  内联自定义属性数:', results.presetModes['dark-default'].propCount, '（应为 0）');
console.log('  --color-primary:', results.presetModes['dark-default'].vals['--color-primary'], 'mode:', results.presetModes['dark-default'].mode);

// 3. 色盲无障碍变体 color-blind
console.log('── 采集 color-blind（无障碍变体，应注入 Okabe-Ito）──');
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('rmfood-theme-storage');
    const cur = raw ? JSON.parse(raw) : { state: {} };
    cur.state = cur.state || {};
    cur.state.accessibilityMode = 'color-blind';
    cur.version = 4;
    localStorage.setItem('rmfood-theme-storage', JSON.stringify(cur));
  } catch {}
});
await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);
results.presetModes['color-blind'] = await measureInlineProps();
console.log('  内联自定义属性数:', results.presetModes['color-blind'].propCount, '（应为 86，含 Okabe-Ito 色板）');
console.log('  --color-success:', results.presetModes['color-blind'].vals['--color-success'], '（应为 #009E73）');
console.log('  --color-error:', results.presetModes['color-blind'].vals['--color-error'], '（应为 #D55E00）');

// 4. 门禁结果
console.log('\n── 全量门禁 ──');
const { execSync } = await import('node:child_process');
try {
  const out = execSync('node scripts/theme-audit/theme-gate.mjs 2>&1', { cwd: 'D:/RMFOODFP/frontend', encoding: 'utf8', timeout: 300000 });
  results.gateResult = out.trim().split('\n').filter(l => l.includes('通过') || l.includes('失败')).pop();
  console.log('  ', results.gateResult);
} catch (e) {
  results.gateResult = 'GATE_FAILED: ' + e.message;
  console.log('  ❌', results.gateResult);
}

// 5. 对比度断言（跳过 null 值）
results.contrastChecks = [
  { label: 'light-default primary 对比度', value: results.presetModes['light-default'].contrastPrimary, pass: (results.presetModes['light-default'].contrastPrimary ?? 0) >= 4.5 },
  { label: 'dark-default primary 对比度', value: results.presetModes['dark-default'].contrastPrimary, pass: (results.presetModes['dark-default'].contrastPrimary ?? 0) >= 4.5 },
];

await browser.close();

// 写结果
import { writeFileSync } from 'node:fs';
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\n══ 结果已写入 ${OUT} ══`);
console.log('  门禁:', results.gateResult);
console.log('  对比度检查:', results.contrastChecks.map(c => `${c.label}=${c.value != null ? c.value.toFixed(2) : 'N/A'}:${c.pass ? '✅' : '❌'}`).join(' '));
