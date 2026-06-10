/**
 * TCMSP-E 中药材数据采集器 v3.0 — 独立命令行版
 * ================================================================
 * 数据源: https://www.tcmsp-e.com/browse.php?qc=herbs
 *
 * 功能:
 *   1. 获取全部药材列表 (502+ 味)
 *   2. 逐个抓取详情页: 化合物 (ADME属性) + 靶点 + 疾病
 *   3. 计算 OB%/DL 汇总统计
 *   4. 增量保存 (每 20 条), 支持断点续传
 *   5. 输出标准化 JSON, 可直接导入 PostgreSQL
 *
 * 用法:
 *   node tcmsp_scraper_cli.js                    # 完整抓取
 *   node tcmsp_scraper_cli.js --list-only        # 仅获取药材列表
 *   node tcmsp_scraper_cli.js --resume           # 断点续传
 *   node tcmsp_scraper_cli.js --herb "麻黄"      # 仅抓取指定药材
 *   node tcmsp_scraper_cli.js --range 1-50       # 抓取第 1-50 味药材
 *   node tcmsp_scraper_cli.js --token "YOUR_KEY" # 使用自定义 token
 *
 * 输出:
 *   tcmsp_data/data/tcmsp_herbs_v3.json       # 完整药材数据
 *   tcmsp_data/data/tcmsp_targets_v3.json     # 靶点/疾病数据
 *   tcmsp_data/data/tcmsp_progress_v3.json    # 进度文件 (断点续传)
 *   tcmsp_data/data/tcmsp_scrape_report.json  # 采集报告
 *
 * 要求: Node.js 18+
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// ═══════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════

const CONFIG = {
  baseUrl: 'www.tcmsp-e.com',
  token: 'ee3a5d33b6d2e34b1fd95dadf566e224',
  delayMs: 1000,           // 请求间隔 (避免被封)
  batchSize: 20,           // 每 N 条保存一次
  timeoutMs: 45000,        // 单次请求超时
  maxRetries: 3,           // 失败重试次数
  retryDelayMs: 5000,      // 重试等待
  dataDir: path.join(__dirname, 'data'),
  // 文件路径
  herbsListFile: 'tcmsp_herbs_list.json',
  outputHerbsFile: 'tcmsp_herbs_v3.json',
  outputTargetsFile: 'tcmsp_targets_v3.json',
  progressFile: 'tcmsp_progress_v3.json',
  reportFile: 'tcmsp_scrape_report.json',
}

// 化合物字段映射
const COMPOUND_MAP = {
  'MOL_ID': 'mol_id', 'molecule_name': 'name', 'mw': 'mw',
  'AlogP': 'alogp', 'Hdon': 'hdon', 'Hacc': 'hacc',
  'OB': 'ob', 'Caco-2': 'caco2', 'BBB': 'bbb',
  'DL': 'dl', 'FASA': 'fasa', 'HL': 'hl',
}

// ═══════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch { return null }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    listOnly: false, resume: false, herb: null, range: null, token: null,
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--list-only': opts.listOnly = true; break
      case '--resume': opts.resume = true; break
      case '--herb': opts.herb = args[++i]; break
      case '--range': opts.range = args[++i]; break
      case '--token': opts.token = args[++i]; break
    }
  }
  return opts
}

// ═══════════════════════════════════════════════════════
// HTTP 请求 (Node.js 原生 https)
// ═══════════════════════════════════════════════════════

function httpGet(urlPath, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `https://${CONFIG.baseUrl}${urlPath}`)
    const client = url.protocol === 'https:' ? https : http
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(token ? { 'Cookie': `JSESSIONID=${token}` } : {}),
      },
      timeout: CONFIG.timeoutMs,
    }

    const req = client.request(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpGet(res.headers.location, token))
        return
      }
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(body)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
    req.end()
  })
}

// ═══════════════════════════════════════════════════════
// 解析引擎
// ═══════════════════════════════════════════════════════

/**
 * 括号计数法: 从 HTML 中提取嵌套 JSON 数组
 */
function extractJsonArray(html, marker) {
  const startIdx = html.indexOf(marker)
  if (startIdx === -1) return null

  const arrayStart = html.indexOf('[', startIdx + marker.length)
  if (arrayStart === -1) return null

  let depth = 0, i = arrayStart
  while (i < html.length) {
    const ch = html[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return html.substring(arrayStart, i + 1)
    } else if (ch === '"' || ch === "'") {
      const q = ch; i++
      while (i < html.length && html[i] !== q) {
        if (html[i] === '\\') i++; i++
      }
    }
    i++
  }
  return null
}

/**
 * 解析药材列表页 (browse.php?qc=herbs)
 */
