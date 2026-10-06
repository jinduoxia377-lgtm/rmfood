// T-G3 测量：精确定位 theme.storage.ts 中可安全删除的块与僵尸键
// 原则：theme-storage（themeStore persist 键）绝不可动；只删 0 消费者的方法/键
import { readFileSync } from 'node:fs';

const SRC = 'D:/RMFOODFP/frontend/src/stores/theme.storage.ts';
const t = readFileSync(SRC, 'utf8');
const lines = t.split('\n');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => { if (ok) { pass++; console.log('  ✅ ' + label); } else { fail++; console.log('  ❌ ' + label + ' ' + extra); } };

// 1. STORAGE_KEYS 的 4 个键定义
const keys = ['THEME_STATE', 'CUSTOM_THEMES', 'USER_PREFERENCES', 'THEME_VERSIONS'];
for (const k of keys) check(new RegExp(`${k}\\s*:`).test(t), `STORAGE_KEYS 定义 ${k}`);

// 2. 各方法定义行号
const methods = ['saveThemeState', 'loadThemeState', 'saveCustomThemes', 'loadCustomThemes', 'clearAll', 'getStorageUsage', 'getVersions', 'saveVersions', 'createVersion', 'getVersionHistory', 'clearVersionHistory', 'rollbackVersion', 'migrateFromV1'];
const mline = {};
methods.forEach(m => {
  const i = lines.findIndex(l => l.trim().startsWith(m + ':') || l.includes(`${m}(`) && l.includes('=>') === false && l.trim().startsWith(m));
  mline[m] = i + 1;
  console.log(`    ${m.padEnd(24)} 行 ${mline[m]}`);
});

// 3. 确认 theme-storage（themeStore 在用的 persist 键）不在本文件定义（由 themeStore.ts 管理）
check(!/rmfood-theme-storage/.test(t), '本文件不含 rmfood-theme-storage（该键归 themeStore.ts）');

// 4. STORAGE_KEYS 引用统计（类内部）
const keyRefs = {};
keys.forEach(k => { keyRefs[k] = (t.match(new RegExp(k, 'g')) || []).length; });
console.log('\n  STORAGE_KEYS 引用次数（含定义行）：');
keys.forEach(k => console.log(`    ${k.padEnd(18)} ${keyRefs[k]}`));

// 5. ThemeVersion 接口
check(/export interface ThemeVersion/.test(t), 'ThemeVersion 接口存在');

console.log(`\n══ 结论：pass=${pass} fail=${fail} ══`);
process.exit(fail ? 1 : 0);
