const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============================================
// TCMSP 批量爬取脚本 - 第 26-500 条（475 条）
// ============================================

const CONFIG = {
    TOKEN: 'ee3a5d33b6d2e34b1fd95dadf566e224',
    BASE_URL: 'https://www.tcmsp-e.com',
    BATCH_SIZE: 10,
    START_INDEX: 26,  // 从第 26 条开始（0-indexed: 25）
    END_INDEX: 500,    // 到第 500 条
    DELAY_MS: 800,     // 请求间隔（毫秒）
    TIMEOUT_MS: 35000, // 单请求超时
    OUTPUT_DIR: path.join(__dirname, 'tcmsp_data'),
    RETRY_COUNT: 2     // 失败重试次数
};

// 提取 HTML 中的 dataSource 数组
function extractDataSource(html) {
    const mi = html.indexOf("dataSource:");
    if (mi === -1) return null;
    const ai = html.indexOf("[", mi + 12);
    if (ai === -1) return null;
    let d = 1, i = ai + 1;
    while (i < html.length && d > 0) {
        const c = html[i];
        if (c === "[") d++;
        else if (c === "]") {
            d--;
            if (d === 0) return html.substring(ai, i + 1);
        } else if (c === '"' || c === "'") {
            const q = c;
            i++;
            while (i < html.length && html[i] !== q) {
                if (html[i] === "\\") i++;
                i++;
            }
        }
        i++;
    }
    return null;
}

// HTTP GET 请求（带超时和重试）
function fetchUrl(url, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'Accept': 'text/html,*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                'Referer': CONFIG.BASE_URL
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // 处理重定向
                fetchUrl(res.headers.location, retryCount).then(resolve).catch(reject);
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
        
        req.on('error', (err) => {
            if (retryCount < CONFIG.RETRY_COUNT) {
                console.log(`    Retrying (${retryCount + 1}/${CONFIG.RETRY_COUNT})...`);
                setTimeout(() => fetchUrl(url, retryCount + 1).then(resolve).catch(reject), 2000);
            } else {
                reject(err);
            }
        });
        
        req.setTimeout(CONFIG.TIMEOUT_MS, () => {
            req.destroy();
            if (retryCount < CONFIG.RETRY_COUNT) {
                console.log(`    Timeout, retrying (${retryCount + 1}/${CONFIG.RETRY_COUNT})...`);
                setTimeout(() => fetchUrl(url, retryCount + 1).then(resolve).catch(reject), 2000);
            } else {
                reject(new Error(`Request timeout after ${CONFIG.TIMEOUT_MS}ms`));
            }
        });
    });
}

// 爬取单个药材详情
async function scrapeHerb(herb, index) {
    try {
        const url = `${CONFIG.BASE_URL}/tcmspsearch.php?qr=${encodeURIComponent(herb.name_latin)}&qsr=herb_en_name&token=${CONFIG.TOKEN}`;
        const html = await fetchUrl(url);
        const jsonStr = extractDataSource(html);
        
        let compounds = [], compoundCount = 0, obPercent = null, dlValue = null;
        
        if (jsonStr) {
            try {
                compounds = JSON.parse(jsonStr);
                compoundCount = compounds.length;
                
                let maxOb = 0, maxDl = 0;
                for (const x of compounds) {
                    const ob = parseFloat(x.ob);
                    if (!isNaN(ob) && ob > maxOb) maxOb = ob;
                    const dl = parseFloat(x.dl);
                    if (!isNaN(dl) && dl > maxDl) maxDl = dl;
                }
                if (maxOb > 0) obPercent = Math.round(maxOb * 100) / 100;
                if (maxDl > 0) dlValue = Math.round(maxDl * 1000) / 1000;
            } catch (e) {
                console.error(`      Parse error for ${herb.name_cn}: ${e.message}`);
            }
        }
        
        return {
            name_cn: herb.name_cn,
            name_pinyin: herb.name_pinyin,
            name_latin: herb.name_latin,
            category_cn: herb.category_cn,
            category_en: herb.category_en,
            compounds: compounds,
            compound_count: compoundCount,
            ob_percent: obPercent,
            dl_value: dlValue,
            error: null
        };
    } catch (e) {
        return {
            name_cn: herb.name_cn,
            name_pinyin: herb.name_pinyin,
            name_latin: herb.name_latin,
            category_cn: herb.category_cn,
            category_en: herb.category_en,
            compounds: [],
            compound_count: 0,
            ob_percent: null,
            dl_value: null,
            error: e.message
        };
    }
}

