#!/usr/bin/env node
/**
 * T-H2 / M4：按规范 §14.3 处置 6 份废弃文档
 *   - 3 份 .md 加 DEPRECATED 头（design-system/RMFOOD-主题系统设计规范.md、
 *     UI-DESIGN-SYSTEM.md、src/docs/DESIGN_SYSTEM.md）
 *   - design-system/rmfood/* 目录：0 引用，删除（§14.3「必须删除」）
 *   - docs/theme-system-spec.md：保留，标题补注「（小程序）」
 */
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = path.resolve(FE, '..');

const header = '> **DEPRECATED** — 本文档已被 `docs/design/RMFOOD-主题系统设计规范.md`（v1.1.9）取代，仅存档用途。详见其 §14.3「旧规范文档处置」。\n';

const targets = [
  path.join(FE, 'design-system', 'RMFOOD-主题系统设计规范.md'),
  path.join(FE, 'UI-DESIGN-SYSTEM.md'),
  path.join(FE, 'src', 'docs', 'DESIGN_SYSTEM.md'),
];

for (const f of targets) {
  if (!existsSync(f)) { console.log('  [缺失] ' + f); continue; }
  const c = readFileSync(f, 'utf8');
  if (c.includes('DEPRECATED') || c.includes('废弃')) {
    console.log('  [已有废弃标记] ' + path.relative(FE, f));
    continue;
  }
  const lines = c.split('\n');
  let insertAt = 0;
  // 找到首个 # 标题行，插在其后
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) { insertAt = i + 1; break; }
  }
  lines.splice(insertAt, 0, '', header.trimEnd());
  writeFileSync(f, lines.join('\n'), 'utf8');
  console.log('  [已加废弃头] ' + path.relative(FE, f));
}

// design-system/rmfood 目录
const rmfoodDir = path.join(FE, 'design-system', 'rmfood');
if (existsSync(rmfoodDir)) {
  const files = readdirSync(rmfoodDir);
  console.log(`  [删除目录] design-system/rmfood/（${files.length} 文件，0 src 引用，§14.3 必须删除）`);
  rmSync(rmfoodDir, { recursive: true, force: true });
} else {
  console.log('  [已不存在] design-system/rmfood/');
}

// docs/theme-system-spec.md 补注
const spec = path.join(REPO, 'docs', 'theme-system-spec.md');
if (existsSync(spec)) {
  const c = readFileSync(spec, 'utf8');
  const lines = c.split('\n');
  const first = lines[0] || '';
  if (!first.includes('小程序')) {
    lines[0] = first + '（小程序）';
    writeFileSync(spec, lines.join('\n'), 'utf8');
    console.log('  [已补注] docs/theme-system-spec.md 标题 +「（小程序）」');
  } else {
    console.log('  [已含「小程序」注] docs/theme-system-spec.md');
  }
} else {
  console.log('  [缺失] docs/theme-system-spec.md');
}
console.log('══ §14.3 文档处置完成 ══');
