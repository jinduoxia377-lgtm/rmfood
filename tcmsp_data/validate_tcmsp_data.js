/**
 * TCMSP 数据质量验证工具
 * ================================================================
 * 验证已采集的 TCMSP 数据完整性、一致性和质量
 *
 * 用法:
 *   node validate_tcmsp_data.js [data_file.json]
 *   node validate_tcmsp_data.js data/tcmsp_herbs_v3.json
 */

const fs = require('fs')
const path = require('path')

// ═══════════════════ 配置 ═══════════════════
const DEFAULT_FILE = path.join(__dirname, 'data', 'tcmsp_herbs_full.json')

// ═══════════════════ 工具 ═══════════════════
function log(msg) { console.log(`  ${msg}`) }
function header(msg) { console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`) }

// ═══════════════════ 验证函数 ═══════════════════
function validate(data) {
  const report = {
    file: '', total: 0,
    completeness: {}, consistency: {}, quality: {},
    issues: [], warnings: [],
    recommendations: [],
  }

  if (!Array.isArray(data)) {
    // 可能是包装对象
    const keys = Object.keys(data)
    for (const k of keys) {
      if (Array.isArray(data[k]) && data[k].length > 10) {
        data = data[k]
        break
      }
    }
    if (!Array.isArray(data)) {
      report.issues.push('数据不是数组格式')
      return report
    }
  }

  report.total = data.length

  // ── 完整性检查 ──
  const fields = ['name_cn', 'name_pinyin', 'name_latin', 'category_cn', 'compounds']
  const fieldStats = {}
  for (const f of fields) {
    const missing = data.filter(h => !h[f] || (Array.isArray(h[f]) && h[f].length === 0))
    fieldStats[f] = {
      total: data.length,
      present: data.length - missing.length,
      missing: missing.length,
      rate: `${((data.length - missing.length) / data.length * 100).toFixed(1)}%`,
    }
  }
  report.completeness = fieldStats

  // ── 一致性检查 ──
  const names = data.map(h => h.name_cn).filter(Boolean)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  report.consistency.duplicateNames = [...new Set(dupes)]

  const categories = [...new Set(data.map(h => h.category_cn).filter(Boolean))]
  report.consistency.categoryCount = categories.length
  report.consistency.categories = categories.sort()

  // ── 质量检查 ──
  const noCompounds = data.filter(h => !h.compounds || h.compounds.length === 0)
  const noTargets = data.filter(h => !h.targets || h.targets.length === 0)
  const noDiseases = data.filter(h => !h.diseases || h.diseases.length === 0)
  const highOB = data.filter(h => (h.ob_percent || 0) >= 80)
  const highDL = data.filter(h => (h.dl_value || 0) >= 0.5)
  const withErrors = data.filter(h => h.error)

  report.quality = {
    herbsWithCompounds: data.length - noCompounds.length,
    herbsWithTargets: data.length - noTargets.length,
    herbsWithDiseases: data.length - noDiseases.length,
    herbsWithoutCompounds: noCompounds.length,
    herbsWithoutTargets: noTargets.length,
    herbsWithoutDiseases: noDiseases.length,
    highOBHerbs: highOB.length,
    highDLHerbs: highDL.length,
    herbsWithErrors: withErrors.length,
    totalCompounds: data.reduce((s, h) => s + (h.compound_count || h.compounds?.length || 0), 0),
    totalTargets: data.reduce((s, h) => s + (h.target_count || h.targets?.length || 0), 0),
    totalDiseases: data.reduce((s, h) => s + (h.disease_count || h.diseases?.length || 0), 0),
  }

  // ── 问题检测 ──
  if (noCompounds.length > data.length * 0.3) {
    report.issues.push(`超过 30% 的药材缺少化合物数据 (${noCompounds.length}/${data.length})`)
  }
  if (dupes.length > 0) {
    report.issues.push(`发现 ${dupes.length} 个重复药材名: ${dupes.join(', ')}`)
  }
  if (withErrors.length > 0) {
    report.issues.push(`${withErrors.length} 条记录有抓取错误`)
    for (const h of withErrors.slice(0, 5)) {
      report.warnings.push(`${h.name_cn}: ${h.error}`)
    }
  }

  // ── 建议 ──
  if (noTargets.length > data.length * 0.5) {
    report.recommendations.push('靶点数据覆盖率低, 建议重新抓取靶点信息')
  }
  if (noDiseases.length > data.length * 0.5) {
    report.recommendations.push('疾病数据覆盖率低, 建议重新抓取疾病信息')
  }
  if (data.length < 500) {
    report.recommendations.push(`药材总数偏少 (${data.length}), TCMSP 官网应有 502+ 味`)
  }

  // ── Top 排行 ──
  report.topCompoundHerbs = [...data]
    .sort((a, b) => (b.compound_count || 0) - (a.compound_count || 0))
    .slice(0, 10)
    .map(h => ({ name: h.name_cn, compounds: h.compound_count || h.compounds?.length || 0 }))

  report.topOBHerbs = [...data]
    .sort((a, b) => (b.ob_percent || 0) - (a.ob_percent || 0))
    .slice(0, 10)
    .map(h => ({ name: h.name_cn, obPercent: h.ob_percent || 0 }))

  return report
}

// ═══════════════════ 打印报告 ═══════════════════
function printReport(report) {
  console.log(`\n  📊 TCMSP 数据质量报告`)
  console.log(`  ${'─'.repeat(40)}`)
  console.log(`  总记录数: ${report.total}`)

  console.log(`\n  📋 字段完整性:`)
  for (const [field, stats] of Object.entries(report.completeness)) {
    const emoji = stats.missing === 0 ? '✅' : stats.missing < report.total * 0.1 ? '⚠️' : '❌'
    console.log(`    ${emoji} ${field}: ${stats.present}/${stats.total} (${stats.rate})`)
  }

  console.log(`\n  🔬 数据质量:`)
  console.log(`    🧪 化合物总数: ${report.quality.totalCompounds}`)
  console.log(`    🎯 靶点总数: ${report.quality.totalTargets}`)
  console.log(`    🏥 疾病总数: ${report.quality.totalDiseases}`)
  console.log(`    📈 高 OB% (≥80%): ${report.quality.highOBHerbs} 味`)
  console.log(`    📈 高 DL (≥0.5): ${report.quality.highDLHerbs} 味`)
  console.log(`    ⚠️ 缺少化合物: ${report.quality.herbsWithoutCompounds} 味`)
  console.log(`    ⚠️ 缺少靶点: ${report.quality.herbsWithoutTargets} 味`)
  console.log(`    ⚠️ 缺少疾病: ${report.quality.herbsWithoutDiseases} 味`)
  console.log(`    ❌ 抓取错误: ${report.quality.herbsWithErrors} 味`)

  console.log(`\n  📂 分类: ${report.consistency.categoryCount} 个`)
  if (report.consistency.duplicateNames.length > 0) {
    console.log(`  ⚠️ 重复药材: ${report.consistency.duplicateNames.join(', ')}`)
  }

  if (report.issues.length > 0) {
    console.log(`\n  ❌ 问题:`)
    report.issues.forEach(i => console.log(`    - ${i}`))
  }

  if (report.recommendations.length > 0) {
    console.log(`\n  💡 建议:`)
    report.recommendations.forEach(r => console.log(`    - ${r}`))
  }

  if (report.topCompoundHerbs?.length > 0) {
    console.log(`\n  🏆 化合物最多的药材:`)
    report.topCompoundHerbs.forEach((h, i) => {
      console.log(`    ${i + 1}. ${h.name} - ${h.compounds} 个`)
    })
  }

  console.log(`\n`)
}

// ═══════════════════ 主流程 ═══════════════════
function main() {
  const filePath = process.argv[2] || DEFAULT_FILE

  console.log('═'.repeat(60))
  console.log('  TCMSP 数据质量验证工具 v1.0')
  console.log('═'.repeat(60))

  if (!fs.existsSync(filePath)) {
    console.error(`\n  ❌ 文件不存在: ${filePath}`)
    console.log(`  用法: node validate_tcmsp_data.js [data_file.json]`)
    console.log(`  示例: node validate_tcmsp_data.js data/tcmsp_herbs_full.json`)
    process.exit(1)
  }

  console.log(`  数据文件: ${filePath}`)

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    console.log(`  文件大小: ${(raw.length / 1024 / 1024).toFixed(1)} MB`)

    const report = validate(data)
    report.file = path.basename(filePath)
    printReport(report)

    // 保存报告
    const reportPath = filePath.replace(/\.json$/, '_quality_report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`  📋 报告已保存: ${reportPath}`)
  } catch (err) {
    console.error(`  ❌ 解析失败: ${err.message}`)
    process.exit(1)
  }
}

main()
