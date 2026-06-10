/**
 * RMFOOD 交叉检索面板
 * ==================
 *
 * 输入药材名称 → 发现相关食物来源活性肽。
 * 使用相关性评分算法：
 *   - 直接来源匹配（权重 1.0）
 *   - 同生物体/同分类匹配（权重 0.5~0.6）
 *   - 功效关键词匹配（权重 0.4）
 *
 * 适配当前项目 API 格式
 */

import React, { useState, useCallback, useEffect } from "react";
import { databaseApi } from "@/api/database";

const ACTIVITY_COLORS: Record<string, string> = {
  "ACE抑制": "bg-blue-100 text-blue-700",
  "抗菌": "bg-purple-100 text-purple-700",
  "抗氧化": "bg-orange-100 text-orange-700",
  "抗炎": "bg-pink-100 text-pink-700",
  "降血糖": "bg-teal-100 text-teal-700",
  "降血脂": "bg-indigo-100 text-indigo-700",
  "免疫调节": "bg-cyan-100 text-cyan-700",
  "抗癌": "bg-red-100 text-red-700",
  "抗凝血": "bg-rose-100 text-rose-700",
  "阿片样活性": "bg-violet-100 text-violet-700",
  "金属离子螯合": "bg-amber-100 text-amber-700",
  "DPP-IV抑制": "bg-lime-100 text-lime-700",
  "α-葡萄糖苷酶抑制": "bg-emerald-100 text-emerald-700",
  "血管紧张素转化酶抑制": "bg-sky-100 text-sky-700",
  "ACE inhibitory": "bg-blue-100 text-blue-700",
  "Antioxidant": "bg-orange-100 text-orange-700",
  "Anti-inflammatory": "bg-pink-100 text-pink-700",
  "Antimicrobial": "bg-purple-100 text-purple-700",
};

const RELEVANCE_BADGES: Record<string, { color: string; label: string }> = {
  high: { color: "bg-green-100 text-green-700 border-green-300", label: "高相关" },
  medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-300", label: "中相关" },
  low: { color: "bg-gray-100 text-gray-600 border-gray-300", label: "弱相关" },
};

