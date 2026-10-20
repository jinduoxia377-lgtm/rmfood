/**
 * SearchModal — 全局搜索模态框
 *
 * 支持 Ctrl+K / Cmd+K 快捷键打开。
 * 搜索范围：配方、实验、原料。
 * 调用 GET /api/v1/search/global（真实端点，跨类型模糊搜索）。
 *
 * 此前指向 /api/v1/ai/search —— 该路由后端不存在，fetch 返回 404 后被
 * catch 成空结果，用户看到的是"未找到匹配结果"，误以为搜索功能正常但库里
 * 没有数据；实际是搜索根本没执行。
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchResult } from '@/types/ai.api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 后端 /search/global 返回 items[].description，前端类型字段叫 snippet */
function normalizeSearchItems(data: unknown): SearchResult[] {
  const payload = data as { types?: Record<string, { items?: unknown[] }> };
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const bucket of Object.values(payload?.types ?? {})) {
    for (const raw of (bucket?.items ?? []) as Array<Record<string, unknown>>) {
      const id = String(raw.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const type = String(raw.type ?? '') as SearchResult['type'];
      out.push({
        id,
        type: type === 'formula' || type === 'ingredient' || type === 'experiment' ? type : 'analysis',
        title: String(raw.title ?? ''),
        snippet: String(raw.description ?? ''),
        score: typeof raw.score === 'number' ? raw.score : 0,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 防抖搜索
  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
       
      setSearchError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `/api/v1/search/global?q=${encodeURIComponent(query)}&types=formula,experiment,ingredient&page_size=20`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setResults(normalizeSearchItems(data));
        }
        // 非 200（鉴权/服务异常）不再静默降级成"无结果"，明确标记失败
        else {
          setResults([]);
          setSearchError(`搜索服务异常（HTTP ${response.status}）`);
        }
      } catch {
        setResults([]);
        setSearchError('搜索服务不可达');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center pt-24 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="全局搜索"
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"  role="button" tabIndex={0} onClick={handleClose} />

      {/* 搜索框 */}
      <div className="relative w-full max-w-2xl bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl border border-[var(--border-color)] overflow-hidden">
        {/* 输入区 */}
        <div className="flex items-center px-[var(--space-apple-md)] py-[var(--space-apple-sm)] border-b border-[var(--border-color)]">
          <Search className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索配方、药材、分析工具..."
            className="flex-1 ml-3 bg-transparent text-base focus:outline-none text-neutral-900 dark:text-white placeholder:text-[color:var(--text-muted)] dark:placeholder:text-[color:var(--text-secondary)]"
            aria-label="搜索内容"
          />
          <button
            onClick={handleClose}
            className="ml-2 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"
            aria-label="关闭搜索"
          >
            <X className="w-4 h-4" />
          </button>
          <kbd className="ml-3 px-2 py-1 text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] bg-neutral-100 dark:bg-neutral-700 rounded">
            ESC
          </kbd>
        </div>

        {/* 结果区 */}
        <div className="max-h-96 overflow-y-auto p-2">
          {isSearching ? (
            <div className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">搜索中...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  onClick={handleClose}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        r.type === 'formula'
                          ? 'bg-secondary-500'
                          : r.type === 'ingredient'
                            ? 'bg-primary-500'
                            : 'bg-accent-500'
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium text-neutral-900 dark:text-white">{r.title}</div>
                      <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">{r.snippet}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchError ? (
            <div className="px-4 py-8 text-center text-sm text-error-500">{searchError}</div>
          ) : query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到匹配 "{query}" 的结果</div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">输入关键词开始搜索</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
