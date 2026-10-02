// T-B2b 摸底：列出 generateCSSVariables 为内置预设输出的全部令牌，
// 并交叉检查哪些在编译产物 / CSS 中有消费者（承载性 vs 仅注入冗余）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 1) 收集 src 中所有 var(--token) 消费者
const SRC = 'D:/RMFOODFP/frontend/src';
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

// 2) 读 theme.presets.ts，静态提取 generateCSSVariables 会输出的令牌名
//    （不实际执行 TS，而是解析其生成模式）
const presets = readFileSync(join(SRC, 'stores/theme.presets.ts'), 'utf8');

// 提取 COLOR_MAIN_TO_L0 映射（当前已映射的 3 个）
const l0Map = {};
for (const m of presets.matchAll(/'([a-z]+-main)':\s*'(--[a-z0-9-]+)'/g)) l0Map[m[1]] = m[2];

// 提取 colors 的键（category 与 key）—— 从 presetThemes 字面量
const colorCategories = new Set();
for (const m of presets.matchAll(/(\w+):\s*\{\s*main:\s*'/g)) colorCategories.add(m[1]);

// 实际会生成的颜色令牌名
const colorTokens = [];
for (const cat of colorCategories) {
  for (const key of ['main', 'background', 'text', 'surface', 'surfaceVariant', 'errorContainer', 'outline', 'outlineVariant', 'onMain']) {
    const name = `--color-${cat}-${key}`;
    if (presets.includes(`--color-${cat}-${key}`) || presets.includes(`\`--color-${cat}-\``)) {
      colorTokens.push({ name, l0: l0Map[`${cat}-${key}`] });
    }
  }
}

// 3) 提取其他类别的令牌（font/text/space/z/ease/duration）
const otherPatterns = [
  [/--font-\$\{key\}/g, 'font-*'],
  [/--text-\$\{key\}/g, 'text-*（字号）'],
  [/--space-\$\{key\}/g, 'space-*'],
  [/--z-\$\{key\}/g, 'z-*'],
  [/--ease-\$\{key\}/g, 'ease-*'],
  [/--duration-\$\{key\}/g, 'duration-*'],
];

console.log('══ generateCSSVariables 输出令牌 → 消费者检查 ══');
console.log('\n【颜色令牌】（category 来自 presetThemes）');
for (const cat of [...colorCategories].sort()) {
  // 找出该 category 下实际定义的 key
  const blockM = presets.match(new RegExp(`${cat}\\s*:\\s*\\{([\\s\\S]{0,400}?)\\n\\s*\\}`, 'm'));
  let keys = [];
  if (blockM) {
    for (const km of blockM[1].matchAll(/^\s*(\w+)\s*:/gm)) keys.push(km[1]);
  }
  for (const key of keys) {
    const name = `--color-${cat}-${key}`;
    const hasConsumer = consumers.has(name);
    const l0Target = l0Map[`${cat}-${key}`];
    const tag = l0Target ? `→L0:${l0Target}` : '';
    console.log(`  ${hasConsumer ? '✅消费者' : '⛔无消费者'}  ${name.padEnd(34)} ${tag}`);
  }
}

console.log('\n【其他类别令牌】（按生成模式推断，逐个查消费者）');
const OTHER_TOKENS = [
  ['--font-sans', 'font'], ['--font-mono', 'font'], ['--font-serif', 'font'],
  ['--text-xs', '字号'], ['--text-sm', '字号'], ['--text-base', '字号'], ['--text-lg', '字号'],
  ['--space-1', '间距'], ['--space-2', '间距'], ['--space-3', '间距'], ['--space-4', '间距'],
  ['--z-base', 'z'], ['--z-modal', 'z'], ['--z-toast', 'z'],
  ['--ease-standard', '缓动'], ['--ease-spring', '缓动'], ['--ease-elegant', '缓动'],
  ['--duration-fast', '时长'], ['--duration-slow', '时长'],
];
for (const [name, group] of OTHER_TOKENS) {
  if (presets.includes(name) || /--(font|text|space|z|ease|duration)-\$/.test(presets)) {
    const hasConsumer = consumers.has(name);
    console.log(`  ${hasConsumer ? '✅消费者' : '⛔无消费者'}  [${group}] ${name}`);
  }
}

// 4) 统计：有多少"无消费者"的注入令牌
console.log('\n══ 总结 ══');
const allInjected = colorTokens.filter(t => t.name.startsWith('--color-')).map(t => t.name)
  .concat(OTHER_TOKENS.map(t => t[0]));
const noConsumer = allInjected.filter(n => !consumers.has(n));
const withConsumer = allInjected.filter(n => consumers.has(n));
console.log(`  注入令牌总数（估计）: ${allInjected.length}`);
console.log(`  有消费者（承载性）:   ${withConsumer.length}`);
console.log(`  无消费者（仅注入）:   ${noConsumer.length}`);
if (noConsumer.length) console.log('  无消费者清单:\n    ' + noConsumer.join('\n    '));
