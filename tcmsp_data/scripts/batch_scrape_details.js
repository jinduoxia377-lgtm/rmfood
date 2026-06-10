/**
 * TCMSP 详情页批量爬取脚本 (Browser / Chrome DevTools MCP evaluate_script)
 * ================================================================
 * 功能:
 *   1. 读取 502 条药材基础列表 (tcmsp_herbs_list.json)
 *   2. 逐个 fetch() 详情页 HTML
 *   3. 用「括号计数法」从内嵌 KendoGrid dataSource 中提取完整 JSON（解决嵌套括号问题）
 *   4. 提取化合物/靶点/疾病数据，计算 OB%/DL 汇总值
 *   5. 每 50 条保存进度，最终返回完整 JSON
 *
 * 使用方式 (Chrome DevTools MCP):
 *   evaluate_script: batch_scrape_details.js
 *
 * Token: ee3a5d33b6d2e34b1fd95dadf566e224
 */

// ═══════════════════════════════════════════════════════
// 配置常量
// ═══════════════════════════════════════════════════════

const BASE_URL = "https://www.tcmsp-e.com";
const TOKEN = "ee3a5d33b6d2e34b1fd95dadf566e224";
const BATCH_SIZE = 50;          // 每多少条保存一次进度
const DELAY_MS = 800;           // 请求间隔(毫秒)
const REQUEST_TIMEOUT_MS = 30000;

// 化合物字段映射 (TCMSP原始字段 → 标准字段)
const COMPOUND_FIELDS = {
    "MOL_ID": "mol_id",
    "molecule_name": "name",
    "mw": "mw",
    "AlogP": "alogp",
    "Hdon": "hdon",
    "Hacc": "hacc",
    "OB": "ob",
    "Caco-2": "caco2",
    "BBB": "bbb",
    "DL": "dl",
    "FASA": "fasa",
    "HL": "hl",
};

// ═══════════════════════════════════════════════════════
// 核心: 括号计数法提取嵌套 JSON 数组
// ═══════════════════════════════════════════════════════

/**
 * 从 HTML 文本中定位 marker 后的 [ 并用括号计数找到匹配的 ]
 * 解决 [\s\S]*? 非贪婪匹配在嵌套对象时提前终止的问题
 *
 * @param {string} html - 原始 HTML 文本
 * @param {string} marker - 定位标记，如 "dataSource:{data:"
 * @returns {string|null} 提取到的 JSON 字符串（含外层 []），失败返回 null
 */
function extractJsonByBracketCounting(html, marker) {
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return null;

    // 找到 marker 之后的第一个 '['
    const arrayStart = html.indexOf("[", startIdx + marker.length);
    if (arrayStart === -1) return null;

    let depth = 0;
    let i = arrayStart;

    while (i < html.length) {
        const ch = html[i];
        if (ch === "[") depth++;
        else if (ch === "]") {
            depth--;
            if (depth === 0) {
                // 找到匹配的闭合括号
                return html.substring(arrayStart, i + 1);
            }
        }
        // 跳过字符串内的括号
        else if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < html.length && html[i] !== quote) {
                if (html[i] === "\\") i++; // 跳过转义字符
                i++;
            }
        }
        i++;
    }

    console.warn(`[extractJson] 未找到匹配的闭合括号, marker="${marker}"`);
    return null;
}

// ═══════════════════════════════════════════════════════
// 详情页解析
// ═══════════════════════════════════════════════════════

/**
 * 解析单个详情页 HTML，提取所有 KendoGrid 数据源
 * 返回结构化数据对象
 */
