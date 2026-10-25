#!/usr/bin/env node
/**
 * 版本发布助手：原子化更新全部 7 个版本承载点
 * =============================================
 *
 * 用法：
 *   node scripts/version/bump-version.js <patch|minor|major|rc> [--tag] [--yes]
 *
 *   patch       2.0.0 -> 2.0.1     向后兼容的修复
 *   minor       2.0.0 -> 2.1.0     向后兼容的新功能
 *   major       2.0.0 -> 3.0.0     不兼容的破坏性变更
 *   rc          2.0.0 -> 2.0.0-rc.1  发布候选
 *
 * 选项：
 *   --tag    更新后直接执行 `git tag -a vX.Y.Z -m "..."` 并推送（默认不执行，只打印命令）
 *   --yes    跳过确认提示
 *
 * 退出码：0 成功；1 写入失败；2 参数错误
 *
 * ⚠️  本脚本不执行 git commit。请按打印的提示手动提交，以便审阅完整 diff。
 */

'use strict';

const { VERSION_SOURCES, extractVersion, writeVersion, bump, todayISO } = require('./version-sources');

const args = process.argv.slice(2);
const kind = args.find((a) => !a.startsWith('--'));
const doTag = args.includes('--tag');
const assumeYes = args.includes('--yes') || args.includes('-y');

const useColor = process.stdout.isTTY;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => c('32', s);
const red = (s) => c('31', s);
const cyan = (s) => c('36', s);
const yellow = (s) => c('33', s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);

if (!kind || !['patch', 'minor', 'major', 'rc', 'prerelease'].includes(kind)) {
  console.error(red('用法：node scripts/version/bump-version.js <patch|minor|major|rc> [--tag] [--yes]\n'));
  console.error(dim('  patch    向后兼容的修复      2.0.0 -> 2.0.1'));
  console.error(dim('  minor    向后兼容的新功能    2.0.0 -> 2.1.0'));
  console.error(dim('  major    破坏性变更          2.0.0 -> 3.0.0'));
  console.error(dim('  rc       发布候选            2.0.0 -> 2.0.0-rc.1'));
  process.exit(2);
}

function git(args) {
  const { execSync } = require('child_process');
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function confirm(question) {
  if (assumeYes) return true;
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(`${question} [y/N] `, (a) => {
      rl.close();
      resolve(/^(y|yes)$/i.test(a.trim()));
    })
  );
}

(async () => {
  console.log(bold('\nRMFOOD 版本发布助手'));
  console.log(dim('='.repeat(56)));

  // 1. 读当前版本（权威源：根 package.json）
  const auth = VERSION_SOURCES.find((s) => s.role.startsWith('权威源'));
  const current = extractVersion(auth);
  if (!current) {
    console.error(red('❌ 无法从 package.json 读取当前版本'));
    process.exit(2);
  }

  const next = bump(current, kind);
  const date = todayISO();
  const tag = `v${next}`;

  // 2. 检测未提交改动，避免把无关改动混进发布提交
  const dirty = git('status --porcelain');
  if (dirty) {
    console.log(yellow('⚠️  工作区存在未提交改动（bump 会把它们一起写入）：'));
    for (const line of dirty.split('\n').slice(0, 12)) console.log(dim('   ' + line));
    if (dirty.split('\n').length > 12) console.log(dim('   ...'));
  }

  console.log();
  console.log(`  当前版本   ${bold(current)}`);
  console.log(`  bump 类型  ${bold(kind)}`);
  console.log(`  目标版本   ${green(next)}`);
  console.log(`  发布 tag   ${cyan(tag)}`);
  console.log(`  发布日期   ${date}`);
  console.log();

  if (!(await confirm('确认执行以上版本发布？'))) {
    console.log(yellow('已取消'));
    process.exit(0);
  }

  // 3. 写回全部承载点
  console.log(dim('='.repeat(56)));
  console.log('更新承载点：\n');
  let failed = 0;
  for (const src of VERSION_SOURCES) {
    const r = writeVersion(src, next);
    const icon = r.changed ? green('✓') : dim('-');
    console.log(`  ${icon} ${src.file.padEnd(28)} ${r.changed ? green(r.note) : dim(r.note)}`);
    if (!r.changed && !/未变化/.test(r.note)) failed++;
  }
  console.log();

  // 4. 立即复核
  const { execFileSync } = require('child_process');
  let ok = false;
  try {
    execFileSync(process.execPath, [require('path').join(__dirname, 'check-version.js'), '--no-color'], {
      stdio: 'inherit',
    });
    ok = true;
  } catch (_) {
    ok = false;
  }

  if (!ok) {
    console.error(red('\n❌ 写回后校验失败，请检查上述输出'));
    process.exit(1);
  }

  // 5. 打印后续操作
  console.log();
  console.log(green('✅ 版本号已原子化更新并通过一致性校验\n'));

  const tagCmd = `git tag -a ${tag} -m "${tag} - RMFOOD 平台 ${date}"`;
  const pushCmd = `git push origin HEAD && git push origin ${tag}`;

  if (doTag) {
    try {
      git(`tag -a ${tag} -m "${tag} - RMFOOD 平台 ${date}"`);
      console.log(green(`✓ 已创建 tag ${tag}`));
    } catch (e) {
      console.log(yellow(`⚠️  tag 创建失败：${e.message}\n   请手动执行：${cyan(tagCmd)}`));
    }
    console.log('\n下一步（需要 git commit，本脚本不代替你提交）：');
  } else {
    console.log('下一步：');
  }

  console.log('  ' + dim('1.'));
  console.log(cyan(`  git status`));
  console.log('  ' + dim('2.'));
  console.log(cyan(`  git add -A`));
  console.log('  ' + dim('3.'));
  console.log(cyan(`  git commit -m "release: ${tag} (ADR-038)"`));
  if (doTag) {
    console.log('  ' + dim('4.'));
    console.log(cyan(`  git push origin HEAD`));
    console.log('  ' + dim('5.'));
    console.log(cyan(`  git push origin ${tag}`));
  } else {
    console.log('  ' + dim('4.'));
    console.log(cyan(`  ${tagCmd}`));
    console.log('  ' + dim('5.'));
    console.log(cyan(`  ${pushCmd}`));
  }

  console.log();
  console.log(yellow('⚠️  发布后请确认：'));
  console.log(yellow('   1. CHANGELOG.md 的 [新版本] 条目已填写实际变更明细（当前是占位）'));
  console.log(yellow('   2. README.md 「版本与代际地图」已同步'));
  console.log(yellow('   3. 若含破坏性变更，已新建 docs/adr/ADR-0XX 记录迁移影响'));
  console.log();
})();
