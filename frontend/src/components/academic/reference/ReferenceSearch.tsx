import { useState } from 'react';
import { useReferenceStore } from '@/stores/referenceStore';
import { Search, FileSearch, BookOpen } from 'lucide-react';

export function ReferenceSearch() {
  const { fetchByDOI, fetchByISBN, isLoading, error } = useReferenceStore();
  const [searchType, setSearchType] = useState<'doi' | 'isbn' | 'search'>('search');
  const [query, setQuery] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) {
      alert('请输入搜索内容');
      return;
    }

    if (searchType === 'doi') {
      await fetchByDOI(query.trim());
    } else if (searchType === 'isbn') {
      await fetchByISBN(query.trim());
    } else {
      useReferenceStore.getState().searchReferences(query.trim());
    }

    setQuery('');
  };

  const handleQuickSearch = (type: 'doi' | 'isbn', example: string) => {
    setSearchType(type);
    setQuery(example);
  };

  return (
    <div className="border rounded-lg p-6 bg-white dark:bg-neutral-800">
      <div className="flex items-center gap-2 mb-6">
        <FileSearch className="w-5 h-5 text-primary-500" />
        <h3 className="text-lg font-semibold">文献检索</h3>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchType('search')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            searchType === 'search'
              ? 'bg-primary-container text-primary-main'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          关键词搜索
        </button>
        <button
          onClick={() => setSearchType('doi')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            searchType === 'doi'
              ? 'bg-primary-container text-primary-main'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          DOI检索
        </button>
        <button
          onClick={() => setSearchType('isbn')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            searchType === 'isbn'
              ? 'bg-primary-container text-primary-main'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          ISBN检索
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder={
            searchType === 'doi' ? '输入DOI号，如 10.1000/xyz123' :
            searchType === 'isbn' ? '输入ISBN号，如 978-3-16-148410-0' :
            '输入关键词搜索文献'
          }
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={(e: any) => e.key === 'Enter' && handleSearch()}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? '检索中...' : '检索'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-error-50 text-error-600 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
        <p className="text-sm text-neutral-500 mb-3">快速检索示例：</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickSearch('doi', '10.1038/s41586-023-06164-9')}
            className="px-3 py-1.5 text-xs bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-900/30"
          >
            DOI: 10.1038/s41586-023-06164-9
          </button>
          <button
            onClick={() => handleQuickSearch('isbn', '9787030720378')}
            className="px-3 py-1.5 text-xs bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 rounded-lg hover:bg-success-100 dark:hover:bg-success-900/30"
          >
            ISBN: 9787030720378
          </button>
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
        <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">检索说明</h4>
        <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
          <li>• DOI检索：输入完整DOI号，自动获取文献元数据</li>
          <li>• ISBN检索：输入ISBN号，获取书籍信息</li>
          <li>• 关键词搜索：在本地文献库中搜索标题、作者、期刊等</li>
        </ul>
      </div>
    </div>
  );
}