function getRelevanceTier(score: number): string {
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

// ============================================================
// 主组件
// ============================================================

interface CrossSearchResponse {
  herb: {
    name_cn: string;
    name_latin: string;
    effects: string;
    category: string;
    ob_percent: number;
    compound_count: number;
  };
  compounds: {
    name: string;
    ob?: number;
    dl?: number;
  }[];
  related_peptides: {
    sequence: string;
    source_protein: string;
    source_organism: string;
    activity_type: string;
    activity_value: number | string;
    molecular_weight: number;
    hydrolysis_enzyme: string;
    relevance_score: number;
  }[];
  match_summary: {
    total_compounds: number;
    matched_peptides: number;
    high_relevance_peptides: number;
  };
}

interface SuggestionItem {
  type: string;
  label: string;
  sublabel?: string;
  category?: string;
}

interface Props {
  initialHerbName?: string;
  onHerbSelect?: (herbName: string) => void;
}

export default function CrossSearchPanel({ initialHerbName = "", onHerbSelect }: Props) {
  const [query, setQuery] = useState(initialHerbName);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<CrossSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 防抖搜索建议
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await databaseApi.getSearchSuggestions(query, 8);
        // 合并 herbs 和 peptides 建议
        const allSuggestions: SuggestionItem[] = [
          ...(res.herbs || []).map((h: { name_cn?: string; label?: string; name_latin?: string; sublabel?: string; category?: string }) => ({
            type: "source",
            label: h.name_cn || h.label || '',
            sublabel: h.name_latin || h.sublabel || '',
            category: h.category,
          })),
          ...(res.peptides || []).map((p: { sequence?: string; label?: string; source_protein?: string; sublabel?: string; activity_type?: string }) => ({
            type: "sequence",
            label: p.sequence || p.label || '',
            sublabel: p.source_protein || p.sublabel || '',
            category: p.activity_type,
          })),
        ];
        setSuggestions(allSuggestions.slice(0, 8));
        setShowSuggestions(allSuggestions.length > 0);
      } catch {
        // 忽略建议加载错误
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // 执行交叉检索
  const doSearch = useCallback(async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;

    try {
      setLoading(true);
      setError(null);
      setShowSuggestions(false);

      const data = await databaseApi.crossSearch(term);
      setResult(data);

      // 更新搜索历史
      setSearchHistory((prev) => {
        const filtered = prev.filter((h) => h !== term);
        return [term, ...filtered].slice(0, 10);
      });

      onHerbSelect?.(term);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检索失败");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [onHerbSelect]);

  // 初始化时执行搜索
  useEffect(() => {
    if (initialHerbName) {
      doSearch(initialHerbName);
    }
  }, [initialHerbName, doSearch]);

  // 提交搜索
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  // 点击建议项
  const handleSuggestionClick = (item: SuggestionItem) => {
    setQuery(item.label);
    setShowSuggestions(false);
    doSearch(item.label);
  };

  // 渲染结果表格
  const renderResults = () => {
    if (!result) return null;

    return (
      <div className="space-y-4">
        {/* 结果摘要 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            "<strong>{result.herb.name_cn}</strong>" 共找到{" "}
            <strong className="text-blue-600">{result.match_summary.matched_peptides}</strong> 条关联活性肽
          </span>
        </div>

        {/* 药材基本信息 */}
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-lg text-gray-800">{result.herb.name_cn}</h4>
              {result.herb.name_latin && (
                <p className="text-xs text-gray-500 italic font-mono">{result.herb.name_latin}</p>
              )}
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{result.herb.effects}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-white dark:bg-slate-800 rounded-full text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700">
              {result.herb.category || "未分类"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-blue-100">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{result.match_summary.total_compounds}</div>
              <div className="text-[10px] text-gray-500">化合物</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{result.match_summary.matched_peptides}</div>
              <div className="text-[10px] text-gray-500">关联肽</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">{result.match_summary.high_relevance_peptides}</div>
              <div className="text-[10px] text-gray-500">高相关性</div>
            </div>
          </div>
        </div>

        {/* 相关活性标签云 */}
        {result.related_peptides.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">相关活性:</span>
            {Array.from(new Set(result.related_peptides.map((p) => p.activity_type))).map((act) => (
              <span
                key={act}
                className={`text-xs px-2 py-0.5 rounded-full ${ACTIVITY_COLORS[act] || "bg-gray-100 text-gray-600"}`}
              >
                {act}
              </span>
            ))}
          </div>
        )}

        {/* 结果表格 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-left border-b border-gray-200">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">相关性</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">序列</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">来源</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">活性</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">活性值</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">MW(Da)</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">水解酶</th>
                </tr>
              </thead>
              <tbody>
                {result.related_peptides.map((item, idx) => {
                  const tier = getRelevanceTier(item.relevance_score);
                  const badge = RELEVANCE_BADGES[tier];
                  return (
                    <tr
                      key={`${idx}-${item.sequence}`}
                      className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {item.relevance_score} {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono font-semibold text-gray-800">
                        {item.sequence}
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-xs text-gray-700">{item.source_protein}</div>
                        <div className="text-xs text-gray-400">{item.source_organism}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACTIVITY_COLORS[item.activity_type] || "bg-gray-100 text-gray-600"}`}>
                          {item.activity_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-sm">
                        <span className={Number(item.activity_value) < 10 ? "text-green-600 font-semibold" :
                          Number(item.activity_value) < 100 ? "text-yellow-600" : "text-gray-500"}>
                          {item.activity_value}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                        {item.molecular_weight?.toFixed(1) || "-"}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {item.hydrolysis_enzyme}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 代表性化合物 */}
        {result.compounds.length > 0 && (
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 mb-1.5">代表性化合物:</p>
            <div className="flex gap-2 flex-wrap">
              {result.compounds.slice(0, 10).map((c, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md text-gray-600 dark:text-gray-300"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* 搜索输入框 */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="输入药材或食物名称，如：黄芪、牛奶、三文鱼..."
          className="w-full px-4 py-3 pl-11 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent shadow-sm"
        />
        {/* 搜索图标 */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* 搜索按钮 */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "搜索中..." : "关联检索"}
        </button>

        {/* 下拉建议 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
            {suggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSuggestionClick(item)}
                className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 text-sm border-b border-gray-50 last:border-0"
              >
                <span className={`w-16 text-xs font-medium px-1.5 py-0.5 rounded ${
                  item.type === "source" ? "bg-blue-50 text-blue-600" :
                  item.type === "sequence" ? "bg-purple-50 text-purple-600" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {item.type === "source" ? "来源" :
                   item.type === "sequence" ? "序列" : item.type}
                </span>
                <span className="text-gray-700 font-medium">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-gray-400 ml-auto">{item.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && !result && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full mr-3" />
          <span className="text-gray-500 text-sm">正在执行交叉检索...</span>
        </div>
      )}

      {/* 搜索历史 */}
      {!result && searchHistory.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">最近搜索:</span>
          {searchHistory.map((term) => (
            <button
              key={term}
              onClick={() => {
                setQuery(term);
                doSearch(term);
              }}
              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {/* 结果渲染 */}
      {renderResults()}
    </div>
  );
}
