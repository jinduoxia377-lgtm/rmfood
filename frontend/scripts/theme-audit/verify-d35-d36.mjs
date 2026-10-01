// D-35 / D-36 验证
// D-35：?preset= 与 ?theme=(base64) 两套协议可区分解析，且旧链接向后兼容
// D-36：扁平导入配置能真正改变主题（此前静默无效）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();

// ── D-35：在真实 URL 下解析 ──
const parseCase = async (search) => {
  await page.goto(BASE + '/login' + search, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2600);
  return page.evaluate(async () => {
    const m = await import('/src/theme/themeUrlParser.ts');
    const p = m.parseThemeFromUrl();
    return p ? { preset: p.preset ?? null, themePayload: p.themePayload ? p.themePayload.slice(0, 18) + '…' : null } : null;
  });
};

const d35 = {};
d35['?preset=dark-default'] = await parseCase('?preset=dark-default');
d35['?theme=<base64>'] = await parseCase('?theme=eyJjb2xvcnMiOnsicHJpbWFyeSI6IiNmZjAwMDAifX0');
d35['?theme=light-default（旧协议兼容）'] = await parseCase('?theme=light-default');
d35['无参数'] = await parseCase('');

// ── D-36：扁平配置导入是否真的生效 ──
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);

const d36 = await page.evaluate(async () => {
  const st = await import('/src/stores/themeStore.ts');
  const S = () => st.useThemeStore.getState();
  const wait = (ms = 420) => new Promise(r => setTimeout(r, ms));

  S().resetToDefault();
  await wait();
  const before = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  const beforeSec = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim();

  // 复刻 ThemeImport 的规范化逻辑（同一输入，走真实 applyCustomTheme）
  const raw = { primary: '#ff0000', secondary: '#00ff00' };
  const base = S().activeTheme;
  const overrides = {
    colors: {
      primary: { ...base.colors.primary, main: raw.primary, contrastText: '#ffffff' },
      secondary: { ...base.colors.secondary, main: raw.secondary, contrastText: '#ffffff' },
    },
  };
  S().applyCustomTheme(overrides);
  await wait();

  const after = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  const afterSec = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim();

  // 归一化颜色（hex ↔ rgb）后再比较，避免因写法不同而误判
  const norm = (s) => {
    const t = String(s).trim().toLowerCase();
    const h = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (h) {
      let x = h[1];
      if (x.length === 3) x = x.split('').map(c => c + c).join('');
      return `rgb(${parseInt(x.slice(0, 2), 16)},${parseInt(x.slice(2, 4), 16)},${parseInt(x.slice(4, 6), 16)})`;
    }
    const m = t.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map(v => parseFloat(v.trim())); return `rgb(${p[0]},${p[1]},${p[2]})`; }
    return t;
  };

  S().resetToDefault();
  return {
    '导入前 --color-primary': before,
    '导入后 --color-primary': after,
    '✅ primary 已改变': norm(before) !== norm(after) && norm(after) === 'rgb(255,0,0)',
    '导入前 --color-secondary': beforeSec,
    '导入后 --color-secondary': afterSec,
    '✅ secondary 已改变': norm(beforeSec) !== norm(afterSec) && norm(afterSec) === 'rgb(0,255,0)',
  };
});

console.log('══ D-35：?theme= 协议拆分 ══');
for (const [k, v] of Object.entries(d35)) console.log(`  ${k.padEnd(34)} → ${JSON.stringify(v)}`);
console.log('\n══ D-36：扁平导入是否生效 ══');
for (const [k, v] of Object.entries(d36)) console.log(`  ${k}: ${v}`);

const ok =
  d35['?preset=dark-default']?.preset === 'dark-default' &&
  d35['?theme=<base64>']?.themePayload != null &&
  d35['?theme=light-default（旧协议兼容）']?.preset === 'light-default' &&
  d36['✅ primary 已改变'] === true &&
  d36['✅ secondary 已改变'] === true;
console.log(`\n结论：${ok ? '✅ 全部通过' : '❌ 存在失败'}`);
fs.writeFileSync('D:/RMFOODFP/temp/theme-d35-d36-verify.json', JSON.stringify({ d35, d36 }, null, 2), 'utf8');
await ctx.close();
await browser.close();
process.exit(ok ? 0 : 1);
