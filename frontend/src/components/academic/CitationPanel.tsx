/**
 * 引文管理面板组件
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, BookOpen, FileText, Clipboard, Download, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CitationService } from '@/services/citationService';
import type { Citation, CitationType, CitationStyle } from '@/types/academicReport';
import { CitationTypeConfig } from '@/types/academicReport';

const CITATION_STYLE_OPTIONS: Record<CitationStyle, { label: string; description: string }> = {
  gbt7714: { label: 'GB/T 7714', description: '中国国家标准' },
  apa: { label: 'APA 7th', description: '美国心理学会格式' },
  mla: { label: 'MLA 9th', description: '现代语言协会格式' },
  chicago: { label: 'Chicago 17th', description: '芝加哥格式' },
  harvard: { label: 'Harvard', description: '哈佛格式' },
  ieee: { label: 'IEEE', description: '电气电子工程师学会格式' },
};

const RECENT_STYLES_KEY = 'citation_recent_styles';
const MAX_RECENT_STYLES = 3;

interface CitationPanelProps {
  citations: Citation[];
  citationStyle: CitationStyle;
  onUpdateCitations: (citations: Citation[]) => void;
  onUpdateStyle: (style: CitationStyle) => void;
  onInsertCitations?: (citationIds: string[]) => void;
  onExportReferences?: (format: 'bibtex' | 'txt' | 'clipboard') => void;
}

export function CitationPanel({
  citations,
  citationStyle,
  onUpdateCitations,
  onUpdateStyle,
  onInsertCitations,
  onExportReferences,
}: CitationPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [bibtexContent, setBibtexContent] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [previewCitation, setPreviewCitation] = useState<Citation | null>(null);
  const [recentStyles, setRecentStyles] = useState<CitationStyle[]>([]);

  const service = useMemo(() => new CitationService(citations), [citations]);
  const references = useMemo(() => service.generateReferences(citationStyle), [service, citationStyle]);

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_STYLES_KEY);
    if (saved) {
      try {
        setRecentStyles(JSON.parse(saved));
      } catch {
        setRecentStyles([]);
      }
    }
  }, []);

  const filteredCitations = useMemo(() => {
    return citations.filter(citation => {
      const query = searchQuery.toLowerCase();
      return (
        citation.title.toLowerCase().includes(query) ||
        citation.authors.some(author => author.toLowerCase().includes(query)) ||
        citation.journal?.toLowerCase().includes(query)
      );
    });
  }, [citations, searchQuery]);

  const handleStyleChange = (style: CitationStyle) => {
    onUpdateStyle(style);
    setRecentStyles(prev => {
      const filtered = prev.filter(s => s !== style);
      const updated = [style, ...filtered].slice(0, MAX_RECENT_STYLES);
      localStorage.setItem(RECENT_STYLES_KEY, JSON.stringify(updated));
      return updated;
    });
    setShowStyleDropdown(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCitations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCitations.map(c => c.id)));
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
    if (selectedIds.size > 0 && onInsertCitations) {
      onInsertCitations(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBatchExport = (format: 'bibtex' | 'txt' | 'clipboard') => {
    if (onExportReferences) {
      onExportReferences(format);
    } else {
      const selectedRefs = format === 'bibtex'
        ? service.exportBibTeX()
        : references.filter((_, i) => selectedIds.has(citations[i]?.id ?? '')).join('\n\n');

      if (format === 'clipboard') {
        navigator.clipboard.writeText(selectedRefs);
      } else {
        const blob = new Blob([selectedRefs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'bibtex' ? 'references.bib' : 'references.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
    setSelectedIds(new Set());
  };

  const handleAddCitation = (data: Omit<Citation, 'id'>) => {
    service.addCitation(data);
    onUpdateCitations(service.getCitations());
    setShowAddModal(false);
  };

  const handleUpdateCitation = (id: string, updates: Partial<Omit<Citation, 'id'>>) => {
    service.updateCitation(id, updates);
    onUpdateCitations(service.getCitations());
    setSelectedCitation(null);
  };

  const handleDeleteCitation = (id: string) => {
    service.deleteCitation(id);
    onUpdateCitations(service.getCitations());
    if (selectedCitation?.id === id) {
      setSelectedCitation(null);
    }
  };

  const handleImportBibTeX = () => {
    if (bibtexContent.trim()) {
      service.importBibTeX(bibtexContent);
      onUpdateCitations(service.getCitations());
      setBibtexContent('');
      setShowImportModal(false);
    }
  };

  const handleExportBibTeX = () => {
    const content = service.exportBibTeX();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'references.bib';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewRef = previewCitation ? service.generateReferences(citationStyle).find(r =>
    r.includes(previewCitation.title),
  ) : null;

  return (<div className="flex flex-col h-full">
    {/* 工具栏 */}
    <div className="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-neutral-700">
      <div className="flex-1 relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"/>
