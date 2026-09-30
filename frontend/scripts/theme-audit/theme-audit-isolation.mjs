// ============================================================================
// 纯 CSS 隔离实验 —— 用生产编译产物在空白页上验证 CSS 语义
// 零应用干扰：不加载 React，不加载 store，排除 app 自身对 .dark 类的写入
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'D:/RMFOODFP/frontend/dist/assets';
const cssFile = fs.readdirSync(DIST).filter(f => /^index-.*\.css$/.test(f))[0];
const CSS = fs.readFileSync(path.join(DIST, cssFile), 'utf8');
console.log('注入 CSS:', cssFile, CSS.length, 'bytes');

const browser = await chromium.launch({ headless: true });

// 探针元素定义：[id, className, 说明]
const PROBES = [
  ['p-palette-darkpair', 'bg-white dark:bg-neutral-900',        'Tailwind 双值写法（bg-white + dark:bg-neutral-900）'],
  ['p-token-neutral',    'bg-neutral-100',                       '令牌类（bg-neutral-100，依赖 neutral 反转）'],
  ['p-token-text',       'text-neutral-900',                     '令牌文字（text-neutral-900）'],
  ['p-darkpair-text',    'text-neutral-900 dark:text-white',     '文字双值（text-neutral-900 + dark:text-white）'],
  ['p-bare-slate',       'bg-slate-50',                          '裸调色板无 dark:（bg-slate-50）'],
  ['p-bare-emerald',     'bg-emerald-50',                        '裸调色板无 dark:（bg-emerald-50）'],
  ['p-badge-draft',      'badge-draft',                          '项目徽章类（badge-draft）'],
  ['p-card',             'bg-card',                              '语义类（bg-card）'],
  ['p-surface-default',  'bg-surface-default',                   '语义类（bg-surface-default）'],
  ['p-text-textprimary', 'text-text-primary',                    '语义类（text-text-primary）'],
  ['p-bg-white-only',    'bg-white',                             '纯 bg-white'],
  ['p-bg-neutral900',    'bg-neutral-900',                       'bg-neutral-900（令牌）'],
];

async function run(useClass, media) {
  const ctx = await browser.newContext({ viewport:{width:900,height:700}, colorScheme: media });
  const page = await ctx.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.addStyleTag({ content: CSS });
  if (useClass) await page.evaluate(() => document.documentElement.classList.add('dark'));

  await page.evaluate((probes) => {
    for (const [id, cls] of probes) {
      const d = document.createElement('div');
      d.id = id; d.className = cls; d.textContent = 'Aa';
      d.style.cssText = 'width:120px;height:24px;margin:2px;display:block';
      document.body.appendChild(d);
    }
  }, PROBES.map(p => [p[0], p[1]]));
  await page.waitForTimeout(250);

  const res = await page.evaluate((probes) => {
    const root = getComputedStyle(document.documentElement);
    const out = { htmlClass: document.documentElement.className, probes: {}, tokens: {} };
    for (const [id, cls, desc] of probes) {
      const e = document.getElementById(id);
      if (!e) { out.probes[id] = { desc, cls, missing:true }; continue; }
      const cs = getComputedStyle(e);
      out.probes[id] = { desc, cls, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor };
    }
    for (const t of ['--color-neutral-50','--color-neutral-100','--color-neutral-900','--color-primary','--color-primary-500','--color-white','--badge-draft-text']) {
      out.tokens[t] = root.getPropertyValue(t).trim();
    }
    return out;
  }, PROBES);

  await ctx.close();
  return res;
}

const A = await run(false, 'light');   // 基线：无 .dark，系统浅色
const B = await run(true,  'light');   // 只有 .dark 类
const C = await run(false, 'dark');    // 只有系统暗色
const D = await run(true,  'dark');    // 两者都有

console.log('\n================ 结果矩阵 ================');
console.log(['探针', 'A 无类/浅', 'B .dark/浅', 'C 无类/暗', 'D .dark/暗', 'B≠A?', 'C≠A?'].join(' | '));
for (const [id, cls, desc] of PROBES) {
  const a = A.probes[id], b = B.probes[id], c = C.probes[id], d = D.probes[id];
  const ne = (x,y) => (x && y && (x.bg!==y.bg || x.color!==y.color || x.border!==y.border)) ? '✓变' : '✗不变';
  console.log([`${desc}`, a?.bg, b?.bg, c?.bg, d?.bg, ne(b,a), ne(c,a)].join(' | '));
}

console.log('\n================ 关键结论 ================');
const verdict = {};
const ne = (x,y) => (x && y && (x.bg!==y.bg || x.color!==y.color || x.border!==y.border));
verdict['bg-white dark:bg-neutral-900 —— 加 .dark 类是否生效'] = ne(B.probes['p-palette-darkpair'], A.probes['p-palette-darkpair']) ? '生效' : '*** 不生效 ***';
verdict['bg-white dark:bg-neutral-900 —— 系统暗色是否生效'] = ne(C.probes['p-palette-darkpair'], A.probes['p-palette-darkpair']) ? '生效' : '不生效';
verdict['text-neutral-900 dark:text-white —— 加 .dark 类是否生效'] = ne(B.probes['p-darkpair-text'], A.probes['p-darkpair-text']) ? '生效' : '*** 不生效 ***';
verdict['bg-neutral-100（令牌类）—— 加 .dark 类是否生效'] = ne(B.probes['p-token-neutral'], A.probes['p-token-neutral']) ? '生效（靠 neutral 反转）' : '不生效';
verdict['bg-slate-50（裸调色板）—— 加 .dark 类是否生效'] = ne(B.probes['p-bare-slate'], A.probes['p-bare-slate']) ? '生效' : '*** 不生效（暗色下仍是浅底）***';
verdict['bg-emerald-50（裸调色板）—— 加 .dark 类是否生效'] = ne(B.probes['p-bare-emerald'], A.probes['p-bare-emerald']) ? '生效' : '*** 不生效 ***';
verdict['badge-draft —— 加 .dark 类是否生效'] = ne(B.probes['p-badge-draft'], A.probes['p-badge-draft']) ? '生效' : '*** 不生效 ***';
console.log(JSON.stringify(verdict, null, 2));

console.log('\n================ 令牌解析（四条件）================');
for (const t of Object.keys(A.tokens)) {
  console.log(`${t.padEnd(24)} A=${String(A.tokens[t]).padEnd(22)} B=${String(B.tokens[t]).padEnd(22)} C=${String(C.tokens[t]).padEnd(22)} D=${D.tokens[t]}`);
}

fs.writeFileSync('D:/RMFOODFP/temp/theme-css-isolation.json', JSON.stringify({ cssFile, A, B, C, D, verdict }, null, 2), 'utf8');
console.log('\n已写入 theme-css-isolation.json');
await browser.close();
