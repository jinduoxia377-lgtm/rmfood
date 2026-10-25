#!/usr/bin/env node
/**
 * 版本一致性门禁：校验 8 个版本承载点是否全部指向同一版本
 * =========================================================
 *
 * 用法：
 *   node scripts/version/check-version.js                        # 一致性 + 双写清单漂移检测
 *   node scripts/version/check-version.js --json                 # JSON 输出（供 CI 采集）
 *   node scripts/version/check-version.js --no-color             # 关闭颜色
 *   node scripts/version/check-version.js --allow-missing        # 缺失承载点降级为警告
 *   node scripts/version/check-version.js --no-verify-source-list
 *                                                  # 仅跳过双写清单漂移检测（默认开启）
 *
 * 退出码：
 *   0  全部一致，且双写清单（JS VERSION_SOURCES ↔ Python VERSION_SOURCE_FILES）一致
 *   1  存在版本漂移 / 承载点缺失 / 双写清单漂移
 *   2  参数错误 / 权威源缺失
 *
 * 双写漂移检测说明：
 *   JS 侧 VERSION_SOURCES 与 backend/app/version.py 的 VERSION_SOURCE_FILES 是人工双写，
 *   任一侧增删承载点却忘记改另一侧，会让 8 处镜像"看起来都对"但实际漏检。本门禁按
 *   集合 + 顺序双向对比，缺失项 / 多余项 / 顺序差异都会报出并以退出码 1 失败。
 *
 * CI 集成：.github/workflows/ci-cd.yml 的 version-gate job
 * 策略说明：docs/adr/ADR-038-语义化版本发布体系.md
 */

'use strict';

const { VERSION_SOURCES, extractVersion, SEMVER_RE, verifySourceList } = require('./version-sources');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const useColor = !args.includes('--no-color') && process.stdout.isTTY;
const allowMissing = args.includes('--allow-missing');
const verifyEnabled = !args.includes('--no-verify-source-list');

function c(code, s) {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const green = (s) => c('32', s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const cyan = (s) => c('36', s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);

function sourceListJson(result) {
  if (!result) return { ok: true, enabled: false };
  const out = {
    ok: result.ok,
    enabled: true,
    expected: result.expected,
    actual: result.actual,
    missing: result.missing,
    extra: result.extra,
    orderMismatch: result.orderMismatch.map((o) => ({
      index: o.index,
      expected: o.expected,
      actual: o.actual,
    })),
  };
  if (result.note) out.note = result.note;
  return out;
}

function printSourceListSection(result) {
  console.log();
  if (result.ok) {
    console.log(
      green(
        `✅ 双写清单一致：scripts/version/version-sources.js ↔ backend/app/version.py（${result.actual.length} 项，集合与顺序均一致）`
      )
    );
    return;
  }

  console.log(red('\n❌ 双写清单漂移：JS VERSION_SOURCES 与 Python VERSION_SOURCE_FILES 不一致'));
  if (result.note) console.log(red(`   ${result.note}`));
  if (result.missing.length > 0)
    console.log(red(`   JS 有 / Python 缺：${result.missing.join('，')}`));
  if (result.extra.length > 0)
    console.log(red(`   Python 有 / JS 缺：${result.extra.join('，')}`));
  if (result.orderMismatch.length > 0) {
    for (const o of result.orderMismatch) {
      console.log(
        red(`   第 ${o.index + 1} 项顺序不一致：JS=${o.expected}  Python=${o.actual}`)
      );
    }
  }
  console.log();
  console.log('   修复方式：让 backend/app/version.py 的 VERSION_SOURCE_FILES 与');
  console.log(`     ${cyan('scripts/version/version-sources.js')} 的 VERSION_SOURCES.file 保持同集合、同顺序。`);
}

function run() {
  const rows = VERSION_SOURCES.map((s) => {
    const v = extractVersion(s);
    return { ...s, found: v, valid: v !== null && SEMVER_RE.test(v) };
  });

  const authoritative = rows.find((r) => r.role.startsWith('权威源'));
  const version = authoritative && authoritative.found ? authoritative.found : null;
  const drifted = rows.filter((r) => r.found !== null && r.found !== version);
  const missing = rows.filter((r) => r.found === null);

  // 双写清单漂移检测（默认开启）
  const sourceListResult = verifyEnabled ? verifySourceList() : null;
  const sourceListFailed = !!(sourceListResult && !sourceListResult.ok);

  const gateFailed = version === null || drifted.length > 0 || (missing.length > 0 && !allowMissing);
  const exitCode = version === null ? 2 : gateFailed || sourceListFailed ? 1 : 0;

  // ── JSON 模式（供 CI 采集） ──
  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: exitCode === 0,
          exitCode,
          version,
          drifted: drifted.map((r) => ({ file: r.file, version: r.found })),
          missing: missing.map((r) => r.file),
          verifySourceList: sourceListJson(sourceListResult),
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

  if (drifted.length > 0) {
    console.log(red(`\n❌ 检测到 ${drifted.length} 处版本漂移（权威版本 ${bold(version)}）：`));
    for (const d of drifted) {
      console.log(red(`   ${d.file}  =  ${d.found}`));
    }
    console.log();
    console.log('   修复方式：在仓库根目录执行');
    console.log(`     ${cyan('npm run version:bump -- patch')}`);
  }

  if (missing.length > 0) {
    console.log(yellow(`\n⚠️  ${missing.length} 个承载点缺失：`));
    for (const m of missing) console.log(yellow(`   ${m.file}`));
    if (!allowMissing) {
      console.log('\n   修复方式：在仓库根目录执行 `npm run version:bump -- patch`');
    } else {
      console.log(dim('   （--allow-missing：以警告继续）'));
    }
  }

  if (sourceListResult) printSourceListSection(sourceListResult);

  if (exitCode === 0) {
    console.log(green(`\n✅ 全部 ${rows.length} 个承载点一致：${bold(version)}`));
  }

  return exitCode;
}

process.exitCode = run();
