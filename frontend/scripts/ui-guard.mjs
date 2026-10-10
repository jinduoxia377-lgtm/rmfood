#!/usr/bin/env node
/**
 * UI/可访问性回归护栏（静态版）
 *
 * 背景：本项目有一批"改一次就会到处复发"的机械性缺陷 ——
 *   · recharts <Pie> 默认给根 <g> 加 tabindex="0" 却没有可访问名称（WCAG 4.1.2）
 *   · Radix <Checkbox.Root> 渲染成 <button role=checkbox>，兄弟 <label htmlFor> 命名不到
 *   · 裸 <input>/<textarea> 既无 aria-label 也无 placeholder，等于匿名控件
 *   · Alert 标题被硬编码成 <h5>，在任意层级插入五级标题造成 h3→h5 跳级
 *   · 品牌渐变实底配白字（暗色下色阶反转，靠调数字档位无法两态同时达标）
 *
 * 全量浏览器评分探针（.local/score-probe.cjs）跑一轮要几分钟，不适合进 pre-commit；
 * 这里用纯静态扫描守住上面这几条，几秒内出结果，作为"廉价的第一道防线"。
 *
 * 用法：node scripts/ui-guard.mjs                # 对照基线，任一规则新增即退出码 1（棘轮）
 *      node scripts/ui-guard.mjs --warn         # 只报告，永不阻塞
 *      node scripts/ui-guard.mjs --baseline     # 把当前违规数写成新的基线
 *
 * 为什么用棘轮而不是"零容忍"：存量有 100+ 处，一次性清零不现实；若直接非零即失败，
 * 这个钩子会长期阻塞任何提交，最后一定被人 --no-verify 掉。棘轮保证"只减不增"，
 * 每修一批就 --baseline 收紧一次，最终收敛到 0。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const WARN_ONLY = process.argv.includes('--warn');
const UPDATE_BASELINE = process.argv.includes('--baseline');
const BASELINE_FILE = path.join(ROOT, '.ui-guard-baseline.json');
const loadBaseline = () => {
  try { return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch { return {}; }
};

/** 收集 src 下所有 tsx/ts 文件 */
function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    // 目录不可读（沙箱/安全策略）——跳过，不能让遍历整体崩掉
    if (e && (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOENT')) return out;
    throw e;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * 取一个 JSX 标签从起始 '<' 到其结束 '>' 的文本。
 * 不能简单用 indexOf('>')：属性值里可能出现 '>'（如 arrow={ () => {} }）。
 */
function tagExtent(src, start) {
  let i = start, depth = 0, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    // 跳过注释：/* ... */ 里常出现 <tag> 字样（例如说明 Radix 渲染成 <button role=checkbox>），
    // 若不跳过会把标签提前截断，导致明明有 aria-label 也被误判为缺失。
    if (!quote && c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = (end === -1 ? src.length : end + 1);
      continue;
    }
    if (!quote && c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = (end === -1 ? src.length : end);
      continue;
    }
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

const violations = [];
const add = (file, line, rule, snippet) =>
  violations.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), line, rule, snippet });

