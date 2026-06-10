/**
 * TCMSP 数据合并工具
 * ================================================================
 * 将 herbs (化合物数据) 与 targets (靶点/疾病) 合并为统一记录
 *
 * 输入:
 *   data/tcmsp_herbs_full.json       — 498 味药材 + 化合物 (15.5 MB)
 *   data/tcmsp_targets_diseases_full.json — 498 味药材 + 靶点/疾病 (21 MB)
 *
 * 输出:
 *   data/tcmsp_merged_unified.json   — 统一合并记录
 *   data/tcmsp_merged_report.json    — 合并报告
 *   data/tcmsp_missing_targets.json  — 缺失靶点的药材列表
 *
 * 用法:
 *   node merge_herbs_targets.js
 */

const fs = require('fs')
const path = require('path')

// ═══════════════════ 配置 ═══════════════════
const DATA_DIR = path.join(__dirname, 'data')
const HERBS_FILE = path.join(DATA_DIR, 'tcmsp_herbs_full.json')
const TARGETS_FILE = path.join(DATA_DIR, 'tcmsp_targets_diseases_full.json')
const MERGED_FILE = path.join(DATA_DIR, 'tcmsp_merged_unified.json')
const REPORT_FILE = path.join(DATA_DIR, 'tcmsp_merged_report.json')
const MISSING_FILE = path.join(DATA_DIR, 'tcmsp_missing_targets.json')

// ═══════════════════ 工具 ═══════════════════
function log(msg) { console.log(`  ${msg}`) }

