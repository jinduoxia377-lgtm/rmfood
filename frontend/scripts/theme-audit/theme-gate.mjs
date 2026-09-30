#!/usr/bin/env node
/**
 * theme:gate — RMFOOD 主题系统阻塞级门禁
 * ============================================================================
 * 依据：docs/design/RMFOOD-主题系统设计规范.md v1.1.0 §10（CHK-01~CHK-25）
 *      docs/plans/RMFOOD-主题系统修复执行方案.md §3 T-H1
 *
 * 断言：
 *   GATE-01 [M1] index.css 声明 @custom-variant dark            ← CHK-05 / D-1
 *   GATE-02 [M1] dark.css 无顶层 :root{} 令牌块                  ← CHK-17 / D-21
 *   GATE-03 [M1] 编译产物 .dark\: 无一位于 prefers-color-scheme  ← CHK-22 / D-1 / I5
 *   GATE-04 [M1] 无「反转色阶 + text-white」元素                 ← CHK-23 / D-50 / C-24
 *   GATE-05 [M1] 所有 text-white 实底元素对比度达标（亮+暗）      ← CHK-24 / A-2
 *   GATE-06 [M1] 徽章类亮色对比度 ≥ 4.5:1                        ← CHK-24 / D-21
 *   GATE-07 [M2] 无障碍 DOM 属性刷新后保留                        ← CHK-25 / D-39
 *   GATE-08 [M2] src 无回退引用的 var(--x) 全部解析非空            ← CHK-18 / D-22 / D-4
 *   GATE-09 [M1] 无自引用令牌声明 --x:var(--x)（循环引用）        ← CHK-26 / D-51
 *
 * 用法：
 *   node scripts/theme-audit/theme-gate.mjs                 # 静态 + 渲染（服务不可达则跳过渲染）
 *   node scripts/theme-audit/theme-gate.mjs --require-render # 渲染不可用即视为失败（CI 用）
 *   node scripts/theme-audit/theme-gate.mjs --json           # 机器可读输出
 *   node scripts/theme-audit/theme-gate.mjs --milestone M1   # 仅将 M1 断言计入退出码
 *
 * 退出码：0 = 计入范围内的断言全部通过；1 = 有失败；2 = 环境错误（如缺构建产物）
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();                       // 期望在 frontend/ 下执行
const SRC = join(ROOT, 'src');
const ARGS = process.argv.slice(2);
const OPT = {
  json: ARGS.includes('--json'),
  requireRender: ARGS.includes('--require-render'),
  milestone: (() => { const i = ARGS.indexOf('--milestone'); return i >= 0 ? ARGS[i + 1] : null; })(),
  baseUrl: (() => { const i = ARGS.indexOf('--base'); return i >= 0 ? ARGS[i + 1] : 'http://127.0.0.1:3000'; })(),
  user: process.env.THEME_GATE_USER || 'admin',
  pass: process.env.THEME_GATE_PASS || 'admin123',
};

const results = [];
const log = (...a) => { if (!OPT.json) console.log(...a); };
const rec = (id, milestone, title, status, detail) => {
  results.push({ id, milestone, title, status, detail });
  const icon = { pass: '✅', fail: '❌', skip: '⏭️ ', warn: '⚠️ ' }[status] || '?';
  log(`${icon} ${id} ${title}`);
  if (detail) String(detail).split('\n').forEach(l => log(`      ${l}`));
};

// ============================================================================
// CSS 工具：块扫描（跳过注释）
// ============================================================================
function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length)); }

/** 返回顶层块列表 [{selector, depth, bodyStart, end}] */
function scanBlocks(css) {
  const c = stripComments(css);
  const blocks = [];
  const stack = [];
  let buf = '';
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === '{') {
      const selector = buf.trim().replace(/\s+/g, ' ');
      stack.push({ selector, depth: stack.length, bodyStart: i + 1 });
      buf = '';
    } else if (ch === '}') {
      const b = stack.pop();
      if (b) { b.end = i; blocks.push(b); }
      buf = '';
    } else if (ch === ';') {
      buf = '';
    } else {
      buf += ch;
    }
  }
  return blocks;
}

/** 花括号深度追踪：求某 @media 前导串的全部块区间 */
function mediaRanges(css, preludeRe) {
  const ranges = [];
  const re = new RegExp(`@media[^{]*${preludeRe}[^{]*\\{`, 'gi');
  let m;
  while ((m = re.exec(css)) !== null) {
    const start = m.index;
    let i = css.indexOf('{', start);
    let depth = 0, j = i;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (depth === 0) break; }
    }
    ranges.push([start, j]);
  }
  return ranges;
}

function walkFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|__tests__|dist|coverage/.test(e.name)) continue;
      walkFiles(p, exts, out);
    } else if (exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

// ============================================================================
// 静态断言
// ============================================================================
function g01() {
  const f = join(SRC, 'index.css');
  if (!existsSync(f)) return rec('GATE-01', 'M1', 'index.css 声明 @custom-variant dark', 'fail', `找不到 ${f}`);
  const css = readFileSync(f, 'utf8');
  const m = css.match(/@custom-variant\s+dark\s*\(([^)]*)\)/);
  if (m && /\.dark/.test(m[1])) {
    rec('GATE-01', 'M1', 'index.css 声明 @custom-variant dark', 'pass', `@custom-variant dark (${m[1].trim()})`);
  } else {
    rec('GATE-01', 'M1', 'index.css 声明 @custom-variant dark', 'fail',
      '缺失 → Tailwind v4 把 dark: 编译为 @media (prefers-color-scheme:dark)，\n' +
      '14 912 处 dark: 工具类不随应用主题切换（D-1）。\n' +
      '修复：在 @import "tailwindcss"; 之后加 @custom-variant dark (&:where(.dark, .dark *));');
  }
}

function g02() {
  const f = join(SRC, 'styles/tokens/dark.css');
  if (!existsSync(f)) return rec('GATE-02', 'M1', 'dark.css 无顶层 :root{} 令牌块', 'fail', `找不到 ${f}`);
  const css = readFileSync(f, 'utf8');
  const blocks = scanBlocks(css).filter(b => b.depth === 0 && /^:root$/.test(b.selector));
  const offenders = [];
  for (const b of blocks) {
    const body = css.slice(b.bodyStart, b.end);
    const decls = (body.match(/--[a-z0-9-]+\s*:/gi) || []).length;
    const line = css.slice(0, b.bodyStart).split('\n').length;
    if (decls > 0) offenders.push({ line, decls });
  }
  if (offenders.length === 0) {
    rec('GATE-02', 'M1', 'dark.css 无顶层 :root{} 令牌块', 'pass', `${blocks.length} 个顶层 :root 块，均无令牌声明`);
  } else {
    rec('GATE-02', 'M1', 'dark.css 无顶层 :root{} 令牌块', 'fail',
      `发现 ${offenders.length} 个顶层 :root 令牌块：` +
      offenders.map(o => `\n  · dark.css:${o.line}（${o.decls} 条声明）`).join('') +
      '\n这些值在【亮色模式】同样生效，污染语义令牌（D-21）。\n' +
      '修复：同值重复项删除；暗色专用值移入 .dark{}。');
  }
}