// 执行一个批次
async function executeBatch(herbs, batchNum, globalStartIndex) {
    const batchLabel = String(batchNum).padStart(2, '0');
    const startIndex = globalStartIndex;
    const endIndex = Math.min(globalStartIndex + herbs.length, CONFIG.END_INDEX);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Batch ${batchLabel} (Items ${startIndex + 1}-${endIndex} of ${CONFIG.END_INDEX})`);
    console.log(`${'='.repeat(70)}`);
    
    const startTime = Date.now();
    const results = [];
    
    for (let i = 0; i < herbs.length; i++) {
        const herb = herbs[i];
        const currentIndex = startIndex + i;
        process.stdout.write(`  [${String(currentIndex + 1).padStart(3, '')}/${CONFIG.END_INDEX}] ${herb.name_cn.padEnd(20, ' ')} (${herb.name_latin.substring(0, 30)})... `);
        
        const result = await scrapeHerb(herb, currentIndex);
        results.push(result);
        
        if (result.error) {
            console.log(`❌ ERROR: ${result.error.substring(0, 50)}`);
        } else if (result.compound_count > 0) {
            console.log(`✅ ${result.compound_count} compounds | OB:${result.ob_percent || '-'}% DL:${result.dl_value || '-'}`);
        } else {
            console.log(`⚠️  No data found`);
        }
        
        // 请求间延迟
        if (i < herbs.length - 1) {
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
        }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const success = results.filter(r => !r.error).length;
    const withData = results.filter(r => r.compound_count > 0).length;
    
    console.log(`\n  📊 Batch ${batchLabel} Results:`);
    console.log(`     Total: ${results.length} | Success: ${success} | With Data: ${withData} | Failed: ${results.length - success}`);
    console.log(`     Time: ${elapsed}s`);
    
    return {
        batchNum: batchLabel,
        batchRange: `${startIndex + 1}-${endIndex}`,
        results: results,
        stats: {
            total: results.length,
            success: success,
            withData: withData,
            failed: results.length - success,
            timeSeconds: parseFloat(elapsed)
        }
    };
}

// 解析 HTML 提取药材数据（从 KendoGrid dataSource）
function parseHerbData(html) {
    const herbs = [];
    
    // 方法1: 查找 dataSource.data JSON 数组
    const dataMatch = html.match(/dataSource:\s*\{\s*data:\s*(\[[\s\S]*?\])\s*,\s*pageSize/);
    if (dataMatch) {
        try {
            const rawData = JSON.parse(dataMatch[1]);
            console.log(`Found ${rawData.length} herbs in dataSource.data`);
            
            for (const item of rawData) {
                if (item.herb_cn_name && item.herb_en_name) {
                    herbs.push({
                        name_cn: item.herb_cn_name,
                        name_pinyin: item.herb_pinyin || '',
                        name_latin: item.herb_en_name,
                        category_cn: item.child_cn_name || '',
                        category_en: item.child_en_name || ''
                    });
                }
            }
            
            return herbs;
        } catch (e) {
            console.error('Error parsing dataSource.data:', e.message);
        }
    }
    
    // 方法2: 尝试查找任何包含 herb_cn_name 的 JSON 数组
    const altMatch = html.match(/\[\s*\{[^}]*"herb_cn_name"[\s\S]*?\}/);
    if (altMatch) {
        console.log('Found alternative herb data format');
        // 尝试提取完整的数组
        const arrayMatch = html.match(/(\[[\s\S]*?"herb_cn_name"[\s\S]*?\])/);
        if (arrayMatch) {
            try {
                const rawData = JSON.parse(arrayMatch[1]);
                for (const item of rawData) {
                    if (item.herb_cn_name && item.herb_en_name) {
                        herbs.push({
                            name_cn: item.herb_cn_name,
                            name_pinyin: item.herb_pinyin || '',
                            name_latin: item.herb_en_name,
                            category_cn: item.child_cn_name || '',
                            category_en: item.child_en_name || ''
                        });
                    }
                }
                return herbs;
            } catch (e) {
                console.error('Error parsing alternative format:', e.message);
            }
        }
    }
    
    return herbs;
}

// 从 TCMSP 浏览页面获取所有药材列表
async function fetchAllHerbs() {
    console.log('\nFetching complete herb list from TCMSP...');
    
    try {
        const html = await fetchUrl(`${CONFIG.BASE_URL}/browse.php?qc=herbs`);
        
        // 保存原始 HTML 用于调试
        fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'page_source.html'), html);
        
        // 解析数据
        const herbs = parseHerbData(html);
        
        if (herbs && herbs.length > 0) {
            console.log(`✓ Successfully parsed ${herbs.length} herbs`);
            return herbs;
        }
        
        console.log('✗ Could not extract herb list');
        return null;
        
    } catch (error) {
        console.error('Error fetching herb list:', error.message);
        return null;
    }
}

// 主函数
async function main() {
    const overallStartTime = Date.now();
    
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          TCMSP Batch Scraper - Items 26 to 500               ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`\nConfiguration:`);
    console.log(`  Start Index: ${CONFIG.START_INDEX} (item #${CONFIG.START_INDEX + 1})`);
    console.log(`  End Index: ${CONFIG.END_INDEX} (item #${CONFIG.END_INDEX})`);
    console.log(`  Total Items: ${CONFIG.END_INDEX - CONFIG.START_INDEX}`);
    console.log(`  Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`  Estimated Batches: ${Math.ceil((CONFIG.END_INDEX - CONFIG.START_INDEX) / CONFIG.BATCH_SIZE)}`);
    console.log(`  Delay between requests: ${CONFIG.DELAY_MS}ms`);
    
    // 创建输出目录
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
        fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
        console.log(`\nCreated output directory: ${CONFIG.OUTPUT_DIR}`);
    }
    
    // 获取药材列表
    let allHerbs = await fetchAllHerbs();
    
    if (!allHerbs) {
        console.log('\n⚠️  Could not fetch herb list automatically.');
        console.log('Please ensure the browser has window.__tcmsp_all_herbs data available.');
        console.log('Or provide a JSON file with the herb list.\n');
        
        // 尝试读取本地缓存的数据文件
        const cacheFile = path.join(CONFIG.OUTPUT_DIR, 'all_herbs.json');
        if (fs.existsSync(cacheFile)) {
            console.log(`Found cached herb list: ${cacheFile}`);
            allHerbs = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            console.log(`Loaded ${allHerbs.length} herbs from cache.`);
        } else {
            console.error('\n❌ No herb data available. Exiting.');
            process.exit(1);
        }
    }
    
    // 缓存完整的药材列表
    fs.writeFileSync(
        path.join(CONFIG.OUTPUT_DIR, 'all_herbs.json'),
        JSON.stringify(allHerbs, null, 2)
    );
    
    // 提取需要爬取的部分（第 26-500 条，即索引 25-499）
    const herbsToScrape = allHerbs.slice(CONFIG.START_INDEX - 1, CONFIG.END_INDEX);
    console.log(`\n📋 Herbs to scrape: ${herbsToScrape.length} items (index ${CONFIG.START_INDEX - 1} to ${CONFIG.END_INDEX - 1})`);
    
    // 分批处理
    const allBatches = [];
    const totalBatches = Math.ceil(herbsToScrape.length / CONFIG.BATCH_SIZE);
    
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const startIdx = batchIdx * CONFIG.BATCH_SIZE;
        const endIdx = Math.min(startIdx + CONFIG.BATCH_SIZE, herbsToScrape.length);
        const batchHerbs = herbsToScrape.slice(startIdx, endIdx);
        const batchNum = batchIdx + 3; // 从 03 开始（因为 01 和 02 已完成）
        const globalStartIndex = CONFIG.START_INDEX - 1 + startIdx;
        
        const batchResult = await executeBatch(batchHerbs, batchNum, globalStartIndex);
        allBatches.push(batchResult);
        
        // 保存每个批次的单独结果
        const batchFile = path.join(CONFIG.OUTPUT_DIR, `batch_${String(batchNum).padStart(2, '0')}.json`);
        fs.writeFileSync(batchFile, JSON.stringify(batchResult.results, null, 2));
        console.log(`  💾 Saved: ${batchFile}`);
        
        // 批次间稍作停顿
        if (batchIdx < totalBatches - 1) {
            console.log('\n  Waiting 2 seconds before next batch...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    // 生成最终汇总
    console.log('\n\n' + '═'.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('═'.repeat(70));
    
    const allResults = allBatches.flatMap(b => b.results);
    const totalItems = allResults.length;
    const totalSuccess = allResults.filter(r => !r.error).length;
    const totalWithData = allResults.filter(r => r.compound_count > 0).total;
    const failedItems = allResults.filter(r => r.error);
    
    const totalTime = ((Date.now() - overallStartTime) / 1000 / 60).toFixed(1);
    
    console.log(`\n📊 Overall Statistics:`);
    console.log(`   Total Items Processed: ${totalItems}`);
    console.log(`   ✅ Successful: ${totalSuccess} (${(totalSuccess / totalItems * 100).toFixed(1)}%)`);
    console.log(`   📈 With Compound Data: ${totalWithData} (${(totalWithData / totalItems * 100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${failedItems.length} (${(failedItems.length / totalItems * 100).toFixed(1)}%)`);
    console.log(`   ⏱️  Total Time: ${totalTime} minutes`);
    
    if (failedItems.length > 0) {
        console.log(`\n❌ Failed Items:`);
        failedItems.forEach(item => {
            console.log(`   - ${item.name_cn} (${item.name_latin}): ${item.error}`);
        });
    }
    
    // 保存最终汇总结果
    const finalResult = {
        metadata: {
            scraped_at: new Date().toISOString(),
            item_range: `${CONFIG.START_INDEX}-${CONFIG.END_INDEX}`,
            total_items: totalItems,
            config: CONFIG
        },
        batches: allBatches.map(b => ({
            batch_num: b.batchNum,
            range: b.batchRange,
            stats: b.stats
        })),
        summary: {
            total_items: totalItems,
            successful: totalSuccess,
            with_data: totalWithData,
            failed: failedItems.length,
            success_rate: (totalSuccess / totalItems * 100).toFixed(1) + '%',
            data_rate: (totalWithData / totalItems * 100).toFixed(1) + '%',
            total_time_minutes: totalTime
        },
        failed_items: failedItems.map(item => ({
            name_cn: item.name_cn,
            name_latin: item.name_latin,
            error: item.error
        })),
        all_results: allResults
    };
    
    const finalFile = path.join(CONFIG.OUTPUT_DIR, 'scrape_final.json');
    fs.writeFileSync(finalFile, JSON.stringify(finalResult, null, 2));
    console.log(`\n💾 Final results saved to: ${finalFile}`);
    
    // 输出每个批次的简要统计表格
    console.log(`\n📋 Batch Summary Table:`);
    console.log('─'.repeat(70));
    console.log('Batch     Range       Total  Success  Data   Failed   Time(s)');
    console.log('─'.repeat(70));
    allBatches.forEach(b => {
        console.log(
            `${b.batchNum.padStart(6)}  ${b.batchRange.padStart(11)}  ` +
            `${String(b.stats.total).padStart(5)}  ` +
            `${String(b.stats.success).padStart(6)}  ` +
            `${String(b.stats.withData).padStart(5)}  ` +
            `${String(b.stats.failed).padStart(6)}  ` +
            `${b.stats.timeSeconds.toFixed(1).padStart(6)}`
        );
    });
    console.log('─'.repeat(70));
    
    console.log('\n✨ Scraping completed successfully!');
    
    return finalResult;
}

// 运行主函数
main()
    .then(result => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nFatal error:', error);
        process.exit(1);
    });
