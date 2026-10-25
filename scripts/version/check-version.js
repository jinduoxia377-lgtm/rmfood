#!/usr/bin/env node
/**
 * 版本一致性门禁：校验 7 个版本承载点是否全部指向同一版本
 * =========================================================
 *
 * 用法：
 *   node scripts/version/check-version.js            # 校验所有承载点一致
 *   node scripts/version/check-version.js --json     # JSON 输出（供 CI 采集）
 *   node scripts/version/check-version.js --no-color # 关闭颜色
 *
 * 退出码：
 *   0  全部一致（或全部缺失且 --allow-missing）
 *   1  存在版本漂移
 *   2  参数错误 / 权威源缺失
 *
 * CI 集成：.github/workflows/ci-cd.yml 的 version-gate job
 * 策略说明：docs/adr/ADR-038-语义化版本发布体系.md
 */

'use strict';

const { VERSION_SOURCES, extractVersion, SEMVER_RE } = require('./version-sources');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const useColor = !args.includes('--no-color') && process.stdout.isTTY;
const allowMissing = args.includes('--allow-missing');

function c(code, s) {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const green = (s) => c('32', s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const cyan = (s) => c('36', s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);

function run() {
  const rows = VERSION_SOURCES.map((s) => {
    const v = extractVersion(s);
    return { ...s, found: v, valid: v !== null && SEMVER_RE.test(v) };
  });

  const authoritative = rows.find((r) => r.role.startsWith('权威源'));
  const missing = rows.filter((r) => r.found === null);

  // ── JSON 模式（供 CI 采集） ──
  if (asJson) {
    const version = authoritative && authoritative.found ? authoritative.found : null;
    const drifted = rows.filter((r) => r.found !== null && r.found !== version);

    const exitCode =
      version === null
        ? 2
        : drifted.length > 0
          ? 1
          : missing.length > 0 && !allowMissing
            ? 1
            : 0;

    process.stdout.write(
      JSON.stringify(
        {
          ok: exitCode === 0,
          exitCode,
          version,
          drifted: drifted.map((r) => ({ file: r.file, version: r.found })),
          missing: missing.map((r) => r.file),
          checkedAt: new Date().toISOString(),
        },
        null,
        2
      ) + '\n'
    );
    return exitCode;
  }

  // ── 人类可读模式 ──
  const width = Math.max(...rows.map((r) => r.file.length));
  console.log(bold('\nRMFOOD 版本一致性门禁'));
  console.log(dim('='.repeat(Math.max(width + 14, 58))));
  console.log();

  for (const r of rows) {
    let cell;
    if (r.found === null) {
      cell = red('缺失');
    } else if (r.valid === false) {
      cell = red(`${r.found} (非 SemVer)`);
    } else {
      cell = green(r.found);
    }
    console.log(
      `  ${cyan(r.file.padEnd(width))}  ${cell.padEnd(16)}  ${dim(r.role)}`
    );
  }

  console.log(dim('='.repeat(Math.max(width + 14, 58))));

  if (!authoritative || !authoritative.found) {
    console.log(red('\n❌ 权威源 package.json 缺失或无法解析版本号'));
    return 2;
  }

  const version = authoritative.found;
  const drifted = rows.filter((r) => r.found !== null && r.found !== version);

  if (drifted.length > 0) {
    console.log(red(`\n❌ 检测到 ${drifted.length} 处版本漂移（权威版本 ${bold(version)}）：`));
    for (const d of drifted) {
      console.log(red(`   ${d.file}  =  ${d.found}`));
    }
    console.log();
    console.log('   修复方式：在仓库根目录执行');
    console.log(`     ${cyan('npm run version:bump -- patch')}`);
    return 1;
  }

  if (missing.length > 0) {
    console.log(yellow(`\n⚠️  ${missing.length} 个承载点缺失：`));
    for (const m of missing) console.log(yellow(`   ${m.file}`));
    if (!allowMissing) {
      console.log('\n   修复方式：在仓库根目录执行 `npm run version:bump -- patch`');
      return 1;
    }
    console.log(dim('   （--allow-missing：以警告继续）'));
  }

  console.log(green(`\n✅ 全部 ${rows.length} 个承载点一致：${bold(version)}`));
  return 0;
}

process.exitCode = run();