function g03() {
  const assets = join(ROOT, 'dist/assets');
  if (!existsSync(assets)) {
    return rec('GATE-03', 'M1', '编译产物 .dark\\: 归属正确', 'skip', '缺少 frontend/dist —— 先执行 npm run build');
  }
  const cssFile = readdirSync(assets).filter(f => /^index-.*\.css$/.test(f)).sort().pop();
  if (!cssFile) return rec('GATE-03', 'M1', '编译产物 .dark\\: 归属正确', 'skip', 'dist/assets 下无 index-*.css');
  const css = readFileSync(join(assets, cssFile), 'utf8');
  const ranges = mediaRanges(css, 'prefers-color-scheme\\s*:\\s*dark');
  let inside = 0, outside = 0;
  for (const m of css.matchAll(/\.dark\\:/g)) {
    const i = m.index;
    (ranges.some(([s, e]) => i >= s && i <= e) ? inside++ : outside++);
  }
  const whereDark = (css.match(/:where\(\.dark/g) || []).length;
  if (inside === 0 && outside > 0) {
    rec('GATE-03', 'M1', '编译产物 .dark\\: 归属正确', 'pass',
      `${cssFile}：媒体查询内 0 / 外 ${outside}；:where(.dark 包装 ${whereDark} 处`);
  } else {
    rec('GATE-03', 'M1', '编译产物 .dark\\: 归属正确', 'fail',
      `${cssFile}：媒体查询内 ${inside} / 外 ${outside}\n` +
      (inside > 0 ? `⇒ 全部 dark: 工具类跟随操作系统偏好，不随应用主题开关（D-1）。` :
                    `⇒ 产物中未找到 .dark\\: 选择器，构建产物可能过期。`));
  }
}

// ============================================================================
// GATE-09 自引用令牌（循环引用）—— 源码 + 编译产物双查
// ============================================================================
const SELF_REF = /--([a-z0-9-]+)\s*:\s*var\(\s*--\1\s*\)/g;

function g09() {
  // 先收集 base.css / dark.css 中「真正定义」（右侧不是指向自身的 var）的令牌名
  const tokenFiles = [
    join(SRC, 'styles/tokens/base.css'),
    join(SRC, 'styles/tokens/dark.css'),
  ];
  const defined = new Set();
  for (const f of tokenFiles) {
    if (!existsSync(f)) continue;
    const css = readFileSync(f, 'utf8');
    for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
      const name = m[1], value = m[2].trim();
      // 排除自身引用形式
      if (!new RegExp(`^var\\(\\s*--${name}\\s*\\)$`).test(value)) defined.add(name);
    }
  }

  const hits = [];
  const srcFiles = [
    join(SRC, 'index.css'),
    join(SRC, 'styles/tokens/base.css'),
    join(SRC, 'styles/tokens/dark.css'),
  ];
  for (const f of srcFiles) {
    if (!existsSync(f)) continue;
    const css = readFileSync(f, 'utf8');
    for (const m of css.matchAll(SELF_REF)) {
      const line = css.slice(0, m.index).split('\n').length;
      hits.push({ where: `${relative(ROOT, f)}:${line}`, name: m[1] });
    }
  }
  const assets = join(ROOT, 'dist/assets');
  let compiledFile = null;
  if (existsSync(assets)) {
    compiledFile = readdirSync(assets).filter(f => /^index-.*\.css$/.test(f)).sort().pop();
    if (compiledFile) {
      const css = readFileSync(join(assets, compiledFile), 'utf8');
      for (const m of css.matchAll(SELF_REF)) hits.push({ where: `${compiledFile}(编译)`, name: m[1] });
    }
  }

  if (hits.length === 0) {
    return rec('GATE-09', 'M1', '无自引用令牌（循环引用）', 'pass', '源码与编译产物均未发现 --x:var(--x)');
  }

  // 分类：同名有真实定义 → 冗余（可工作，潜在风险）；无定义 → 循环引用（令牌彻底失效）
  const harmful = new Map();   // name -> sources
  const redundant = new Map();
  for (const h of hits) {
    const bucket = defined.has(h.name) ? redundant : harmful;
    if (!bucket.has(h.name)) bucket.set(h.name, new Set());
    bucket.get(h.name).add(h.where);
  }

  if (harmful.size === 0) {
    return rec('GATE-09', 'M1', '无自引用令牌（循环引用）', 'warn',
      `无「循环引用」（失效）令牌；但存在 ${redundant.size} 个冗余自引用（同名有真实定义，靠层叠顺序侥幸可用）：\n` +
      '  ' + [...redundant.keys()].slice(0, 15).join(', ') +
      (redundant.size > 15 ? ` …（共 ${redundant.size}）` : '') +
      '\n建议清理：@theme 写成 --x: var(--x) 既不生效也无意义，且一旦 base.css 移除该定义即静默失效。');
  }

  const detail = [...harmful.entries()].slice(0, 12)
    .map(([n, w]) => `  · --${n}  ← ${[...w].slice(0, 2).join(', ')}`).join('\n');

  rec('GATE-09', 'M1', '无自引用令牌（循环引用）', 'fail',
    `发现 ${harmful.size} 个【循环引用】令牌（令牌彻底失效，共 ${[...harmful.values()].reduce((a, s) => a + s.size, 0)} 处）：\n${detail}` +
    (harmful.size > 12 ? `\n  …（共 ${harmful.size} 个）` : '') +
    `\n另有 ${redundant.size} 个冗余自引用（同名有真实定义，靠层叠顺序侥幸可用）。` +
    '\n成因：@theme 写 --color-X: var(--color-X)，替换掉 Tailwind 默认值；若 base.css/dark.css 也未定义同名令牌，' +
    '则全部声明都是自引用 → 解析为 guaranteed-invalid（空）→ 依赖它的工具类失去颜色。' +
    '\n修复：删除这些自引用声明，让 Tailwind 保留默认主题值（或改为引用真实 primitive）。');
}

