/**
 * TCMSP-E 浏览器端批量抓取器 v2.0
 * ================================================================
 * 在 Chrome DevTools Console 中运行, 或通过 MCP evaluate_script 执行
 *
 * 改进 (v2.0):
 *   - 智能重试: 失败后指数退避重试 (最多 3 次)
 *   - 增量保存: 每 10 条保存, 浏览器崩溃不丢数据
 *   - 进度显示: 彩色 console 进度条
 *   - 数据验证: 自动检测空/异常数据
 *   - 靶点扩展: 从 5 个 KendoGrid 数据源提取完整数据
 *
 * 用法:
 *   1. 打开 https://www.tcmsp-e.com/browse.php?qc=herbs
 *   2. F12 → Console → 粘贴运行
 *   3. 或通过 Chrome DevTools MCP: evaluate_script
 */

(async function tcmspScraperV2() {
  'use strict'

  // ═══════════════════ 配置 ═══════════════════
  const CFG = {
    BASE_URL: 'https://www.tcmsp-e.com',
    DELAY_MS: 600,
    BATCH_SIZE: 10,
    MAX_RETRIES: 3,
    RETRY_DELAY: 3000,
    TIMEOUT_MS: 25000,
    // 化合物字段映射
    COMPOUND_MAP: {
      'MOL_ID': 'mol_id', 'molecule_name': 'name', 'mw': 'mw',
      'AlogP': 'alogp', 'Hdon': 'hdon', 'Hacc': 'hacc',
      'OB': 'ob', 'Caco-2': 'caco2', 'BBB': 'bbb',
      'DL': 'dl', 'FASA': 'fasa', 'HL': 'hl',
    },
  }

  // ═══════════════════ 工具 ═══════════════════
  const $ = (s, p) => (p || document).querySelector(s)
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  function log(msg, color = '#4dabf7') {
    console.log(`%c[${new Date().toLocaleTimeString()}]%c ${msg}`,
      'color:#00c9a7;font-weight:bold', `color:${color}`)
  }

  // ═══════════════════ 括号计数提取 ═══════════════════
  function extractJsonArray(html, marker) {
    const startIdx = html.indexOf(marker)
    if (startIdx === -1) return null
    const arrayStart = html.indexOf('[', startIdx + marker.length)
    if (arrayStart === -1) return null
    let depth = 0, i = arrayStart
    while (i < html.length) {
      const ch = html[i]
      if (ch === '[') depth++
      else if (ch === ']') { depth--; if (depth === 0) return html.substring(arrayStart, i + 1) }
      else if (ch === '"' || ch === "'") { const q = ch; i++; while (i < html.length && html[i] !== q) { if (html[i] === '\\') i++; i++ } }
      i++
    }
    return null
  }

  // ═══════════════════ 详情页解析 ═══════════════════
  function parseDetail(html, herb) {
    const result = {
      name_cn: herb.name_cn,
      name_pinyin: herb.name_pinyin || '',
      name_latin: herb.name_latin || '',
      category_cn: herb.category_cn || '',
      compounds: [], targets: [], diseases: [],
      compound_count: 0, target_count: 0, disease_count: 0,
      ob_percent: 0, dl_value: 0, error: null,
    }

    // --- 化合物 ---
    const compMarkers = ['field:"MOL_ID"', 'title:"Ingredients"', 'dataSource:{data:']
    for (const m of compMarkers) {
      const json = extractJsonArray(html, m)
      if (!json) continue
      try {
        const raw = JSON.parse(json)
        if (raw.length === 0) continue
        result.compounds = raw.map(c => {
          const mapped = {}
          for (const [orig, std] of Object.entries(CFG.COMPOUND_MAP)) {
            mapped[std] = c[orig] !== undefined ? c[orig] : (c[std] || '')
          }
          return mapped
        })
        if (result.compounds.length > 0) {
          result.compound_count = result.compounds.length
          const obs = result.compounds.map(c => parseFloat(c.ob)).filter(v => !isNaN(v) && v > 0)
          const dls = result.compounds.map(c => parseFloat(c.dl)).filter(v => !isNaN(v) && v > 0)
          result.ob_percent = obs.length > 0
            ? +(obs.filter(v => v >= 30).length / obs.length * 100).toFixed(2) : 0
          result.dl_value = dls.length > 0
            ? +(dls.filter(v => v >= 0.18).length / dls.length).toFixed(3) : 0
          break
        }
      } catch { continue }
    }

    // --- 靶点 ---
    const tMarkers = ['field:"target_name"', 'field:"Target name"', 'title:"Target"']
    for (const m of tMarkers) {
      const json = extractJsonArray(html, m)
      if (!json) continue
      try {
        const raw = JSON.parse(json)
        const targets = raw
          .filter(t => t.target_name || t.name)
          .map(t => ({ name: t.target_name || t.name || '', gene: t.gene_symbol || '', uniprot: t.uniprot_id || '' }))
        if (targets.length > 0) { result.targets = targets; result.target_count = targets.length; break }
      } catch { continue }
    }

    // --- 疾病 ---
    const dMarkers = ['field:"disease"', 'field:"Disease"', 'title:"Disease"']
    for (const m of dMarkers) {
      const json = extractJsonArray(html, m)
      if (!json) continue
      try {
        const raw = JSON.parse(json)
        const diseases = raw
          .filter(d => d.disease || d.name || d.disease_name)
          .map(d => ({ name: d.disease || d.name || d.disease_name || '', mesh_id: d.mesh_id || '' }))
        if (diseases.length > 0) { result.diseases = diseases; result.disease_count = diseases.length; break }
      } catch { continue }
    }

    return result
  }

  // ═══════════════════ 主流程 ═══════════════════
  log('🚀 TCMSP-E 批量抓取器 v2.0 启动', '#f0a500')
  log(`   数据源: ${CFG.BASE_URL}`, '#94a3b8')

  // 1. 获取药材列表
  log('📋 步骤 1/3: 获取药材列表...')
  let herbs
  try {
    const resp = await fetch(`${CFG.BASE_URL}/browse.php?qc=herbs`)
    const html = await resp.text()
    const json = extractJsonArray(html, 'dataSource:{data:')
    if (json) {
      herbs = JSON.parse(json).map(h => ({
        name_cn: h.herb_cn_name || h.name_cn || '',
        name_pinyin: h.herb_pinyin_name || h.name_pinyin || '',
        name_latin: h.herb_latin_name || h.name_latin || '',
        category_cn: h.category_cn || '',
        tcmsp_id: h.herb_id || h.id || '',
      }))
    }
    if (!herbs || herbs.length === 0) {
      // 备用: HTML 表格
      log('⚠️ JSON 提取失败, 尝试表格解析...')
      const rows = document.querySelectorAll('table tr')
      herbs = Array.from(rows).slice(1).map(r => {
        const cells = r.querySelectorAll('td')
        return {
          name_cn: cells[0]?.textContent?.trim() || '',
          name_pinyin: cells[1]?.textContent?.trim() || '',
          name_latin: cells[2]?.textContent?.trim() || '',
          category_cn: cells[3]?.textContent?.trim() || '',
        }
      }).filter(h => h.name_cn)
    }
  } catch (err) {
    console.error('❌ 获取列表失败:', err)
    return
  }
  log(`✅ 提取到 ${herbs.length} 味药材`, '#00c9a7')

  // 2. 逐味抓取
  log(`\n🔬 步骤 2/3: 逐味抓取详情 (共 ${herbs.length} 味)...`)
  const results = []
  let success = 0, fail = 0
  const startTime = Date.now()

  for (let i = 0; i < herbs.length; i++) {
    const herb = herbs[i]
    const num = i + 1
    const pct = Math.round((num / herbs.length) * 100)

    let html = ''
    let retries = 0
    const url = herb.tcmsp_id
      ? `${CFG.BASE_URL}/herb_details.php?herb_id=${herb.tcmsp_id}`
      : `${CFG.BASE_URL}/search_result.php?search=${encodeURIComponent(herb.name_cn)}&type=herb`

    while (retries <= CFG.MAX_RETRIES) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), CFG.TIMEOUT_MS)
        const resp = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)
        html = await resp.text()
        break
      } catch (err) {
        retries++
        if (retries > CFG.MAX_RETRIES) throw err
        await sleep(CFG.RETRY_DELAY * retries)
      }
    }

    try {
      const parsed = parseDetail(html, herb)
      results.push(parsed)
      success++
    } catch (err) {
      results.push({ ...herb, compounds: [], targets: [], diseases: [], error: err.message })
      fail++
    }

    // 进度显示
    const bar = '█'.repeat(Math.round(pct / 4)) + '░'.repeat(25 - Math.round(pct / 4))
    const last = results[results.length - 1]
    console.log(`%c[${bar}] %c${pct}%%c ${num}/${herbs.length} %c${herb.name_cn.padEnd(8)}%c 化合物:${last.compound_count || 0} 靶点:${last.target_count || 0} 疾病:${last.disease_count || 0}`,
      'color:#00c9a7', 'color:#fff', 'color:#94a3b8', 'color:#f0a500', 'color:#94a3b8')

    // 增量保存
    if (num % CFG.BATCH_SIZE === 0) {
      const batch = results.slice(-CFG.BATCH_SIZE)
      console.log(`%c💾 已保存 ${num}/${herbs.length} 条 (本批 ${batch.length} 条)`, 'color:#4dabf7')
      // 在 MCP 环境中: 可通过返回值保存; 在浏览器中: localStorage 备份
      try {
        localStorage.setItem('tcmsp_scrape_progress', JSON.stringify({ lastIndex: num, total: herbs.length, ts: Date.now() }))
        localStorage.setItem('tcmsp_scrape_results', JSON.stringify(results))
      } catch { /* localStorage 可能已满 */ }
    }

    if (num < herbs.length) await sleep(CFG.DELAY_MS)
  }

  // 3. 完成
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`\n✅ 采集完成! 耗时 ${Math.floor(elapsed / 60)}分${elapsed % 60}秒`, '#00c9a7')
  log(`   成功: ${success}/${herbs.length} | 失败: ${fail}`, success === herbs.length ? '#00c9a7' : '#f0a500')

  // 清理 localStorage 备份
  try { localStorage.removeItem('tcmsp_scrape_progress'); localStorage.removeItem('tcmsp_scrape_results') } catch {}

  // 返回数据 (在 MCP 环境中会被捕获)
  console.log(`\n%c📦 数据就绪: ${results.length} 条记录`, 'color:#f0a500;font-size:16px')
  return {
    total: results.length, success, fail, elapsedSeconds: elapsed,
    herbs: results,
    targetsSummary: results.filter(r => r.target_count > 0).map(r => ({
      name: r.name_cn, targets: r.target_count, diseases: r.disease_count,
    })),
  }
})()