// ═══════════════════ 主流程 ═══════════════════
function main() {
  console.log('═'.repeat(60))
  console.log('  TCMSP 数据合并工具 v1.0')
  console.log('═'.repeat(60))

  // 1. 加载数据
  log('📂 加载数据文件...')
  if (!fs.existsSync(HERBS_FILE)) { console.error(`  ❌ 文件不存在: ${HERBS_FILE}`); return }
  if (!fs.existsSync(TARGETS_FILE)) { console.error(`  ❌ 文件不存在: ${TARGETS_FILE}`); return }

  const herbsRaw = JSON.parse(fs.readFileSync(HERBS_FILE, 'utf-8'))
  const targetsRaw = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'))

  const herbs = Array.isArray(herbsRaw) ? herbsRaw : herbsRaw.data || []
  const targets = Array.isArray(targetsRaw) ? targetsRaw : targetsRaw.data || []

  log(`  药材数据: ${herbs.length} 条 (${(JSON.stringify(herbsRaw).length / 1024 / 1024).toFixed(1)} MB)`)
  log(`  靶点数据: ${targets.length} 条 (${(JSON.stringify(targetsRaw).length / 1024 / 1024).toFixed(1)} MB)`)

  // 2. 构建靶点索引 (按 name_cn)
  log('\n🔗 构建靶点索引...')
  const targetIndex = new Map()
  for (const t of targets) {
    const key = t.name_cn?.trim()
    if (key) targetIndex.set(key, t)
  }
  log(`  索引: ${targetIndex.size} 条`)

  // 3. 合并
  log('\n🔀 合并数据...')
  const merged = []
  const missingTargets = []
  const stats = {
    total: herbs.length,
    matchedTargets: 0,
    matchedDiseases: 0,
    missingTargets: 0,
    missingDiseases: 0,
    totalCompoundsAll: 0,
    totalTargetsAll: 0,
    totalDiseasesAll: 0,
  }

  for (const herb of herbs) {
    const name = herb.name_cn?.trim()
    const tdMatch = name ? targetIndex.get(name) : null

    const record = {
      // 基础信息
      name_cn: herb.name_cn || '',
      name_pinyin: herb.name_pinyin || '',
      name_latin: herb.name_latin || '',
      category_cn: herb.category_cn || '',
      category_en: herb.category_en || '',
      effects: tdMatch?.effects || herb.effects || herb.category_cn || '',

      // 化合物
      compounds: herb.compounds || [],
      compound_count: herb.compound_count || herb.compounds?.length || 0,
      ob_percent: herb.ob_percent || 0,
      dl_value: herb.dl_value || 0,

      // 靶点 (从靶点文件合并)
      targets: tdMatch?.targets || [],
      target_count: tdMatch?.target_count || tdMatch?.targets?.length || 0,

      // 疾病 (从靶点文件合并)
      diseases: tdMatch?.diseases || [],
      disease_count: tdMatch?.disease_count || tdMatch?.diseases?.length || 0,

      // 元数据
      is_food_homology: herb.is_food_homology || false,
      source_version: 'tcmsp_merged_v1',
      merged_at: new Date().toISOString(),
    }

    // 统计
    stats.totalCompoundsAll += record.compound_count
    stats.totalTargetsAll += record.target_count
    stats.totalDiseasesAll += record.disease_count

    if (record.target_count > 0) stats.matchedTargets++
    else { stats.missingTargets++; missingTargets.push(name) }

    if (record.disease_count > 0) stats.matchedDiseases++
    else stats.missingDiseases++

    merged.push(record)
  }

  // 4. 统计汇总
  const compoundRich = [...merged].sort((a, b) => b.compound_count - a.compound_count).slice(0, 10)
  const targetRich = [...merged].sort((a, b) => b.target_count - a.target_count).slice(0, 10)
  const diseaseRich = [...merged].sort((a, b) => b.disease_count - a.disease_count).slice(0, 10)
  const highOB = merged.filter(h => h.ob_percent >= 80).length
  const highDL = merged.filter(h => h.dl_value >= 0.5).length
  const categories = [...new Set(merged.map(h => h.category_cn).filter(Boolean))].sort()

  // 5. 保存
  log('\n💾 保存合并结果...')
  const output = {
    merged_at: new Date().toISOString(),
    sources: {
      herbs: path.basename(HERBS_FILE),
      targets: path.basename(TARGETS_FILE),
    },
    stats: {
      ...stats,
      highOBHerbs: highOB,
      highDLHerbs: highDL,
      categoryCount: categories.length,
      uniqueTargets: new Set(merged.flatMap(h => h.targets.map(t => t.name))).size,
      uniqueDiseases: new Set(merged.flatMap(h => h.diseases.map(d => d.name))).size,
    },
    categories,
    topCompoundHerbs: compoundRich.map(h => ({ name: h.name_cn, count: h.compound_count })),
    topTargetHerbs: targetRich.map(h => ({ name: h.name_cn, count: h.target_count })),
    topDiseaseHerbs: diseaseRich.map(h => ({ name: h.name_cn, count: h.disease_count })),
    missingTargetsList: missingTargets,
    data: merged,
  }

  fs.writeFileSync(MERGED_FILE, JSON.stringify(output, null, 2), 'utf-8')
  log(`  ✅ 合并数据: ${MERGED_FILE}`)
  log(`     ${(JSON.stringify(output).length / 1024 / 1024).toFixed(1)} MB`)

  fs.writeFileSync(REPORT_FILE, JSON.stringify({ ...output, data: undefined }, null, 2), 'utf-8')
  log(`  ✅ 合并报告: ${REPORT_FILE}`)

  if (missingTargets.length > 0) {
    fs.writeFileSync(MISSING_FILE, JSON.stringify(missingTargets, null, 2), 'utf-8')
    log(`  ⚠️ 缺失靶点: ${MISSING_FILE}`)
  }

  // 6. 打印摘要
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  📊 合并完成摘要`)
  console.log(`  ${'─'.repeat(40)}`)
  console.log(`  ✅ 总药材:       ${merged.length}`)
  console.log(`  🧪 化合物总数:   ${stats.totalCompoundsAll.toLocaleString()}`)
  console.log(`  🎯 靶点总数:     ${stats.totalTargetsAll.toLocaleString()}`)
  console.log(`  🏥 疾病总数:     ${stats.totalDiseasesAll.toLocaleString()}`)
  console.log(`  📈 高 OB% (≥80): ${highOB} 味`)
  console.log(`  📈 高 DL (≥0.5): ${highDL} 味`)
  console.log(`  📂 分类:         ${categories.length} 个`)
  console.log(`  ⚠️ 缺靶点:       ${stats.missingTargets} 味`)
  console.log(`  ⚠️ 缺疾病:       ${stats.missingDiseases} 味`)

  if (compoundRich.length > 0) {
    console.log(`\n  🏆 化合物最多:`)
    compoundRich.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.name_cn} - ${h.compound_count} 个`)
    })
  }
  if (targetRich.length > 0) {
    console.log(`\n  🏆 靶点最多:`)
    targetRich.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.name_cn} - ${h.target_count} 个`)
    })
  }
  if (missingTargets.length > 0) {
    console.log(`\n  ⚠️ 缺失靶点的药材 (${missingTargets.length} 味):`)
    missingTargets.forEach((n, i) => {
      if (i < 20) console.log(`     ${i + 1}. ${n}`)
      else if (i === 20) console.log(`     ... 共 ${missingTargets.length} 味`)
    })
  }
  console.log()
}

main()
