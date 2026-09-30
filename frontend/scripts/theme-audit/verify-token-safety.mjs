// T-D2 注入防护验证 + D-53/D-54 回归审计
// 在 Vite dev server 内直接调用真实模块（vitest 本机不可用）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3500);

const CASES = {
  namesAccept: ['--color-primary', '--color-primary-500', '--text-primary', '--bg-surface-container-low',
                '--badge-draft-text-dark', '--z-modal-backdrop', '--color-primary-surface-hover'],
  namesReject: ['color', '--', '--Color-Primary', '--color_primary', '--color--primary', '-color-primary',
                '--color primary', '--color-primary;', 'background', 'position',
                // camelCase：既违规 T1，也属被拒名（D-53）
                '--z-modalBackdrop', '--color-text-textPrimary'],
  valuesAccept: [
    '#10b981', '#10B981', '#fff', '#ffff', '#10b981ff',
    'rgb(16, 185, 129)', 'rgba(16, 185, 129, 0.15)', 'hsl(160, 84%, 39%)', 'hsla(160, 84%, 39%, 0.5)',
    'var(--color-primary-500)', 'var(--color-primary-500, #10b981)',
    'linear-gradient(135deg, #10b981, #34d399)',
    'radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px)',
    '#0f172a', 'none', 'auto', 'transparent', 'currentColor', '4px', '0.5rem', '200ms', '1.5', '100%', '50vh', '-1px',
    // ── 曾被旧「值形状白名单」误杀、现必须放行的合法复合值（D-54）──
    '0 1px 2px rgba(0, 0, 0, 0.05)',                                  // --shadow-sm
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', // --shadow-md
    "'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",  // --font-body
    'cubic-bezier(0.4, 0, 0.2, 1)',                                   // --easing-ease-in-out
    '1000',                                                           // --z-modal
  ],
  valuesReject: [
    '#10b981; position: fixed', '#10b981;inset:0', 'red; background-image: url(https://evil/x.png)',
    'var(--x); position: absolute', '#fff} body { display: none', '#fff { color: red }',
    'url(https://evil.example/x.png)', 'expression(alert(1))', '#fff; }',
    'red; @import "https://evil/x.css"', '', '   ', 'a'.repeat(400),
    '<script>alert(1)</script>',
    // 新增：换行注入（旧实现未显式覆盖）
    '#10b981\n; position: fixed', '#10b981\r\nposition: fixed',
    // 新增：javascript: 伪协议
    'javascript:alert(1)',
  ],
};

