const fs = require('fs');
const path = require('path');

// 读取药材列表
const herbsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'tcmsp_data', 'tcmsp_herbs_full.json'), 'utf8'));
const herbs = herbsData.data;

console.log(`总药材数: ${herbs.length}`);

// 提取Grid数据的函数（与浏览器端一致）
function extractGridData(htmlText, gridId) {
  const pattern = `$("${'#'}${gridId}").kendoGrid(`;
  let idx = htmlText.indexOf(pattern);
  if (idx === -1) return null;
  const dsIdx = htmlText.indexOf('dataSource:', idx);
  if (dsIdx === -1 || dsIdx > idx + 50000) return null;
  const arrStart = htmlText.indexOf('[', dsIdx);
  if (arrStart === -1 || arrStart > dsIdx + 2000) return null;
  let depth = 0, endPos = arrStart;
  for (let j = arrStart; j < Math.min(arrStart + 3000000, htmlText.length); j++) {
    if (htmlText[j] === '[') depth++;
    else if (htmlText[j] === ']') { depth--; if (depth === 0) { endPos = j + 1; break; } }
  }
  try { return JSON.parse(htmlText.substring(arrStart, endPos)); } catch(e) { return null; }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理单个药材
async function processHerb(herb, index) {
  const nameEn = herb.name_en || herb.name_latin || herb.name_pinyin;
  const url = `https://www.tcmsp-e.com/tcmspsearch.php?qr=${encodeURIComponent(nameEn)}&qsr=herb_en_name&token=ee3a5d33b6d2e34b1fd95dadf566e224`;

  try {
    console.log(`[${index}] 正在处理: ${herb.name_cn} (${nameEn})`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 提取grid2（化合物-靶点关联）
    const grid2Data = extractGridData(html, 'grid2');
    // 提取grid3（靶点-疾病关联）
    const grid3Data = extractGridData(html, 'grid3');

    if (!grid2Data && !grid3Data) {
      console.log(`[${index}] ⚠️ ${herb.name_cn}: 未找到grid数据`);
      return null;
    }

    // 处理targets（从grid2去重）
    let targets = [];
    if (grid2Data && Array.isArray(grid2Data)) {
      const targetMap = new Map();
      grid2Data.forEach(row => {
        if (row.target_name && !targetMap.has(row.target_name)) {
          targetMap.set(row.target_name, {
            name: row.target_name,
            id: row.target_id || '',
            drugbank_id: row.drugbank_id || ''
          });
        }
      });
      targets = Array.from(targetMap.values());
    }

    // 处理diseases（从grid3去重）
    let diseases = [];
    if (grid3Data && Array.isArray(grid3Data)) {
      const diseaseMap = new Map();
      grid3Data.forEach(row => {
        if (row.disease_name && !diseaseMap.has(row.disease_name)) {
          diseaseMap.set(row.disease_name, {
            name: row.disease_name,
            id: row.disease_id || ''
          });
        }
      });
      diseases = Array.from(diseaseMap.values());
    }

    const result = {
      name_cn: herb.name_cn,
      category: herb.category_cn || herb.category_en || '',
      effects: herb.category_cn || herb.category_en || '',
      target_count: targets.length,
      targets: targets,
      disease_count: diseases.length,
      diseases: diseases
    };

    console.log(`[${index}] ✅ ${herb.name_cn}: ${targets.length} targets, ${diseases.length} diseases`);
    return result;

  } catch (error) {
    console.error(`[${index}] ❌ ${herb.name_cn}: ${error.message}`);
    return null;
  }
}

// 批量处理函数
async function processBatch(startIndex, batchSize, outputFile) {
  console.log(`\n开始处理批次: 索引 ${startIndex}-${startIndex + batchSize - 1}`);
  console.log(`输出文件: ${outputFile}`);

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalTargets = 0;
  let totalDiseases = 0;

  for (let i = startIndex; i < Math.min(startIndex + batchSize, herbs.length); i++) {
    const herb = herbs[i];
    const result = await processHerb(herb, i);

    if (result) {
      results.push(result);
      successCount++;
      totalTargets += result.target_count;
      totalDiseases += result.disease_count;
    } else {
      failCount++;
    }

    // 批次内延迟80ms
    if (i < startIndex + batchSize - 1 && i < herbs.length - 1) {
      await delay(80);
    }
  }

  // 保存结果
  const output = {
    batch_info: {
      start_index: startIndex,
      end_index: Math.min(startIndex + batchSize - 1, herbs.length - 1),
      total: results.length,
      success: successCount,
      failed: failCount,
      total_targets: totalTargets,
      total_diseases: totalDiseases
    },
    data: results,
    summary: `Done ${results.length}: ${successCount} ok, totalT=${totalTargets}, totalD=${totalDiseases}`
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n批次完成: ${successCount} 成功, ${failCount} 失败`);
  console.log(`总靶点: ${totalTargets}, 总疾病: ${totalDiseases}`);
  console.log(`已保存到: ${outputFile}`);

  return output;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const startIndex = parseInt(args[0]) || 10;
  const batchSize = parseInt(args[1]) || 10;
  const outputFile = args[2] || path.join(__dirname, 'tcmsp_data', `td_batch_${String(startIndex).padStart(3, '0')}_${String(startIndex + batchSize - 1).padStart(3, '0')}.json`);

  await processBatch(startIndex, batchSize, outputFile);
}

main().catch(console.error);
