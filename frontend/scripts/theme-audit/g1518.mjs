#!/usr/bin/env node
/**
 * GATE-15 / GATE-16 / GATE-17 / GATE-18 门禁断言
 *
 * 依据：docs/design/RMFOOD-主题设置模块系统性控制执行方案.md 阶段 D
 *      docs/design/RMFOOD-主题系统设计规范.md §8.2 U-8 / §10.3 待补断言
 *
 * 用法：`node g1518.mjs`（独立运行，自含门禁报告）
 *      或被 `theme-gate.mjs` 主流程 import（注入 rec + 渲染环境）
 *
 * GATE-15（M4，渲染）：配色 / 字号 / 明暗三者经「刷新」后全部保持。
 *   /settings 主题面板选配色 + 调字号 + 切暗色 → reload → 三者不回落。
 *   断言：
 *     a. --color-primary-500 保持所选配色（非品牌绿 L0 值）
 *     b. --text-body 保持所选字号方案
 *     c. .dark 类仍挂于 <html>
 *     d. 运行时色阶样式表 #rmfood-runtime-theme 存在且含 :root / .dark 双作用域
 *   这是 R1（「配色/字号刷新即丢」）的防回归线。
 *
 * GATE-16（M4，静态）：主色阶档位必须整档单调（含 L0 基线）。
 *   base.css 亮色 50→950 亮度单调递减，dark.css 暗色 50→950 单调递增（L0 反转
 *   是设计约定，两列都是单调的）。局部改中间档会产生「断裂梯度」：500/600/700
 *   换色而 100-400、800-950 仍是品牌绿的反转值，暗色下 800-950 是浅色，
 *   叠白字即 D-50 对比度崩塌。探针已实测复现该形态。
 *
 * GATE-17（M4，静态）：主色档位令牌不得经 root.style.setProperty 写入。
 *   base.css 的 --color-primary-<档> 定义在 :root，dark.css 的同名令牌定义在
 *   .dark；inline setProperty 的优先级高于任何非 !important 选择器，会同时压过
 *   两个作用域 —— 选完配色后切暗色模式仍显示亮色 ramp。档位令牌只允许走
 *   generateModeRampCSS 生成的运行时 <style> 双作用域块。
 *   单通道断言：setProperty('-- 只允许出现在 stores/theme.presets.ts。
 *
 * GATE-18（M4，静态）：禁止写死的 aria-checked={false}。
 *   选中态必须从 store 派生（§8.2 U-6），否则用户看不出当前生效方案。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');   // frontend/
const SRC = join(ROOT, 'src');

const results = [];
const log = (...a) => { if (process.argv.includes('--quiet')) return; console.log(...a); };
function report(id, milestone, title, status, detail) {
  results.push({ id, milestone, title, status, detail });
  const icon = { pass: '✅', fail: '❌', skip: '⏭️ ', warn: '⚠️ ' }[status] || '?';
  log(`${icon} ${id} ${title}`);
  if (detail) String(detail).split('\n').forEach(l => log(`      ${l}`));
}

// 由 theme-gate.mjs 注入 rec（闭包）；独立运行时用本地 report
let gateRec = report;
export function setGateRec(fn) { if (typeof fn === 'function') gateRec = fn; }
if (typeof process.env.GATE_REC === 'function') gateRec = process.env.GATE_REC;

/** 渲染环境由 theme-gate.mjs 注入；独立运行时由 runRenderGates 自行启动 */
let injectedEnv = null;
export function setRenderEnv(env) { injectedEnv = env; }

// ── 工具：递归收集 .ts/.tsx 文件（排除 __tests__ / node_modules）──
function collectSrcFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (/^node_modules$|^__tests__$/.test(e.name)) continue;
      collectSrcFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// ── 亮度（WCAG 相对亮度），供档位单调性判定 ──
