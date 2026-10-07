import { useState } from 'react';
import { useReferenceStore } from '@/stores/referenceStore';
import { Search, Plus, X, BookOpen, Globe, Calendar, User, Clipboard, Download, ChevronDown } from 'lucide-react';
import type { ReferenceType } from '@/types/academic-report';
import { cn } from '@/lib/utils';

const typeLabels: Record<ReferenceType, string> = {
  article: '期刊文章',
  book: '书籍',
  conference: '会议论文',
  thesis: '学位论文',
  website: '网页',
  patent: '专利',
};

const typeColors: Record<ReferenceType, string> = {
  article: 'bg-secondary-100 text-secondary-700',
  book: 'bg-success-100 text-success-700',
  conference: 'bg-pink-100 text-pink-700',
  thesis: 'bg-indigo-100 text-indigo-700',
  website: 'bg-orange-100 text-orange-700',
  patent: 'bg-warning-100 text-warning-700',
};

export function ReferenceLibrary() {
  const { searchQuery, filteredReferences, addReference, deleteReference } = useReferenceStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [newReference, setNewReference] = useState({
    title: '',
    authors: '',
    year: '',
    journal: '',
    volume: '',
    pages: '',
    doi: '',
    type: 'article' as ReferenceType,
  });

  const handleAddReference = () => {
    if (!newReference.title || !newReference.authors) {
      alert('请填写标题和作者');
      return;
    }

    addReference({
      title: newReference.title,
      authors: newReference.authors.split(',').map(a => a.trim()),
      year: Number(newReference.year),
      journal: newReference.journal || undefined,
      volume: newReference.volume || undefined,
      pages: newReference.pages || undefined,
      doi: newReference.doi || undefined,
      type: newReference.type,
    });

    setNewReference({
      title: '',
      authors: '',
      year: '',
      journal: '',
      volume: '',
      pages: '',
      doi: '',
      type: 'article',
    });
    setShowAddForm(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredReferences().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReferences().map(ref => ref.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchInsert = () => {
    if (selectedIds.size > 0) {
      const selectedRefs = filteredReferences().filter(ref => selectedIds.has(ref.id));
      const citationText = selectedRefs.map((ref, i) =>
        `[${i + 1}] ${ref.authors.join(', ')} (${ref.year}). ${ref.title}.`,
      ).join('\n');
      navigator.clipboard.writeText(citationText);
      setSelectedIds(new Set());
    }
  };

  const handleBatchExport = () => {
    if (selectedIds.size > 0) {
      const selectedRefs = filteredReferences().filter(ref => selectedIds.has(ref.id));
      const content = selectedRefs.map((ref, i) =>
        `${i + 1}. ${ref.authors.join(', ')} (${ref.year}). ${ref.title}. ${ref.journal || ''}${ref.volume ? `, ${ref.volume}` : ''}${ref.pages ? `, pp. ${ref.pages}` : ''}.`,
      ).join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'references.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSelectedIds(new Set());
    }
  };

  const displayedReferences = filteredReferences();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="搜索文献..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => useReferenceStore.getState().searchReferences(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            添加文献
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              筛选
              <ChevronDown className="w-4 h-4" />
            </button>
            {showTypeDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                <button
                  onClick={() => {
                    useReferenceStore.getState().setTypeFilter('all');
                    setShowTypeDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                >
                  全部类型
                </button>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      useReferenceStore.getState().setTypeFilter(value as ReferenceType);
                      setShowTypeDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-primary dark:text-primary-300">
            已选择 {selectedIds.size} 项
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBatchInsert}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Clipboard className="w-3 h-3" />
              复制到剪贴板
            </button>
            <button
              onClick={handleBatchExport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 text-primary border border-primary rounded-lg hover:bg-primary-50"
            >
              <Download className="w-3 h-3" />
              导出
            </button>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="border rounded-lg p-4 bg-white dark:bg-neutral-800">
            <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">添加新文献</h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-neutral-100 dark:bg-neutral-800 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">标题</label>
              <input
                type="text"
                value={newReference.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, title: e.target.value }))}
                placeholder="输入文献标题"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">作者（逗号分隔）</label>
              <input
                type="text"
                value={newReference.authors}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, authors: e.target.value }))}
                placeholder="作者1, 作者2, 作者3"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">年份</label>
              <input
                type="number"
                value={newReference.year}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, year: e.target.value }))}
                placeholder="2024"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">期刊名称</label>
              <input
                type="text"
                value={newReference.journal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, journal: e.target.value }))}
                placeholder="期刊名称"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">卷号</label>
              <input
                type="text"
                value={newReference.volume}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, volume: e.target.value }))}
                placeholder="卷号"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">页码</label>
              <input
                type="text"
                value={newReference.pages}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, pages: e.target.value }))}
                placeholder="123-145"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">DOI</label>
              <input
                type="text"
                value={newReference.doi}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewReference(prev => ({ ...prev, doi: e.target.value }))}
                placeholder="10.1000/xyz123"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">类型</label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                value={newReference.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewReference(prev => ({ ...prev, type: e.target.value as ReferenceType }))}
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              取消
            </button>
            <button
              onClick={handleAddReference}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              添加
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-2 py-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg">
        <input
          type="checkbox"
          checked={selectedIds.size === displayedReferences.length && displayedReferences.length > 0}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
        />
        <span className="text-sm text-neutral-600 dark:text-neutral-400">全选</span>
        <span className="text-sm text-neutral-400 dark:text-neutral-500 ml-auto">
          共 {displayedReferences.length} 条文献
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedReferences.map((ref) => (
          <div
            key={ref.id}
            className={cn(
              'border rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-neutral-800',
              selectedIds.has(ref.id) ? 'border-primary ring-1 ring-primary/20' : '',
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(ref.id)}
                onChange={() => handleToggleSelect(ref.id)}
                className="mt-1 w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <span className={cn('px-2 py-1 text-xs rounded', typeColors[ref.type as ReferenceType] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700')}>
                    {typeLabels[ref.type as ReferenceType] || ref.type}
                  </span>
                  <button
                    onClick={() => deleteReference(ref.id)}
                    className="p-1 hover:bg-error-50 rounded text-neutral-400 hover:text-error-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1 line-clamp-2">{ref.title}</h3>
                <div className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                  <User className="w-3 h-3" />
                  <span className="line-clamp-1">{ref.authors.join('、')}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-neutral-400">
                  {ref.year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {ref.year}
                    </span>
                  )}
                  {ref.journal && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {ref.journal}
                    </span>
                  )}
                  {ref.volume && (
                    <span>卷 {ref.volume}</span>
                  )}
                  {ref.pages && (
                    <span>页 {ref.pages}</span>
                  )}
                  {ref.doi && (
                    <span className="flex items-center gap-1 text-primary-500">
                      <Globe className="w-3 h-3" />
                      DOI
                    </span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {`${ref.authors.join(', ')} (${ref.year}). ${ref.title}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {displayedReferences.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
          <p className="text-neutral-400">暂无文献</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            添加第一篇文献
          </button>
        </div>
      )}
    </div>
  );
}
