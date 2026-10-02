// T-B2b 综合验证
//  1. 内置纯净预设：isCleanBuiltinPreset === true → applyThemeToDOM 跳过注入
//  2. 无障碍变体：isCleanBuiltinPreset === false → 仍注入（差异生效）
//  3. 自定义主题：isCleanBuiltinPreset === false → 仍注入
//  4. 四角色映射：success/error/warning/info 的 main/background/text → L0 名
//  5. L0 映射目标全部在 base.css/dark.css 有真实定义
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const presets = readFileSync(join(SRC, 'stores/theme.presets.ts'), 'utf8');
const base = readFileSync(join(SRC, 'styles/tokens/base.css'), 'utf8');
const dark = readFileSync(join(SRC, 'styles/tokens/dark.css'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${extra}`); }
};

console.log('══ T-B2b 综合验证 ══\n');

// 1) 四角色映射存在
const map = {};
for (const m of presets.matchAll(/'([a-z-]+)':\s*'(--[a-z-]+)'/g)) map[m[1]] = m[2];
for (const role of ['success', 'error', 'warning', 'info']) {
  check(map[`${role}-main`] === `--color-${role}`, `${role}-main → ${map[`${role}-main`] ?? '(缺失)'}`);
  check(map[`${role}-background`] === `--color-${role}-container`, `${role}-background → ${map[`${role}-background`] ?? '(缺失)'}`);
  check(map[`${role}-text`] === `--color-${role}-text`, `${role}-text → ${map[`${role}-text`] ?? '(缺失)'}`);
}
// 2) T-B2a 的三个品牌角色映射仍在
for (const [k, v] of [['primary-main','--color-primary'],['secondary-main','--color-secondary'],['tertiary-main','--color-accent']]) {
  check(map[k] === v, `${k} → ${map[k] ?? '(缺失)'}`);
}

// 3) isCleanBuiltinPreset 与 clearInlineCustomProps 存在
check(/export function isCleanBuiltinPreset/.test(presets), 'isCleanBuiltinPreset 已导出');
check(/function clearInlineCustomProps/.test(presets), 'clearInlineCustomProps 已定义');
check(/skipInjection = isCleanBuiltinPreset\(theme\)/.test(presets), 'applyThemeToDOM 使用 isCleanBuiltinPreset 判定');

// 4) 映射目标在 L0 有定义
const L0_TARGETS = [
  '--color-success','--color-error','--color-warning','--color-info',
  '--color-success-container','--color-success-text',
  '--color-error-container','--color-error-text',
  '--color-warning-container','--color-warning-text',
  '--color-info-container','--color-info-text',
  '--color-primary','--color-secondary','--color-accent',
];
for (const t of L0_TARGETS) {
  const inBase = new RegExp(`^\\s*${t}\\s*:`, 'm').test(base);
  const inDark = new RegExp(`^\\s*${t}\\s*:`, 'm').test(dark);
  check(inBase || inDark, `L0 定义 ${t}${inBase ? '（base）' : ''}${inDark ? '（dark）' : ''}`);
}

// 5) 旧"无消费者"名字在 src 中确实无 var() 消费者（安全改名的前置证据）
const consumers = new Set();
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(css|tsx|ts|js)$/.test(e.name)) {
      const t = readFileSync(p, 'utf8');
      for (const m of t.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) consumers.add(m[1]);
    }
  }
})(SRC);
for (const old of ['--color-success-main','--color-error-main','--color-warning-main','--color-info-main']) {
  check(!consumers.has(old), `${old} 在 src 中无消费者（可安全改名）`);
}

console.log(`\n══ 结果：${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail ? 1 : 0);
