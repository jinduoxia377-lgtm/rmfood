import { useState, useCallback, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Quote, Link2, Code, Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Undo, Redo } from 'lucide-react';
import { useAcademicReportStore } from '@/stores/academicReportStore';

interface EditorState {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

export function AcademicEditor() {
  const { currentReport, updateContent } = useAcademicReportStore();
  const [editorState, setEditorState] = useState<EditorState>({
    content: currentReport?.abstract || '',
    selectionStart: 0,
    selectionEnd: 0,
  });

  useEffect(() => {
    if (currentReport) {
      setEditorState(prev => ({ ...prev, content: currentReport.abstract || '' }));
    }
  }, [currentReport]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorState(prev => ({
      ...prev,
      content: e.target.value,
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (currentReport) {
      updateContent(editorState.content);
    }
  }, [currentReport, editorState.content, updateContent]);

  const insertFormatting = useCallback((prefix: string, suffix = '') => {
    const { content, selectionStart, selectionEnd } = editorState;
    const selectedText = content.substring(selectionStart, selectionEnd);

    const newContent = content.substring(0, selectionStart) +
                      prefix + selectedText + suffix +
                      content.substring(selectionEnd);

    setEditorState(prev => ({
      ...prev,
      content: newContent,
      selectionStart: selectionStart + prefix.length,
      selectionEnd: selectionEnd + prefix.length,
    }));
  }, [editorState]);

  const toolbarButtons = [
    { icon: <Heading1 className="w-4 h-4" />, action: () => insertFormatting('# '), title: '一级标题' },
    { icon: <Heading2 className="w-4 h-4" />, action: () => insertFormatting('## '), title: '二级标题' },
    { icon: <Heading3 className="w-4 h-4" />, action: () => insertFormatting('### '), title: '三级标题' },
    { type: 'divider' },
    { icon: <Bold className="w-4 h-4" />, action: () => insertFormatting('**', '**'), title: '粗体' },
    { icon: <Italic className="w-4 h-4" />, action: () => insertFormatting('*', '*'), title: '斜体' },
    { icon: <Underline className="w-4 h-4" />, action: () => insertFormatting('<u>', '</u>'), title: '下划线' },
    { type: 'divider' },
    { icon: <List className="w-4 h-4" />, action: () => insertFormatting('- '), title: '无序列表' },
    { icon: <ListOrdered className="w-4 h-4" />, action: () => insertFormatting('1. '), title: '有序列表' },
    { icon: <Quote className="w-4 h-4" />, action: () => insertFormatting('> '), title: '引用' },
    { type: 'divider' },
    { icon: <Code className="w-4 h-4" />, action: () => insertFormatting('`', '`'), title: '行内代码' },
    { icon: <Link2 className="w-4 h-4" />, action: () => insertFormatting('[', '](url)'), title: '链接' },
    { type: 'divider' },
    { icon: <AlignLeft className="w-4 h-4" />, action: () => {}, title: '左对齐' },
    { icon: <AlignCenter className="w-4 h-4" />, action: () => {}, title: '居中' },
    { icon: <AlignRight className="w-4 h-4" />, action: () => {}, title: '右对齐' },
  ];

  const wordCount = editorState.content.length;
  const charCount = editorState.content.replace(/\s/g, '').length;

  return (
    <div className="h-full flex flex-col border rounded-lg bg-white dark:bg-neutral-800">
      <div className="flex items-center gap-1 p-2 border-b border-neutral-200 dark:border-neutral-700 flex-wrap">
        {toolbarButtons.map((btn, index) => (
          btn.type === 'divider' ? (
            <div key={index} className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1" />
          ) : (
            <button
              key={index}
              onClick={btn.action}
              title={btn.title}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              {btn.icon}
            </button>
          )
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span>{wordCount} 字</span>
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
          <span>{charCount} 字符</span>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <textarea
          value={editorState.content}
          onChange={handleContentChange}
          className="w-full h-full min-h-[400px] resize-none border-none outline-none bg-transparent text-neutral-900 dark:text-neutral-100 font-mono text-sm"
          placeholder="开始编写您的学术报告...

支持 Markdown 格式：
- 使用 # 标题
- 使用 **粗体** 和 *斜体*
- 使用 - 或 1. 创建列表
- 使用 > 创建引用"
          style={{ tabSize: 2 }}
        />
      </div>

      <div className="flex items-center justify-between p-3 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-50 dark:hover:bg-neutral-700">
            <Undo className="w-4 h-4" />
            撤销
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-50 dark:hover:bg-neutral-700">
            <Redo className="w-4 h-4" />
            重做
          </button>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
        >
          保存更改
        </button>
      </div>
    </div>
  );
}
