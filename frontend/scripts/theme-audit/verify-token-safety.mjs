// T-D2 注入防护验证：在 Vite dev server 内直接调用真实的 isSafeToken 跑断言
// （vitest 安装在本机不完整，故用 dev server 的模块解析作为执行环境）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3500);

const CASES = {
  namesAccept: ['--color-primary','--color-primary-500','--text-primary','--bg-surface-container-low','--badge-draft-text-dark','--z-modal-backdrop'],
  namesReject: ['color','--','--Color-Primary','--color_primary','--color--primary','-color-primary','--color primary','--color-primary;','background','position'],
  valuesAccept: ['#10b981','#10B981','#fff','#ffff','#10b981ff','rgb(16, 185, 129)','rgba(16, 185, 129, 0.15)','hsl(160, 84%, 39%)','hsla(160, 84%, 39%, 0.5)','var(--color-primary-500)','var(--color-primary-500, #10b981)','linear-gradient(135deg, #10b981, #34d399)','radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px)','#0f172a','none','auto','transparent','currentColor','4px','0.5rem','200ms','1.5','100%','50vh','-1px'],
  valuesReject: ['#10b981; position: fixed','#10b981;inset:0','red; background-image: url(https://evil/x.png)','var(--x); position: absolute','#fff} body { display: none','#fff { color: red }','url(https://evil.example/x.png)','expression(alert(1))','#fff; }','red; @import "https://evil/x.css"','','   ','a'.repeat(400),'<script>alert(1)</script>'],
};

const res = await page.evaluate(async (C) => {
  const m = await import('/src/stores/theme.presets.ts');
  const f = m.isSafeToken;
  const out = { exported: typeof f === 'function', failures: [], counts: {} };
  if (typeof f !== 'function') return out;

  const check = (label, actual, expected, input) => {
    if (actual !== expected) out.failures.push({ label, expected, actual, input: String(input).slice(0, 60) });
  };

  for (const n of C.namesAccept)  check('name-accept', f(n, '#10b981'), true, n);
  for (const n of C.namesReject)  check('name-reject', f(n, '#10b981'), false, n);
  for (const v of C.valuesAccept) check('value-accept', f('--x', v), true, v);
  for (const v of C.valuesReject) check('value-reject', f('--color-primary', v), false, v);
  check('nonstring-value', f('--x', undefined), false, 'undefined');
  check('nonstring-value-null', f('--x', null), false, 'null');
  check('nonstring-value-num', f('--x', 123), false, '123');
  check('nonstring-name', f(undefined, '#fff'), false, 'undefined-name');

  out.counts = {
    名称接受: C.namesAccept.length, 名称拒绝: C.namesReject.length,
    值接受: C.valuesAccept.length, 值拒绝: C.valuesReject.length, 非字符串: 4,
  };
  out.total = Object.values(out.counts).reduce((a, b) => a + b, 0);
  return out;
}, CASES);

const pass = res.exported && res.failures.length === 0;
console.log('isSafeToken 已导出 :', res.exported);
console.log('断言总数          :', res.total || 0);
console.log('失败数            :', res.failures.length);
if (res.failures.length) {
  console.log('\n失败明细:');
  res.failures.forEach(f => console.log(`  [${f.label}] input=${JSON.stringify(f.input)} 期望=${f.expected} 实际=${f.actual}`));
}
console.log('\n结论:', pass ? '✅ 全部通过（注入向量已被阻断）' : '❌ 存在失败');

fs.writeFileSync('D:/RMFOODFP/temp/theme-safety-verify.json', JSON.stringify({ ...res, pass }, null, 2), 'utf8');
await ctx.close();
await browser.close();
process.exit(pass ? 0 : 1);
