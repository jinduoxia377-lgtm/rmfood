// D-53 核查：10 个 camelCase 令牌的 kebab 化候选名在 src / L0 中的消费者
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const srcFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(css|tsx|ts|js)$/.test(e.name)) srcFiles.push(p);
  }
})(SRC);
const allSrc = srcFiles.map(f => readFileSync(f, 'utf8')).join('\n');
const base = existsSync(join(SRC, 'styles/tokens/base.css')) ? readFileSync(join(SRC, 'styles/tokens/base.css'), 'utf8') : '';
const dark = existsSync(join(SRC, 'styles/tokens/dark.css')) ? readFileSync(join(SRC, 'styles/tokens/dark.css'), 'utf8') : '';

const CANDIDATES = [
  // D-53 原文 10 个（camelCase → kebab）
  ['--color-primary-contrastText',    '--color-primary-contrast-text'],
  ['--color-secondary-contrastText',  '--color-secondary-contrast-text'],
  ['--color-tertiary-contrastText',   '--color-tertiary-contrast-text'],
  ['--color-text-textPrimary',        '--color-text-text-primary'],
  ['--color-text-textSecondary',      '--color-text-text-secondary'],
  ['--color-text-textMuted',          '--color-text-text-muted'],
  ['--easing-easeIn',                 '--ease-ease-in'],
  ['--easing-easeOut',                '--ease-ease-out'],
  ['--easing-easeInOut',             '--ease-ease-in-out'],
  ['--z-modalBackdrop',               '--z-modal-backdrop'],
  // T-D5 之后实际会生成的（--ease-<camelKey>）
  ['--ease-easeIn',                   '--ease-ease-in'],
  ['--ease-easeOut',                  '--ease-ease-out'],
  ['--ease-easeInOut',                '--ease-ease-in-out'],
  // colors 顶层字符串型（被 typeof===object 过滤丢弃的，顺带核查）
  ['--color-surfaceVariant',          '--color-surface-variant'],
  ['--color-errorContainer',          '--color-error-container'],
  ['--color-outlineVariant',          '--color-outline-variant'],
];

const countVar = (name) => (allSrc.match(new RegExp('var\\(--' + name.slice(2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\w)', 'g')) || []).length;
const countDecl = (name) => {
  const re = new RegExp(`(^|[;{\\s])--${name.slice(2)}\\s*:`, 'g');
  return (base.match(re) || []).length + (dark.match(re) || []).length;
};

console.log('══ D-53 候选令牌核查 ══');
console.log('当前 camelCase（被白名单拒绝） | kebab 候选 | src消费者 | L0定义');
for (const [camel, kebab] of CANDIDATES) {
  const cc = countVar(camel.slice(2));
  const kc = countVar(kebab.slice(2));
  const kd = countDecl(kebab.slice(2));
  const mark = cc === 0 && kc === 0 ? '⛔ 无消费者（改名为零影响）' : (kc > 0 ? `✅ kebab有${kc}消费者` : '');
  console.log(`  ${camel.padEnd(40)} → ${kebab.padEnd(32)} camelC:${cc} kebabC:${kc} L0定义:${kd}  ${mark}`);
}

// L0 实际有哪些 --ease-* 与 --z-* 定义
console.log('\n══ L0 中 --ease-* / --z-* 定义 ══');
for (const m of (base + '\n' + dark).matchAll(/(--ease-[a-z0-9-]+|--z-[a-z0-9-]+)\s*:/g)) {
  console.log(`  ${m[1]}`);
}
