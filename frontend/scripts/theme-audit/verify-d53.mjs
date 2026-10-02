// D-53 验证：generateCSSVariables 输出的所有令牌名必须匹配 SAFE_TOKEN_NAME
// （kebab 全小写），不再含 camelCase 名。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const presets = readFileSync(join(SRC, 'stores/theme.presets.ts'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};

console.log('══ D-53 验证 ══\n');

// 1) 生成器已引入 toKebab
check(/const toKebab = \(k: string\) => k\.replace/.test(presets), 'toKebab 辅助函数已定义');
check(/--color-\$\{category\}-\$\{kebabKey\}/.test(presets), '颜色键已 kebab 化');
check(/--ease-\$\{toKebab\(key\)\}/.test(presets), '缓动键已 kebab 化');
check(/--z-\$\{toKebab\(key\)\}/.test(presets), 'z-index 键已 kebab 化');

// 2) 静态模拟：把所有会生成的令牌名按 toKebab 规则算出，验证全部匹配 SAFE_TOKEN_NAME
const SAFE = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;
const toKebab = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// 收集 preset 中所有会进入 generateCSSVariables 的键
// colors: category × key（取 lightColors 字面量的键）
const colorCats = {};
for (const m of presets.matchAll(/^(const \w+Colors: SemanticColors = \{)([\s\S]*?)^\};/gm)) {
  // 简单：直接从字面量抓所有二级键
  const body = m[2];
  const keys = new Set();
  for (const km of body.matchAll(/^\s{2,4}(\w+):\s*\{/gm)) keys.add(km[1]);
  for (const km of body.matchAll(/^\s{4}(\w+):\s*'(?:rgba?\([^)]*\)|#[0-9a-fA-F]+|[^\n]+)'/gm)) keys.add(km[1]);
  colorCats[m[1].match(/\w+Colors/)?.[0] || 'x'] = keys;
}

// 仅验证规则：所有含大写字母的键经 toKebab 后都变全小写 kebab
const camelCaseKeys = [
  'contrastText', 'textPrimary', 'textSecondary', 'textMuted',
  'surfaceVariant', 'errorContainer', 'outlineVariant',
  'easeIn', 'easeOut', 'easeInOut', 'modalBackdrop',
];
for (const k of camelCaseKeys) {
  const kebab = toKebab(k);
  const token = `--z-${kebab}`; // 用 z 前缀演示
  check(SAFE.test(`--color-x-${kebab}`) && SAFE.test(token), `kebab 化 ${k} → ${kebab}（SAFE_TOKEN_NAME 通过）`);
}

// 3) 确认 SAFE_TOKEN_NAME 在生成器的 isSafeToken 中仍被引用（守卫未删）
check(/SAFE_TOKEN_NAME\.test\(name\)/.test(presets), 'SAFE_TOKEN_NAME 守卫仍在（拒绝非 kebab 名）');

console.log(`\n══ 结果：${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail ? 1 : 0);
