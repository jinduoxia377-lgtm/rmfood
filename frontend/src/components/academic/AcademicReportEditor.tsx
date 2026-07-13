import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, BookOpen, GraduationCap, ClipboardList, Settings, LayoutDashboard,
  Menu, X, Download, Save, Eye, Edit3, BookMarked, FileCode, FileText as FileTextIcon, Printer,
  Upload, CheckSquare, Square, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChapterTree } from './ChapterTree';
import { DocumentEditor } from './DocumentEditor';
import { CitationPanel } from './CitationPanel';
import { DocumentPreview } from './DocumentPreview';
import { DocumentImport } from './editor/DocumentImport';
import { BatchOperations } from './editor/BatchOperations';
import { SaveStatusIndicator, AutoSaveIndicator } from './editor/SaveStatusIndicator';
import { createNewDocument } from '@/data/reportTemplates';
import { AcademicExportService } from '@/services/academicExportService';
import { useAcademicReportStore } from '@/stores/academicReportStore';
import { useToastStore } from '@/stores/toastStore';
import type { ReportDocument, Chapter, Citation, ReportType, CitationStyle } from '@/types/academicReport';
import { ReportTypeConfig } from '@/types/academicReport';
import { logger } from '@/utils/safeLogger';


export function AcademicReportEditor() {
  const [reportDoc, setReportDoc] = useState<ReportDocument | null>(() => createNewDocument('research'));
  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>();
  const [activePanel, setActivePanel] = useState<'chapters' | 'editor' | 'preview'>('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showNewDocMenu, setShowNewDocMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    saveStatus,
    lastSavedAt,
    error,
    saveReport,
    autoSaveEnabled,
    autoSaveInterval,
    enableAutoSave,
    disableAutoSave,
    importChapters,
    batchDeleteChapters,
    batchMoveChapters,
  } = useAcademicReportStore();
  const { addToast } = useToastStore();

  const autoSaveTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoSaveEnabled && autoSaveTimerRef.current) {
      autoSaveTimerRef.current = setInterval(() => {
        if (reportDoc) {
          saveReport();
        }
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, autoSaveInterval, reportDoc, saveReport]);

  const getExportService = () => {
    if (!reportDoc) return null;
    // reportDoc is of type ReportDocument — AcademicExportService accepts any report-like object
return new AcademicExportService(reportDoc as any);
  };

  const selectedChapter = reportDoc?.chapters.find(chapter => chapter.id === selectedChapterId);

  const handleUpdateChapter = useCallback((updatedChapter: Chapter) => {
    if (!reportDoc) return;

    const updateChapterRecursively = (chapters: Chapter[]): Chapter[] => {
      return chapters.map(chapter => {
        if (chapter.id === updatedChapter.id) {
          return updatedChapter;
        }
        if (chapter.children) {
          return { ...chapter, children: updateChapterRecursively(chapter.children) };
        }
        return chapter;
      });
    };

    setReportDoc({
      ...reportDoc,
      chapters: updateChapterRecursively(reportDoc.chapters),
      updatedAt: new Date().toISOString(),
    });
  }, [reportDoc]);

  const handleUpdateChapters = useCallback((chapters: Chapter[]) => {
    if (!reportDoc) return;
    setReportDoc({
      ...reportDoc,
      chapters,
      updatedAt: new Date().toISOString(),
    });
  }, [reportDoc]);

  const handleUpdateCitations = useCallback((citations: Citation[]) => {
    if (!reportDoc) return;
    setReportDoc({
      ...reportDoc,
      citations,
      updatedAt: new Date().toISOString(),
    });
  }, [reportDoc]);

  const handleUpdateCitationStyle = useCallback((style: CitationStyle) => {
    if (!reportDoc) return;
    setReportDoc({
      ...reportDoc,
      citationStyle: style,
      updatedAt: new Date().toISOString(),
    });
  }, [reportDoc]);

  const handleNewDocument = useCallback((type: ReportType) => {
    const newDoc = createNewDocument(type);
    setReportDoc(newDoc);
    setSelectedChapterId(undefined);
    setShowNewDocMenu(false);
    addToast({
      type: 'success',
      title: '文档已创建',
      message: `已创建新的 ${ReportTypeConfig[type].label}`,
    });
  }, [addToast]);

  const handleExport = async (format: 'html' | 'docx' | 'pdf') => {
    if (!reportDoc || isExporting) return;

    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const service = getExportService();
      if (!service) return;

      const exportFormat = format === 'docx' ? 'word' : format;
      const result = await service.export({
        format: exportFormat,
        citationStyle: reportDoc.citationStyle,
        includeFigures: true,
        includeTables: true,
        includeReferences: true,
      });

      if (result.success && result.data) {
        const extension = format === 'html' ? 'html' : format === 'docx' ? 'docx' : 'pdf';
        const filename = `${reportDoc.title}.${extension}`;
        AcademicExportService.downloadBlob(result.data, filename);
        addToast({
          type: 'success',
          title: '导出成功',
          message: `文档已导出为 ${extension.toUpperCase()} 格式`,
        });
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      logger.error('Export failed:', error);
      addToast({
        type: 'error',
        title: '导出失败',
        message: error instanceof Error ? error.message : '请重试',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = useCallback(() => {
    if (!reportDoc) return;
    window.print();
  }, [reportDoc]);

  const handleImport = useCallback((chapters: Chapter[]) => {
    if (!reportDoc) {
      const newDoc = createNewDocument('research');
      newDoc.chapters = chapters;
      setReportDoc(newDoc);
    } else {
      const mergedChapters = [...reportDoc.chapters, ...chapters].map((ch, idx) => ({
        ...ch,
        order: idx + 1,
      }));
      setReportDoc({
        ...reportDoc,
        chapters: mergedChapters,
        updatedAt: new Date().toISOString(),
      });
    }
    importChapters(chapters);
    setShowImportDialog(false);
    addToast({
      type: 'success',
      title: '导入成功',
      message: `成功导入 ${chapters.length} 个章节`,
    });
  }, [reportDoc, importChapters, addToast]);

  const handleBatchDelete = useCallback((ids: string[]) => {
    if (!reportDoc) return;

    const idSet = new Set(ids);
    const filterChapters = (chapters: Chapter[]): Chapter[] => {
      return chapters
        .filter(ch => !idSet.has(ch.id))
        .map(ch => ({
          ...ch,
          children: ch.children ? filterChapters(ch.children) : [],
        }));
    };

    const updatedChapters = filterChapters(reportDoc.chapters);
    setReportDoc({
      ...reportDoc,
      chapters: updatedChapters,
      updatedAt: new Date().toISOString(),
    });
    batchDeleteChapters(ids);
    setSelectedIds(new Set());
    setBatchMode(false);
  }, [reportDoc, batchDeleteChapters]);

  const handleBatchMove = useCallback((ids: string[], targetId: string | null) => {
    if (!reportDoc) return;

    const idSet = new Set(ids);
    const movedChapters: Chapter[] = [];

    const categorizeChapters = (chapters: Chapter[]): Chapter[] => {
      return chapters.filter(ch => {
        if (idSet.has(ch.id)) {
          movedChapters.push(ch);
          return false;
        }
        return true;
      }).map(ch => ({
        ...ch,
        children: ch.children ? categorizeChapters(ch.children) : [],
      }));
    };

    const filtered = categorizeChapters(reportDoc.chapters);

    let updatedChapters: Chapter[];
    if (targetId === null) {
      updatedChapters = [...filtered, ...movedChapters].map((ch, idx) => ({
        ...ch,
        order: idx + 1,
      }));
    } else {
      const addToTarget = (chapters: Chapter[]): Chapter[] => {
        return chapters.map(ch => {
          if (ch.id === targetId) {
            return {
              ...ch,
              children: [...(ch.children || []), ...movedChapters],
            };
          }
          if (ch.children) {
            return {
              ...ch,
              children: addToTarget(ch.children),
            };
          }
          return ch;
        });
      };
      updatedChapters = addToTarget(filtered);
    }

    setReportDoc({
      ...reportDoc,
      chapters: updatedChapters,
      updatedAt: new Date().toISOString(),
    });
    batchMoveChapters(ids, targetId);
    setSelectedIds(new Set());
  }, [reportDoc, batchMoveChapters]);

  const handleBatchExport = useCallback((ids: string[]) => {
    if (!reportDoc) return;

    const idSet = new Set(ids);
    const selectedChapters: Chapter[] = [];

    const collectChapters = (chapters: Chapter[]) => {
      chapters.forEach(ch => {
        if (idSet.has(ch.id)) {
          selectedChapters.push(ch);
        }
        if (ch.children) {
          collectChapters(ch.children);
        }
      });
    };

    collectChapters(reportDoc.chapters);

    const exportContent = selectedChapters
      .map(ch => `# ${ch.title}\n\n${ch.content}`)
      .join('\n\n---\n\n');

    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exported_chapters_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: '导出成功',
      message: `已导出 ${ids.length} 个章节为 Markdown 格式`,
    });
  }, [reportDoc, addToast]);

  const handleManualSave = useCallback(async () => {
    const success = await saveReport();
    if (success) {
      addToast({
        type: 'success',
        title: '保存成功',
        message: '文档已保存到本地',
      });
    } else {
      addToast({
        type: 'error',
        title: '保存失败',
        message: '请重试保存操作',
      });
    }
  }, [saveReport, addToast]);

  const getReportTypeIcon = (type: ReportType) => {
    switch (type) {
      case 'journal': return <FileText className="w-5 h-5"/>;
      case 'thesis': return <GraduationCap className="w-5 h-5"/>;
      case 'research': return <ClipboardList className="w-5 h-5"/>;
      case 'review': return <BookOpen className="w-5 h-5"/>;
      case 'technical': return <Settings className="w-5 h-5"/>;
    }
  };

  const updateMetadata = useCallback((field: string, value: unknown) => {
    if (!reportDoc) return;
    setReportDoc({
      ...reportDoc,
      [field]: value,
      updatedAt: new Date().toISOString(),
    });
  }, [reportDoc]);

  if (!reportDoc) {
    return (<div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">📄</div>
        <p className="text-neutral-500">正在加载文档...</p>
      </div>
    </div>);
  }

  return (<div className="h-screen flex flex-col bg-neutral-100 dark:bg-neutral-900">
    {showImportDialog && (
      <DocumentImport
        onImport={handleImport}
        onClose={() => setShowImportDialog(false)}
      />
    )}

    {batchMode && (
      <BatchOperations
        chapters={reportDoc.chapters}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onBatchDelete={handleBatchDelete}
        onBatchMove={handleBatchMove}
        onBatchExport={handleBatchExport}
        onClose={() => {
          setBatchMode(false);
          setSelectedIds(new Set());
        }}
      />
    )}

    <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-primary"/>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">学术报告系统</span>
        </div>

        <input type="text" value={reportDoc.title} onChange={(e) => setReportDoc({ ...reportDoc, title: e.target.value })} className="px-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-700 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary max-w-xs"/>

        <SaveStatusIndicator
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          error={error}
          onRetry={handleManualSave}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
        >
          <Upload className="w-4 h-4"/>
          导入
        </button>

        <button
          onClick={() => setBatchMode(!batchMode)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors',
            batchMode
              ? 'bg-primary text-white'
              : 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600',
          )}
        >
          {batchMode ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
          批量选择
        </button>

        <div className="relative">
          <button onClick={() => setShowNewDocMenu(!showNewDocMenu)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
            <FileText className="w-4 h-4"/>
            新建
            <Menu className="w-4 h-4"/>
          </button>
          {showNewDocMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-2 w-48 z-50">
              {Object.entries(ReportTypeConfig).map(([key, config]) => (<button key={key} onClick={() => handleNewDocument(key as ReportType)} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
                {getReportTypeIcon(key as ReportType)}
                {config.label}
              </button>))}
            </div>
          )}
        </div>

        <button onClick={handleManualSave} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Save className="w-4 h-4"/>
          保存
        </button>

        <div className="relative">
          <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4"/>
            {isExporting ? '导出中...' : '导出'}
            <Menu className="w-4 h-4"/>
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-2 w-40 z-50">
              <button onClick={() => handleExport('html')} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
                <FileCode className="w-4 h-4"/>
                HTML格式
              </button>
              <button onClick={() => handleExport('docx')} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
                <FileTextIcon className="w-4 h-4"/>
                Word格式
              </button>
              <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2">
                <Printer className="w-4 h-4"/>
                PDF格式
              </button>
            </div>
          )}
        </div>

        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
          <Printer className="w-4 h-4"/>
          打印
        </button>
      </div>
    </header>

    <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-neutral-600 dark:text-neutral-400">作者：</label>
            <input type="text" value={reportDoc.authors?.join('，') || ''} onChange={(e) => updateMetadata('authors', e.target.value.split('，'))} placeholder="请输入作者姓名" className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-primary max-w-32"/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-neutral-600 dark:text-neutral-400">单位：</label>
            <input type="text" value={reportDoc.institution || ''} onChange={(e) => updateMetadata('institution', e.target.value)} placeholder="请输入单位名称" className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-primary max-w-40"/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-neutral-600 dark:text-neutral-400">日期：</label>
            <input type="date" value={reportDoc.date || ''} onChange={(e) => updateMetadata('date', e.target.value)} className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-primary"/>
          </div>
        </div>

        <AutoSaveIndicator
          enabled={autoSaveEnabled}
          interval={autoSaveInterval}
          onToggle={() => autoSaveEnabled ? disableAutoSave() : enableAutoSave()}
        />
      </div>
    </div>

    <div className="flex-1 flex overflow-hidden">
      <aside className={cn('flex flex-col border-r border-neutral-200 dark:border-neutral-700 transition-all duration-300', sidebarCollapsed ? 'w-16' : 'w-72')}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-700">
          {sidebarCollapsed ? <Menu className="w-5 h-5 mx-auto"/> : <X className="w-5 h-5 mx-auto"/>}
        </button>

        <nav className="flex-1 p-2 space-y-1">
          <button onClick={() => setActivePanel('chapters')} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', activePanel === 'chapters'
            ? 'bg-primary text-white'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800')}>
            <LayoutDashboard className="w-5 h-5"/>
            {!sidebarCollapsed && <span>章节结构</span>}
          </button>
          <button onClick={() => setActivePanel('editor')} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', activePanel === 'editor'
            ? 'bg-primary text-white'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800')}>
            <Edit3 className="w-5 h-5"/>
            {!sidebarCollapsed && <span>文档编辑</span>}
          </button>
          <button onClick={() => setActivePanel('preview')} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', activePanel === 'preview'
            ? 'bg-primary text-white'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800')}>
            <Eye className="w-5 h-5"/>
            {!sidebarCollapsed && <span>预览</span>}
          </button>
        </nav>

        {!sidebarCollapsed && (<div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
          <CitationPanel citations={reportDoc.citations} citationStyle={reportDoc.citationStyle} onUpdateCitations={handleUpdateCitations} onUpdateStyle={handleUpdateCitationStyle}/>
        </div>)}
      </aside>

      <main className="flex-1 flex overflow-hidden">
        {activePanel === 'chapters' && (<div className="w-72 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100">章节结构</h3>
              {!batchMode && (
                <button
                  onClick={() => setBatchMode(true)}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  title="批量选择模式"
                >
                  <Layers className="w-4 h-4 text-neutral-500" />
                </button>
              )}
            </div>
          </div>
          <ChapterTree
            chapters={reportDoc?.chapters || []}
            onUpdate={handleUpdateChapters}
            selectedChapterId={selectedChapterId}
            onSelect={setSelectedChapterId}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            showBatchToolbar={batchMode}
          />
        </div>)}

        <div className={cn('flex-1 flex flex-col overflow-hidden', activePanel === 'chapters' ? 'border-l border-neutral-200 dark:border-neutral-700' : '')}>
          {activePanel === 'editor' && (<DocumentEditor chapter={selectedChapter || null} onUpdate={handleUpdateChapter}/>)}
          {activePanel === 'preview' && (<DocumentPreview document={reportDoc}/>)}
          {activePanel === 'chapters' && (<div className="flex-1 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📝</div>
              <p>请从左侧选择章节进行编辑</p>
            </div>
          </div>)}
        </div>
      </main>
    </div>
  </div>);
}
