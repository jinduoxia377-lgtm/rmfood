#!/usr/bin/env node
/**
 * 把仓库内被跟踪的 .husky/{pre-commit,pre-push} 接线到 .git/hooks/ 同名文件。
 *
 * 为什么需要这一步：本项目从未安装 husky（package.json 无 husky 依赖、
 * 无 prepare 脚本、lockfile 无记录），因此 .husky/ 下的钩子虽然进了版本库
 * 却从未被执行过；真正生效的是 .git/hooks/pre-commit / pre-push，而它们是本地
 * 未跟踪文件，新克隆拿不到——两份逻辑各自漂移。
 *
 * 本脚本消除漂移：以 .husky/ 下的钩子为唯一权威，复制到 .git/hooks/ 同名文件。
 * pre-commit 与 pre-push 一并接线（pre-push 此前从未被接线，属真空转）。
 * 零第三方依赖，跨平台（Windows / macOS / Linux）。
 *
 * 用法：npm run hooks:setup
 */

import { cpSync, existsSync, mkdirSync, statSync, chmodSync, renameSync, readFileSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

const HOOKS_DIR = join(repo, '.git', 'hooks');
const HOOK_NAMES = ['pre-commit', 'pre-push'];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// fail-soft 守卫：postinstall 会在非 git 环境（如作为依赖安装、无 .git 的打包件）
// 触发。此时不破坏安装，仅跳过接线并提示。
if (!existsSync(join(repo, '.git')) || !statSync(join(repo, '.git')).isDirectory()) {
  console.warn('⚠️  未检测到 .git 目录（非 Git 仓库环境），跳过提交钩子接线。');
  process.exit(0);
}

try {
  mkdirSync(HOOKS_DIR, { recursive: true });
} catch (e) {
  fail(`无法创建 ${HOOKS_DIR}: ${e.message}`);
}

let wired = 0;
for (const name of HOOK_NAMES) {
  const SRC = join(repo, '.husky', name);
  const DST = join(HOOKS_DIR, name);

  if (!existsSync(SRC)) {
    fail(`找不到权威钩子 ${SRC}`);
  }

  // 备份已存在的本地钩子（只覆盖一次，不覆盖备份，避免误删历史接线）
  if (existsSync(DST)) {
    if (!statSync(DST).isFile()) fail(`${DST} 不是普通文件`);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backup = join(HOOKS_DIR, `${name}.bak-${ts}`);
    try {
      renameSync(DST, backup);
      console.log(`📦 已备份原本地钩子 -> ${basename(backup)}`);
    } catch (e) {
      fail(`无法备份原钩子: ${e.message}`);
    }
  }

  cpSync(SRC, DST);
  try {
    // Windows 上无 exec 位概念，但设置无害；Unix 上 git 需要它
    chmodSync(DST, 0o755);
  } catch {
    /* 忽略：部分文件系统不支持 chmod */
  }

  const size = statSync(DST).size;
  const lines = readFileSync(DST, 'utf8').trim().split(/\r?\n/).length;
  console.log(`✅ ${name} 钩子已接线：.git/hooks/${name} <- .husky/${name}`);
  console.log(`   ${lines} 行 / ${size} 字节`);
  wired += 1;
}

console.log(`\n已接线 ${wired}/${HOOK_NAMES.length} 个钩子。.husky/ 下的钩子是唯一权威，修改后重新运行本脚本即可生效。`);