for (const file of walk(SRC)) {
  // 少数文件受沙箱/安全策略限制读不到（EPERM/EACCES）——跳过而不是让整个护栏崩掉，
  // 否则 pre-commit 会因为一个无法读取的文件而全量失败。
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'EISDIR')) continue;
    throw e;
  }
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  // ── 规则 1：<Pie> 必须有 rootTabIndex={-1} ──
  for (const m of src.matchAll(/<Pie\b/g)) {
    const tag = tagExtent(src, m.index);
    if (!/rootTabIndex/.test(tag)) {
      add(file, lineOf(m.index), 'Pie 缺少 rootTabIndex={-1}（recharts 默认给根 <g> 加 tabindex=0 但无名称）', tag.slice(0, 90));
    }
  }

  // ── 规则 2：<Checkbox> 必须有 aria-label / aria-labelledby ──
  for (const m of src.matchAll(/<Checkbox\b/g)) {
    const tag = tagExtent(src, m.index);
    // 自闭合且无属性时通常靠 FormField 之类的外层关联，放行；其余必须有显式名称
    if (!/aria-label|aria-labelledby/.test(tag) && !/\/>\s*$/.test(tag)) {
      add(file, lineOf(m.index), 'Checkbox 缺少 aria-label / aria-labelledby（Radix 渲染为 button，label htmlFor 命名不到）', tag.slice(0, 90));
    }
  }

  // ── 规则 3：裸 <input> / <textarea> 必须可命名 ──
  for (const m of src.matchAll(/<(input|textarea)\b/g)) {
    const tag = tagExtent(src, m.index);
    const typeM = tag.match(/type=["'{]?(\w+)/);
    const type = typeM ? typeM[1] : 'text';
    // checkbox / radio 通常由外层 <label> 包裹来命名（静态扫不到祖先），交由浏览器探针判定
    if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) continue;
    /* A-31：程序化触发的隐藏控件（className 里带 hidden 的 <input type="file">，
       由旁边按钮 .click() 唤起）正确解法是 aria-hidden + tabIndex={-1} —— 它既不该
       进 Tab 序列、也不该进无障碍树。给它塞 aria-label 反而是错的：屏幕阅读器会
       读到一个摸不着、点不到的控件。所以「aria-hidden + 不可聚焦」也算合格。 */
    const offTree = /\baria-hidden=/.test(tag) && /tabIndex=\{-1\}|\btabIndex="-1"/.test(tag);
    const named = /aria-label|aria-labelledby|placeholder|id=|\{\.\.\./.test(tag) || offTree;
    if (!named) {
      add(file, lineOf(m.index), `<${type === 'textarea' ? 'textarea' : 'input'}> 无 aria-label / placeholder / id（屏幕阅读器读到的是匿名控件）`, tag.slice(0, 90));
    }
  }

  // ── 规则 4：Alert 标题不得硬编码为标题标签（会插进文档大纲造成跳级）──
  for (const m of src.matchAll(/<(h[1-6])\b[^>]*className=["'][^"']*font-medium leading-none/g)) {
    add(file, lineOf(m.index), `Alert 标题硬编码为 <${m[1]}>，应改为 <p>（会在任意层级插入 ${m[1]} 造成标题跳级）`, m[0].slice(0, 90));
  }

  // ── 规则 5：品牌渐变实底 + 白字 —— 必须用按模式取值的 -surface 令牌 ──
  // 只拦「渐变 + 白字 + 数字色阶」这一确定会踩 D-50 反转坑的组合。
  if (/from-(primary|accent)-\d{3}/.test(src) && /text-white/.test(src)) {
    for (const m of src.matchAll(/className=["'`][^"'`]*from-(primary|accent)-\d{3}[^"'`]*/g)) {
      const frag = m[0];
      if (/text-white/.test(frag) && !/color-(primary|accent)-surface/.test(frag)) {
        add(file, lineOf(m.index), '品牌渐变实底配白字：暗色下色阶反转，须改用 from-[var(--color-primary-surface)] / to-[var(--color-accent-surface)]', frag.slice(0, 110));
      }
    }
  }
}

// ── 按规则聚合 ──
const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}

if (UPDATE_BASELINE) {
  const baseline = Object.fromEntries([...byRule].map(([r, l]) => [r, l.length]));
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✅ 已写入基线 ${path.relative(ROOT, BASELINE_FILE)}：共 ${violations.length} 处`);
  for (const [r, l] of byRule) console.log(`   ${l.length}\t${r}`);
  process.exit(0);
}

if (violations.length === 0) {
  console.log('✅ UI/可访问性静态护栏：0 处违规');
  process.exit(0);
}

console.log(`\n${WARN_ONLY ? '⚠️ ' : ''}UI/可访问性静态护栏：${violations.length} 处违规\n`);
for (const [rule, list] of byRule) {
  console.log(`▸ ${rule}  （${list.length} 处）`);
  const shown = process.env.UI_GUARD_ALL ? list.length : 12;
  for (const v of list.slice(0, shown)) console.log(`    ${v.file}:${v.line}  ${v.snippet.replace(/\s+/g, ' ')}`);
  if (list.length > shown) console.log(`    … 另有 ${list.length - shown} 处`);
  console.log('');
}

// ── 棘轮判定 ──
const base = loadBaseline();
let blocked = false;
for (const [rule, list] of byRule) {
  const b = base[rule];
  if (b === undefined) {
    console.log(`❌ 新增规则违规「${rule}」：基线中不存在（${list.length} 处）。修掉它们，或先跑 --baseline 登记。`);
    blocked = true;
  } else if (list.length > b) {
    console.log(`❌ 「${rule}」从基线 ${b} 增加到 ${list.length}（+${list.length - b}）—— 不得变多。`);
    blocked = true;
  } else if (list.length < b) {
    console.log(`🎉 「${rule}」从基线 ${b} 降到 ${list.length}（-${b - list.length}）—— 跑 --baseline 收紧基线。`);
  }
}
if (blocked && !WARN_ONLY) process.exit(1);
console.log(blocked ? '（--warn 模式，未阻塞）' : '✅ 未超过基线');
process.exit(0);