function hexToRgb(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance(rgb) {
  if (!rgb) return null;
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/**
 * 判定一列档位色值是否严格单调。
 * @returns {violations: number, parsed: string[], unparseable: string[], first: number|null}
 */
function rampMonotonicity(pairs, expectDecreasing) {
  let prev = null, violations = 0;
  const unparseable = [];
  for (const [tier, val] of pairs) {
    const lum = luminance(hexToRgb(val));
    if (lum === null) { unparseable.push(`${tier}=${val}`); continue; }
    if (prev !== null) {
      const ok = expectDecreasing ? lum < prev.lum : lum > prev.lum;
      if (!ok) violations++;
    }
    prev = { tier, val, lum };
  }
  return { violations, unparseable, parsed: pairs.length, first: prev ? prev.lum : null };
}

// ============================================================================
// GATE-16 L0 档位单调性（静态）
// ============================================================================
export function g16() {
  const files = {
    light: join(SRC, 'styles', 'tokens', 'base.css'),
    dark: join(SRC, 'styles', 'tokens', 'dark.css'),
  };
  const missing = Object.entries(files).filter(([, p]) => !existsSync(p)).map(([k]) => k);
  if (missing.length) {
    return gateRec('GATE-16', 'M4', 'L0 主色阶整档单调', 'fail', `找不到令牌源文件：${missing.join(', ')}`);
  }

  const tierRe = /--color-primary-(\d{2,3})\s*:\s*([^;]+);/g;
  const read = (path) => {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    let m;
    while ((m = tierRe.exec(css)) !== null) out.push([m[1], m[2].trim()]);
    return out;
  };

  const light = rampMonotonicity(read(files.light), true);
  const dark = rampMonotonicity(read(files.dark), false);

  const rel = p => relative(ROOT, p).split('\\').join('/');
  const detail = [
    `亮色 ${rel(files.light)}：${light.parsed} 档，50→950 亮度单调递减，违背 ${light.violations} 处`,
    `暗色 ${rel(files.dark)}：${dark.parsed} 档，50→950 亮度单调递增（L0 反转），违背 ${dark.violations} 处`,
  ];
  if (light.unparseable.length) detail.push(`无法解析：${light.unparseable.join(', ')}（系统关键字如 ButtonText 不参与单调判定）`);
  if (dark.unparseable.length) detail.push(`无法解析：${dark.unparseable.join(', ')}（系统关键字如 ButtonText 不参与单调判定）`);

  if (light.violations + dark.violations === 0) {
    gateRec('GATE-16', 'M4', 'L0 主色阶整档单调', 'pass', detail.join('\n'));
  } else {
    gateRec('GATE-16', 'M4', 'L0 主色阶整档单调', 'fail',
      detail.join('\n') + '\n修复：只允许整档同向替换色阶，禁止只改中间档（断裂梯度）。');
  }
  return { light, dark };
}

// ============================================================================
// GATE-17 档位令牌单通道（静态）
// ============================================================================
export function g17() {
  const files = collectSrcFiles(SRC);
  const ALLOW = ['stores/theme.presets.ts'];
  const rel = p => relative(SRC, p).split('\\').join('/');
  // 档位令牌 = 带数值档位的调色板阶（--color-primary-500 等）。
  // 只拦这一类：非档位令牌（如 --theme-transition-duration）与明暗模式无关，
  // inline 写入不构成「双作用域被同时压过」的风险。
  const TIER_TOKEN = /^--color-[a-z0-9]+(?:-[a-z0-9]+)*-\d{2,3}$/;
  const hits = [];
  let tierWriteTotal = 0;
  for (const p of files) {
    const text = readFileSync(p, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!/setProperty\s*\(/.test(line)) return;
      const strs = line.match(/'[^']*'|"[^"]*"/g) || [];
      const tokens = strs.map(s => s.slice(1, -1).trim()).filter(s => TIER_TOKEN.test(s));
      if (!tokens.length) return;
      tierWriteTotal++;
      if (ALLOW.includes(rel(p))) return;
      hits.push(`${rel(p)}:${i + 1}  ${line.trim().slice(0, 110)}`);
    });
  }

  if (hits.length === 0) {
    gateRec('GATE-17', 'M4', '档位令牌不直写 root.style.setProperty', 'pass',
      `扫描 ${files.length} 个源文件：${tierWriteTotal} 处档位令牌 setProperty 全部位于 stores/theme.presets.ts 单通道`);
  } else {
    gateRec('GATE-17', 'M4', '档位令牌不直写 root.style.setProperty', 'fail',
      `${hits.length} 处越界直写（共 ${tierWriteTotal} 处档位令牌 setProperty）：\n  ${hits.slice(0, 12).join('\n  ')}` +
      (hits.length > 12 ? `\n  …（共 ${hits.length}）` : '') +
      '\n原因：inline setProperty 优先级高于任何非 !important 选择器，会同时压过 :root 与 .dark，' +
      '导致选完配色后切暗色模式仍显示亮色 ramp。' +
      '\n修复：档位令牌走 generateModeRampCSS → #rmfood-runtime-theme 双作用域块。');
  }
  return { files: files.length, hits, tierWriteTotal };
}

// ============================================================================
// GATE-18 禁止写死 aria-checked={false}（静态）
// ============================================================================
// ── 剥离注释（保留行号：等长空白替换）──
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
  // 行注释：排除 http:// 这类 URL（前一个字符不是 ':'）
  return noBlock.replace(/(^|[^:])\/\/[^\n]*/g, m => ' '.repeat(m.length));
}

