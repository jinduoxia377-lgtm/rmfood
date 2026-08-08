/**
 * SearchModal — 全局搜索模态框
 *
 * 支持 Ctrl+K / Cmd+K 快捷键打开。
 * 搜索范围：配方、药材、分析结果。
 * 调用 GET /api/ai/search?q=... 后端 API（未实现时返回空结果）。
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchResult } from '@/types/ai.api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 防抖搜索
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/ai/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results as SearchResult[]);
        }
      } catch (_error) {
        setResults([]);
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="全局搜索"
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* 搜索框 */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* 输入区 */}
        <div className="flex items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索配方、药材、分析工具..."
            className="flex-1 ml-3 bg-transparent text-base focus:outline-none text-neutral-900 dark:text-white placeholder:text-neutral-400"
            aria-label="搜索内容"
          />
          <button
            onClick={handleClose}
            className="ml-2 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400"
            aria-label="关闭搜索"
          >
            <X className="w-4 h-4" />
          </button>
          <kbd className="ml-3 px-2 py-1 text-xs font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-700 rounded">
            ESC
          </kbd>
        </div>

        {/* 结果区 */}
        <div className="max-h-96 overflow-y-auto p-2">
          {isSearching ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">搜索中...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700/50 transition-colors"
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
                      <div className="text-xs text-neutral-500 truncate">{r.snippet}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">未找到匹配 "{query}" 的结果</div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">输入关键词开始搜索</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
