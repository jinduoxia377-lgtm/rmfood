#!/usr/bin/env node
/**
 * UI 缺陷批量扫描（页面级，静态）
 *
 * 与 ui-guard.mjs 的分工：
 *   ui-guard  = 棘轮护栏，守的是"改一次到处复发"的机械缺陷（Pie/Checkbox/裸 input/Alert h5/渐变白字），
 *              一旦清零就靠棘轮锁住，进 pre-commit。
 *   ui-sweep  = 普查工具，扫的是"四页经验"里那些还没法写进棘轮的、需要人工判断的类别，
 *              用来生成待修清单。它不阻塞提交，只负责把 60+ 路由的存量问题一次性摊开。
 *
 * 覆盖的缺陷类别（全部来自已修四页 /settings /databases /formulas /users 的实测结论）：
 *   W1 白底白字       —— bg-white(或 /95 等浅底) 与 text-white 同现，对比度 1:1
 *   W2 品牌实底白字   —— bg-primary(-600/700 等) 配 text-white，暗色下色阶反转必翻车（D-50）
 *   W3 页面缺 h1      —— WCAG 1.3.1 / 2.4.6，每页应有且仅有一个 h1
 *   W4 标题跳级       —— 有 h3 但没有 h2（h1→h3 断层）
 *   W5 命中区过小     —— 图标按钮 padding ≤ p-1.5 且无 min-h-/min-w- 兜底（WCAG 2.5.5 44×44）
 *   W6 aria-label 字面量花括号 —— JSX 属性里写 "{x}" 不会被求值，读屏会念出字面 "{x}"
 *   W7 亮色低对比     —— text-neutral-400 / -300 等被全局兜底规则覆盖前的高发写法（仅提示）
 *
 * 用法：node scripts/ui-sweep.mjs            # 只扫 src/pages
 *      node scripts/ui-sweep.mjs --all      # 扫整个 src
 *      node scripts/ui-sweep.mjs --json     # 机器可读输出
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL = process.argv.includes('--all');
const AS_JSON = process.argv.includes('--json');
const SCAN_DIR = path.join(ROOT, 'src', ALL ? '' : 'pages');

/** 取从 start('<') 开始的完整开标签文本（跳过字符串/注释内的 < 与 >） */
function tagExtent(src, start) {
  let quote = null, depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = (e === -1 ? src.length : e + 1); continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = (e === -1 ? src.length : e); continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

/** 抽出所有 className={...} / className="..." 里的字面类名串 */
function classLiterals(src) {
  const out = [];
  // className="..."（含 cn('...') 里的第一参数不处理，只管最常见的字面量）
  for (const m of src.matchAll(/className\s*=\s*"([^"]*)"/g)) out.push({ text: m[1], index: m.index });
  for (const m of src.matchAll(/className\s*=\s*\{\s*[`'"]([^`'"]*)[`'"]/g)) out.push({ text: m[1], index: m.index });
  // cn(...) / clsx(...) 里的字面量片段
  for (const m of src.matchAll(/c(?:n|lsx)\(([^)]*)\)/g)) {
    for (const s of m[1].matchAll(/['"`]([^'"`]*)['"`]/g)) out.push({ text: s[1], index: m.index });
  }
  return out;
}

const findings = [];
const add = (file, line, rule, snippet) =>
  findings.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), line, rule, snippet: snippet.replace(/\s+/g, ' ').slice(0, 110) });

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { if (e && ['EPERM', 'EACCES', 'ENOENT'].includes(e.code)) return out; throw e; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
  }
  return out;
}

for (const file of walk(SCAN_DIR)) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); }
  catch (e) { if (e && ['EPERM', 'EACCES', 'EISDIR'].includes(e.code)) continue; throw e; }
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  // ── W1 / W2 / W5 / W7：基于 className 字面量 ──
  for (const cl of classLiterals(src)) {
    const t = cl.text;

    // W1 白底白字：浅底（bg-white* 或 bg-*-50/100）配 text-white
    const lightBg = /\bbg-white\b|\bbg-\[?(?:#f8fafc|#fff|#ffffff)/i.test(t) || /\bbg-(?:neutral|slate|gray|primary|success|warning|error)-\d0\b/.test(t);
    if (lightBg && /\btext-white\b/.test(t) && !/\bdark:text-/.test(t)) {
      add(file, lineOf(cl.index), 'W1 白底白字（对比度 1:1）', t);
    }

    // W2 品牌实底配白字：bg-primary(-N) 而不是 bg-primary-surface
    // 排除 -50/-100/-200 这类浅色 tint —— 它们是浅底，本来就该配深色字，不是 D-50 说的实底
    // 注意 (?![\w-])：\b 在 "-" 前后也算边界，写成 \bbg-primary\b 会把 bg-primary-50 也匹配进来
    if (/\bbg-primary(?:-[3-9]00)?(?![\w-])/.test(t) && /\btext-white\b/.test(t) && !/\bbg-primary-surface\b/.test(t)) {
      add(file, lineOf(cl.index), 'W2 品牌实底配白字，暗色色阶反转（应用 -surface）', t);
    }

    // W7 亮色低对比高发写法（已被 semantic-utils.css 全局兜底，仅登记以便后续核对）
    if (/\btext-(?:neutral|slate|gray)-(?:300|400)\b/.test(t) && !/\bdark:/.test(t)) {
      add(file, lineOf(cl.index), 'W7 亮色低对比文本（依赖全局兜底）', t);
    }
  }

  // ── W5 命中区过小：<button 的开标签里 padding 很小且无 min-h/min-w ──
  for (const m of src.matchAll(/<button\b/g)) {
    const tag = tagExtent(src, m.index);
    const cls = (tag.match(/className\s*=\s*(?:"([^"]*)"|\{[^}]*['"`]([^'"`]*))/ ) || []);
    const classText = cls[1] || cls[2] || '';
    const tiny = /\bp-(?:0|0\.5|1|1\.5)\b/.test(classText) || /\bsize-(?:3|4|5)\b/.test(classText) || /\bh-(?:4|5|6|7|8)\b/.test(classText);
    const hasFloor = /\bmin-h-\[|\bmin-w-\[|\bmin-h-\d|\bmin-w-\d/.test(classText);
    if (tiny && !hasFloor) add(file, lineOf(m.index), 'W5 命中区 <44×44', classText || tag.slice(0, 80));
  }

  // ── W6 aria-label 字面量花括号 ──
  for (const m of src.matchAll(/aria-label\s*=\s*"[^"]*\{[^"]*"/g)) {
    add(file, lineOf(m.index), 'W6 aria-label 含未被求值的 {…} 字面量', m[0].slice(0, 90));
  }

  // ── W3 / W4：标题结构 ──
  // 只审"路由页面"。Tab / Card / Section 这类子组件本来就不该有 h1，
  // 把它们算进来会得到 60+ 条噪声，反而淹没真正需要修的页面。
  const base = path.basename(file);
  const isRoutePage = /Page\.tsx$/.test(base) && !/\.(test|spec)\./.test(base);
  if (isRoutePage) {
    const levels = [...src.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    // <PageHeader> 内部渲染的就是 <h1>（见 components/ui/PageHeader.tsx），
    // 用了它的页面运行时已经有 h1 —— 静态扫描看不到组件内部，会误报。
    const viaHeader = /<PageHeader\b/.test(src);
    if (!levels.includes(1) && !viaHeader) {
      add(file, 1, 'W3 路由页缺少 h1', `现有标题层级: ${[...new Set(levels)].sort().join(',') || '无'}`);
    } else {
      const uniq = [...new Set(levels)].sort();
      for (let i = 1; i < uniq.length; i++) {
        if (uniq[i] - uniq[i - 1] > 1) add(file, 1, 'W4 标题跳级', `h${uniq[i - 1]} → h${uniq[i]} 断层`);
      }
    }
  }
}

// ── 输出 ──
const byRule = {};
for (const f of findings) (byRule[f.rule] ||= []).push(f);

if (AS_JSON) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const ruleKeys = Object.keys(byRule).sort();
  if (!ruleKeys.length) {
    console.log('✅ 未发现上述类别的缺陷');
  } else {
    console.log(`共 ${findings.length} 处：\n`);
    for (const r of ruleKeys) {
      console.log(`── ${r}（${byRule[r].length}）`);
      for (const f of byRule[r].slice(0, 40)) console.log(`   ${f.file}:${f.line}  ${f.snippet}`);
      if (byRule[r].length > 40) console.log(`   … 另有 ${byRule[r].length - 40} 处`);
      console.log();
    }
  }
}
