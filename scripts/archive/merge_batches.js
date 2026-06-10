const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'tcmsp_data');

// 查找所有批次文件
const batchFiles = fs.readdirSync(dataDir)
  .filter(f => f.startsWith('td_batch_') && f.endsWith('.json'))
  .sort();

console.log(`找到 ${batchFiles.length} 个批次文件`);

let allData = [];
let totalTargets = 0;
let totalDiseases = 0;
let successCount = 0;
let failCount = 0;

// 读取第一批（已存在的）
try {
  const firstBatch = JSON.parse(fs.readFileSync(path.join(dataDir, 'td_batch_001_010.json'), 'utf8'));
  if (firstBatch.data && Array.isArray(firstBatch.data)) {
    allData.push(...firstBatch.data);
    totalTargets += firstBatch.batch_info?.total_targets || 0;
    totalDiseases += firstBatch.batch_info?.total_diseases || 0;
    successCount += firstBatch.batch_info?.success || 0;
    console.log(`✅ 已加载 td_batch_001_010.json: ${firstBatch.data.length} 条记录`);
  }
} catch (e) {
  console.log(`⚠️ 无法加载 td_batch_001_010.json: ${e.message}`);
}

// 读取其他批次
for (const file of batchFiles) {
  if (file === 'td_batch_001_010.json') continue; // 跳过第一批

  try {
    const filePath = path.join(dataDir, file);
    const batchData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (batchData.data && Array.isArray(batchData.data)) {
      allData.push(...batchData.data);
      totalTargets += batchData.batch_info?.total_targets || 0;
      totalDiseases += batchData.batch_info?.total_diseases || 0;
      successCount += batchData.batch_info?.success || 0;
      failCount += batchData.batch_info?.failed || 0;
      console.log(`✅ 已加载 ${file}: ${batchData.data.length} 条记录`);
    }
  } catch (e) {
    console.log(`⚠️ 无法加载 ${file}: ${e.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('统计信息');
console.log('='.repeat(60));
console.log(`总药材数: ${allData.length}`);
console.log(`成功爬取: ${successCount}`);
console.log(`失败数量: ${failCount}`);
console.log(`总靶点数: ${totalTargets}`);
console.log(`总疾病数: ${totalDiseases}`);

// 统计唯一靶点和疾病
const allTargets = new Map();
const allDiseases = new Map();

allData.forEach(herb => {
  if (herb.targets) {
    herb.targets.forEach(t => {
      if (!allTargets.has(t.name)) {
        allTargets.set(t.name, t);
      }
    });
  }
  if (herb.diseases) {
    herb.diseases.forEach(d => {
      if (!allDiseases.has(d.name)) {
        allDiseases.set(d.name, d);
      }
    });
  }
});

console.log(`\n唯一靶点数: ${allTargets.size}`);
console.log(`唯一疾病数: ${allDiseases.size}`);

// 计算每个药材的平均靶点/疾病数
const avgTargets = Math.round(totalTargets / allData.length);
const avgDiseases = Math.round(totalDiseases / allData.length);
console.log(`平均每药材靶点数: ${avgTargets}`);
console.log(`平均每药材疾病数: ${avgDiseases}`);

// 找出靶点最多和最少的药材
allData.sort((a, b) => b.target_count - a.target_count);
console.log(`\n靶点最多的前5个药材:`);
allData.slice(0, 5).forEach((herb, i) => {
  console.log(`  ${i+1}. ${herb.name_cn}: ${herb.target_count} targets, ${herb.disease_count} diseases`);
});

console.log(`\n疾病最多的前5个药材:`);
allData.sort((a, b) => b.disease_count - a.disease_count);
allData.slice(0, 5).forEach((herb, i) => {
  console.log(`  ${i+1}. ${herb.name_cn}: ${herb.target_count} targets, ${herb.disease_count} diseases`);
});

// 创建完整输出文件
const output = {
  success: true,
  total: allData.length,
  scraped_at: new Date().toISOString(),
  stats: {
    total_herbs: allData.length,
    success_count: successCount,
    failed_count: failCount,
    total_targets: totalTargets,
    total_diseases: totalDiseases,
    unique_targets: allTargets.size,
    unique_diseases: allDiseases.size,
    avg_targets_per_herb: avgTargets,
    avg_diseases_per_herb: avgDiseases
  },
  data: allData
};

const outputFile = path.join(dataDir, 'tcmsp_targets_diseases_full.json');
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n✅ 完整数据已保存到: ${outputFile}`);
console.log(`文件大小: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);

console.log('\n' + '='.repeat(60));
console.log('批量爬取任务完成！');
console.log('='.repeat(60));