<input aria-label="搜索引文..." type="text" placeholder="搜索引文..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"/>
      </div>
      <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
        <Plus className="w-4 h-4"/>
        添加
      </button>
      <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
        <FileText className="w-4 h-4"/>
        导入
      </button>
    </div>

    {/* 引用格式选择 */}
    <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">引用格式:</span>
        <div className="relative">
          <button
            onClick={() => setShowStyleDropdown(!showStyleDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            {CITATION_STYLE_OPTIONS[citationStyle].label}
            <ChevronDown className="w-3 h-3"/>
          </button>
          {showStyleDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-[200px]">
              {Object.entries(CITATION_STYLE_OPTIONS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleStyleChange(key as CitationStyle)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors',
                    citationStyle === key ? 'bg-primary-50 dark:bg-primary-300/20 text-primary' : 'text-neutral-700 dark:text-neutral-300',
                  )}
                >
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{config.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {recentStyles.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <Clock className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"/>
            <div className="flex gap-1">
              {recentStyles.filter(s => s !== citationStyle).slice(0, 2).map(style => (
                <button
                  key={style}
                  onClick={() => handleStyleChange(style)}
                  className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  {CITATION_STYLE_OPTIONS[style].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 批量操作栏 */}
    {selectedIds.size > 0 && (
      <div className="px-3 py-2 bg-primary-50 dark:bg-primary-300/20 border-b border-primary-200 dark:border-primary-800 flex items-center justify-between">
        <span className="text-sm text-primary dark:text-primary-700">
          已选择 {selectedIds.size} 项
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleBatchInsert}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Clipboard className="w-3 h-3"/>
            插入文档
          </button>
          <button
            onClick={() => handleBatchExport('bibtex')}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-white dark:bg-neutral-800 text-primary border border-primary rounded-lg hover:bg-primary-50"
          >
            <Download className="w-3 h-3"/>
            导出BibTeX
          </button>
          <button
            onClick={() => handleBatchExport('txt')}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-white dark:bg-neutral-800 text-primary border border-primary rounded-lg hover:bg-primary-50"
          >
            <Download className="w-3 h-3"/>
            导出TXT
          </button>
        </div>
      </div>
    )}

    {/* 引文列表 */}
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {filteredCitations.length === 0 ? (<div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50"/>
        <p>暂无引文</p>
        <button onClick={() => setShowAddModal(true)} className="mt-2 text-sm text-primary hover:underline">
          添加引文
        </button>
      </div>) : (
        <>
          <div className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredCitations.length && filteredCitations.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary focus:ring-primary"
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">全选</span>
          </div>
          {filteredCitations.map((citation, index) => (
            <div
              key={citation.id}
              className={cn(
                'p-3 rounded-lg border cursor-pointer transition-colors',
                selectedCitation?.id === citation.id
                  ? 'border-primary bg-primary-50 dark:bg-primary-300/20'
                  : selectedIds.has(citation.id)
                    ? 'border-primary/50 bg-primary-50/50 dark:bg-primary-300/15'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
              )}
               role="button" tabIndex={0} onClick={() => setSelectedCitation(citation)}
              onMouseEnter={() => setPreviewCitation(citation)}
              onMouseLeave={() => setPreviewCitation(null)}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(citation.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(citation.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary focus:ring-primary"
                />
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {citation.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {citation.authors.join(', ')}
                    {citation.year && ` (${citation.year})`}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCitation(citation.id); }}
                  className="p-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors"
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>

    {/* 参考文献预览 */}
    <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">参考文献预览</span>
          {previewCitation && previewRef && (
            <span className="text-xs text-primary">格式预览</span>
          )}
        </div>
        <button onClick={handleExportBibTeX} className="text-xs text-primary hover:underline">
          导出BibTeX
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {references.map((ref, index) => (
          <div key={index} className={cn(
            'pl-3 border-l-2 py-1 transition-colors',
            previewCitation && ref.includes(previewCitation.title)
              ? 'border-primary bg-primary-50/50 dark:bg-primary-300/20'
              : 'border-neutral-300 dark:border-neutral-600',
          )}>
            {ref}
          </div>
        ))}
        {references.length === 0 && (<p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">添加引文后将在此显示参考文献列表</p>)}
      </div>
    </div>

    {/* 添加引文弹窗 */}
    {showAddModal && (<CitationForm onSubmit={handleAddCitation} onClose={() => setShowAddModal(false)}/>)}

    {/* 导入BibTeX弹窗 */}
    {showImportModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">导入BibTeX</h3>
          <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <textarea value={bibtexContent} onChange={(e) => setBibtexContent(e.target.value)} placeholder="粘贴BibTeX内容..." className="w-full h-48 p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"/>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setShowImportModal(false)} className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
            取消
          </button>
          <button onClick={handleImportBibTeX} className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            导入
          </button>
        </div>
      </div>
    </div>)}

    {/* 编辑引文弹窗 */}
    {selectedCitation && (<CitationForm citation={selectedCitation} onSubmit={(data) => handleUpdateCitation(selectedCitation.id, data)} onClose={() => setSelectedCitation(null)}/>)}
  </div>);
}

interface CitationFormProps {
  citation?: Citation;
  onSubmit: (data: Omit<Citation, 'id'>) => void;
  onClose: () => void;
}

function CitationForm({ citation, onSubmit, onClose }: CitationFormProps) {
  const [formData, setFormData] = useState({
    type: (citation?.type || 'journal-article'),
    authors: citation?.authors || [],
    title: citation?.title || '',
    journal: citation?.journal || '',
    year: citation?.year || new Date().getFullYear(),
    volume: citation?.volume || '',
    pages: citation?.pages || '',
    doi: citation?.doi || '',
    isbn: citation?.isbn || '',
    publisher: citation?.publisher || '',
    url: citation?.url || '',
    accessedDate: citation?.accessedDate || '',
  });

  const [newAuthor, setNewAuthor] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    if (!formData.title.trim()) {
      newErrors.push('标题不能为空');
    }
    if (formData.authors.length === 0) {
      newErrors.push('作者不能为空');
    }
    if (!formData.year || isNaN(formData.year)) {
      newErrors.push('年份无效');
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    onSubmit(formData);
  };

  const addAuthor = () => {
    if (newAuthor.trim()) {
      setFormData({ ...formData, authors: [...formData.authors, newAuthor.trim()] });
      setNewAuthor('');
    }
  };

  const removeAuthor = (index: number) => {
    setFormData({ ...formData, authors: formData.authors.filter((_, i) => i !== index) });
  };

  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {citation ? '编辑引文' : '添加引文'}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded">
          <X className="w-5 h-5"/>
        </button>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 rounded-lg">
          <div className="flex items-center gap-2 text-error-600 dark:text-error-600 mb-2">
            <AlertCircle className="w-4 h-4"/>
            <span className="text-sm font-medium">请修正以下错误</span>
          </div>
          <ul className="text-xs text-error-500 dark:text-error-600 space-y-1">
            {errors.map((err, i) => <li key={i}>• {err}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            文献类型
          </label>
          <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as CitationType })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            {Object.entries(CitationTypeConfig).map(([key, config]) => (<option key={key} value={key}>
              {config.label}
            </option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            标题 <span className="text-error-500">*</span>
          </label>
<input aria-label="请输入文献标题" type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="请输入文献标题"/>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            作者 <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-2 mb-2">
<input aria-label="输入作者姓名后回车添加" type="text" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())} className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="输入作者姓名后回车添加"/>
            <button type="button" onClick={addAuthor} className="px-3 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
              <Plus className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.authors.map((author, index) => (<span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-300/35 text-primary rounded-full text-sm">
              {author}
              <button type="button" onClick={() => removeAuthor(index)} className="hover:text-error-500">
                <X className="w-3 h-3"/>
              </button>
            </span>))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {formData.type === 'journal-article' ? '期刊名称' : formData.type === 'conference-proceeding' ? '会议名称' : formData.type === 'book' || formData.type === 'book-chapter' ? '出版社' : formData.type === 'thesis' ? '学校/机构' : '来源'}
          </label>
<input aria-label="请输入期刊/会议/出版社名称" type="text" value={formData.journal} onChange={(e) => setFormData({ ...formData, journal: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="请输入期刊/会议/出版社名称"/>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            年份
          </label>
<input aria-label="年份" type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="年份"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              卷号
            </label>
<input aria-label="卷号" type="text" value={formData.volume} onChange={(e) => setFormData({ ...formData, volume: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="卷号"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              页码
            </label>
<input aria-label="起始-结束" type="text" value={formData.pages} onChange={(e) => setFormData({ ...formData, pages: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="起始-结束"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              DOI
            </label>
<input aria-label="DOI编号" type="text" value={formData.doi} onChange={(e) => setFormData({ ...formData, doi: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="DOI编号"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              ISBN
            </label>
<input aria-label="ISBN编号" type="text" value={formData.isbn} onChange={(e) => setFormData({ ...formData, isbn: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="ISBN编号"/>
          </div>
        </div>

        {formData.type === 'web-page' && (<>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              URL
            </label>
<input aria-label="网页链接" type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="网页链接"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              访问日期
            </label>
            <input type="date" value={formData.accessedDate} onChange={(e) => setFormData({ ...formData, accessedDate: e.target.value })} className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="访问日期"
      />
          </div>
        </>)}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
            取消
          </button>
          <button type="submit" className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            {citation ? '保存' : '添加'}
          </button>
        </div>
      </form>
    </div>
  </div>);
}
