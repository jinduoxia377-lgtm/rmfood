#!/usr/bin/env node
/**
 * 批量给「匿名控件」补可访问名称 —— A-31
 *
 * 分两类处理，策略不同：
 *
 * ① type="file" + className="hidden"：这是【程序化触发器】，本身不可见，
 *    由旁边的按钮/标签点击后 .click() 唤起。它既不该进 Tab 序列、也不该进
 *    无障碍树 —— 正确做法是 aria-hidden="true" tabIndex={-1}，而不是塞一个
 *    屏幕阅读器读得到却摸不着的 aria-label。
 *
 * ② type="range" 滑块：原生 range 没有文本内容，兄弟 <label> 若没写 htmlFor
 *    也命名不到它。这里向前找最近的 <label>…</label> 文案作为 aria-label；
 *    找不到再退到紧邻的前一段可见文本；都没有才用「滑块」兜底。
 *
 * ③ 第二批（A-33）：text / number / date / time / datetime-local / textarea 同样处理。
 *    这类控件通常旁边就有一个可见的 <label>，取它的文案最贴切；取不到才按类型兜底。
 *    ⚠ 机器取词是有风险的：宁可跑 --verbose 逐条看过再落盘，也别盲信启发式。
 *
 * 用法：node scripts/fix-anon-controls.mjs [--dry] [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

/** 取一个 JSX 标签的完整文本：从 '<' 起，跳过字符串/注释里的 '>' */
function tagExtent(src, start) {
  let i = start, depth = 0, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (!quote && c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (!quote && c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 向前找最近的 <label …>…</label> 纯文本 */
function nearestLabel(src, start) {
  const win = src.slice(Math.max(0, start - 500), start);
  let best = null, idx = -1;
  for (const m of win.matchAll(/<label\b[^>]*>([^<>{}]{1,40})<\/label>/g)) {
    const t = m[1].trim();
    if (t && m.index > idx) { idx = m.index; best = t; }
  }
  if (best) return best;
  // 退路：紧邻的前一段可见文本（如 <span>预测月份:</span>）
  const texts = [...win.matchAll(/>([^<>{}]{2,24})<\//g)].map(m => m[1].trim()).filter(Boolean);
  return texts.length ? texts[texts.length - 1] : null;
}

/** 取不到可见文案时的类型兜底词 */
const FALLBACK = {
  range: '滑块', date: '日期', time: '时间', 'datetime-local': '日期时间',
  number: '数值', text: '文本', email: '邮箱', password: '密码',
  search: '搜索', url: '链接', tel: '电话',
};

let nFile = 0, nRange = 0, nText = 0;
const log = [];

for (const file of walk(SRC)) {
  const orig = fs.readFileSync(file, 'utf8');
  let src = orig;
  const edits = [];

  const TYPES = 'file|range|text|number|date|time|datetime-local|email|password|search|url|tel';
  /* 预计算行首偏移：verbose 时要打行号，若对每个匹配都 src.slice(0,i).split('\n')，
     在几千个匹配上是 O(n²)，实测直接把脚本跑超时。二分一次即可。 */
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const lineNo = (idx) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
  for (const m of [...src.matchAll(/<(input|textarea)\b/g)]) {
    const start = m.index;
    const tag = tagExtent(src, start);
    const typeM = tag.match(/type=["']?([a-z-]+)/);
    const type = m[1] === 'textarea' ? 'textarea' : (typeM ? typeM[1] : 'text');
    if (!new RegExp(`^(${TYPES})$`).test(type)) continue;
    if (/\baria-label\b|\baria-labelledby\b|\baria-hidden\b|\bplaceholder\b|\bid=/.test(tag)) continue;

    const isFile = type === 'file';
    const hidden = /className="[^"]*\bhidden\b/.test(tag);

    let insert = null;
    if (isFile && hidden) {
      insert = 'aria-hidden="true" tabIndex={-1}';
      nFile++;
    } else if (isFile) {
      insert = 'aria-label="选择文件"';
      nFile++;
    } else {
      const t = nearestLabel(src, start);
      const label = t ? t.replace(/"/g, '').replace(/[:：]\s*$/, '') : (FALLBACK[type] || '输入');
      insert = `aria-label="${label}"`;
      if (type === 'range') nRange++; else nText++;
      if (VERBOSE) log.push(`    ${path.relative(ROOT, file).replace(/\\/g, '/')}:${lineNo(start)}  ${type}  ->  ${label}`);
    }
    if (!insert) continue;

    // 插到结束 '>' 之前（自闭合时保留 '/>'）
    const close = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1;
    const next = tag.slice(0, close).replace(/\s+$/, '') + ' ' + insert + ' ' + tag.slice(close);
    edits.push([start, tag, next]);
  }

  /* 必须【按偏移从大到小】回填：edits 里的 start/tag 全部取自改写前的 src 快照，
     若从前往后应用，前面插入的字符会把后面所有 start 推后，导致后续编辑落在错误的
     偏移上 —— 实测把 `</label>` 和 `<input` 拼成了 `</labe<input`，源码被截坏。
     倒序应用时，每次修改都发生在尚未处理区间之后，前面的偏移不受影响。 */
  for (const [start, tag, next] of edits.sort((a, b) => b[0] - a[0]))
    src = src.slice(0, start) + next + src.slice(start + tag.length);

  if (src !== orig) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    log.push(`${rel}  (${edits.length})`);
    if (!DRY) fs.writeFileSync(file, src);
  }
}

console.log(`${DRY ? '[DRY] ' : ''}文件输入：${nFile}；滑块：${nRange}；文本/日期/数字类：${nText}`);
for (const l of log) console.log(l);
