/**
 * 文档编辑器组件 - 支持富文本编辑和格式化工具，包含图表管理
 */
import React, { useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Table,
  Link,
  Image as ImageIcon,
  Code,
  BarChart3,
} from 'lucide-react';
import type { Chapter, Figure, Table as TableType } from '@/types/academicReport';

interface DocumentEditorProps {
  chapter: Chapter | null;
  onUpdate: (chapter: Chapter) => void;
}

export function DocumentEditor({ chapter, onUpdate }: DocumentEditorProps) {
  const [content, setContent] = useState('');
  const [showFigureModal, setShowFigureModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [figureCounter, setFigureCounter] = useState(1);
  const [tableCounter, setTableCounter] = useState(1);

  useEffect(() => {
    if (chapter) {
      setContent(chapter.content);
      // 计算当前章节的图表编号
      const figCount = chapter.figures?.length || 0;
      const tblCount = chapter.tables?.length || 0;
      setFigureCounter(figCount + 1);
      setTableCounter(tblCount + 1);
    }
  }, [chapter]);

  const handleContentChange = (e: React.ChangeEvent<any>) => {
    setContent(e.target.value);
  };

  const handleBlur = () => {
    if (chapter && content !== chapter.content) {
      onUpdate({ ...chapter, content });
    }
  };

  const handleFormatClick = (format: string) => {
    let newContent = content;
    const textarea = document.querySelector('.document-editor-textarea') as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;
    const selectedText = content.substring(start, end);

    switch (format) {
      case 'bold':
        newContent = content.substring(0, start) + `**${selectedText || '粗体文本'}**` + content.substring(end);
        break;
      case 'italic':
        newContent = content.substring(0, start) + `*${selectedText || '斜体文本'}*` + content.substring(end);
        break;
      case 'underline':
        newContent = content.substring(0, start) + `__${selectedText || '下划线文本'}__` + content.substring(end);
        break;
      case 'strikethrough':
        newContent = content.substring(0, start) + `~~${selectedText || '删除线文本'}~~` + content.substring(end);
        break;
      case 'heading1':
        newContent = content.substring(0, start) + `\n# ${selectedText || '一级标题'}\n` + content.substring(end);
        break;
      case 'heading2':
        newContent = content.substring(0, start) + `\n## ${selectedText || '二级标题'}\n` + content.substring(end);
        break;
      case 'heading3':
        newContent = content.substring(0, start) + `\n### ${selectedText || '三级标题'}\n` + content.substring(end);
        break;
      case 'heading4':
        newContent = content.substring(0, start) + `\n#### ${selectedText || '四级标题'}\n` + content.substring(end);
        break;
      case 'bullet-list':
        newContent = content.substring(0, start) + `\n- ${selectedText || '列表项'}\n- ` + content.substring(end);
        break;
      case 'numbered-list':
        newContent = content.substring(0, start) + `\n1. ${selectedText || '列表项'}\n2. ` + content.substring(end);
        break;
      case 'quote':
        newContent = content.substring(0, start) + `\n> ${selectedText || '引用文本'}\n` + content.substring(end);
        break;
      case 'code':
        newContent = content.substring(0, start) + `\`${selectedText || '代码'}\`` + content.substring(end);
        break;
      case 'link':
        const url = prompt('请输入链接地址:', 'https://');
        if (url) {
          newContent = content.substring(0, start) + `[${selectedText || '链接文本'}](${url})` + content.substring(end);
        }
        break;
      case 'table':
        newContent =
          content.substring(0, start) +
          `\n| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n` +
          content.substring(end);
        break;
      case 'figure':
        setShowFigureModal(true);
        return;
      case 'chart':
        setShowTableModal(true);
        return;
    }

    setContent(newContent);
    setTimeout(() => {
      textarea?.focus?.();
    }, 0);
  };

  // 处理插入图表
  const handleInsertFigure = (caption: string, source?: string) => {
    if (!chapter) return;

    const newFigure: Figure = {
      id: `fig-${Date.now()}`,
      number: `图${figureCounter}`,
      caption,
      source,
    };

    const updatedChapter: Chapter = {
      ...chapter,
      figures: [...(chapter.figures || []), newFigure],
      content:
        content +
        `\n\n![图${figureCounter}](${caption})\n**图${figureCounter}** ${caption}${source ? `（来源：${source}）` : ''}\n\n`,
    };

    onUpdate(updatedChapter);
    setFigureCounter((prev) => prev + 1);
    setShowFigureModal(false);
  };

  // 处理插入表格
  const handleInsertTable = (caption: string, rows: number, cols: number, source?: string) => {
    if (!chapter) return;

    const headers = Array.from({ length: cols }, (_, i) => `列${i + 1}`);
    const tableRows = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

    const newTable: TableType = {
      id: `table-${Date.now()}`,
      number: `表${tableCounter}`,
      caption,
      source,
      headers,
      rows: tableRows.map((r) => r.map(() => '')),
    };

    // 生成Markdown表格
    let tableMarkdown = `\n\n**表${tableCounter}** ${caption}${source ? `（来源：${source}）` : ''}\n\n`;
    tableMarkdown += `| ${headers.join(' | ')} |\n`;
    tableMarkdown += `| ${Array(cols).fill('---').join(' | ')} |\n`;
    for (let i = 0; i < rows; i++) {
      tableMarkdown += `| ${Array(cols).fill('').join(' | ')} |\n`;
    }
    tableMarkdown += '\n';

    const updatedChapter: Chapter = {
      ...chapter,
      tables: [...(chapter.tables || []), newTable],
      content: content + tableMarkdown,
    };

    onUpdate(updatedChapter);
    setTableCounter((prev) => prev + 1);
    setShowTableModal(false);
  };

  const formatTools = [
    { icon: <Bold className="w-4 h-4" />, action: 'bold', label: '粗体' },
    { icon: <Italic className="w-4 h-4" />, action: 'italic', label: '斜体' },
    { icon: <Underline className="w-4 h-4" />, action: 'underline', label: '下划线' },
    { icon: <Strikethrough className="w-4 h-4" />, action: 'strikethrough', label: '删除线' },
  ];

  const headingTools = [
    { icon: <span className="text-xs font-bold">#</span>, action: 'heading1', label: 'H1' },
    { icon: <span className="text-xs font-bold">##</span>, action: 'heading2', label: 'H2' },
    { icon: <span className="text-xs font-bold">###</span>, action: 'heading3', label: 'H3' },
    { icon: <span className="text-xs font-bold">####</span>, action: 'heading4', label: 'H4' },
  ];

  const listTools = [
    { icon: <List className="w-4 h-4" />, action: 'bullet-list', label: '无序列表' },
    { icon: <ListOrdered className="w-4 h-4" />, action: 'numbered-list', label: '有序列表' },
    { icon: <Quote className="w-4 h-4" />, action: 'quote', label: '引用' },
    { icon: <Code className="w-4 h-4" />, action: 'code', label: '代码' },
  ];

  const insertTools = [
    { icon: <Link className="w-4 h-4" />, action: 'link', label: '链接' },
    { icon: <Table className="w-4 h-4" />, action: 'table', label: '表格' },
    { icon: <ImageIcon className="w-4 h-4" />, action: 'figure', label: '图表' },
    { icon: <BarChart3 className="w-4 h-4" />, action: 'chart', label: '统计图' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800">
        {/* 格式化工具 */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-neutral-300 dark:border-neutral-600">
          {formatTools.map((tool) => (
            <button
              key={tool.action}
              onClick={() => handleFormatClick(tool.action)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* 标题工具 */}
        <div className="flex items-center gap-0.5 px-2 border-r border-neutral-300 dark:border-neutral-600">
          {headingTools.map((tool) => (
            <button
              key={tool.action}
              onClick={() => handleFormatClick(tool.action)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* 列表工具 */}
        <div className="flex items-center gap-0.5 px-2 border-r border-neutral-300 dark:border-neutral-600">
          {listTools.map((tool) => (
            <button
              key={tool.action}
              onClick={() => handleFormatClick(tool.action)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* 插入工具 */}
        <div className="flex items-center gap-0.5 pl-2">
          {insertTools.map((tool) => (
            <button
              key={tool.action}
              onClick={() => handleFormatClick(tool.action)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">Markdown 语法支持</div>
      </div>

      {/* 编辑区域 */}
      <div className="flex-1 overflow-hidden">
        {chapter ? (
          <textarea
            className="document-editor-textarea w-full h-full p-4 border-none outline-none resize-none bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono text-sm leading-relaxed"
            placeholder="请输入章节内容...支持Markdown语法..."
            value={content}
            onChange={handleContentChange}
            onBlur={handleBlur}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📝</div>
              <p>请从左侧选择一个章节进行编辑</p>
            </div>
          </div>
        )}
      </div>

      {/* 图表插入弹窗 */}
      {showFigureModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowFigureModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">插入图表</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">图表标题</label>
                <input
                  type="text"
                  placeholder="请输入图表标题"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">来源（可选）</label>
                <input
                  type="text"
                  placeholder="请输入数据来源"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFigureModal(false)}
                  className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleInsertFigure('图表标题', '')}
                  className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  插入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表格插入弹窗 */}
      {showTableModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowTableModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">插入表格</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">表格标题</label>
                <input
                  type="text"
                  placeholder="请输入表格标题"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">行数</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    defaultValue="3"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">列数</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="3"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">来源（可选）</label>
                <input
                  type="text"
                  placeholder="请输入数据来源"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTableModal(false)}
                  className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleInsertTable('表格标题', 3, 3, '')}
                  className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  插入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