function parseHerbList(html) {
  // TCMSP-E 列表页使用 KendoGrid, 数据内嵌在 dataSource 中
  const json = extractJsonArray(html, 'dataSource:{data:')
  if (!json) {
    // 备用: 尝试从 HTML 表格解析
    log('  ⚠️ 未找到内嵌 JSON, 尝试 HTML 表格解析...')
    return parseHerbTable(html)
  }
  try {
    const data = JSON.parse(json)
    return data.map(item => ({
      name_cn: item.herb_cn_name || item.name_cn || '',
      name_pinyin: item.herb_pinyin_name || item.name_pinyin || '',
      name_latin: item.herb_latin_name || item.name_latin || '',
      category_cn: item.category_cn || '',
      tcmsp_id: item.herb_id || item.id || '',
    }))
  } catch (e) {
    log(`  ❌ JSON 解析失败: ${e.message}`)
    return []
  }
}

/**
 * 备用: HTML 表格解析
 */
function parseHerbTable(html) {
  const herbs = []
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells = []
    let tdMatch
    while ((tdMatch = tdRegex.exec(rowMatch[0])) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
    }
    if (cells.length >= 3) {
      herbs.push({
        name_cn: cells[0] || '',
        name_pinyin: cells[1] || '',
        name_latin: cells[2] || '',
      })
    }
  }
  return herbs
}

/**
 * 解析详情页化合物/靶点/疾病
 */
function parseDetailPage(html, herbInfo) {
  const result = {
    name_cn: herbInfo.name_cn,
    name_pinyin: herbInfo.name_pinyin,
    name_latin: herbInfo.name_latin,
    category_cn: herbInfo.category_cn,
    compounds: [],
    targets: [],
    diseases: [],
    compound_count: 0,
    target_count: 0,
    disease_count: 0,
    ob_percent: 0,
    dl_value: 0,
  }

  // 1. 解析化合物 (Grid 1: 成分信息)
  const compJson = extractJsonArray(html, 'field:"MOL_ID"') ||
                   extractJsonArray(html, 'title:"Ingredients"') ||
                   extractJsonArray(html, 'dataSource:{data:')
  if (compJson) {
    try {
      const raw = JSON.parse(compJson)
      result.compounds = raw.map(c => {
        const mapped = {}
        for (const [orig, std] of Object.entries(COMPOUND_MAP)) {
          mapped[std] = c[orig] !== undefined ? c[orig] : c[std] || ''
        }
        // 保留原始字段
        for (const k of ['target_name', 'target_id', 'disease', 'disease_id']) {
          if (c[k] !== undefined) mapped[k] = c[k]
        }
        return mapped
      })
    } catch { /* 化合物解析失败 */ }
  }

  // 2. 计算 OB% / DL
  if (result.compounds.length > 0) {
    const obValues = result.compounds
      .map(c => parseFloat(c.ob))
      .filter(v => !isNaN(v) && v > 0)
    const dlValues = result.compounds
      .map(c => parseFloat(c.dl))
      .filter(v => !isNaN(v) && v > 0)

    result.ob_percent = obValues.length > 0
      ? Math.round((obValues.filter(v => v >= 30).length / obValues.length) * 100 * 100) / 100
      : 0
    result.dl_value = dlValues.length > 0
      ? Math.round((dlValues.filter(v => v >= 0.18).length / dlValues.length) * 1000) / 1000
      : 0
    result.compound_count = result.compounds.length
  }

  // 3. 解析靶点 (Grid: 靶点信息)
  const targetMarkers = [
    'field:"target_name"', 'field:"Target name"', 'title:"Target"',
    'targets', 'related_targets',
  ]
  for (const marker of targetMarkers) {
    const json = extractJsonArray(html, marker)
    if (json) {
      try {
        const raw = JSON.parse(json)
        const targets = []
        for (const t of raw) {
          if (t.target_name || t.name) {
            targets.push({
              name: t.target_name || t.name || '',
              id: t.target_id || t.id || '',
              gene: t.gene_symbol || t.gene || '',
              uniprot: t.uniprot_id || t.uniprot || '',
            })
          }
        }
        if (targets.length > 0) {
          result.targets = targets
          result.target_count = targets.length
          break
        }
      } catch { continue }
    }
  }

  // 4. 解析疾病
  const diseaseMarkers = [
    'field:"disease"', 'field:"Disease"', 'title:"Disease"',
    'diseases', 'related_diseases',
  ]
  for (const marker of diseaseMarkers) {
    const json = extractJsonArray(html, marker)
    if (json) {
      try {
        const raw = JSON.parse(json)
        const diseases = []
        for (const d of raw) {
          if (d.disease || d.name || d.disease_name) {
            diseases.push({
              name: d.disease || d.name || d.disease_name || '',
              id: d.disease_id || d.id || '',
              mesh_id: d.mesh_id || '',
            })
          }
        }
        if (diseases.length > 0) {
          result.diseases = diseases
          result.disease_count = diseases.length
          break
        }
      } catch { continue }
    }
  }

  return result
}

