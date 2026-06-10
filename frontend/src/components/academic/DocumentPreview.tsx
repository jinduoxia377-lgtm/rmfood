/**
 * 文档预览组件 - 实时渲染Markdown内容，支持专业学术排版
 * 包含页码、页眉页脚系统
 */
import React, { useMemo, useState, useEffect } from 'react';
import { FileText, Eye, Printer } from 'lucide-react';
import type { ReportDocument } from '@/types/academicReport';
import { CitationService } from '@/services/citationService';

interface DocumentPreviewProps {
  document: ReportDocument | null;
}

export function DocumentPreview({ document }: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const service = useMemo(() => {
    return new CitationService(document?.citations || []);
  }, [document?.citations]);

  const references = useMemo(() => {
    if (!document) return [];
    return service.generateReferences(document.citationStyle);
  }, [document, service]);

  // 计算总页数
  useEffect(() => {
    if (!document) return;

    let pages = 0;

    // 封面
    pages += 1;

    // 摘要（中英文各占一页）
    if (document.abstractChinese || document.abstractEnglish) {
      pages += 1;
    }

    // 目录
    pages += 1;

    // 章节内容（每章至少一页）
    const contentChapters = document.chapters.filter(
      ch => ch.type !== 'cover' && ch.type !== 'abstract' && ch.type !== 'toc',
    );
    pages += contentChapters.length;

    // 参考文献
    if (references.length > 0) {
      pages += Math.ceil(references.length / 15); // 每页约15条参考文献
    }

    setTotalPages(pages);
  }, [document, references]);

  const handlePrint = () => {
    window.print();
  };

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>暂无文档</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">预览</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            打印
          </button>
        </div>
      </div>

      {/* 预览内容 - 使用专业学术排版样式 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 print:shadow-none print:bg-white academic-preview">
          {/* 封面 */}
          {document.title && (
            <div className="cover-page text-center mb-12 mt-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 tracking-widest">
                {document.title}
              </h1>
              {document.authors && document.authors.length > 0 && (
                <p className="text-base text-gray-700 dark:text-gray-300 mb-2">
                  <span className="font-medium">作者：</span>
                  {document.authors.join('，')}
                </p>
              )}
              {document.institution && (
                <p className="text-base text-gray-700 dark:text-gray-300 mb-2">
                  <span className="font-medium">单位：</span>
                  {document.institution}
                </p>
              )}
              {document.date && (
                <p className="text-base text-gray-700 dark:text-gray-300">
                  <span className="font-medium">日期：</span>
                  {document.date}
                </p>
              )}
            </div>
          )}

          {/* 页眉（从目录开始显示） */}
          <div className="header-section">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 mb-6">
              <span className="text-xs text-gray-500 dark:text-gray-400">{document.title}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">学术报告</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">第 页</span>
            </div>
          </div>

          {/* 中文摘要 */}
          {document.abstractChinese && (
            <div className="abstract-section mb-8">
              <h2 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
                摘要
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-justify indent-8">
                {document.abstractChinese}
              </p>
              {document.keywords && document.keywords.length > 0 && (
                <p className="text-gray-700 dark:text-gray-300 mt-4 indent-8">
                  <span className="font-medium">关键词：</span>
                  {document.keywords.join('；')}
                </p>
              )}
            </div>
          )}

          {/* 英文摘要 */}
          {document.abstractEnglish && (
            <div className="abstract-section mb-8">
              <h2 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
                Abstract
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-justify indent-8">
                {document.abstractEnglish}
              </p>
            </div>
          )}

          {/* 目录 */}
          <div className="toc-section mb-12">
            <h2 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
              目录
            </h2>
            <ul className="space-y-2">
              {document.chapters
                .filter(ch => ch.type !== 'cover' && ch.type !== 'abstract' && ch.type !== 'toc')
                .map((chapter, index) => (
                  <li key={chapter.id} className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className={`text-gray-800 dark:text-gray-200 ${chapter.level === 1 ? 'font-medium' : chapter.level === 2 ? 'ml-4' : 'ml-8'}`}>
                      {chapter.title}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-4">
                      {index + 1}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {/* 章节内容 */}
          {document.chapters.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无内容</p>
            </div>
          ) : (
            document.chapters
              .filter(ch => ch.type !== 'cover' && ch.type !== 'abstract' && ch.type !== 'toc')
              .map((chapter, chapterIndex) => (
                <div key={chapter.id} className="chapter mb-8">
                  {/* 一级标题：居中加粗 */}
                  <h2 className="text-xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
                    {chapter.title}
                  </h2>

                  {/* 章节内容 */}
                  {chapter.content && (
                    <div className="chapter-content text-gray-700 dark:text-gray-300 leading-loose">
                      {renderContent(chapter.content)}
                    </div>
                  )}

                  {/* 子章节 */}
                  {chapter.children && chapter.children.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {chapter.children.map(child => (
                        <div key={child.id} className="subsection">
                          {/* 二级标题：左对齐加粗 */}
                          <h3 className="text-lg font-semibold text-left mb-3 text-gray-900 dark:text-gray-100">
                            {child.title}
                          </h3>
                          {child.content && (
                            <div className="text-gray-700 dark:text-gray-300 leading-loose">
                              {renderContent(child.content)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 图表 */}
                  {chapter.figures && chapter.figures.length > 0 && (
                    <div className="figures mt-6 space-y-6">
                      {chapter.figures.map(figure => (
                        <figure key={figure.id} className="text-center">
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 inline-block">
                            {figure.data ? (
                              <img
                                src={figure.data}
                                alt={figure.caption}
                                className="max-w-full h-auto"
                              />
                            ) : (
                              <div className="w-64 h-32 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                                <span className="text-gray-400">图片占位</span>
                              </div>
                            )}
                          </div>
                          <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {figure.number || `图${chapterIndex + 1}-1`}
                            </span>
                            {' '}{figure.caption}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}

                  {/* 表格 */}
                  {chapter.tables && chapter.tables.length > 0 && (
                    <div className="tables mt-6 space-y-6">
                      {chapter.tables.map(table => (
                        <div key={table.id} className="text-center">
                          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 mx-auto max-w-2xl">
                            <thead>
                              <tr className="bg-gray-100 dark:bg-gray-800">
                                {table.headers?.map((header, i) => (
                                  <th key={i} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-medium">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows?.map((row, i) => (
                                <tr key={i}>
                                  {row.map((cell, j) => (
                                    <td key={j} className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {table.number || `表${chapterIndex + 1}-1`}
                            </span>
                            {' '}{table.caption}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}

          {/* 参考文献 */}
          {references.length > 0 && (
            <div className="references-section mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
                参考文献
              </h2>
              <div className="space-y-3">
                {references.map((ref, index) => (
                  <p
                    key={index}
                    className="text-sm text-gray-700 dark:text-gray-300 text-justify pl-8 -indent-8"
                  >
                    <span className="text-blue-600 dark:text-blue-400 font-medium">[{index + 1}]</span>
                    {' '}{ref}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 页脚 */}
          <div className="footer-section mt-12 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
              <span>© {new Date().getFullYear()} 学术报告系统</span>
              <span>第 {currentPage} / {totalPages} 页</span>
              <span>版本 1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 分页导航 */}
      <div className="flex items-center justify-center gap-4 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          第 {currentPage} / {totalPages} 页
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>

      {/* 打印样式 */}
      <style>{`
        @media print {
          .academic-preview {
            padding: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }
          .cover-page {
            page-break-after: always;
          }
          .chapter {
            page-break-inside: avoid;
          }
          .footer-section {
            position: fixed;
            bottom: 2.5cm;
            left: 3.0cm;
            right: 2.5cm;
          }
          .header-section {
            position: fixed;
            top: 2.5cm;
            left: 3.0cm;
            right: 2.5cm;
          }
          .cover-page + .header-section {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * 渲染Markdown内容为React组件
 */
function renderContent(content: string): React.ReactNode {
  if (!content.trim()) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n');
      elements.push(
        <p key={elements.length} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-justify">
          {renderInlineFormatting(text)}
        </p>,
      );
      currentParagraph = [];
    }
  };

  const renderInlineFormatting = (text: string): React.ReactNode => {
    // 处理加粗
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // 处理斜体
      const italicParts = part.split(/(_[^_]+_)/g);
      return italicParts.map((ip, j) => {
        if (ip.startsWith('_') && ip.endsWith('_')) {
          return <em key={`${i}-${j}`}>{ip.slice(1, -1)}</em>;
        }
        return ip;
      });
    });
  };

  lines.forEach((line, _index) => {
    // 代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={elements.length} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">
            <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">
              {codeBlockContent.join('\n')}
            </code>
          </pre>,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // 标题
    if (line.startsWith('#### ')) {
      flushParagraph();
      elements.push(
        <h4 key={elements.length} className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">
          {line.slice(5)}
        </h4>,
      );
      return;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      elements.push(
        <h3 key={elements.length} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">
          {line.slice(4)}
        </h3>,
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      elements.push(
        <h2 key={elements.length} className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3">
          {line.slice(3)}
        </h2>,
      );
      return;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      elements.push(
        <h1 key={elements.length} className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4">
          {line.slice(2)}
        </h1>,
      );
      return;
    }

    // 无序列表
    if (line.startsWith('- ')) {
      flushParagraph();
      const items = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2));
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300">
          {items.map((item, i) => <li key={i}>{renderInlineFormatting(item)}</li>)}
        </ul>,
      );
      return;
    }

    // 有序列表
    if (/^\d+\.\s/.exec(line)) {
      flushParagraph();
      const items = lines.filter(l => /^\d+\.\s/.exec(l)).map(l => l.replace(/^\d+\.\s/, ''));
      elements.push(
        <ol key={elements.length} className="list-decimal list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300">
          {items.map((item, i) => <li key={i}>{renderInlineFormatting(item)}</li>)}
        </ol>,
      );
      return;
    }

    // 引用
    if (line.startsWith('> ')) {
      flushParagraph();
      elements.push(
        <blockquote key={elements.length} className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-4">
          {line.slice(2)}
        </blockquote>,
      );
      return;
    }

    // 表格
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushParagraph();
      const tableLines = lines.filter(l => l.includes('|') && l.trim().startsWith('|'));
      if (tableLines.length > 0) {
        const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
        const bodyRows = tableLines.slice(2).map(row =>
          row.split('|').map(c => c.trim()).filter(c => c),
        );
        elements.push(
          <table key={elements.length} className="w-full border-collapse my-4">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                {headers.map((header, i) => (
                  <th key={i} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {row.map((cell, j) => (
                    <td key={j} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>,
        );
      }
      return;
    }

    // 普通段落
    if (line.trim()) {
      currentParagraph.push(line);
    } else if (currentParagraph.length > 0) {
      flushParagraph();
    }
  });

  flushParagraph();
  return elements;
}
