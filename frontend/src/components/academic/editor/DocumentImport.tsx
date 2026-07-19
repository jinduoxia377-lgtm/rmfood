import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, FileCode, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/toastStore';
import type { Chapter } from '@/types/academicReport';

interface DocumentImportProps {
  onImport: (chapters: Chapter[]) => void;
  onClose: () => void;
}

type FileType = 'markdown' | 'text' | 'html';

interface ParsedContent {
  title: string;
  chapters: Chapter[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function DocumentImport({ onImport, onClose }: DocumentImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();

  const detectFileType = (file: File): FileType | null => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'txt':
      case 'text':
        return 'text';
      case 'html':
      case 'htm':
        return 'html';
      default:
        return null;
    }
  };

  const parseMarkdown = async (content: string): Promise<ParsedContent> => {
    const lines = content.split('\n');
    const chapters: Chapter[] = [];
    let currentChapter: Chapter | null = null;
    let currentContent: string[] = [];
    let chapterIndex = 0;

    for (const line of lines) {
      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
      if (headingMatch && headingMatch[1] && headingMatch[2]) {
        if (currentChapter) {
          currentChapter.content = currentContent.join('\n').trim();
          chapters.push(currentChapter);
        }
        chapterIndex++;
        const level = headingMatch[1].length;
        currentChapter = {
          id: `chapter-${Date.now()}-${chapterIndex}`,
          title: headingMatch[2].trim(),
          content: '',
          level,
          order: chapterIndex,
          children: [],
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentChapter) {
      currentChapter.content = currentContent.join('\n').trim();
      chapters.push(currentChapter);
    }

    const titleMatch = /^#\s+(.+)$/m.exec(content);
    const title = titleMatch && titleMatch[1] ? titleMatch[1] : '导入文档';

    return { title, chapters };
  };

  const parseText = async (content: string): Promise<ParsedContent> => {
    const sections = content.split(/\n\n+/);
    const chapters: Chapter[] = [];
    let title = '导入文档';

    sections.forEach((section, index) => {
      const trimmed = section.trim();
      if (!trimmed) return;

      const lines = trimmed.split('\n');
      const firstLine = lines[0]?.trim() || '';

      if (index === 0 && firstLine.length < 100) {
        title = firstLine;
        chapters.push({
          id: `chapter-${Date.now()}-${index + 1}`,
          title: firstLine,
          content: lines.slice(1).join('\n').trim(),
          level: 1,
          order: 1,
          children: [],
        });
      } else {
        chapters.push({
          id: `chapter-${Date.now()}-${index + 1}`,
          title: firstLine.substring(0, 50) || `章节 ${index + 1}`,
          content: trimmed,
          level: 1,
          order: index + 1,
          children: [],
        });
      }
    });

    return { title, chapters };
  };

  const parseHtml = async (content: string): Promise<ParsedContent> => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    const title = tempDiv.querySelector('h1')?.textContent ||
                  tempDiv.querySelector('title')?.textContent ||
                  '导入文档';

    const chapters: Chapter[] = [];
    let chapterIndex = 0;

    const processHeading = (element: Element) => {
      chapterIndex++;
      const level = parseInt(element.tagName.substring(1), 10);
      chapters.push({
        id: `chapter-${Date.now()}-${chapterIndex}`,
        title: element.textContent || '',
        content: '',
        level: Math.min(level, 4),
        order: chapterIndex,
        children: [],
      });
    };

    tempDiv.querySelectorAll('h1, h2, h3, h4').forEach(processHeading);

    if (chapters.length === 0) {
      const bodyText = tempDiv.textContent || '';
      return parseText(bodyText);
    }

    return { title, chapters };
  };

  const parseFile = async (file: File): Promise<ParsedContent> => {
    const fileType = detectFileType(file);
    if (!fileType) {
      throw new Error(`不支持的文件类型: ${file.name}。请上传 .md、.txt 或 .html 文件。`);
    }

    const content = await file.text();

    setImportProgress(30);

    switch (fileType) {
      case 'markdown':
        return parseMarkdown(content);
      case 'text':
        return parseText(content);
      case 'html':
        return parseHtml(content);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`文件大小超过 10MB 限制。当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      setImportStatus('error');
      addToast({
        type: 'error',
        title: '文件过大',
        message: `文件 ${file.name} 超过 10MB 限制`,
      });
      return;
    }

    const fileType = detectFileType(file);
    if (!fileType) {
      setErrorMessage(`不支持的文件类型。请上传 .md、.txt 或 .html 文件。`);
      setImportStatus('error');
      addToast({
        type: 'error',
        title: '不支持的文件类型',
        message: `${file.name} 不是支持的文件格式`,
      });
      return;
    }

    setSelectedFile(file);
    setImportStatus('importing');
    setErrorMessage('');
    setImportProgress(10);

    try {
      setImportProgress(50);
      const parsed = await parseFile(file);
      setImportProgress(80);

      if (parsed.chapters.length === 0) {
        throw new Error('未能解析出有效的章节内容');
      }

      setImportProgress(100);
      setImportStatus('success');

      addToast({
        type: 'success',
        title: '文档导入成功',
        message: `成功解析 ${parsed.chapters.length} 个章节`,
      });

      setTimeout(() => {
        onImport(parsed.chapters);
      }, 500);
    } catch (error) {
      setImportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '文件解析失败');
      addToast({
        type: 'error',
        title: '导入失败',
        message: error instanceof Error ? error.message : '文件解析失败',
      });
    }
  }, [onImport, addToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const getFileIcon = (file: File) => {
    const type = detectFileType(file);
    switch (type) {
      case 'markdown':
        return <FileCode className="w-12 h-12 text-secondary-500" />;
      case 'html':
        return <FileCode className="w-12 h-12 text-orange-500" />;
      default:
        return <FileText className="w-12 h-12 text-neutral-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">导入文档</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-primary',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,.html,.htm"
              onChange={handleFileSelect}
              className="hidden"
            />

            {importStatus === 'idle' && (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                  拖拽文件到此处，或
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline mx-1"
                  >
                    点击选择
                  </button>
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-500">
                  支持 .md、.txt、.html 格式，文件大小不超过 10MB
                </p>
              </>
            )}

            {importStatus === 'importing' && selectedFile && (
              <>
                {getFileIcon(selectedFile)}
                <p className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">{selectedFile.name}</p>
                <div className="mt-4">
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-neutral-500">正在解析文档... {importProgress}%</p>
                </div>
              </>
            )}

            {importStatus === 'success' && selectedFile && (
              <>
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success-500" />
                <p className="mt-4 font-medium text-neutral-900 dark:text-neutral-100">导入成功！</p>
                <p className="text-sm text-neutral-500">正在跳转到文档编辑...</p>
              </>
            )}

            {importStatus === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-error-500" />
                <p className="mt-4 font-medium text-error-600 dark:text-error-400">{errorMessage}</p>
                <button
                  onClick={() => {
                    setImportStatus('idle');
                    setSelectedFile(null);
                    setErrorMessage('');
                  }}
                  className="mt-4 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  重新选择文件
                </button>
              </>
            )}
          </div>

          <div className="mt-6 p-4 bg-slate-50 dark:bg-neutral-900 rounded-lg">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">导入说明</h3>
            <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
              <li>• Markdown 文件会根据 # 标题自动解析章节结构</li>
              <li>• 纯文本文件会根据段落自动拆分为章节</li>
              <li>• HTML 文件会根据 h1-h4 标签解析章节</li>
              <li>• 导入后可在编辑器中调整章节结构</li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            选择文件
          </button>
        </div>
      </div>
    </div>
  );
}