// ============================================================================
// GATE-10 Radix Themes 前置条件（R-9 / CHK-21 / D-41）
// ----------------------------------------------------------------------------
// 规则：若源码导入 @radix-ui/themes，则必须同时导入其样式表
//       @radix-ui/themes/styles.css；否则 <Theme> 只是没有令牌定义的 wrapper。
//       若源码完全不使用该库，则本断言通过（当前状态）。
// ============================================================================
function g10() {
  const files = walkFiles(SRC, ['.ts', '.tsx', '.css']);
  const pkgImportRe = /from\s+['"]@radix-ui\/themes['"]|require\(\s*['"]@radix-ui\/themes['"]\s*\)/;
  const styleImportRe = /@radix-ui\/themes\/styles(\.css)?['"]/;

  const importers = [];
  let styleImported = false;
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    // 去掉注释后再判定，避免把说明性提及误判为真实导入
    const code = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (pkgImportRe.test(code)) importers.push(relative(ROOT, f));
    if (styleImportRe.test(code)) styleImported = true;
  }

  if (importers.length === 0) {
    rec('GATE-10', 'M1', 'Radix Themes 前置条件（R-9）', 'pass',
      '源码未使用 @radix-ui/themes —— 无「引入但样式表未加载」风险');
    return;
  }
  if (styleImported) {
    rec('GATE-10', 'M1', 'Radix Themes 前置条件（R-9）', 'pass',
      `${importers.length} 处导入，且已加载 @radix-ui/themes/styles.css`);
    return;
  }
  rec('GATE-10', 'M1', 'Radix Themes 前置条件（R-9）', 'fail',
    `检测到 ${importers.length} 处 @radix-ui/themes 导入，但全项目未导入其样式表：\n` +
    importers.slice(0, 8).map(p => `  · ${p}`).join('\n') +
    '\n后果：<Theme> 仅渲染无令牌定义的 wrapper；--gray-* / --font-size-* / --radius-* 全部为空。\n' +
    '修复二选一：① 补 `import \'@radix-ui/themes/styles.css\'` 并做视觉复核；\n' +
    '            ② 移除该依赖，包装层改用项目原生实现。');
}

// ============================================================================
// GATE-11 主色表面令牌对比度（亮/暗 × 基础 / hover）
// ----------------------------------------------------------------------------
// D-54 回归防护：.surface-primary 承载固定的白色前景，其**所有状态（含 :hover）**
// 必须使用【不参与色阶反转】的表面令牌族。曾用 --color-primary-800 作暗色 hover，
// 该令牌在暗色下被反转为 #d1fae5（浅薄荷），白字对比度仅 1.13:1 —— 比 D-50 本身
// 的 1.52:1 更差，且静态对比度断言无法发现（它只测非悬停态）。
// ============================================================================
function g11() {
  const readTokens = (file) => {
    const p = join(SRC, 'styles/tokens', file);
    if (!existsSync(p)) return {};
    const css = readFileSync(p, 'utf8');
    const out = {};
    // 键统一保留 `--` 前缀，与 NEED 数组口径一致
    for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[`--${m[1]}`] = m[2];
    return out;
  };
  const lum = (hex) => {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4]
      .map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(s => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };

  const NEED = ['--color-primary-surface', '--color-primary-surface-hover', '--color-on-primary-surface'];
  const problems = [];
  const report = [];
  for (const [mode, file] of [['亮色', 'base.css'], ['暗色', 'dark.css']]) {
    const t = readTokens(file);
    const missing = NEED.filter(n => !t[n]);
    if (missing.length) { problems.push(`${mode}(${file}) 缺少令牌: ${missing.join(', ')}`); continue; }
    const base = ratio(t['--color-primary-surface'], t['--color-on-primary-surface']);
    const hov = ratio(t['--color-primary-surface-hover'], t['--color-on-primary-surface']);
    report.push(`${mode} 基础 ${base}:1 / hover ${hov}:1`);
    if (base < 4.5) problems.push(`${mode} 基础态对比度 ${base}:1 < 4.5:1`);
    if (hov < 4.5) problems.push(`${mode} hover 态对比度 ${hov}:1 < 4.5:1`);
  }

  // .surface-primary:hover 不得引用会随主题反转的色阶令牌
  const su = join(SRC, 'styles/components/semantic-utils.css');
  if (existsSync(su)) {
    const css = readFileSync(su, 'utf8');
    const m = css.match(/\.surface-primary:hover\s*\{([^}]*)\}/);
    if (!m) problems.push('semantic-utils.css 中未找到 .surface-primary:hover 规则');
    else {
      const bad = m[1].match(/--color-primary-(?:[1-9]\d{2}|hover)\b/);
      if (bad) problems.push(`.surface-primary:hover 引用了会反转的色阶令牌 ${bad[0]}（暗色下变浅 → 白字对比度崩塌）`);
      if (!/--color-primary-surface-hover/.test(m[1])) problems.push('.surface-primary:hover 未使用 --color-primary-surface-hover');
    }
  }

  if (problems.length) {
    rec('GATE-11', 'M1', '主色表面令牌对比度（含 hover）', 'fail',
      problems.join('\n') + (report.length ? `\n实测: ${report.join(' | ')}` : ''));
  } else {
    rec('GATE-11', 'M1', '主色表面令牌对比度（含 hover）', 'pass',
      `全部 ≥ 4.5:1 —— ${report.join(' | ')}`);
  }
}

