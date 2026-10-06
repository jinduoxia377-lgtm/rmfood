#!/usr/bin/env node
/**
 * P1-8 焦点环分层治理（待 focus-scroll.css D-57 WIP 合并后执行）
 *
 * 原理：把 `*:focus-visible` 全局焦点环（6 条）包进 `@layer base`，
 * 让 Tailwind 工具类（`focus:ring-*` 在 @layer utilities）能覆盖默认焦点环。
 * 未加 ring 类的元素仍走 3px 主色环（行为不变）。
 *
 * 滚动条 7 条 + skip-link（D-57）保持未分层（skip-link 故意未分层压过工具类）。
 *
 * ⚠️ 前置：focus-scroll.css 的 D-57 skip-link 属并发编辑者 WIP，本脚本
 * 只处理焦点环 6 条 + 滚动条 7 条的 @layer base 包裹，不动 skip-link。
 * 执行前需确认 skip-link 块仍为 HEAD 未改动状态（WIP 未混入）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'src/styles/utilities/focus-scroll.css';
let c = readFileSync(F, 'utf8');

// 焦点环 6 条规则的行边界（按 L7-34 的 6 个块：*:focus-visible / .dark * /
// input/textarea/select / .dark input / button / .dark button）
// 用块头注释定位：「焦点状态（全局）」到「跳过导航链接」之间
const startMarker = '/* ═══ 焦点状态（全局）';
const endMarker = '/* ═══ 跳过导航链接';
const si = c.indexOf(startMarker);
const ei = c.indexOf(endMarker);
if (si === -1 || ei === -1 || si > ei) {
  console.error('未找到焦点环块边界（可能已被 WIP 改动），中止');
  process.exit(1);
}
const block = c.slice(si, ei).trimEnd();
// 检查块是否已被 @layer base 包裹（幂等）
if (block.startsWith('@layer base')) {
  console.log('焦点环块已是 @layer base，无需改动');
  // 滚动条块单独处理
} else {
  const wrapped = '@layer base {\n' + block + '\n}\n';
  c = c.slice(0, si) + wrapped + c.slice(ei);
  console.log('焦点环 6 条已包入 @layer base');
}

// 滚动条 7 条（L66-87）包入 @layer base（滚动条属全局 UI，可被 utility 覆盖）
const sbStart = '/* ═══ 滚动条系统';
const sbEnd = '/* GPU acceleration';
const s2 = c.indexOf(sbStart);
const e2 = c.indexOf(sbEnd);
if (s2 !== -1 && e2 !== -1 && s2 < e2) {
  const sbBlock = c.slice(s2, e2).trimEnd();
  if (!sbBlock.startsWith('@layer base')) {
    const wrapped = '@layer base {\n' + sbBlock + '\n}\n';
    c = c.slice(0, s2) + wrapped + c.slice(e2);
    console.log('滚动条 7 条已包入 @layer base');
  } else {
    console.log('滚动条块已是 @layer base，无需改动');
  }
}

writeFileSync(F, c, 'utf8');
console.log('P1-8 焦点环分层完成（skip-link 保持未分层）');
console.log('下一步：build + verify-g2-browser 45/45 + 焦点环探针（focus:ring-* 可覆盖）');
