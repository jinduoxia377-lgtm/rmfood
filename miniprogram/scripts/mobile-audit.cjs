#!/usr/bin/env node
/**
 * RMFOOD 小程序移动端适配静态审计
 * 扫描 miniprogram 下所有 wxss/wxml，量化：
 *  1. 硬编码 hex 色（未走 var()）
 *  2. WXML 内联 style 中的固定尺寸/颜色
 *  3. 固定 px / 超宽 rpx（>750rpx）导致的横向溢出风险
 *  4. 触控目标过小（height < 88rpx = 44px）
 *  5. 文本字号硬编码（未走 var(--font-size-*)）
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const dirs = ['pages', 'packages', 'components'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(wxss|wxml)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [];
for (const d of dirs) {
  const p = path.join(ROOT, d);
  if (fs.existsSync(p)) walk(p, files);
}

const report = {
  wxmlAttrColors: [],  // WXML 组件 color/backgroundColor 属性硬编码
  wxssHex: [],         // wxss 中非 var 回退的硬编码 hex
  inlineStyles: [],    // { file, line, snippet }
  overflow: [],        // 固定 px 宽度 / min-width / width>750rpx
  smallTargets: [],    // 高度 < 88rpx 的可点元素
  hardcodedFont: [],   // font-size: \d+rpx 未用 var
};

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const FONT_RE = /font-size:\s*(\d+(?:\.\d+)?)rpx/g;
const HEIGHT_RE = /height:\s*(\d+(?:\.\d+)?)rpx/g;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let comment = false;

  lines.forEach((line, i) => {
    const lnum = i + 1;
    const l = line;
    if (comment) {
      if (l.includes('*/')) comment = false;
      return;
    }
    if (l.includes('/*')) {
      if (!l.includes('*/')) comment = true;
      return;
    }

    // WXML：组件 color 属性 / style 属性
    if (file.endsWith('.wxml')) {
      // 原生组件（switch/checkbox/radio/slider）的 color 属性不支持 CSS 变量，
      // 允许硬编码 hex（但值必须与品牌一致）。仅检查自定义组件。
      const isNative = /<(switch|checkbox|radio|slider)\b/.test(l);
      if (!isNative) {
        for (const m of l.matchAll(/\b(color|backgroundColor|selectedColor|activeColor)="(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|var\([^)]*\))"\s*\/?/g)) {
          const val = m[2];
          if (/^#/.test(val)) {
            report.wxmlAttrColors.push({ file: rel, line: lnum, color: val, attr: m[1], context: l.trim().slice(0, 60) });
          }
        }
      }
      for (const m of l.matchAll(/style="([^"]+)"/g)) {
        if (/rpx|px|#/.test(m[1])) {
          report.inlineStyles.push({ file: rel, line: lnum, snippet: m[1].slice(0, 80) });
        }
      }
      return;
    }

    // WXSS
    const stripped = l.replace(/\/\/.*$/, '');
    for (const m of stripped.matchAll(HEX_RE)) {
      const before = stripped.slice(0, m.index);
      // 判断是否在 var(--x, #hex) 回退位：往前找最近的 ( 和 {，且 var( 后未闭合
      const parens = [...before.matchAll(/[()]/g)];
      let depth = 0, inVar = false;
      for (let k = parens.length - 1; k >= 0; k--) {
        const ch = parens[k][0];
        if (ch === ')') depth++;
        else {
          if (depth === 0) {
            // 检查这个 ( 前面是否是 var(
            const slice = before.slice(0, parens[k].index + 1); // 含 '('
            if (/var\(\s*[^)]*$/.test(slice)) inVar = true;
            break;
          }
          depth--;
        }
      }
      if (inVar) continue;
      report.wxssHex.push({ file: rel, line: lnum, color: m[0], context: stripped.trim().slice(0, 60) });
    }

    // 3. 溢出风险
    if (/(min-)?width:\s*\d+(?:\.\d+)?px\b/.test(l)) {
      report.overflow.push({ file: rel, line: lnum, type: 'px-width', context: stripped.trim().slice(0, 70) });
    }
    for (const m of l.matchAll(/width:\s*(\d+(?:\.\d+)?)rpx/g)) {
      if (+m[1] > 750) {
        report.overflow.push({ file: rel, line: lnum, type: `rpx-width>750 (${m[1]})`, context: stripped.trim().slice(0, 70) });
      }
    }

    // 4. 触控目标过小：height < 88rpx，且上下文是按钮/点击项
    if (/button|btn|tap|click|cursor|picker|switch|checkbox|radio|nav/i.test(l) && !/var\(/.test(l)) {
      for (const m of l.matchAll(HEIGHT_RE)) {
        if (+m[1] < 88) {
          report.smallTargets.push({ file: rel, line: lnum, height: +m[1], context: stripped.trim().slice(0, 70) });
        }
      }
    }

    // 5. 字号硬编码
    for (const m of l.matchAll(FONT_RE)) {
      const before = l.slice(0, m.index);
      if (!/var\(/.test(before.slice(-40))) {
        report.hardcodedFont.push({ file: rel, line: lnum, size: +m[1], context: stripped.trim().slice(0, 60) });
      }
    }
  });
}

const agg = (arr) => {
  const byFile = {};
  for (const x of arr) byFile[x.file] = (byFile[x.file] || 0) + 1;
  return Object.entries(byFile).sort((a, b) => b[1] - a[1]);
};

console.log(`\n══ 扫描范围：${files.length} 个 wxss/wxml ══\n`);
console.log(`[1a] WXML 组件色属性硬编码（icon/switch 等）：${report.wxmlAttrColors.length} 处`);
for (const [f, c] of agg(report.wxmlAttrColors)) console.log(`    ${f}  ${c}`);
console.log(`\n[1b] WXSS 硬编码 hex（非 var 回退）：${report.wxssHex.length} 处`);
for (const [f, c] of agg(report.wxssHex)) console.log(`    ${f}  ${c}`);
console.log(`\n[2] WXML 内联样式（动态尺寸，合理）：${report.inlineStyles.length} 处`);
for (const s of report.inlineStyles.slice(0, 11)) console.log(`    ${s.file}:${s.line}  ${s.snippet}`);
console.log(`\n[3] 溢出风险：${report.overflow.length} 处`);
for (const s of report.overflow.slice(0, 10)) console.log(`    ${s.file}:${s.line}  [${s.type}]  ${s.context}`);
console.log(`\n[4] 触控目标 <88rpx：${report.smallTargets.length} 处`);
for (const s of report.smallTargets.slice(0, 10)) console.log(`    ${s.file}:${s.line}  h=${s.height}rpx  ${s.context}`);
console.log(`\n[5] 字号硬编码（未用令牌）：${report.hardcodedFont.length} 处`);
for (const [f, c] of agg(report.hardcodedFont)) console.log(`    ${f}  ${c}`);
console.log(`\n样本（字号硬编码）`);
for (const s of report.hardcodedFont.slice(0, 10)) console.log(`    ${s.file}:${s.line}  ${s.size}rpx  ${s.context}`);