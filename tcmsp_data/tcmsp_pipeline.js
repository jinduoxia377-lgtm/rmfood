/**
 * TCMSP 统一数据管道 v1.0
 * ================================================================
 * 一键执行: 抓取 → 验证 → 合并 → 导入 PostgreSQL
 *
 * 用法:
 *   node tcmsp_pipeline.js                    # 完整管道
 *   node tcmsp_pipeline.js --step merge       # 仅合并
 *   node tcmsp_pipeline.js --step import      # 仅导入 PostgreSQL
 *   node tcmsp_pipeline.js --step validate    # 仅验证
 *   node tcmsp_pipeline.js --dry-run          # 预览 (不执行实际操作)
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')

// ═══════════════════ 配置 ═══════════════════
const BASE_DIR = __dirname
const DATA_DIR = path.join(BASE_DIR, 'data')
const SCRIPTS = {
  scrape: path.join(BASE_DIR, 'tcmsp_scraper_cli.js'),
  validate: path.join(BASE_DIR, 'validate_tcmsp_data.js'),
  merge: path.join(BASE_DIR, 'merge_herbs_targets.js'),
}
const FILES = {
  herbs: path.join(DATA_DIR, 'tcmsp_herbs_full.json'),
  targets: path.join(DATA_DIR, 'tcmsp_targets_diseases_full.json'),
  merged: path.join(DATA_DIR, 'tcmsp_merged_unified.json'),
  report: path.join(DATA_DIR, 'tcmsp_merged_report.json'),
  missing: path.join(DATA_DIR, 'tcmsp_missing_targets.json'),
}

// ═══════════════════ 工具 ═══════════════════
function log(msg, emoji = '') {
  console.log(`  ${emoji} ${msg}`)
}
function header(msg) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${msg}`)
  console.log(`${'═'.repeat(60)}`)
}
function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [script, ...args], {
      cwd: BASE_DIR, stdio: 'inherit', shell: true,
    })
    proc.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`Exit code: ${code}`))
    })
    proc.on('error', reject)
  })
}

// ═══════════════════ 管道步骤 ═══════════════════

async function stepScrape(opts) {
  header('步骤 1/4: 数据采集')
  if (opts.dryRun) {
    log('预览模式 — 将执行:', '🔍')
    log(`  node ${SCRIPTS.scrape}${opts.resume ? ' --resume' : ''}`)
    return
  }
  const args = opts.resume ? ['--resume'] : []
  await runNode(SCRIPTS.scrape, args)
}

async function stepValidate(opts) {
  header('步骤 2/4: 数据验证')
  if (opts.dryRun) {
    log('预览模式 — 将验证:', '🔍')
    for (const [k, v] of Object.entries(FILES)) {
      if (fs.existsSync(v)) log(`  ${v} (${(fs.statSync(v).size / 1024 / 1024).toFixed(1)} MB)`)
    }
    return
  }
  // 验证 herbs
  if (fs.existsSync(FILES.herbs)) {
    await runNode(SCRIPTS.validate, [FILES.herbs])
  } else {
    log('药材文件不存在, 跳过验证', '⚠️')
  }
  // 验证 merged (如果存在)
  if (fs.existsSync(FILES.merged)) {
    await runNode(SCRIPTS.validate, [FILES.merged])
  }
}

async function stepMerge(opts) {
  header('步骤 3/4: 数据合并')
  if (opts.dryRun) {
    log('预览模式 — 将合并 herbs + targets/diseases', '🔍')
    log(`  输入: ${path.basename(FILES.herbs)} + ${path.basename(FILES.targets)}`)
    log(`  输出: ${path.basename(FILES.merged)}`)
    return
  }
  if (!fs.existsSync(FILES.herbs)) {
    log('药材文件不存在, 请先执行采集步骤', '❌')
    return
  }
  if (!fs.existsSync(FILES.targets)) {
    log('靶点文件不存在, 将创建仅含化合物的合并数据', '⚠️')
  }
  await runNode(SCRIPTS.merge)
}

async function stepImport(opts) {
  header('步骤 4/4: 导入 PostgreSQL')
  log('导入需要后端 Python 环境和 PostgreSQL 运行中', 'ℹ️')
  log('手动导入步骤:', 'ℹ️')
  log('  1. 确保 PostgreSQL 正在运行')
  log('  2. cd backend && python -c "from app.services.data_sources.tcmsp_client import TCMSPSyncService; ..."')
  log('  3. 或使用后端 API: POST /api/v1/databases/sync/herbs')
}

// ═══════════════════ 状态检查 ═══════════════════

function checkStatus() {
  header('📊 当前数据状态')

  const checks = [
    { label: '药材数据 (herbs)', file: FILES.herbs },
    { label: '靶点数据 (targets)', file: FILES.targets },
    { label: '合并数据 (merged)', file: FILES.merged },
    { label: '合并报告', file: FILES.report },
    { label: '缺失靶点列表', file: FILES.missing },
  ]

  for (const check of checks) {
    if (fs.existsSync(check.file)) {
      const size = (fs.statSync(check.file).size / 1024 / 1024).toFixed(1)
      const data = JSON.parse(fs.readFileSync(check.file, 'utf-8'))
      const count = Array.isArray(data) ? data.length : data.data?.length || data.total || '?'
      log(`${check.label}: ✅ ${count} 条 (${size} MB)`)
    } else {
      log(`${check.label}: ❌ 不存在`)
    }
  }

  // 后端数据库检查
  log('\n后端数据库:')
  const envFile = path.join(BASE_DIR, '..', 'backend', '.env')
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8')
    const dbMatch = envContent.match(/DATABASE_URL=(.+)/)
    if (dbMatch) {
      const dbUrl = dbMatch[1]
      const isSQLite = dbUrl.includes('sqlite')
      const isPostgres = dbUrl.includes('postgres')
      log(`  类型: ${isSQLite ? 'SQLite (开发)' : isPostgres ? 'PostgreSQL (生产)' : '未知'}`)
      log(`  连接: ${dbUrl.replace(/\/\/.*@/, '//***@')}`)
    } else {
      log('  ⚠️ 未配置 DATABASE_URL, 使用默认 PostgreSQL')
    }
  }
}

// ═══════════════════ 主流程 ═══════════════════

async function main() {
  const args = process.argv.slice(2)
  const opts = {
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    step: null,
  }

  const stepIdx = args.indexOf('--step')
  if (stepIdx !== -1) opts.step = args[stepIdx + 1]

  console.log('═'.repeat(60))
  console.log('  🧬 TCMSP 统一数据管道 v1.0')
  console.log('  莱茵分子生物科技 — 中药材数据采集与管理系统')
  console.log('═'.repeat(60))

  // 状态检查
  checkStatus()

  if (opts.step === 'status') return

  // 执行管道
  try {
    if (!opts.step || opts.step === 'scrape') await stepScrape(opts)
    if (!opts.step || opts.step === 'validate') await stepValidate(opts)
    if (!opts.step || opts.step === 'merge') await stepMerge(opts)
    if (!opts.step || opts.step === 'import') await stepImport(opts)
  } catch (err) {
    console.error(`\n  ❌ 管道执行失败: ${err.message}`)
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ✅ 管道执行完毕`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(err => {
  console.error(`❌ 致命错误: ${err.message}`)
  process.exit(1)
})
