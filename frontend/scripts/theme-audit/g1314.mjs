#!/usr/bin/env node
/**
 * GATE-13 / GATE-14 门禁断言（规范 §10.3「待补断言」落地）
 *
 * 用法：`node g1314.mjs`（独立运行，自含门禁报告）
 * 或被 `theme-gate.mjs` 主流程 import（注入 GATE_REC）
 *
 * GATE-13（M4）：代码中出现的 `--color-*` 令牌与语义类**必须**已在规范 §3/§4.2 登记。
 *   扫描 src/ 的 var(--color-*) 消费，对照 L0 令牌源（base.css + dark.css）的实际定义；
 *   出现但未定义的 → fail（漏登记，T6 无机械校验的兜底）。
 *
 * GATE-14（M4）：静态清零条件类字符串 `bg-primary-{400..950}` + `text-white`。
 *   规范 §12 序 21 登记的「82 处条件类残余」——这类字符串在特定条件渲染时
 *   会触发 D-50（反转色阶 + 白字 → 暗色对比度 1.52:1）。静态断言：
 *   全 src 中 `bg-primary-{400..950}` 与 `text-white` 同行/同类名串共现。
 *   当前为 warn（存量未清零，登记为待办）；清零后转 pass。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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
// 兼容旧调用：若 process.env.GATE_REC 注入的是「已解析的函数引用」（直接赋值，非字符串）
if (typeof process.env.GATE_REC === 'function') gateRec = process.env.GATE_REC;

// ── 工具：递归收集 .ts/.tsx/.css 文件（排除 __tests__） ──
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === 'node_modules' || e === '__tests__') continue;
      walk(p, out);
    } else if (/\.(ts|tsx|css)$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

// ============================================================================
// GATE-13：令牌登记校验（白名单制）
//
// 口径：只对 **RMFOOD 自有语义族**做「消费必须有 L0 定义」校验。
// Tailwind 内置调色板（blue/red/pink/amber/... 20 族）与代码高亮色
// （ts/python/json/...）**豁免**——它们由 @theme 默认保留、base/dark.css
// 不定义是正确设计（§3.2 品牌色板只登自有族）。
// 自有族清单 = base.css 中实际定义的 --color-<族>- 前缀 + on-* 派生。
// ============================================================================
function g13() {
  const baseP = join(SRC, 'styles/tokens/base.css');
  const darkP = join(SRC, 'styles/tokens/dark.css');
  const baseT = existsSync(baseP) ? readFileSync(baseP, 'utf8') : '';
  const darkT = existsSync(darkP) ? readFileSync(darkP, 'utf8') : '';
  if (!baseT && !darkT) {
    return gateRec('GATE-13', 'M4', '代码中自有 --color-* 令牌均已登记', 'fail', 'base/dark.css 读取失败');
  }
  // 自有族 = base/dark.css 中 --color-<族>- 的前缀集合
  const ownFams = new Set(
    [...baseT.matchAll(/--color-([a-z]+)-\d*\s*:/g), ...darkT.matchAll(/--color-([a-z]+)-\d*\s*:/g)]
      .map(m => m[1])
  );
  // L0 全量已定义的 --color-* 键名
  const defs = new Set(
    [...baseT.matchAll(/--(color-[a-z0-9-]+)\s*:/g), ...darkT.matchAll(/--(color-[a-z0-9-]+)\s*:/g)]
      .map(m => m[1])
  );
  // Tailwind 内置调色板豁免族（@theme 默认保留，base/dark 不定义是正确的）
  const TAILWIND_FAMS = new Set([
    'slate','gray','zinc','neutral','stone','red','orange','amber','yellow','lime',
    'green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia',
    'pink','rose','black','white'
  ]);
  // 代码高亮色豁免（--color-{ts,js,py,...}）
  const CODEHL_FAMS = new Set([
    'ts','tsx','js','jsx','json','css','html','xml','md','sql','sh','shell','yaml','toml','ini',
    'go','java','kt','kotlin','py','python','rb','ruby','rs','rust','c','cpp','cs','swift','php','lua','zig','rust'
  ]);

  const files = walk(SRC);
  const missing = new Map(); // token -> Set(file)
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/var\(\s*--(color-[a-z0-9-]+)/g)) {
      const name = m[1];
      const fam = name.split('-').slice(1, 2)[0] || ''; // --color-<fam>-... 的族
      // 豁免：Tailwind 内置调色板 + 代码高亮色
      if (TAILWIND_FAMS.has(fam) || CODEHL_FAMS.has(fam)) continue;
      // 带 fallback 的 var(--x, …) 豁免（有兜底值，解析不为空）
      const after = t.slice(m.index + m[0].length);
      if (/^\s*,/.test(after)) continue;
      // 自有族：必须在 L0 有定义
      if (!defs.has(name)) {
        if (!missing.has(name)) missing.set(name, new Set());
        missing.get(name).add(relative(ROOT, f));
      }
    }
  }
  if (missing.size === 0) {
    return gateRec('GATE-13', 'M4', '代码中自有 --color-* 令牌均已登记', 'pass',
      `扫描 ${files.length} 文件，自有族 ${ownFams.size} 个全部 L0 定义（${defs.size} 键），Tailwind 内置 + 代码高亮色豁免`);
  }
  const detail = [...missing.entries()].slice(0, 12)
    .map(([n, fs]) => `  · --${n}（${fs.size} 文件）← ${[...fs].slice(0, 3).join(', ')}`).join('\n');
  return gateRec('GATE-13', 'M4', '代码中自有 --color-* 令牌均已登记', 'fail',
    `发现 ${missing.size} 个未登记的自有 --color-* 消费（L0 无定义，解析为空）：\n${detail}` +
    (missing.size > 12 ? `\n  …（共 ${missing.size} 个）` : '') +
    '\n修复：在 base.css + dark.css 成对补定义（T6），或改用已登记的语义令牌。');
}

// ============================================================================
// GATE-14：条件类字符串 bg-primary-{400..950} + text-white 静态清零
// ============================================================================
function g14() {
  const files = walk(SRC);
  const hits = [];
  // 同一类名串中 bg-{primary,secondary,accent}-{400..950} 与 text-white 共现
  const comboRe = /bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)[^"'\`]*\btext-white\b|\btext-white\b[^"'\`]*\b(?:bg-)?(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
  // 条件拼接/模板字符串：`bg-primary-${x}` 或条件三元 + text-white
  const condRe = /bg-(?:primary|secondary|accent)-\$\{|\btext-white\b[^\n]*bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // 跳过注释行（避免把 §4.3 C-24 文档示例误报）
      if (/^\s*(\/\/|\/\*|\*|<!--)/.test(l)) continue;
      if (comboRe.test(l) || condRe.test(l)) {
        hits.push({ file: relative(ROOT, f), line: i + 1, text: l.trim().slice(0, 90) });
      }
    }
  }
  if (hits.length === 0) {
    return gateRec('GATE-14', 'M4', '无「反转色阶 + text-white」条件类字符串', 'pass',
      `扫描 ${files.length} 文件，0 处条件类残余`);
  }
  return gateRec('GATE-14', 'M4', '无「反转色阶 + text-white」条件类字符串', 'warn',
    `发现 ${hits.length} 处条件类字符串（存量待清零，规范 §12 序 21）：\n` +
    hits.slice(0, 10).map(h => `  · ${h.file}:${h.line}  ${h.text}`).join('\n') +
    (hits.length > 10 ? `\n  …（共 ${hits.length} 处）` : '') +
    '\n后果：特定条件渲染时触发 D-50（暗色对比度 1.52:1）。修复：见 §4.3 C-24 方案 A/B/C。');
}

// 被 theme-gate.mjs import 时由 run() 显式调用（配合 setGateRec 注入 rec）
// 独立运行（node g1314.mjs）由下方入口判断自动执行
export function run() {
  g13();
  g14();
}

// 独立运行时（node g1314.mjs，gateRec 仍为本地 report）输出汇总并退出
// 被 theme-gate.mjs import 时：顶层 gateRec === report 成立但 run() 尚未调用，
// 这里检测「是否为脚本入口」——只有直接运行才汇总退出，被 import 时不退出
const isDirectRun = process.argv[1] && process.argv[1].endsWith('g1314.mjs');
if (isDirectRun && gateRec === report) {
  run();
  const fails = results.filter(r => r.status === 'fail').length;
  const warns = results.filter(r => r.status === 'warn').length;
  const passes = results.filter(r => r.status === 'pass').length;
  console.log('');
  console.log(`══ GATE-13/14：${passes} 通过 / ${fails} 失败 / ${warns} 告警 ══`);
  process.exit(fails > 0 ? 1 : 0);
}

