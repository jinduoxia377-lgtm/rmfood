// M3 T-G1 孤岛识别：把"零活跃导入方"的死代码簇精确列出来
// 方法：对每个候选目标，grep 全 src 的 `from '<含该文件>'` 真实导入，
//       并递归判断导入方自身是否也是死代码（导入方再被谁 import）
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const files = [];
(function walk(dir, rel = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, r);
    else if (/\.(ts|tsx|css|js)$/.test(e.name)) files.push({ abs: p, rel: r });
  }
})(SRC);
const content = {};
for (const f of files) content[f.rel] = readFileSync(f.abs, 'utf8');

// 构建导入图：importer(rel) -> Set<被导入的模块路径字符串>
const importRe = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const importersOf = new Map(); // target 片段 -> Set<importer rel>
for (const { rel, } of files) {
  for (const m of content[rel].matchAll(importRe)) {
    const mod = m[1] || m[2] || m[3];
    if (!mod) continue;
    // 归一化：提取有意义的片段用于匹配
    if (!importersOf.has(mod)) importersOf.set(mod, new Set());
    importersOf.get(mod).add(rel);
  }
}

// 判断某目标文件是否被"活跃"代码导入：
//  目标 rel 是 active 当且仅当：存在某 importer，其 import 语句的模块串"匹配"目标，
//  且该 importer 自身也是 active（递归，根是 App.tsx / main.tsx / index.css 等入口）
const ENTRY = new Set(['App.tsx','main.tsx','index.tsx','index.css','index.html','App.css']);
const memo = new Map();
function isRelActive(rel) {
  if (memo.has(rel)) return memo.get(rel);
  memo.set(rel, false); // 防环
  let active = false;
  const base = rel;
  // 找所有可能 import 该文件的位置
  for (const [mod, set] of importersOf) {
    if (set.has(base)) continue; // 找的是谁 import base，但我们要反向
  }
  // 反向：谁的 import 模块串能解析到 base
  const matchesMod = (mod) => {
    // 简化匹配：mod 结尾等于 base 或 base 去掉扩展名，或包含 base 的路径片段
    const clean = mod.replace(/\.tsx?$/, '').replace(/^\.?\/?(src\/)?/,'');
    const cleanBase = base.replace(/\.tsx?$/, '');
    if (clean.endsWith(cleanBase)) return true;
    // @/ alias
    if (mod.startsWith('@/')) {
      const a = mod.slice(2).replace(/\.tsx?$/, '');
      if (a === cleanBase || a.endsWith('/'+cleanBase)) return true;
    }
    return false;
  };
  // 该文件的导入方
  const importedBy = new Set();
  for (const [mod, set] of importersOf) {
    if (matchesMod(mod)) for (const im of set) importedBy.add(im);
  }
  if (ENTRY.has(base) || (base.endsWith('index.css') && !base.includes('styles/'))) { active = true; }
  else if (importedBy.size > 0) {
    for (const im of importedBy) { if (isRelActive(im)) { active = true; break; } }
  }
  memo.set(rel, active);
  return active;
}

const CANDIDATES = [
  'styles/tokens/adjustments.css',
  'docs/theme-cleanup-guide.md',
  'docs/theme-cleanup-report.md',
  'utils/theme/ThemeStorageAdapter.ts',
  'utils/theme/VersionController.ts',
  'utils/theme/ThemeShare.ts',
  'utils/events/ThemeEventBus.ts',
  'types/theme-mode.ts',
  'pages/settings/ThemeSettingsPage.tsx',
  'components/theme/ThemeEditor.tsx',
  'components/theme/ThemePreviewOverlay.tsx',
  'components/theme/ThemeOnboarding.tsx',
  'components/theme/ColorEditor.tsx',
  'components/theme/VersionHistoryPanel.tsx',
  'components/theme/index.ts',
];

console.log('══ T-G1 死代码孤岛判定 ══');
for (const c of CANDIDATES) {
  const active = isRelActive(c);
  console.log(`  ${active ? '🔴 活跃' : '⚫ 死代码'}  ${c}`);
}
console.log('\n（活跃 = 存在指向入口的导入链；死代码 = 零活跃导入方，可安全删除）');
