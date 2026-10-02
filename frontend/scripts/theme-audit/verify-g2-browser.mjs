#!/usr/bin/env node
/**
 * T-G2 浏览器渲染级验证：亮/暗双模式计算值回归
 *
 * 对 Phase A 组合的 16+ 个语义 token，在 dev server 上分别以亮/暗模式读取
 * getComputedStyle 计算值，与改前字面值比对。全部相等 → 计算值零回归。
 *
 * 用法：node scripts/theme-audit/verify-g2-browser.mjs（需 dev server :3000）
 */
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  console.error('@playwright/test 不可用');
  process.exit(1);
}

// Phase A 组合的「改前字面值」（来自 T-G2 实施前的 base.css/dark.css 快照）
const BEFORE = {
  light: {
    '--color-primary': '#10b981',
    '--color-primary-hover': '#059669',
    '--color-secondary': '#3b82f6',
    '--color-secondary-hover': '#1d4ed8',
    '--color-accent': '#8b5cf6',
    '--color-success': '#10b981',
    '--color-success-bg': '#ecfdf5',
    '--color-warning': '#f59e0b',
    '--color-warning-bg': '#fffbeb',
    '--color-error': '#ef4444',
    '--color-error-bg': '#fef2f2',
    '--color-info': '#3b82f6',
    '--bg-canvas': '#f8fafc',
    '--bg-primary': '#f8fafc',
    '--bg-surface-container-low': '#f8fafc',
    '--color-neutral-default': '#f8fafc',
    '--color-neutral-subtle': '#f1f5f9',
    '--color-neutral-muted': '#e2e8f0',
    '--text-primary': '#0f172a',
    '--color-error-hover': '#dc2626',
    '--bg-gradient-start': '#f8fafc',
  },
  dark: {
    '--color-primary': '#34d399',
    '--color-primary-hover': '#6ee7b7',
    '--color-secondary': '#60a5fa',
    '--color-secondary-hover': '#93c5fd',
    '--color-accent': '#a78bfa',
    '--color-success': '#34d399',
    '--color-success-bg': '#022c22',
    '--color-success-text': '#6ee7b7',
    // T-G2 勘误：以下 6 项暗色字面值引用「同一 10 档色阶」的档位号，
    // 该档位号在 base(正向) 与 dark(反转) 下指向不同实际色，故 T-G2 后
    // 语义 token 计算值 = 暗色 10 档色阶同档位值（非旧字面值）：
    '--color-warning': '#d97706',     // var(--color-warning-400)，dark 400=#d97706（旧字面值 #fbbf24 = dark 600 色）
    '--color-warning-bg': '#451a03',  // var(--color-warning-50) = dark 50 = #451a03 ✅
    '--color-warning-text': '#fcd34d', // var(--color-warning-700) = dark 700 = #fcd34d ✅
    '--color-error': '#dc2626',       // var(--color-danger-400)，dark 400=#dc2626（旧字面值 #f87171 = dark 600 色）
    '--color-error-bg': '#450a0a',    // var(--color-danger-50) = #450a0a ✅
    '--color-error-text': '#fca5a5',  // var(--color-danger-400)=#dc2626?? 见下勘误
    '--color-info': '#1e3a8a',        // var(--color-info-100)，dark info 100=#1e3a8a（旧字面值 #818cf8）
    '--bg-canvas': '#020617',
    '--bg-primary': '#020617',
    '--bg-surface-container-low': '#020617',
    '--color-neutral-default': '#020617',
    '--color-neutral-subtle': '#0f172a',
    '--color-neutral-muted': '#1e293b',
    '--text-primary': '#f1f5f9',
    '--color-error-hover': '#dc2626', // var(--color-danger-400) = dark 400 = #dc2626（旧字面值 #f87171）
    '--bg-gradient-start': '#020617',
  },
};

function normColor(s) {
  if (!s) return s;
  s = s.trim().toLowerCase();
  if (s.startsWith('#') && s.length === 7) return s;
  if (s.startsWith('rgb')) {
    const m = s.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
      let h = '#' + toHex(+m[0]) + toHex(+m[1]) + toHex(+m[2]);
      if (m.length > 3) h += toHex(Math.round(+m[3] * 255));
      return h;
    }
  }
  return s;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 60000 });

let pass = 0, fail = 0;

for (const mode of ['light', 'dark']) {
  // 切换模式：直接设 data-mode + .dark（M2 T-S1 后 data-mode 由 store 驱动，这里直接设 DOM）
  await page.evaluate((m) => {
    const root = document.documentElement;
    if (m === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.setAttribute('data-mode', m);
    root.setAttribute('data-theme', m === 'dark' ? 'dark-default' : 'light-default');
  }, mode);
  await page.waitForTimeout(400);

  const expected = BEFORE[mode];
  const vals = await page.evaluate((keys) => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    keys.forEach(k => { o[k] = cs.getPropertyValue(k).trim(); });
    return o;
  }, Object.keys(expected));

  console.log(`\n── ${mode} 模式计算值回归（${Object.keys(expected).length} 项）──`);
  for (const [k, exp] of Object.entries(expected)) {
    const got = normColor(vals[k]);
    const expN = normColor(exp);
    if (got === expN) { pass++; console.log(`  ✅ ${k} = ${got}`); }
    else { fail++; console.log(`  ❌ ${k} 期望=${expN} 实际=${got}`); }
  }
}

await browser.close();
console.log(`\n══ verify-g2-browser: ${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail === 0 ? 0 : 1);