// ============================================================================
// GATE-12 源码使用的品牌色阶类必须在编译产物中真实存在
// ----------------------------------------------------------------------------
// D-51 / D-55 同源防护：@theme 桥接层不完整时，Tailwind v4 不会生成对应的
// 工具类，而源码里的类名却照常书写 —— 元素静默失去颜色（bg-* → 透明，
// 配 text-white 即白字落在透明底上）。静态 grep 与 var() 可用性检查都发现不了。
// 本次实测：secondary 族整族缺失 → 104 处 bg-secondary-* / text-secondary-* 全废。
// ============================================================================
function g12() {
  const assets = join(ROOT, 'dist/assets');
  if (!existsSync(assets)) {
    rec('GATE-12', 'M1', '品牌色阶工具类已在产物中生成', 'skip', '未找到 dist/assets，跳过');
    return;
  }
  const compiled = readdirSync(assets).filter(f => /^index-.*\.css$/.test(f)).sort().pop();
  if (!compiled) { rec('GATE-12', 'M1', '品牌色阶工具类已在产物中生成', 'skip', '未找到 index-*.css'); return; }
  const css = readFileSync(join(assets, compiled), 'utf8');

  const FAMILIES = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'error', 'info', 'neutral'];
  const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  const PREFIX = ['bg', 'text', 'border', 'from', 'to', 'via', 'ring', 'fill', 'stroke', 'divide', 'outline', 'shadow', 'decoration', 'accent'];

  const used = new Set();
  for (const f of walkFiles(SRC, ['.ts', '.tsx'])) {
    const t = readFileSync(f, 'utf8');
    const re = new RegExp(`\\b((?:${PREFIX.join('|')})-(?:${FAMILIES.join('|')})-(?:${STEPS.join('|')}))\\b`, 'g');
    for (const m of t.matchAll(re)) used.add(m[1]);
  }

  // Tailwind 产物中类选择器形如 `.bg-x`，带变体时形如 `.dark\:bg-x`、`.hover\:bg-x`
  // 故匹配「紧邻 `.` 或转义冒号 `\:`」的类名，并排除更长标识符的误配
  const esc = (c) => c.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  const missing = [];
  for (const c of used) {
    const re = new RegExp(`(?:\\.|\\\\:)${esc(c)}(?![\\w-])`);
    if (!re.test(css)) missing.push(c);
  }

  if (missing.length === 0) {
    rec('GATE-12', 'M1', '品牌色阶工具类已在产物中生成', 'pass',
      `源码使用的 ${used.size} 个品牌色阶类全部存在于 ${compiled}`);
  } else {
    const byFam = {};
    for (const c of missing) {
      const fam = c.match(new RegExp(`(?:${PREFIX.join('|')})-(${FAMILIES.join('|')})-`))?.[1] ?? '其他';
      (byFam[fam] ??= []).push(c);
    }
    rec('GATE-12', 'M1', '品牌色阶工具类已在产物中生成', 'fail',
      `源码使用了 ${missing.length}/${used.size} 个产物中不存在的品牌色阶类：\n` +
      Object.entries(byFam).map(([f, a]) => `  · ${f}(${a.length}): ${a.slice(0, 8).join(', ')}${a.length > 8 ? ' …' : ''}`).join('\n') +
      '\n后果：这些类不产生任何样式 → bg-* 元素背景透明、text-* 回落继承色。\n' +
      '成因：@theme 块未桥接对应令牌 —— 在 index.css 的 @theme 中补 `--color-<族>-<档>: var(--color-<族>-<档>);`。');
  }
}

// ============================================================================
// 渲染断言（惰性加载 Playwright）
// ============================================================================
async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.ok || r.status < 500;
  } catch { return false; }
}

const RELATIVE_LUM = `(function(){
  window.__lum=function(css){const m=String(css).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]);};
  window.__contrast=function(f,b){const a=window.__lum(f),c=window.__lum(b);if(a===null||c===null)return null;
    const hi=Math.max(a,c),lo=Math.min(a,c);return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try{const m=await import(/* @vite-ignore */ p); if(m&&m.useThemeStore){window.__store=m.useThemeStore;return window.__store;}}catch(e){}
    } return null; };
  window.__setTheme=async function(id){const s=await window.__getStore();if(!s)return false;s.getState().setPresetTheme(id);return true;};
  window.__setA11y=async function(m){const s=await window.__getStore();if(!s)return false;s.getState().setAccessibilityMode(m);return true;};
})();`;

/** 采集当前页面「text-white + 实底」元素及其对比度；同时标记「反转色阶 + 白字」 */
const SCAN_WHITE_ON_FILL = `(function(){
  var PALETTE_SCALE = /(?:^|\\s)bg-(primary|secondary|accent)-(?:[4-9][0-9][0-9]|950)(?:\\s|$|\\/)/;
  var out=[];
  var all=document.querySelectorAll('body *');
  for (var k=0;k<all.length;k++){
    var e=all[k];
    var cls=(typeof e.className==='string')?e.className:'';
    if(!/(^|\\s)text-white(\\/\\d+)?(\\s|$)/.test(cls)) continue;
    var r=e.getBoundingClientRect();
    if(r.width<20||r.height<14) continue;
    var cs=getComputedStyle(e);
    var bg=cs.backgroundColor;
    if(bg==='rgba(0, 0, 0, 0)'||bg==='transparent') continue;
    var fs=parseFloat(cs.fontSize)||16;
    var fw=parseInt(cs.fontWeight,10)||400;
    var large = fs>=24 || (fs>=18.66 && fw>=700);
    out.push({ cls:cls.slice(0,140), bg:bg, color:cs.color,
               tag:e.tagName, text:(e.textContent||'').trim().slice(0,30),
               large:large, required: large?3:4.5,
               ratio: window.__contrast(cs.color,bg),
               invertedScale: PALETTE_SCALE.test(cls) });
  }
  return out;
})()`;

