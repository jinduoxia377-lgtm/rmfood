#!/usr/bin/env node
/**
 * 批量修「品牌渐变实底 + 白字」——A-29
 *
 * 根因（D-50）：暗色模式下品牌色阶是【反转】的（数值越大越亮），
 * 所以 `from-primary-600 to-primary-700 text-white` 这种写死档位的实底渐变，
 * 在亮色下尚可达标，一到暗色白字就压在最亮的一档上 → 实测 1.75~2.48:1，远低于 4.5:1。
 * 靠"换个数字档位"无法两态同时达标（亮色要深、暗色要浅，方向相反），
 * 唯一正解是改用【按模式取值】的 -surface 语义令牌：
 *   亮色 → -700/-800（深底配白字）
 *   暗色 → -200/-100（浅底配黑字——白字令牌在暗色下也翻转成深色底）
 *
 * 替换规则（只动 className 字符串里、且同一串里带 text-white 的渐变色停）：
 *   from-<brand>-NNN                → from-[var(--color-<brand>-surface)]
 *   via-<brand>-NNN                 → via-[var(--color-<brand>-surface)]
 *   to-<brand>-NNN                  → to-[var(--color-<brand>-surface-deep)]
 *   hover:from-<brand>-NNN          → hover:from-[var(--color-<brand>-surface-deep)]
 *   hover:to-<brand>-NNN            → hover:to-[var(--color-<brand>-surface-deep)]
 * 非品牌族（neutral/gray/slate…）不动。已有 -surface 的不动（幂等）。
 *
 * 用法：node scripts/fix-brand-gradient-surface.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DRY = process.argv.includes('--dry');

const BRAND = 'primary|secondary|accent|success|warning|danger|info';
// 匹配 className="..." / className={'...'} / className={`...`} 中的纯字面量串
const CLASS_RE = /className=(?:"([^"]*)"|'([^']*)')/g;
// 色停：可选 hover:/focus: 等前缀 + from|via|to + -品牌族-数字
const STOP_RE = new RegExp(
  String.raw`(?:[a-z-]+:)?(from|via|to)-(?:${BRAND})-\d{2,3}`, 'g'
);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0, stops = 0;
const touched = [];

for (const file of walk(SRC)) {
  const orig = fs.readFileSync(file, 'utf8');
  let src = orig;

  src = src.replace(CLASS_RE, (full, dq, sq) => {
    const cls = dq ?? sq;
    const quote = dq !== undefined ? '"' : "'";
    if (!cls) return full;
    // 只在「实底白字」场景动手：有 text-white 且确实是渐变
    if (!/\btext-white\b/.test(cls)) return full;
    // 方向后缀有 1~2 个字母：r / l / t / b 与 br / bl / tr / tl
    if (!/\bbg-gradient-to-[a-z]{1,2}\b/.test(cls)) return full;

    let changed = false;
    const next = cls.replace(STOP_RE, (stop) => {
      if (/--color-/.test(stop)) return stop;            // 已替换过，幂等
      const m = /^((?:[a-z-]+:)?)(from|via|to)-([a-z]+)-\d{2,3}$/.exec(stop);
      if (!m) return stop;
      const [, prefix, kind, brand] = m;
      // hover/focus 一律取 -deep（视觉上"按下更深"），to 也取 -deep，from/via 取 -surface
      const deep = kind === 'to' || prefix.startsWith('hover:') || prefix.startsWith('focus:');
      const token = deep ? `${brand}-surface-deep` : `${brand}-surface`;
      changed = true;
      stops += 1;
      return `${prefix}${kind}-[var(--color-${token})]`;
    });
    if (!changed) return full;
    return `className=${quote}${next}${quote}`;
  });

  if (src !== orig) {
    files += 1;
    touched.push(path.relative(ROOT, file).replace(/\\/g, '/'));
    if (!DRY) fs.writeFileSync(file, src);
  }
}

console.log(`${DRY ? '[DRY] ' : ''}改写文件 ${files} 个，色停 ${stops} 处`);
for (const t of touched) console.log('  ' + t);