export function g18() {
  const files = collectSrcFiles(SRC);
  const rel = p => relative(SRC, p).split('\\').join('/');
  const hits = [];
  for (const p of files) {
    const lines = stripComments(readFileSync(p, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      // 只抓字面量 false（排除从状态派生的写法）
      if (!/aria-checked\s*=\s*\{?\s*false\b/.test(line)) return;
      hits.push(`${rel(p)}:${i + 1}  ${line.trim().slice(0, 110)}`);
    });
  }

  if (hits.length === 0) {
    gateRec('GATE-18', 'M4', '选中态从状态派生（无写死 aria-checked={false}）', 'pass',
      `扫描 ${files.length} 个源文件：全部 aria-checked 均由状态表达式求值`);
  } else {
    gateRec('GATE-18', 'M4', '选中态从状态派生（无写死 aria-checked={false}）', 'fail',
      `${hits.length} 处写死选中态：\n  ${hits.slice(0, 12).join('\n  ')}` +
      (hits.length > 12 ? `\n  …（共 ${hits.length}）` : '') +
      '\n后果：用户看不出当前生效方案（§8.2 U-6）。修复：aria-checked={state === key}。');
  }
  return { files: files.length, hits };
}

// ============================================================================
// GATE-15 冷启动回放（渲染）
// ============================================================================
const GROUP = (label) => `[role="radiogroup"][aria-label="${label}"] [role="radio"]`;

async function startEnv(base) {
  let chromium;
  try { ({ chromium } = await import('@playwright/test')); }
  catch { return { available: false, reason: '@playwright/test 未安装' }; }
  try {
    const r = await fetch(base + '/login', { signal: AbortSignal.timeout(4000) });
    if (!r.ok && r.status >= 500) return { available: false, reason: `dev server 不可达：${base}` };
  } catch { return { available: false, reason: `dev server 不可达：${base}` }; }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
  const page = await ctx.newPage();
  try {
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await page.fill('input[type="text"]', process.env.THEME_GATE_USER || 'admin');
      await page.fill('input[type="password"]', process.env.THEME_GATE_PASS || 'admin123');
      await page.locator('button[type="submit"], button:has-text("登录"), button:has-text("进入平台")').first().click();
      try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
      await page.waitForTimeout(2500);
    }
    return { available: true, browser, ctx, page };
  } catch (e) {
    await browser.close();
    return { available: false, reason: `渲染环境初始化失败：${String(e).slice(0, 180)}` };
  }
}