async function renderSuite() {
  let chromium;
  try { ({ chromium } = await import('@playwright/test')); }
  catch {
    return { available: false, reason: '@playwright/test 未安装' };
  }
  const loginOk = await reachable(OPT.baseUrl + '/login');
  if (!loginOk) return { available: false, reason: `dev server 不可达：${OPT.baseUrl}` };

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(RELATIVE_LUM);
  try {
    await page.goto(OPT.baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3200);
    const pw = await page.$('input[type="password"]');
    if (pw) {
      await page.fill('#rhine-username, input[type="username"], input[type="text"]', OPT.user);
      await page.fill('#rhine-password, input[type="password"]', OPT.pass);
      await page.locator('button[type="submit"], button:has-text("登录")').first().click();
      try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
      await page.waitForTimeout(4000);
    }
    return { available: true, browser, ctx, page };
  } catch (e) {
    await browser.close();
    return { available: false, reason: `渲染环境初始化失败：${String(e).slice(0, 200)}` };
  }
}

async function g0405(env) {
  // 覆盖含页头/按钮/徽章的高密度路由；不存在的路由会被 goto 报错并跳过
  const routes = ['/dashboard', '/formulas', '/settings', '/users', '/ai',
                  '/analytics', '/database', '/experiments', '/workflow',
                  '/organizations', '/notifications', '/academic']; 
  const inverted = [];
  const failures = [];
  let scanned = 0;

  for (const route of routes) {
    try {
      const resp = await env.page.goto(OPT.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 70000 });
      await env.page.waitForTimeout(3600);
      // 跳过 404 / 重定向到错误页的路由，避免把「路由不存在」误报为对比度问题
      const path = new URL(env.page.url()).pathname;
      if (path === '/404' || (resp && resp.status() === 404)) { scanned++; continue; }
      for (const mode of ['light-default', 'dark-default']) {
        await env.page.evaluate(async (m) => { await window.__setTheme(m); }, mode);
        await env.page.waitForTimeout(1300);
        const rows = await env.page.evaluate(SCAN_WHITE_ON_FILL);
        scanned += rows.length;
        for (const r of rows) {
          const item = { route, mode, ...r };
          if (r.invertedScale) inverted.push(item);
          if (r.ratio !== null && r.ratio < r.required) failures.push(item);
        }
      }
    } catch (e) {
      return { error: `${route}: ${String(e).slice(0, 160)}` };
    }
  }
  return { inverted, failures, scanned, routes };
}

async function g06(env) {
  await env.page.goto(OPT.baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 70000 });
  await env.page.waitForTimeout(3500);
  await env.page.evaluate(async () => { await window.__setTheme('light-default'); });
  await env.page.waitForTimeout(1000);
  return env.page.evaluate(() => {
    const mk = (cls) => {
      const d = document.createElement('div');
      d.className = cls; d.textContent = '草稿';
      d.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(d);
      const cs = getComputedStyle(d);
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      let eff = cs.backgroundColor;
      if (m) {
        const p = m[1].split(',').map(s => parseFloat(s.trim()));
        const bb = bodyBg.match(/rgba?\(([^)]+)\)/);
        if (bb && p.length === 4) {
          const b = bb[1].split(',').map(s => parseFloat(s.trim()));
          const a = p[3];
          eff = `rgb(${Math.round(p[0]*a + b[0]*(1-a))}, ${Math.round(p[1]*a + b[1]*(1-a))}, ${Math.round(p[2]*a + b[2]*(1-a))})`;
        }
      }
      return { cls, color: cs.color, effectiveBg: eff, ratio: window.__contrast(cs.color, eff) };
    };
    const names = ['badge-draft','badge-approved','badge-pending','badge-rejected','badge-revision','badge-archived'];
    return { badges: names.map(mk), draftText: getComputedStyle(document.documentElement).getPropertyValue('--badge-draft-text').trim() };
  });
}

