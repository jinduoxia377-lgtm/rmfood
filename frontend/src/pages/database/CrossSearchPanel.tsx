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
  "ACE抑制": "bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)]",
  "抗菌": "bg-[var(--color-accent-container)] text-[var(--color-accent-text)]",
  "抗氧化": "bg-[var(--color-warning-container)] text-[var(--color-warning-text)]",
  "抗炎": "bg-danger-100 text-danger-700",
  "降血糖": "bg-[var(--color-success-container)] text-[var(--color-success-text)]",
  "降血脂": "bg-[var(--color-accent-container)] text-[var(--color-accent-text)]",
  "免疫调节": "bg-info-100 text-info-700",
  "抗癌": "bg-[var(--color-error-container)] text-[var(--color-error-text)]",
  "抗凝血": "bg-danger-100 text-danger-700",
  "阿片样活性": "bg-[var(--color-accent-container)] text-[var(--color-accent-text)]",
  "金属离子螯合": "bg-[var(--color-warning-container)] text-[var(--color-warning-text)]",
  "DPP-IV抑制": "bg-[var(--color-success-container)] text-[var(--color-success-text)]",
  "α-葡萄糖苷酶抑制": "bg-[var(--color-primary-container)] text-[var(--color-primary-text)]",
  "血管紧张素转化酶抑制": "bg-info-100 text-info-700",
  "ACE inhibitory": "bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)]",
  "Antioxidant": "bg-[var(--color-warning-container)] text-[var(--color-warning-text)]",
  "Anti-inflammatory": "bg-danger-100 text-danger-700",
  "Antimicrobial": "bg-[var(--color-accent-container)] text-[var(--color-accent-text)]",
};

const RELEVANCE_BADGES: Record<string, { color: string; label: string }> = {
  high: { color: "bg-[var(--color-success-container)] text-[var(--color-success-text)] border-[var(--color-success-border)]", label: "高相关" },
  medium: { color: "bg-[var(--color-warning-container)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]", label: "中相关" },
  low: { color: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)]", label: "弱相关" },
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
      <div className="space-y-[var(--space-apple-md)]">
        {/* 结果摘要 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--text-secondary)]">
            "<strong>{result.herb.name_cn}</strong>" 共找到{" "}
            <strong className="text-[var(--color-secondary-text)]">{result.match_summary.matched_peptides}</strong> 条关联活性肽
          </span>
        </div>

        {/* 药材基本信息 */}
        <div className="bg-gradient-to-r from-secondary-50 to-success-50 rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--color-secondary-border)]">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-lg text-neutral-800">{result.herb.name_cn}</h4>
              {result.herb.name_latin && (
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic font-mono">{result.herb.name_latin}</p>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{result.herb.effects}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-[var(--bg-secondary)] rounded-[var(--radius-pill)] text-[var(--text-secondary)] border border-[var(--border-color)]">
              {result.herb.category || "未分类"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-[var(--space-apple-sm)] pt-3 border-t border-[var(--color-secondary-border)]">
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--color-secondary-text)]">{result.match_summary.total_compounds}</div>
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">化合物</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--color-warning-text)]">{result.match_summary.matched_peptides}</div>
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">关联肽</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--color-primary-text)]">{result.match_summary.high_relevance_peptides}</div>
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">高相关性</div>
            </div>
          </div>
        </div>

        {/* 相关活性标签云 */}
        {result.related_peptides.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">相关活性:</span>
            {Array.from(new Set(result.related_peptides.map((p) => p.activity_type))).map((act) => (
              <span
                key={act}
                className={`text-xs px-2 py-0.5 rounded-[var(--radius-pill)] ${ACTIVITY_COLORS[act] || "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"}`}
              >
                {act}
              </span>
            ))}
          </div>
        )}

        {/* 结果表格 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-sm border border-[var(--border-color)] overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-tertiary)] z-10">
                <tr className="text-left border-b border-[var(--border-color)]">
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">相关性</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">序列</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">来源</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">活性</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-right">活性值</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-right">MW(Da)</th>
                  <th className="px-[var(--space-apple-md)] py-2.5 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">水解酶</th>
                </tr>
              </thead>
              <tbody>
                {result.related_peptides.map((item, idx) => {
                  const tier = getRelevanceTier(item.relevance_score);
                  const badge = RELEVANCE_BADGES[tier];
                  return (
                    <tr
                      key={`${idx}-${item.sequence}`}
                      className="border-b border-neutral-50 hover:bg-[var(--color-secondary-container)]/20 transition-colors"
                    >
                      <td className="px-[var(--space-apple-md)] py-2">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-[var(--radius-pill)] border ${badge.color}`}>
                          {item.relevance_score} {badge.label}
                        </span>
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2 font-mono font-semibold text-neutral-800">
                        {item.sequence}
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2">
                        <div className="text-xs text-[var(--text-primary)]">{item.source_protein}</div>
                        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{item.source_organism}</div>
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-pill)] ${ACTIVITY_COLORS[item.activity_type] || "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"}`}>
                          {item.activity_type}
                        </span>
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2 text-right font-mono text-sm">
                        <span className={Number(item.activity_value) < 10 ? "text-[var(--color-success-text)] font-semibold" :
                          Number(item.activity_value) < 100 ? "text-[var(--color-warning-text)]" : "text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"}>
                          {item.activity_value}
                        </span>
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2 text-right font-mono text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        {item.molecular_weight?.toFixed(1) || "-"}
                      </td>
                      <td className="px-[var(--space-apple-md)] py-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
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
          <div className="bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">代表性化合物:</p>
            <div className="flex gap-2 flex-wrap">
              {result.compounds.slice(0, 10).map((c, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] text-[var(--text-secondary)]"
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
    <div className="w-full space-y-[var(--space-apple-md)]">
      {/* 搜索输入框 */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="输入药材或食物名称，如：黄芪、牛奶、三文鱼..."
          className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] pl-11 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary-container)] focus:border-transparent shadow-sm"
        />
        {/* 搜索图标 */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"
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
          className="absolute right-2 top-1/2 -translate-y-1/2 px-[var(--space-apple-md)] py-1.5 bg-secondary-container text-secondary-main text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "搜索中..." : "关联检索"}
        </button>

        {/* 下拉建议 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-lg z-20 max-h-64 overflow-y-auto">
            {suggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSuggestionClick(item)}
                className="w-full px-[var(--space-apple-md)] py-2.5 text-left hover:bg-[var(--color-secondary-container)] flex items-center gap-[var(--space-apple-sm)] text-sm border-b border-neutral-50 last:border-0"
              >
                <span className={`w-16 text-xs font-medium px-1.5 py-0.5 rounded ${
                  item.type === "source" ? "bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)]" :
                  item.type === "sequence" ? "bg-[var(--color-accent-container)] text-[var(--color-accent-text)]" :
                  "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                }`}>
                  {item.type === "source" ? "来源" :
                   item.type === "sequence" ? "序列" : item.type}
                </span>
                <span className="text-[var(--text-primary)] font-medium">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">{item.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* 错误提示 */}
      {error && (
        <div className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] rounded-[var(--radius-Apple-sm)] text-sm text-[var(--color-error-text)]">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && !result && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-3 border-[var(--color-secondary-border)] border-t-blue-600 rounded-[var(--radius-pill)] mr-3" />
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">正在执行交叉检索...</span>
        </div>
      )}

      {/* 搜索历史 */}
      {!result && searchHistory.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">最近搜索:</span>
          {searchHistory.map((term) => (
            <button
              key={term}
              onClick={() => {
                setQuery(term);
                doSearch(term);
              }}
              className="text-xs px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--border-color)] transition-colors"
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
