/**
 * 学术元素编辑器组件
 * 支持公式、表格、代码块的插入与编辑
 */

import { useState, useCallback } from 'react';
import {
  Plus,
  X,
  Variable,
  Table,
  Code2,
  Trash2,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import { Button } from '@/components/ui';


export type ElementType = 'formula' | 'table' | 'code';

export interface FormulaElement {
  id: string;
  type: 'formula';
  content: string;
  label?: string;
}

export interface TableElement {
  id: string;
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface CodeElement {
  id: string;
  type: 'code';
  language: string;
  code: string;
  caption?: string;
}

export type AcademicElement = FormulaElement | TableElement | CodeElement;

interface AcademicElementEditorProps {
  elements: AcademicElement[];
  onUpdateElements: (elements: AcademicElement[]) => void;
  onInsert: (element: AcademicElement, position: number) => void;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
];

export function AcademicElementEditor({
  elements,
  onUpdateElements,
  onInsert,
}: AcademicElementEditorProps) {
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [insertPosition, setInsertPosition] = useState(0);

  const handleInsertFormula = useCallback(() => {
    const newElement: FormulaElement = {
      id: `formula-${Date.now()}`,
      type: 'formula',
      content: 'E = mc^2',
      label: '',
    };
    onInsert(newElement, insertPosition);
    setShowInsertMenu(false);
  }, [onInsert, insertPosition]);

  const handleInsertTable = useCallback(() => {
    const newElement: TableElement = {
      id: `table-${Date.now()}`,
      type: 'table',
      headers: ['列1', '列2', '列3'],
      rows: [
        ['数据1', '数据2', '数据3'],
        ['数据4', '数据5', '数据6'],
      ],
      caption: '表格标题',
    };
    onInsert(newElement, insertPosition);
    setShowInsertMenu(false);
  }, [onInsert, insertPosition]);

  const handleInsertCode = useCallback(() => {
    const newElement: CodeElement = {
      id: `code-${Date.now()}`,
      type: 'code',
      language: 'javascript',
      code: `// 代码示例
function hello() {
  logger.info("Hello World");
}`,
      caption: '代码示例',
    };
    onInsert(newElement, insertPosition);
    setShowInsertMenu(false);
  }, [onInsert, insertPosition]);

  const handleDeleteElement = useCallback((id: string) => {
    onUpdateElements(elements.filter(el => el.id !== id));
  }, [elements, onUpdateElements]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newElements = [...elements];
    const temp = newElements[index];
    newElements[index] = newElements[index - 1];
    newElements[index - 1] = temp;
    onUpdateElements(newElements);
  }, [elements, onUpdateElements]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === elements.length - 1) return;
    const newElements = [...elements];
    const temp = newElements[index];
    newElements[index] = newElements[index + 1];
    newElements[index + 1] = temp;
    onUpdateElements(newElements);
  }, [elements, onUpdateElements]);

  const handleUpdateFormula = useCallback((id: string, content: string, label: string) => {
    onUpdateElements(elements.map(el =>
      el.id === id && el.type === 'formula'
        ? { ...el, content, label }
        : el,
    ));
  }, [elements, onUpdateElements]);

  const handleUpdateTable = useCallback((id: string, headers: string[], rows: string[][], caption: string) => {
    onUpdateElements(elements.map(el =>
      el.id === id && el.type === 'table'
        ? { ...el, headers, rows, caption }
        : el,
    ));
  }, [elements, onUpdateElements]);

  const handleUpdateCode = useCallback((id: string, language: string, code: string, caption: string) => {
    onUpdateElements(elements.map(el =>
      el.id === id && el.type === 'code'
        ? { ...el, language, code, caption }
        : el,
    ));
  }, [elements, onUpdateElements]);

  return (
    <div className="space-y-3">
      {elements.map((element, index) => (
        <div key={element.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-100">
            {element.type === 'formula' && <Variable className="w-5 h-5 text-secondary-500" />}
            {element.type === 'table' && <Table className="w-5 h-5 text-success-500" />}
            {element.type === 'code' && <Code2 className="w-5 h-5 text-accent-500" />}
            <span className="font-medium text-neutral-700">
              {element.type === 'formula' && '公式'}
              {element.type === 'table' && '表格'}
              {element.type === 'code' && '代码块'}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="p-1 hover:bg-neutral-100 dark:bg-neutral-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="上移"
              >
                <MoveUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveDown(index)}
                disabled={index === elements.length - 1}
                className="p-1 hover:bg-neutral-100 dark:bg-neutral-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="下移"
              >
                <MoveDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteElement(element.id)}
                className="p-1 hover:bg-error-100 hover:text-error-600 rounded"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {element.type === 'formula' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">公式内容</label>
                <textarea
                  value={element.content}
                  onChange={(e) => handleUpdateFormula(element.id, e.target.value, element.label || '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={3}
                  placeholder="输入公式，如: E = mc^2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">公式标签（可选）</label>
                <input
                  type="text"
                  value={element.label || ''}
                  onChange={(e) => handleUpdateFormula(element.id, element.content, e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="公式标签"
                />
              </div>
            </div>
          )}

          {element.type === 'table' && (
            <TableEditor
              headers={element.headers}
              rows={element.rows}
              caption={element.caption || ''}
              onUpdate={(headers, rows, caption) => handleUpdateTable(element.id, headers, rows, caption)}
            />
          )}

          {element.type === 'code' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">语言</label>
                <select
                  value={element.language}
                  onChange={(e) => handleUpdateCode(element.id, e.target.value, element.code, element.caption || '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">代码</label>
                <textarea
                  value={element.code}
                  onChange={(e) => handleUpdateCode(element.id, element.language, e.target.value, element.caption || '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">标题（可选）</label>
                <input
                  type="text"
                  value={element.caption || ''}
                  onChange={(e) => handleUpdateCode(element.id, element.language, element.code, e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="代码标题"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setInsertPosition(elements.length);
            setShowInsertMenu(true);
          }}
          className="w-full justify-start gap-2"
        >
          <Plus className="w-4 h-4" />
          添加学术元素
        </Button>

        {showInsertMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg shadow-lg z-10">
            <button
              type="button"
              onClick={handleInsertFormula}
              className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:bg-neutral-800 flex items-center gap-2"
            >
              <Variable className="w-4 h-4 text-secondary-500" />
              插入公式
            </button>
            <button
              type="button"
              onClick={handleInsertTable}
              className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:bg-neutral-800 flex items-center gap-2"
            >
              <Table className="w-4 h-4 text-success-500" />
              插入表格
            </button>
            <button
              type="button"
              onClick={handleInsertCode}
              className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:bg-neutral-800 flex items-center gap-2"
            >
              <Code2 className="w-4 h-4 text-accent-500" />
              插入代码块
            </button>
            <button
              type="button"
              onClick={() => setShowInsertMenu(false)}
              className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:bg-neutral-800 text-neutral-500 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface TableEditorProps {
  headers: string[];
  rows: string[][];
  caption: string;
  onUpdate: (headers: string[], rows: string[][], caption: string) => void;
}

function TableEditor({ headers, rows, caption, onUpdate }: TableEditorProps) {
  const addColumn = useCallback(() => {
    const newHeaders = [...headers, `列${headers.length + 1}`];
    const newRows = rows.map(row => [...row, '']);
    onUpdate(newHeaders, newRows, caption);
  }, [headers, rows, caption, onUpdate]);

  const addRow = useCallback(() => {
    const newRows = [...rows, new Array(headers.length).fill('')];
    onUpdate(headers, newRows, caption);
  }, [headers, rows, caption, onUpdate]);

  const deleteColumn = useCallback((index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    const newRows = rows.map(row => row.filter((_, i) => i !== index));
    onUpdate(newHeaders, newRows, caption);
  }, [headers, rows, caption, onUpdate]);

  const deleteRow = useCallback((index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    onUpdate(headers, newRows, caption);
  }, [headers, rows, caption, onUpdate]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={caption}
        onChange={(e) => onUpdate(headers, rows, e.target.value)}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        placeholder="表格标题"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index} className="border border-neutral-300 px-3 py-2 bg-slate-50 dark:bg-neutral-800">
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => {
                      const newHeaders = [...headers];
                      newHeaders[index] = e.target.value;
                      onUpdate(newHeaders, rows, caption);
                    }}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium"
                  />
                  {headers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteColumn(index)}
                      className="ml-1 text-error-500 hover:text-error-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </th>
              ))}
              <th className="border border-neutral-300 px-2 py-2 bg-slate-50 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={addColumn}
                  className="text-primary hover:text-primary/80"
                  title="添加列"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-neutral-300 dark:border-neutral-700 px-3 py-2">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => {
                        const newRows = [...rows];
                        if (newRows[rowIndex]) {
                          newRows[rowIndex][cellIndex] = e.target.value;
                          onUpdate(headers, newRows, caption);
                        }
                      }}
                      className="w-full bg-transparent border-none outline-none text-sm"
                    />
                  </td>
                ))}
                <td className="border border-neutral-300 dark:border-neutral-700 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIndex)}
                    className="text-error-500 hover:text-error-700"
                    title="删除行"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        添加行
      </Button>
    </div>
  );
}
