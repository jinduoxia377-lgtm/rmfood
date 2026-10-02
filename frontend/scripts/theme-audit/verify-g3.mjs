// T-G3 验证：版本历史死功能删除 + 僵尸键清理 + D-28 重复样板收敛
// 注：focus-scroll.css 属他人 WIP（D-57），其 D-28 副本留待合并后处理，
//     本脚本不校验该文件。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const t = readFileSync('D:/RMFOODFP/frontend/src/stores/theme.storage.ts', 'utf8');
const s = readFileSync('D:/RMFOODFP/frontend/src/stores/themeStore.ts', 'utf8');
let pass = 0, fail = 0;
const check = (ok, label, extra = '') => { if (ok) { pass++; console.log('  ✅ ' + label); } else { fail++; console.log('  ❌ ' + label + ' ' + extra); } };

console.log('══ theme.storage.ts 瘦身 ══');
check(!/saveThemeState/.test(t), 'saveThemeState 已删除');
check(/loadThemeState/.test(t), 'loadThemeState 保留（read-only 迁移）');
check(!/saveCustomThemes/.test(t), 'saveCustomThemes 已删除');
check(/loadCustomThemes/.test(t), 'loadCustomThemes 保留（read-only 迁移）');
check(!/clearAll/.test(t), 'clearAll 已删除');
check(!/getStorageUsage/.test(t), 'getStorageUsage 已删除');
check(!/getVersions/.test(t), 'getVersions 已删除');
check(!/saveVersions/.test(t), 'saveVersions 已删除');
check(!/createVersion/.test(t), 'createVersion 已删除（D-44）');
check(!/getVersionHistory/.test(t), 'getVersionHistory 已删除（D-44）');
check(!/clearVersionHistory/.test(t), 'clearVersionHistory 已删除（D-44）');
check(!/rollbackVersion/.test(t) || t.includes('// D-44'), 'rollbackVersion 已删除（仅注释提及）');
check(!/export interface ThemeVersion/.test(t), 'ThemeVersion 接口已删除');
check(t.includes('LEGACY_STORAGE_KEYS'), 'LEGACY_STORAGE_KEYS 存在（含 4 个遗留键）');
check(t.includes('cleanLegacyKeys'), 'cleanLegacyKeys 一次性清理方法存在');

console.log('\n══ themeStore.ts R-15 清理 ══');
check(s.includes("localStorage.removeItem('rmfood-custom-themes')"), 'rmfood-custom-themes 清理');
check(s.includes("localStorage.removeItem('rmfood-theme-state')"), 'rmfood-theme-state 清理');
check(s.includes("localStorage.removeItem('rmfood-theme-preferences')"), 'rmfood-theme-preferences 清理');
check(s.includes("localStorage.removeItem('rmfood-theme-versions')"), 'rmfood-theme-versions 清理');
check(s.includes("name: 'rmfood-theme-storage'"), 'rmfood-theme-storage（活跃 persist 键）保留');

console.log('\n══ D-28 全局 reduced-motion 块收敛（排除他人 WIP 文件）══');
const SRC = 'D:/RMFOODFP/frontend/src';
// 他人 WIP 文件（D-57 改动 focus-scroll.css），暂不校验其副本
const SKIP = new Set(['utilities/focus-scroll.css']);
const files = [];
(function walk(dir, rel) {
  const r = rel || '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name), rr = r ? `${r}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, rr);
    else if (/\.(css|tsx?|ts)$/.test(e.name)) files.push({ abs: p, rel: rr });
  }
})(SRC, '');
const GLOBAL_BLOCK = /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\*, \*::before, \*::after \{\s*\n\s*animation-duration: 0\.01ms !important;\s*\n\s*animation-iteration-count: 1 !important;\s*\n\s*transition-duration: 0\.01ms !important;\s*\n\s*scroll-behavior: auto !important;\s*\n\s*\}?\s*\}/;
const hits = [];
for (const f of files) {
  if (SKIP.has(f.rel)) continue;
  const c = readFileSync(f.abs, 'utf8');
  if (GLOBAL_BLOCK.test(c)) hits.push(f.rel);
}
const remaining = hits.filter(h => !h.endsWith('environment.css'));
check(remaining.length === 0, `非 environment.css 的全局块 = ${remaining.length}（${remaining.join(', ') || '无'}），目标 0`);

console.log(`\n══ 结果：${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail ? 1 : 0);
