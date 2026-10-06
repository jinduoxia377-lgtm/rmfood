#!/usr/bin/env node
/**
 * GATE-09 诊断工具（**不自动改写**，仅验证两种路线的可行性）
 *
 * 结论（2026-10-06 实证）：GATE-09 的 106 个 `--x:var(--x)` 登记声明在
 * 本项目 Tailwind v4 + 暗色反转架构下**无安全根治解**：
 *
 *   路线 A：@theme → @theme inline
 *     自引用归 0、产物减 112KB，但「值含 var() 的声明被展开为字面量」→
 *     源码写 bg-secondary-500 处烘焙 base.css 字面值，暗色模式不再翻转 →
 *     暗色下品牌色阶视觉失效；且 GATE-12 因产物内工具类选择器缺失报错。
 *
 *   路线 B：保持 @theme，删除自引用登记声明
 *     Tailwind v4 非 inline @theme 中「键名出现」是工具类生成机制
 *     （v1.1.5 口径，D-55 实证 secondary 族缺条目 → 0 工具类）；
 *     删 100 个自引用后 GATE-12 回归（工具类 396 → 115）。
 *
 *   → GATE-09 维持 ⚠️ warn（合法登记声明，非缺陷）。真正根治需等
 *     Tailwind 版本升级或暗色架构调整（D-1 的 .dark 类驱动与 @theme inline
 *     互斥），届时单独立项。
 *
 * 本脚本仅作诊断：统计登记声明数 + 输出结论。
 */
import { readFileSync } from 'node:fs';

const IDX = 'src/index.css';
const idx = readFileSync(IDX, 'utf8');
let selfRef = 0, crossRef = 0, literal = 0;
// 只在 @theme 块内统计
const start = idx.indexOf('@theme');
const themeBlock = idx.slice(start);
for (const l of themeBlock.split('\n')) {
  const t = l.trim();
  const m = t.match(/^--([a-z0-9-]+)\s*:\s*(.+);$/);
  if (!m) continue;
  if (new RegExp(`^var\\(\\s*--${m[1]}\\s*\\)$`).test(m[2])) selfRef++;
  else if (m[2].startsWith('var(--')) crossRef++;
  else literal++;
}
console.log(`@theme 块内登记声明统计：`);
console.log(`  自引用 --x:var(--x)        ${selfRef} 个（v1.1.5 合法登记机制，必须保留）`);
console.log(`  跨令牌组合 --x:var(--y)    ${crossRef} 个`);
console.log(`  字面量/fallback            ${literal} 个`);
console.log(`\n结论：GATE-09 的 ${selfRef} 个自引用为 Tailwind v4 工具类生成机制，`);
console.log(`  在暗色反转（.dark 类驱动）架构下无安全根治解，维持 ⚠️ warn（合法）。`);
console.log(`  根治需 Tailwind 版本升级或暗色架构调整，届时单独立项。`);