async function g07(env) {
  await env.page.goto(OPT.baseUrl + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 70000 });
  await env.page.waitForTimeout(4000);
  const set = await env.page.evaluate(async () => {
    await window.__setA11y('reading');
    await new Promise(r => setTimeout(r, 800));
    const de = document.documentElement;
    return { a11y: de.getAttribute('data-a11y-mode'), reading: de.getAttribute('data-reading-mode') };
  });
  await env.page.reload({ waitUntil: 'domcontentloaded', timeout: 70000 });
  await env.page.waitForTimeout(5000);
  const after = await env.page.evaluate(() => {
    const de = document.documentElement;
    return { a11y: de.getAttribute('data-a11y-mode'), reading: de.getAttribute('data-reading-mode'),
             textPrimary: getComputedStyle(de).getPropertyValue('--text-primary').trim() };
  });
  await env.page.evaluate(async () => { await window.__setA11y('normal'); });
  return { set, after };
}

async function g08(env) {
  // 静态收集 src 中引用的 var 名，区分「无回退」与「有回退」
  const files = walkFiles(SRC, ['.css', '.ts', '.tsx']);
  const required = new Set();   // var(--x) 无回退 → 必须有定义
  const optional = new Set();   // var(--x, fallback) → 可以无定义
  const defFiles = new Set(['index.css', 'base.css', 'dark.css']);  // 定义位不计入
  for (const f of files) {
    const base = f.split(/[\\/]/).pop();
    if (defFiles.has(base)) continue;                    // 跳过定义文件
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/gi)) {
      (m[2] === ',' ? optional : required).add(m[1]);
    }
  }
  // @theme 自引用块内的无回退引用（如 --color-blue-500: var(--color-blue-500)）也是缺陷
  const idx = join(SRC, 'index.css');
  if (existsSync(idx)) {
    const t = readFileSync(idx, 'utf8');
    for (const m of t.matchAll(SELF_REF)) required.add(`--${m[1]}`);
  }

  await env.page.goto(OPT.baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 70000 });
  await env.page.waitForTimeout(4000);
  const res = await env.page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    const bad = [];
    for (const n of names) if (!cs.getPropertyValue(n).trim()) bad.push(n);
    return bad;
  }, [...required]);

  const optUnresolved = await env.page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    return names.filter(n => !cs.getPropertyValue(n).trim());
  }, [...optional]);

  return { requiredCount: required.size, optionalCount: optional.size, unresolved: res, optUnresolved };
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  log('');
  log('══════════════════════════════════════════════════════════════');
  log(' RMFOOD 主题系统门禁 (theme:gate)');
  log(` 范围: ${OPT.milestone ? OPT.milestone + ' 断言计入退出码' : '全部断言'}`);
  log('══════════════════════════════════════════════════════════════');
  log('');
  log('── 静态断言 ──');
  g01(); g02(); g03(); g09(); g10(); g11(); g12();

  log('');
  log('── 渲染断言 ──');
  const env = await renderSuite();
  if (!env.available) {
    const why = env.reason || '渲染环境不可用';
    for (const [id, ms, t] of [
      ['GATE-04', 'M1', '无「反转色阶 + text-white」元素'],
      ['GATE-05', 'M1', 'text-white 实底元素对比度达标'],
      ['GATE-06', 'M1', '徽章类亮色对比度达标'],
      ['GATE-07', 'M2', '无障碍属性刷新后保留'],
      ['GATE-08', 'M2', 'var(--x) 全部可解析'],
    ]) {
      rec(id, ms, t, OPT.requireRender ? 'fail' : 'skip', why);
    }
  } else {
    try {
      const r05 = await g0405(env);
      if (r05.error) {
        rec('GATE-04', 'M1', '无「反转色阶 + text-white」元素', 'fail', r05.error);
        rec('GATE-05', 'M1', 'text-white 实底元素对比度达标', 'fail', r05.error);
      } else {
        // GATE-04
        if (r05.inverted.length === 0) {
          rec('GATE-04', 'M1', '无「反转色阶 + text-white」元素', 'pass',
            `扫描 ${r05.scanned} 个白字实底元素 × ${r05.routes.length} 路由 × 双模式`);
        } else {
          const uniq = new Map();
          for (const it of r05.inverted) {
            const key = it.cls;
            if (!uniq.has(key)) uniq.set(key, { ...it, count: 0, routes: new Set() });
            const u = uniq.get(key); u.count++; u.routes.add(it.route);
          }
          rec('GATE-04', 'M1', '无「反转色阶 + text-white」元素', 'fail',
            `发现 ${r05.inverted.length} 处（${uniq.size} 种模式）：\n` +
            [...uniq.values()].slice(0, 6).map(u =>
              `  · ${u.cls.slice(0, 78)}\n    ${u.mode} bg=${u.bg} 对比度=${u.ratio}（需 ${u.required}） 见于 ${[...u.routes].join(',')}`
            ).join('\n') +
            '\n修复：见规范 §4.3 C-24（改用 surface-primary 或不可反转的固定色阶）。');
        }
        // GATE-05
        if (r05.failures.length === 0) {
          rec('GATE-05', 'M1', 'text-white 实底元素对比度达标', 'pass', `${r05.scanned} 个元素全部 ≥ 阈值`);
        } else {
          rec('GATE-05', 'M1', 'text-white 实底元素对比度达标', 'fail',
            `${r05.failures.length}/${r05.scanned} 未达标：\n` +
            r05.failures.slice(0, 6).map(f =>
              `  · [${f.route} ${f.mode}] 实测 ${f.ratio}:1（需 ${f.required}）bg=${f.bg}`
            ).join('\n'));
        }
      }

      // GATE-06
      try {
        const b = await g06(env);
        const bad = b.badges.filter(x => x.ratio !== null && x.ratio < 4.5);
        if (bad.length === 0) {
          rec('GATE-06', 'M1', '徽章类亮色对比度达标', 'pass',
            b.badges.map(x => `${x.cls.replace('badge-','')}=${x.ratio}`).join(' '));
        } else {
          rec('GATE-06', 'M1', '徽章类亮色对比度达标', 'fail',
            `--badge-draft-text 解析为 ${b.draftText}（应为 #6E6E73）\n` +
            bad.map(x => `  · ${x.cls}: ${x.ratio}:1（${x.color} on ${x.effectiveBg}）`).join('\n') +
            '\n修复：dark.css 顶层 :root 块把暗色值泄漏到亮色模式（D-21）。');
        }
      } catch (e) { rec('GATE-06', 'M1', '徽章类亮色对比度达标', 'fail', String(e).slice(0, 200)); }

      // GATE-07
      try {
        const a = await g07(env);
        if (a.after.a11y === 'reading' && a.after.reading === 'sepia') {
          rec('GATE-07', 'M2', '无障碍属性刷新后保留', 'pass',
            `刷新后 a11y=${a.after.a11y} reading=${a.after.reading} --text-primary=${a.after.textPrimary}`);
        } else {
          rec('GATE-07', 'M2', '无障碍属性刷新后保留', 'fail',
            `交互设置时 a11y=${a.set.a11y} reading=${a.set.reading}（正确）\n` +
            `刷新后 a11y=${a.after.a11y} reading=${a.after.reading}（丢失）\n` +
            `⇒ --text-primary 回退为 ${a.after.textPrimary}，semantic-utils.css 的阅读模式规则整层失效（D-39）。`);
        }
      } catch (e) { rec('GATE-07', 'M2', '无障碍属性刷新后保留', 'fail', String(e).slice(0, 200)); }

      // GATE-08
      try {
        const v = await g08(env);
        if (v.unresolved.length === 0) {
          rec('GATE-08', 'M2', '无回退引用的 var(--x) 全部可解析', 'pass',
            `必需 ${v.requiredCount} 个全部解析；另有 ${v.optionalCount} 个带回退引用` +
            (v.optUnresolved.length ? `（其中 ${v.optUnresolved.length} 个未定义但有回退，属可接受）` : ''));
        } else {
          rec('GATE-08', 'M2', '无回退引用的 var(--x) 全部可解析', 'fail',
            `${v.unresolved.length}/${v.requiredCount} 个无回退引用的变量解析为空：\n` +
            '  ' + v.unresolved.slice(0, 20).join(', ') +
            (v.unresolved.length > 20 ? ` …（共 ${v.unresolved.length}）` : '') +
            `\n（另有 ${v.optUnresolved.length}/${v.optionalCount} 个带回退的变量未定义，属可接受）`);
        }
      } catch (e) { rec('GATE-08', 'M2', '无回退引用的 var(--x) 全部可解析', 'fail', String(e).slice(0, 200)); }
    } finally {
      await env.browser.close();
    }
  }

  // ── 汇总 ──
  const inScope = OPT.milestone ? results.filter(r => r.milestone === OPT.milestone) : results;
  const failed = inScope.filter(r => r.status === 'fail');
  const skipped = inScope.filter(r => r.status === 'skip');
  const passed = inScope.filter(r => r.status === 'pass');

  log('');
  log('══════════════════════════════════════════════════════════════');
  log(` 通过 ${passed.length} / 失败 ${failed.length} / 跳过 ${skipped.length}   （范围：${OPT.milestone || '全部'}）`);
  if (failed.length) {
    log(' 失败项: ' + failed.map(r => r.id).join(', '));
  }
  log('══════════════════════════════════════════════════════════════');
  log('');

  if (OPT.json) {
    console.log(JSON.stringify({ milestone: OPT.milestone, results, summary: {
      passed: passed.length, failed: failed.length, skipped: skipped.length } }, null, 2));
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('theme:gate 异常:', e); process.exit(2); });