const res = await page.evaluate(async (C) => {
  const m = await import('/src/stores/theme.presets.ts');
  const f = m.isSafeToken;
  const out = { exported: typeof f === 'function', failures: [], counts: {}, audit: null, hover: null };
  if (typeof f !== 'function') return out;

  const check = (label, actual, expected, input) => {
    if (actual !== expected) out.failures.push({ label, expected, actual, input: String(input).slice(0, 60) });
  };

  for (const n of C.namesAccept) check('name-accept', f(n, '#10b981'), true, n);
  for (const n of C.namesReject) check('name-reject', f(n, '#10b981'), false, n);
  for (const v of C.valuesAccept) check('value-accept', f('--x', v), true, v);
  for (const v of C.valuesReject) check('value-reject', f('--x', v), false, v);
  check('nonstring-value', f('--x', undefined), false, 'undefined');
  check('nonstring-value-null', f('--x', null), false, 'null');
  check('nonstring-value-num', f('--x', 123), false, '123');
  check('nonstring-name', f(undefined, '#fff'), false, 'undefined-name');

  // ── D-53/D-54 审计：generateCSSVariables 的输出有多少能通过校验 ──
  try {
    const g = await import('/src/stores/theme.presets.ts');
    const st = await import('/src/stores/themeStore.ts');
    const theme = st.useThemeStore.getState().activeTheme ?? null;
    if (g.generateCSSVariables && theme) {
      const vars = g.generateCSSVariables(theme);
      const entries = Object.entries(vars);
      const rejected = entries.filter(([k, v]) => !f(k, String(v)));
      out.audit = {
        总数: entries.length,
        通过: entries.length - rejected.length,
        被拒: rejected.length,
        被拒明细: rejected.map(([k, v]) => ({ name: k, value: String(v).slice(0, 46), 原因: /^--[a-z0-9]+(?:-[a-z0-9]+)*$/.test(k) ? '值' : '名称(camelCase/T1违规)' })),
      };
    }
  } catch (e) { out.audit = { error: String(e).slice(0, 200) }; }

  // ── hover 对比度实测（D-54 的可见后果）──
  // 直接读 <html> 上的令牌值计算，不依赖探测元素是否被类命中
  const lum = (rgb) => {
    const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    if (!s) return null;
    const str = String(s).trim();
    const hex = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      let h = hex[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = str.match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const ratio = (a, b) => {
    const pa = parse(a), pb = parse(b);
    if (!pa || !pb) return null;
    const [x, y] = [lum(pa), lum(pb)].sort((p, q) => q - p);
    return +((x + 0.05) / (y + 0.05)).toFixed(2);
  };

  const rootCS = getComputedStyle(document.documentElement);
  const tok = (n, fallback) => (rootCS.getPropertyValue(n).trim() || fallback);
  const surface = tok('--color-primary-surface', '#047857');
  const surfaceHover = tok('--color-primary-surface-hover', '(未定义)');
  const onSurface = tok('--color-on-primary-surface', '#ffffff');

  out.hover = {
    isDark: document.documentElement.classList.contains('dark'),
    '基础底色 --color-primary-surface': surface,
    '悬停底色 --color-primary-surface-hover': surfaceHover,
    '前景 --color-on-primary-surface': onSurface,
    基础态对比度: ratio(surface, onSurface),
    悬停态对比度: ratio(surfaceHover, onSurface),
  };

  // 顺带取证：旧实现使用的两个错误悬停令牌当前值
  out.hover['（对照）--color-primary-hover'] = tok('--color-primary-hover', '(未定义)');
  out.hover['（对照）--color-primary-800'] = tok('--color-primary-800', '(未定义)');
  out.hover['（对照）旧悬停色对比度'] = ratio(out.hover['（对照）--color-primary-800'], onSurface);

  // ── 暗色模式同样取证 ──
  const setMode = async (m) => {
    try {
      const st = await import('/src/stores/themeStore.ts');
      st.useThemeStore.getState().setPresetTheme(m);
      await new Promise(r => setTimeout(r, 400));
    } catch {}
  };
  await setMode('dark-default');
  const dcs = getComputedStyle(document.documentElement);
  const dtok = (n, fb) => (dcs.getPropertyValue(n).trim() || fb);
  const dSurface = dtok('--color-primary-surface', '#065f46');
  const dHover = dtok('--color-primary-surface-hover', '(未定义)');
  const dOn = dtok('--color-on-primary-surface', '#ffffff');
  out.dark = {
    isDark: document.documentElement.classList.contains('dark'),
    '基础底色': dSurface,
    '悬停底色': dHover,
    '前景': dOn,
    基础态对比度: ratio(dSurface, dOn),
    悬停态对比度: ratio(dHover, dOn),
    '（对照）旧悬停色 --color-primary-800': dtok('--color-primary-800', '(未定义)'),
    '（对照）旧悬停色对比度': ratio(dtok('--color-primary-800', ''), dOn),
  };
  await setMode('light-default');

  return out;
}, CASES);

const total = CASES.namesAccept.length + CASES.namesReject.length + CASES.valuesAccept.length + CASES.valuesReject.length + 4;
console.log('══ 安全断言 ══');
console.log(`  用例总数: ${total}   失败: ${res.failures.length}`);
for (const f of res.failures) console.log(`  ❌ [${f.label}] input=${JSON.stringify(f.input)} 期望 ${f.expected} 实际 ${f.actual}`);
if (!res.failures.length) console.log('  ✅ 全部通过');

console.log('\n══ D-53/D-54 审计：generateCSSVariables 输出可写入率 ══');
if (res.audit?.error) console.log('  ⚠️ ' + res.audit.error);
else if (res.audit) {
  console.log(`  生成 ${res.audit.总数} 条 → 通过 ${res.audit.通过} / 被拒 ${res.audit.被拒}`);
  for (const r of res.audit.被拒明细) console.log(`    · ${r.name}  [${r.原因}]  ${r.value}`);
} else console.log('  （无法取得 activeTheme，跳过）');

console.log('\n══ surface-primary 对比度实测 ══');
for (const [label, h] of [['亮色', res.hover], ['暗色', res.dark]]) {
  if (!h) continue;
  console.log(`  ── ${label}模式 (isDark=${h.isDark}) ──`);
  for (const [k, v] of Object.entries(h)) if (k !== 'isDark') console.log(`     ${k}: ${v}`);
  const b = h.基础态对比度, hv = h.悬停态对比度;
  const verdict = (b >= 4.5 && hv >= 4.5) ? '✅ 基础态与悬停态均 ≥ 4.5:1' : `❌ 未达标（基础 ${b} / 悬停 ${hv}）`;
  console.log(`     → ${verdict}`);
}

fs.writeFileSync('D:/RMFOODFP/temp/theme-safety-verify.json', JSON.stringify({ cases: CASES, result: res }, null, 2), 'utf8');
await ctx.close();
await browser.close();
const ok = res.failures.length === 0;
console.log(`\n结论: ${ok ? '✅ 安全断言全通过' : '❌ 存在失败'}`);
process.exit(ok ? 0 : 1);
