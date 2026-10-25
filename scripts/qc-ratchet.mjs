#!/usr/bin/env node
/**
 * 棘轮式存量违规治理（print / console.log）
 * ============================================================
 *
 * 为什么不用「零违规即失败」：这两类检查原本写在 .husky/pre-commit 里，但
 * husky 从未安装（package.json 无 husky 依赖、无 prepare 脚本、lockfile 无记录），
 * 该文件从未被执行过。存量 print() 有 94 处、console.log 亦非零，一旦硬阻塞，
 * 钩子会被长期 `--no-verify` 绕过而彻底失效——这正是 UI/可访问性护栏当初
 * 选择棘轮的原因，写在 .husky/pre-commit 第 7 节的注释里。
 *
 * 棘轮语义：
 *   - 每个文件的违规数量与基线 scripts/qc-baseline.json 逐文件比较
 *   - 超过基线 → 退出 1（新增违规，阻塞提交）
 *   - 低于基线 → 通过（修复存量只会更严格，自动生效，无需改基线）
 *   - 基线里有、现已消失的文件 → 通过
 *   - 刷新基线：npm run qc:baseline（需人工确认是有意的收紧）
 *
 * 逐文件计数而非逐行定位：行号会随代码增删漂移，计数稳定且足够拦住「新增」。
 *
 * 用法：
 *   node scripts/qc-ratchet.mjs print      # 检查 print()，阻塞新增
 *   node scripts/qc-ratchet.mjs console    # 检查 console.log，阻塞新增
 *   node scripts/qc-ratchet.mjs --update   # 刷新基线（两个模式一起）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const BASELINE = join(repo, 'scripts', 'qc-baseline.json');

const TARGETS = {
  print: {
    label: 'print()',
    dir: 'backend/app',
    ext: ['.py'],
    // 命中行自身若匹配任一正则则不计入（等价于原来 grep -v 链）
    reject: [/>>>/, /^\s*#/, /^\s*"""/, /archived/, /logger\./, /__main__/],
    hint: '请使用 logger 替代',
  },
  console: {
    label: 'console.log',
    dir: 'frontend/src',
    ext: ['.tsx', '.ts'],
    reject: [/__tests__/, /\.test\./, /\.spec\./, /safeConsole|safeLogger|logger\.ts|errorBoundary/],
    hint: '请使用 logger 替代',
  },
};

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__pycache__' || name === '.git') continue;
      walk(full, exts, out);
    } else if (st.isFile() && exts.includes('.' + name.split('.').pop())) {
      out.push(full);
    }
  }
  return out;
}

/** 统计单个模式下的违规：{ 相对路径: 命中明细数组 } */
function scan(mode) {
  const t = TARGETS[mode];
  const dir = join(repo, t.dir);
  const needle = mode === 'print' ? 'print(' : 'console.log';
  const files = walk(dir, t.ext);
  const result = new Map();

  for (const file of files) {
    const rel = relative(repo, file).split('\\').join('/');
    if (t.reject.some((r) => r.test(rel))) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes(needle)) continue;
      if (t.reject.some((r) => r.test(line))) continue;
      hits.push({ line: i + 1, text: line.trim() });
    }
    if (hits.length > 0) result.set(rel, hits);
  }
  return result;
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    return {};
  }
}

// ---------- --update：刷新基线 ----------
if (process.argv.includes('--update')) {
  const data = {};
  for (const mode of Object.keys(TARGETS)) {
    const scanned = scan(mode);
    data[mode] = Object.fromEntries(
      [...scanned.entries()].map(([f, hits]) => [f, hits.length]),
    );
    const total = [...scanned.values()].reduce((n, h) => n + h.length, 0);
    console.log(`📦 ${TARGETS[mode].label}: ${scanned.size} 个文件 / ${total} 处`);
  }
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n✅ 基线已写入 ${relative(repo, BASELINE)}`);
  console.log('   提交前请确认这些存量是有意保留的（优先修掉，其次才是刷新基线）。');
  process.exit(0);
}

// ---------- 检查模式 ----------
const mode = process.argv[2];
if (!TARGETS[mode]) {
  console.error('用法: node scripts/qc-ratchet.mjs <print|console|--update>');
  process.exit(1);
}

const t = TARGETS[mode];
const scanned = scan(mode);
const baseline = loadBaseline()[mode] || {};
const drift = [];

for (const [file, hits] of scanned.entries()) {
  const allowed = baseline[file] ?? 0;
  if (hits.length > allowed) {
    drift.push({ file, now: hits.length, allowed, hits });
  }
}

if (drift.length === 0) {
  const total = [...scanned.values()].reduce((n, h) => n + h.length, 0);
  console.log(`✅ ${t.label}: ${scanned.size} 个文件 / ${total} 处，未超过基线`);
  process.exit(0);
}

console.error(`❌ ${t.label}: ${drift.length} 个文件新增了违规（${t.hint}）`);
for (const d of drift.slice(0, 10)) {
  console.error(`\n  ${d.file}  基线=${d.allowed}  现在=${d.now}`);
  for (const h of d.hits.slice(0, 5)) {
    console.error(`    L${h.line}: ${h.text.slice(0, 110)}`);
  }
  if (d.hits.length > 5) console.error(`    ... 另有 ${d.hits.length - 5} 处`);
}
if (drift.length > 10) console.error(`\n  ... 另有 ${drift.length - 10} 个文件`);
console.error('\n   修复这些新增违规后即可提交。若确属有意保留，用 npm run qc:baseline 刷新基线。');
process.exit(1);