function parseDetailPage(html, herbInfo) {
    const result = {
        name_cn: herbInfo.name_cn || "",
        name_latin: herbInfo.name_latin || "",
        name_pinyin: herbInfo.name_pinyin || "",
        category_cn: herbInfo.category_cn || "",
        category_en: herbInfo.category_en || "",
        compounds: [],
        targets: [],
        network_nodes: [],
        target_diseases: [],
        disease_network: [],
        ob_percent: null,
        dl_value: null,
        compound_count: 0,
        error: null,
    };

    try {
        // ── 1. 提取化合物数据 (Ingredients grid) ──
        // 模式: dataSource:{data:[{...},{...}]}
        const compoundJsonStr = extractJsonByBracketCounting(
            html, "dataSource:{data:"
        );

        if (compoundJsonStr) {
            const rawCompounds = JSON.parse(compoundJsonStr);
            result.compounds = rawCompounds.map(c => {
                const mapped = {};
                for (const [srcKey, dstKey] of Object.entries(COMPOUND_FIELDS)) {
                    // 尝试多种大小写形式
                    let val = c[srcKey];
                    if (val === undefined) {
                        // 尝试首字母大写
                        const altKey = srcKey.charAt(0).toUpperCase() + srcKey.slice(1);
                        val = c[altKey];
                    }
                    if (val === undefined) {
                        // 尝试全小写
                        val = c[srcKey.toLowerCase()];
                    }
                    mapped[dstKey] = val !== undefined ? val : null;
                }
                return mapped;
            });
            result.compound_count = result.compounds.length;

            // 计算 OB% 和 DL 汇总值
            const obValues = result.compounds
                .map(c => parseFloat(c.ob))
                .filter(v => !isNaN(v) && v !== null);

            const dlValues = result.compounds
                .map(c => parseFloat(c.dl))
                .filter(v => !isNaN(v) && v !== null);

            if (obValues.length > 0) {
                result.ob_percent = Math.round(Math.max(...obValues) * 100) / 100;
            }
            if (dlValues.length > 0) {
                result.dl_value = Math.round(Math.max(...dlValues) * 1000) / 1000;
            }
        } else {
            console.warn(`[${herbInfo.name_cn}] 未找到化合物数据`);
        }

        // ── 2. 提取化合物-靶点关联数据 (Compound Targets grid) ──
        const targetJsonStr = extractJsonByBracketCounting(
            html, "dataSource:{data:"
        );
        // 注意: 如果页面有多个 kendoGrid，需要按顺序或特定标记区分
        // 这里用更精确的标记来区分不同grid
        // 实际上 TCMSP 的每个 grid 有不同的 schema 定义，我们通过位置来区分

        // 重新用更精确的方式: 提取所有 dataSource:{data:... 出现的位置
        const allDataSources = [];
        let searchPos = 0;
        const dataMarker = "dataSource:{data:";
        while (true) {
            const idx = html.indexOf(dataMarker, searchPos);
            if (idx === -1) break;
            allDataSources.push(idx);
            searchPos = idx + dataMarker.length;
        }

        // 通常顺序: compounds(0), compound-targets(1), network-nodes(2), target-diseases(3), disease-network(4)
        if (allDataSources.length >= 2) {
            try {
                const ctJsonStr = extractJsonByBracketCountingAt(
                    html, dataMarker, allDataSources[1]
                );
                if (ctJsonStr) {
                    result.targets = JSON.parse(ctJsonStr);
                }
            } catch (e) {
                console.warn(`[${herbInfo.name_cn}] 解析靶点数据失败: ${e.message}`);
            }
        }

        if (allDataSources.length >= 3) {
            try {
                const nnJsonStr = extractJsonByBracketCountingAt(
                    html, dataMarker, allDataSources[2]
                );
                if (nnJsonStr) {
                    result.network_nodes = JSON.parse(nnJsonStr);
                }
            } catch (e) {
                console.warn(`[${herbInfo.name_cn}] 解析网络节点失败: ${e.message}`);
            }
        }

        if (allDataSources.length >= 4) {
            try {
                const tdJsonStr = extractJsonByBracketCountingAt(
                    html, dataMarker, allDataSources[3]
                );
                if (tdJsonStr) {
                    result.target_diseases = JSON.parse(tdJsonStr);
                }
            } catch (e) {
                console.warn(`[${herbInfo.name_cn}] 解析靶点-疾病失败: ${e.message}`);
            }
        }

        if (allDataSources.length >= 5) {
            try {
                const dnJsonStr = extractJsonByBracketCountingAt(
                    html, dataMarker, allDataSources[4]
                );
                if (dnJsonStr) {
                    result.disease_network = JSON.parse(dnJsonStr);
                }
            } catch (e) {
                console.warn(`[${herbInfo.name_cn}] 解析疾病网络失败: ${e.message}`);
            }
        }

    } catch (err) {
        result.error = err.message;
        console.error(`[${herbInfo.name_cn}] 解析异常: ${err.message}`);
    }

    return result;
}

/**
 * 在指定起始位置后提取 JSON 数组
 */
function extractJsonByBracketCountingAt(html, marker, startPos) {
    const arrayStart = html.indexOf("[", startPos + marker.length);
    if (arrayStart === -1) return null;

    let depth = 0;
    let i = arrayStart;

    while (i < html.length) {
        const ch = html[i];
        if (ch === "[") depth++;
        else if (ch === "]") {
            depth--;
            if (depth === 0) {
                return html.substring(arrayStart, i + 1);
            }
        } else if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < html.length && html[i] !== quote) {
                if (html[i] === "\\") i++;
                i++;
            }
        }
        i++;
    }
    return null;
}

// ═══════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildDetailUrl(latinName) {
    const encoded = encodeURIComponent(latinName);
    return `${BASE_URL}/tcmspsearch.php?qr=${encoded}&qsr=herb_en_name&token=${TOKEN}`;
}

// ═══════════════════════════════════════════════════════
// 主函数: 批量爬取
// ═══════════════════════════════════════════════════════