// ═══════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════

async function main() {
  const opts = parseArgs()
  const token = opts.token || CONFIG.token
  ensureDir(CONFIG.dataDir)
  ensureDir(path.join(CONFIG.dataDir, 'reports'))

  log('═══════════════════════════════════════════════════')
  log('  TCMSP-E 中药材数据采集器 v3.0')
  log('  数据源: https://www.tcmsp-e.com')
  log('═══════════════════════════════════════════════════')

  // ── 步骤 1: 获取药材列表 ──
  log('📋 步骤 1/4: 获取药材列表...')
  let herbs

  const listPath = path.join(CONFIG.dataDir, CONFIG.herbsListFile)
  const cached = loadJson(listPath)
  if (cached && cached.length > 100) {
    log(`  ✅ 使用缓存列表: ${cached.length} 味药材`)
    herbs = cached
  } else {
    try {
      const html = await httpGet('/browse.php?qc=herbs', null)
      herbs = parseHerbList(html)
      if (herbs.length === 0) {
        log('  ❌ 未从列表页提取到药材, 请检查网站是否可访问')
        log('  提示: 尝试在浏览器中打开 https://www.tcmsp-e.com/browse.php?qc=herbs')
        log('  如果浏览器可访问但脚本不能, 可能需要更新 Cookie/Token')
        return
      }
      saveJson(listPath, herbs)
      log(`  ✅ 提取到 ${herbs.length} 味药材, 已缓存`)
    } catch (err) {
      log(`  ❌ 获取列表失败: ${err.message}`)
      log('  请确认: 1) 网络可访问 tcmsp-e.com  2) 站点未改版')
      return
    }
  }

  // ── 筛选药材范围 ──
  let targetHerbs = herbs
  if (opts.herb) {
    targetHerbs = herbs.filter(h => h.name_cn === opts.herb)
    log(`  🎯 筛选: "${opts.herb}" → ${targetHerbs.length} 味`)
  } else if (opts.range) {
    const [start, end] = opts.range.split('-').map(Number)
    targetHerbs = herbs.slice(start - 1, end)
    log(`  🎯 范围: 第 ${start}-${end} 味 → ${targetHerbs.length} 味`)
  } else {
    log(`  📊 目标: 全部 ${targetHerbs.length} 味药材`)
  }

  if (targetHerbs.length === 0) {
    log('  ❌ 没有匹配的药材')
    return
  }

  // ── 仅列表模式 ──
  if (opts.listOnly) {
    log(`\n📋 药材列表 (前 30 味):`)
    targetHerbs.slice(0, 30).forEach((h, i) => {
      log(`  ${i + 1}. ${h.name_cn} (${h.name_pinyin}) - ${h.category_cn || '未分类'}`)
    })
    if (targetHerbs.length > 30) log(`  ... 共 ${targetHerbs.length} 味`)
    return
  }

  // ── 步骤 2: 加载/初始化进度 ──
  log('\n📦 步骤 2/4: 准备采集...')
  const progressPath = path.join(CONFIG.dataDir, CONFIG.progressFile)
  const herbsPath = path.join(CONFIG.dataDir, CONFIG.outputHerbsFile)
  const targetsPath = path.join(CONFIG.dataDir, CONFIG.outputTargetsFile)

  let results = []
  let targetsData = []
  let startIdx = 0

  if (opts.resume) {
    const progress = loadJson(progressPath)
    const cachedResults = loadJson(herbsPath)
    const cachedTargets = loadJson(targetsPath)
    if (progress && cachedResults) {
      startIdx = progress.lastIndex || 0
      results = cachedResults
      targetsData = cachedTargets || []
      log(`  🔄 断点续传: 从第 ${startIdx + 1}/${targetHerbs.length} 味继续`)
    } else {
      log('  ⚠️ 未找到进度文件, 从头开始')
    }
  }

  // ── 步骤 3: 逐味抓取详情 ──
  log(`\n🔬 步骤 3/4: 逐味抓取详情 (${startIdx + 1}-${targetHerbs.length})...`)
  const total = targetHerbs.length
  const startTime = Date.now()
  let successCount = 0
  let failCount = 0

  for (let i = startIdx; i < total; i++) {
    const herb = targetHerbs[i]
    const num = i + 1
    const pct = Math.round((num / total) * 100)

    // 显示进度条
    const barLen = 30
    const filled = Math.round((num / total) * barLen)
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

    try {
      // 构建详情页 URL
      const detailUrl = herb.tcmsp_id
        ? `/herb_details.php?herb_id=${herb.tcmsp_id}`
        : `/search_result.php?search=${encodeURIComponent(herb.name_cn)}&type=herb`

      let html = ''
      let retries = 0
      while (retries <= CONFIG.maxRetries) {
        try {
          html = await httpGet(detailUrl, token)
          break
        } catch (err) {
          retries++
          if (retries > CONFIG.maxRetries) throw err
          log(`    ⚠️ 重试 ${retries}/${CONFIG.maxRetries}: ${err.message}`)
          await sleep(CONFIG.retryDelayMs)
        }
      }

      const parsed = parseDetailPage(html, herb)
      results.push(parsed)

      // 收集靶点和疾病
      if (parsed.targets.length > 0) {
        targetsData.push({
          name_cn: herb.name_cn,
          category: herb.category_cn,
          targets: parsed.targets,
          diseases: parsed.diseases,
          target_count: parsed.target_count,
          disease_count: parsed.disease_count,
        })
      }

      successCount++
      process.stdout.write(`\r  [${bar}] ${pct}% | ${num}/${total} | ✅ ${herb.name_cn.padEnd(8)} | 化合物:${parsed.compound_count} 靶点:${parsed.target_count} 疾病:${parsed.disease_count}    `)
    } catch (err) {
      failCount++
      results.push({
        name_cn: herb.name_cn,
        name_pinyin: herb.name_pinyin,
        name_latin: herb.name_latin,
        category_cn: herb.category_cn,
        compounds: [], targets: [], diseases: [],
        compound_count: 0, target_count: 0, disease_count: 0,
        ob_percent: 0, dl_value: 0,
        error: err.message,
      })
      process.stdout.write(`\r  [${bar}] ${pct}% | ${num}/${total} | ❌ ${herb.name_cn.padEnd(8)} | ${err.message.slice(0, 40)}    `)
    }

    // 增量保存
    if (num % CONFIG.batchSize === 0 || num === total) {
      saveJson(herbsPath, results)
      saveJson(targetsPath, targetsData)
      saveJson(progressPath, { lastIndex: num, total, updatedAt: new Date().toISOString() })
      process.stdout.write(` 💾`)
    }

    // 请求间隔
    if (num < total) await sleep(CONFIG.delayMs)
  }

  console.log('\n') // 换行

  // ── 步骤 4: 生成报告 ──
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`\n📊 步骤 4/4: 生成报告...`)

  const report = {
    generatedAt: new Date().toISOString(),
    dataSource: 'https://www.tcmsp-e.com',
    totalHerbs: total,
    successCount,
    failCount,
    successRate: `${Math.round((successCount / total) * 100)}%`,
    elapsedSeconds: elapsed,
    avgTimePerHerb: `${(elapsed / total).toFixed(1)}s`,
    totalCompounds: results.reduce((s, h) => s + h.compound_count, 0),
    totalTargets: targetsData.reduce((s, t) => s + t.target_count, 0),
    totalDiseases: targetsData.reduce((s, t) => s + t.disease_count, 0),
    herbsWithHighOB: results.filter(h => h.ob_percent >= 80).length,       // OB% >= 80%
    herbsWithHighDL: results.filter(h => h.dl_value >= 0.5).length,         // DL >= 0.5
    topCompoundHerbs: [...results]
      .sort((a, b) => b.compound_count - a.compound_count)
      .slice(0, 10)
      .map(h => ({ name: h.name_cn, compounds: h.compound_count })),
    categories: [...new Set(results.map(h => h.category_cn).filter(Boolean))].sort(),
    errors: results.filter(h => h.error).map(h => ({ name: h.name_cn, error: h.error })),
  }

  saveJson(path.join(CONFIG.dataDir, CONFIG.reportFile), report)

  log('\n═══════════════════════════════════════════════════')
  log('  ✅ 采集完成!')
  log(`  ⏱️  耗时: ${Math.floor(elapsed / 60)}分${elapsed % 60}秒`)
  log(`  ✅ 成功: ${successCount}/${total} (${report.successRate})`)
  log(`  🧪 化合物总数: ${report.totalCompounds}`)
  log(`  🎯 靶点总数: ${report.totalTargets}`)
  log(`  🏥 疾病总数: ${report.totalDiseases}`)
  log(`  📂 数据文件: ${herbsPath}`)
  log(`  📂 靶点文件: ${targetsPath}`)
  log(`  📋 报告文件: ${path.join(CONFIG.dataDir, CONFIG.reportFile)}`)
  log('═══════════════════════════════════════════════════')
}

// ═══════════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════════
main().catch(err => {
  log(`❌ 致命错误: ${err.message}`)
  console.error(err)
  process.exit(1)
})