/** GATE-15：在已登录的 page 上执行「选配色 → 调字号 → 切暗色 → reload → 断言」 */
export async function g15(page, baseUrl) {
  await page.goto(baseUrl + '/settings?tab=theme', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  const readTokens = () => page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const tiers = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    return {
      dark: document.documentElement.classList.contains('dark'),
      primary500: s.getPropertyValue('--color-primary-500').trim(),
      primaryScale: tiers.reduce((a, t) => (a[t] = s.getPropertyValue(`--color-primary-${t}`).trim(), a), {}),
      textBody: s.getPropertyValue('--text-body').trim(),
      textH1: s.getPropertyValue('--text-h1').trim(),
      runtimeStyle: (() => {
        const el = document.getElementById('rmfood-runtime-theme');
        return el ? { present: true, css: el.textContent } : { present: false, css: '' };
      })(),
      fontChecked: [...document.querySelectorAll('[role="radiogroup"][aria-label="字体大小"] [role="radio"]')]
        .map(b => b.getAttribute('aria-checked')),
      paletteChecked: [...document.querySelectorAll('[role="radiogroup"][aria-label="配色方案"] [role="radio"]')]
        .map(b => b.getAttribute('aria-checked')),
    };
  });

  const before = await readTokens();

  // 选配色（第 2 项 = 苹果蓝；品牌绿是第 1 项，避免误判为「未生效」）
  await page.locator(GROUP('配色方案')).nth(1).click();
  await page.waitForTimeout(700);
  // 调字号（第 3 项 = 宽松，18px 基准）
  await page.locator(GROUP('字体大小')).nth(2).click();
  await page.waitForTimeout(600);
  // 切暗色（第 2 项 = 深色）
  await page.locator(GROUP('明暗模式')).nth(1).click();
  await page.waitForTimeout(900);

  const afterClick = await readTokens();

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  const afterReload = await readTokens();

  // ── 判定 ──
  const failures = [];
  if (!afterClick.dark) failures.push('点击深色后 <html> 未挂 .dark 类');
  if (afterClick.primary500 === before.primary500) {
    failures.push(`点击配色后 --color-primary-500 未变（仍为 ${afterClick.primary500}）`);
  }
  if (afterClick.textBody === before.textBody) {
    failures.push(`点击字号后 --text-body 未变（仍为 ${afterClick.textBody}）`);
  }

  // 刷新后三者保持
  if (afterReload.primary500 !== afterClick.primary500) {
    failures.push(`刷新后配色丢失：--color-primary-500 ${afterClick.primary500} → ${afterReload.primary500}`);
  }
  if (afterReload.textBody !== afterClick.textBody) {
    failures.push(`刷新后字号丢失：--text-body ${afterClick.textBody} → ${afterReload.textBody}`);
  }
  if (afterReload.dark !== true) {
    failures.push(`刷新后明暗丢失：.dark 类为 ${afterReload.dark}`);
  }

  // 运行时双作用域样式表
  if (!afterReload.runtimeStyle.present) {
    failures.push('刷新后 #rmfood-runtime-theme 运行时色阶样式表不存在（色阶回落到 L0）');
  } else {
    const css = afterReload.runtimeStyle.css;
    if (!/:root\s*\{/.test(css)) {
      failures.push('运行时样式表缺 :root 作用域块');
    }
    if (!/\.dark\s*\{/.test(css)) {
      failures.push('运行时样式表缺 .dark 作用域块（暗色模式将错用亮色 ramp）');
    }
    const tiers = Object.entries(afterReload.primaryScale).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v));
    if (tiers.length < 11) {
      failures.push(`刷新后主色阶仅注入 ${tiers.length}/11 档`);
    }
    const inlineLeaks = await page.evaluate(() => {
      const st = document.documentElement.style;
      const tiers = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
      return tiers.filter(t => st.getPropertyValue(`--color-primary-${t}`) !== '');
    });
    if (inlineLeaks.length) {
      failures.push(`档位令牌泄漏到 <html> inline 样式：${inlineLeaks.join(',')}（会同时压过 :root 与 .dark）`);
    }
  }

  const detail = [
    `--color-primary-500  选前 ${before.primary500} → 点击 ${afterClick.primary500} → 刷新 ${afterReload.primary500}`,
    `--text-body          选前 ${before.textBody} → 点击 ${afterClick.textBody} → 刷新 ${afterReload.textBody}`,
    `--text-h1            选前 ${before.textH1} → 点击 ${afterClick.textH1} → 刷新 ${afterReload.textH1}`,
    `.dark 类             点击后 ${afterClick.dark} → 刷新后 ${afterReload.dark}`,
    `运行时样式表         ${afterReload.runtimeStyle.present ? `存在（${afterReload.runtimeStyle.css.length} 字符）` : '缺失'}`,
    `选中态派生           字号 ${JSON.stringify(afterReload.fontChecked)} / 配色 ${JSON.stringify(afterReload.paletteChecked)}`,
  ];

  if (failures.length === 0) {
    gateRec('GATE-15', 'M4', '配色/字号/明暗刷新后保持（冷启动回放）', 'pass', detail.join('\n'));
  } else {
    gateRec('GATE-15', 'M4', '配色/字号/明暗刷新后保持（冷启动回放）', 'fail',
      `${failures.length} 项未通过：\n  · ${failures.join('\n  · ')}\n\n${detail.join('\n')}`);
  }
  return { failures, before, afterClick, afterReload };
}

// ── 独立运行入口 ──
async function runRenderGates() {
  const base = process.env.THEME_GATE_BASE || 'http://localhost:3000';
  if (injectedEnv && injectedEnv.available) {
    await g15(injectedEnv.page, base);
    return;
  }
  const env = await startEnv(base);
  if (!env.available) {
    gateRec('GATE-15', 'M4', '配色/字号/明暗刷新后保持（冷启动回放）', 'skip', env.reason);
    return;
  }
  try { await g15(env.page, base); }
  finally { await env.browser.close(); }
}

export async function run() {
  g16(); g17(); g18();
  await runRenderGates();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().then(() => {
    const p = results.filter(r => r.status === 'pass').length;
    const f = results.filter(r => r.status === 'fail').length;
    const s = results.filter(r => r.status === 'skip').length;
    log(`\nGATE-15~18：通过 ${p} / 失败 ${f} / 跳过 ${s}`);
    process.exit(f > 0 ? 1 : 0);
  }).catch(e => { console.error('g1518 异常:', e); process.exit(2); });
}