async function batchScrapeTcmspDetails(herbList) {
    const total = herbList.length;
    const results = [];
    const errors = [];

    console.log(`\n${"=".repeat(60)}`);
    console.log(`TCMSP 详情页批量爬取开始`);
    console.log(`总计: ${total} 条药材 | Token: ${TOKEN.substring(0, 8)}...`);
    console.log(`批次保存: 每 ${BATCH_SIZE} 条 | 请求延迟: ${DELAY_MS}ms`);
    console.log(`${"=".repeat(60)}\n`);

    const startTime = Date.now();

    for (let i = 0; i < total; i++) {
        const herb = herbList[i];
        const latinName = herb.name_latin || "";

        if (!latinName) {
            console.warn(`[${i + 1}/${total}] 跳过(无拉丁名): ${herb.name_cn}`);
            results.push({
                ...herb,
                compounds: [],
                ob_percent: null,
                dl_value: null,
                compound_count: 0,
                error: "NO_LATIN_NAME",
            });
            continue;
        }

        const url = buildDetailUrl(latinName);
        let detailResult;

        try {
            console.log(`[${i + 1}/${total}] 正在获取: ${herb.name_cn} (${latinName})`);
            console.log(`  URL: ${url}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "text/html,application/xhtml+xml,*/*",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();

            if (!html || html.length < 500) {
                throw new Error(`响应内容过短(${html.length}字节)，可能被拦截`);
            }

            detailResult = parseDetailPage(html, herb);

            // 日志输出摘要
            console.log(`  ✅ 成功 | 成分:${detailResult.compound_count} | OB:${detailResult.ob_percent} | DL:${detailResult.dl_value}`);

        } catch (err) {
            console.error(`  ❌ 失败: ${err.message}`);
            detailResult = {
                ...herb,
                compounds: [],
                targets: [],
                diseases: [],
                ob_percent: null,
                dl_value: null,
                compound_count: 0,
                error: err.message,
            };
            errors.push({ index: i, name_cn: herb.name_cn, error: err.message });
        }

        results.push(detailResult);

        // 进度保存
        if ((i + 1) % BATCH_SIZE === 0) {
            const progressData = {
                phase: "batch_scrape_details",
                completed: i + 1,
                total: total,
                results: results,
                errors: errors,
                timestamp: new Date().toISOString(),
            };
            // 通过 window 对象暴露进度数据，供外部读取
            window.__tcmsp_scrape_progress = progressData;
            console.log(`\n📦 已完成 ${i + 1}/${total}，进度已保存到 window.__tcmsp_scrape_progress\n`);

            // 同时输出到控制台便于复制
            console.log(`--- PROGRESS_SAVE_POINT_${i + 1} ---`);
            console.log(JSON.stringify(progressData));
            console.log(`--- END_PROGRESS_${i + 1} ---\n`);
        }

        // 请求间延迟（最后一个不需要）
        if (i < total - 1) {
            await sleep(DELAY_MS);
        }
    }

    // 最终汇总
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => !r.error).length;
    const withCompounds = results.filter(r => r.compound_count > 0).length;
    const withOB = results.filter(r => r.ob_percent !== null).length;
    const withDL = results.filter(r => r.dl_value !== null).length;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`爬取完成!`);
    console.log(`总耗时: ${elapsed}s (~${(elapsed / 60).toFixed(1)}min)`);
    console.log(`成功: ${successCount}/${total} | 失败: ${errors.length}`);
    console.log(`有成分: ${withCompounds} | 有OB: ${withOB} | 有DL: ${withDL}`);
    if (errors.length > 0) {
        console.log(`\n失败列表:`);
        errors.forEach(e => console.log(`  [${e.index}] ${e.name_cn}: ${e.error}`));
    }
    console.log(`${"=".repeat(60)}\n`);

    // 构建最终结果
    const finalOutput = {
        success: true,
        total: total,
        success_count: successCount,
        error_count: errors.length,
        stats: {
            with_compounds: withCompounds,
            with_ob: withOB,
            with_dl: withDL,
            elapsed_seconds: parseFloat(elapsed),
        },
        errors: errors,
        scraped_at: new Date().toISOString(),
        source: "tcmsp_browser_batch_v1",
        token_used: TOKEN,
        data: results,
    };

    // 暴露到全局
    window.__tcmsp_scrape_result = finalOutput;

    console.log(`\n🎉 最终结果已保存到 window.__tcmsp_scrape_result`);
    console.log(`数据量: ${(JSON.stringify(finalOutput).length / 1024 / 1024).toFixed(2)} MB`);

    return finalOutput;
}

// ═══════════════════════════════════════════════════════
// 导出 & 自执行入口
// ═══════════════════════════════════════════════════════

// 导出函数供外部调用
if (typeof globalThis !== "undefined") {
    globalThis.batchScrapeTcmspDetails = batchScrapeTcmspDetails;
    globalThis.extractJsonByBracketCounting = extractJsonByBracketCounting;
    globalThis.parseDetailPage = parseDetailPage;
}
