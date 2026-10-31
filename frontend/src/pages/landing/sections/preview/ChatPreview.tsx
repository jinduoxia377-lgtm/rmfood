/**
 * ChatPreview — 对话预览 Tab
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - Message / DemoState 类型
 *   - 零依赖 MarkdownRenderer（针对对话气泡优化）
 *   - 对话交互逻辑（预设问题、Demo API、思考步骤）
 *
 * 状态自治：messages / input / demoState / thinkingStep 均保留在组件内部，
 * 通过 onStateChange 回调向父组件上报最小快照（messageCount + status），
 * 通过 resetToken prop 支持外部重置。
 */
import { useEffect, useState, useRef } from 'react';
import { Send, Loader2, AlertCircle, Sparkles, Copy, Check } from 'lucide-react';
import { cachedDemoChat, friendlyError } from '../../shared/apiClient';

// ── 类型定义 ────────────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface DemoState {
  status: 'idle' | 'thinking' | 'success' | 'error';
  message: string;
  error?: string;
}

// ── 预设问题 ────────────────────────────────────────────────────
const PRESET_QUESTIONS = [
  '设计一款增强免疫的配方',
  '黄芪和枸杞可以搭配吗？',
  '检测配方的安全性',
  '推荐抗氧化药材组合',
];

// ── 思考步骤 ────────────────────────────────────────────────────
const THINKING_STEPS = [
  { label: '分析意图',   color: 'var(--color-primary-700, #047857)' },
  { label: '检索知识',   color: 'var(--color-secondary-700, #1d4ed8)' },
  { label: '生成配方',   color: 'var(--color-accent-700, #6d28d9)' },
];

// ── 专业级 Markdown 渲染器（零外部依赖，针对对话气泡优化） ───────────
// 支持：标题、粗体/斜体、列表、代码块/行内代码、表格、引用块、分割线

interface MDProps { content: string }

/** 内联格式解析：处理 **bold** *italic* `code` [link](url) */
function parseInline(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<span key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIdx, m.index)}</span>);
    }
    if (m[2] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-neutral-900">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<em key={`${keyPrefix}-i-${idx++}`} className="italic text-[var(--text-secondary)]">{m[3]}</em>);
    } else if (m[4] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c-${idx++}`} className="px-1 py-0.5 rounded text-[12px] font-mono"
          style={{ background: 'var(--color-neutral-100, #f1f5f9)', color: 'var(--color-neutral-900, #0f172a)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>
          {m[4]}
        </code>
      );
    } else if (m[5] !== undefined) {
      parts.push(
        <a key={`${keyPrefix}-l-${idx++}`} href={m[6]} target="_blank" rel="noopener noreferrer"
          className="text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] underline decoration-primary-400 underline-offset-2"
          style={{ fontSize: 12 }}>
          {m[5]}
        </a>
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(<span key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIdx)}</span>);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** 渲染一行文本（含内联格式） */
function InlineLine({ text, prefix }: { text: string; prefix?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1" style={{ fontSize: 12, lineHeight: '1.65', color: 'var(--color-neutral-700, #334155)' }}>
      {prefix && <span className="flex-shrink-0 mt-0.5 text-[var(--color-primary-text)]" style={{ fontSize: 12 }}>{prefix}</span>}
      <span className="flex-1">{parseInline(text, 'line')}</span>
    </div>
  );
}

/** 分割线 */
function MDHR() {
  return <div className="my-1.5" style={{ height: 1, background: 'linear-gradient(90deg, transparent 0%, var(--color-neutral-200, #e2e8f0) 15%, var(--color-neutral-200, #e2e8f0) 85%, transparent 100%)' }} />;
}

/** 代码块 */
function MDCodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-1.5 rounded-[var(--radius-Apple-sm)] overflow-hidden" style={{ border: '1px solid var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-900, #0f172a)' }}>
      <div className="flex items-center justify-between px-[var(--space-apple-sm)] py-1.5" style={{ background: 'var(--color-neutral-800, #1e293b)' }}>
        <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-300, #cbd5e1)' }}>{lang || 'text'}</span>
        <button onClick={handleCopy} aria-label="复制代码" className="flex items-center gap-1 transition-opacity hover:opacity-80 min-h-[44px] min-w-[44px] justify-center py-1" style={{ opacity: 0.9 }}>
          {copied
            ? <><Check size={11} style={{ color: 'var(--color-success-500, #34d399)' }} /><span className="text-[12px]" style={{ color: 'var(--color-success-500, #34d399)' }}>已复制</span></>
            : <Copy size={11} style={{ color: 'var(--color-neutral-300, #cbd5e1)' }} />}
        </button>
      </div>
      <pre className="m-0 p-2.5 overflow-x-auto">
        <code className="text-[12px] font-mono leading-[1.7]" style={{ color: 'var(--color-neutral-200, #e2e8f0)' }}>{code}</code>
      </pre>
    </div>
  );
}

/** 引用块 */
function MDBlockquote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1.5 pl-2.5 py-1.5 rounded-r-md" style={{ background: 'var(--color-neutral-50, #f8fafc)', borderLeft: '2px solid var(--color-neutral-400, #94a3b8)' }}>
      <div className="text-[12px] italic text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-relaxed">{children}</div>
    </div>
  );
}

/** Callout 提示块 */
function MDCallout({ type, children }: { type: 'info' | 'warn' | 'success'; children: React.ReactNode }) {
  const cfg = {
    info:    { bg: 'var(--color-secondary-50, #eff6ff)', border: 'var(--color-secondary-300, #93c5fd)', dot: 'var(--color-secondary-700, #1d4ed8)', label: '信息' },
    warn:    { bg: 'var(--color-warning-50, #fffbeb)', border: 'var(--color-warning-300, #fcd34d)', dot: 'var(--color-warning-700, #b45309)', label: '注意' },
    success: { bg: 'var(--color-success-50, #ecfdf5)', border: 'var(--color-success-600, #6ee7b7)', dot: 'var(--color-primary-700, #047857)', label: '通过' },
  }[type];
  return (
    <div className="my-1.5 rounded-[var(--radius-Apple-sm)] px-2.5 py-2 flex items-start gap-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="w-1.5 h-1.5 rounded-[var(--radius-pill)] flex-shrink-0 mt-1" style={{ background: cfg.dot }} />
      <div className="text-[12px] leading-relaxed text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

/** 表格 */
function MDTable({ header: hdr, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            {hdr.map((h, i) => (
              <th key={i} className="px-2.5 py-1.5 font-semibold text-left whitespace-nowrap"
                style={{ background: 'var(--color-neutral-50, #f8fafc)', color: 'var(--color-neutral-600, #475569)', borderBottom: '1px solid var(--color-neutral-200, #e2e8f0)', fontSize: 12 }}>
                {h.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-2.5 py-1.5 align-top whitespace-nowrap"
                  style={{ borderBottom: '1px solid var(--color-neutral-100, #f1f5f9)', color: 'var(--color-neutral-600, #475569)', fontSize: 12, background: ri % 2 === 1 ? 'var(--color-neutral-50, #fafbfc)' : 'transparent' }}>
                  {parseInline(cell.trim(), `cell-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ── 主渲染组件 ── */
export function MarkdownRenderer({ content }: MDProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCode = false, codeLang = '', codeLines: string[] = [];
  let inList = false, listType: 'ul' | 'ol' = 'ul', listItems: string[] = [];
  let inBQ = false, bqLines: string[] = [];
  let tableRows: string[][] = [], tableHeader: string[] = [];
  let isTableRow = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, i) => (
      <InlineLine
        key={i}
        prefix={listType === 'ol' ? `${i + 1}.` : <span style={{ fontSize: 12, lineHeight: 1.5 }}>·</span>}
        text={item}
      />
    ));
    elements.push(
      <div key="lst" className="space-y-0.5 mb-1" style={{ paddingLeft: 14 }}>
        {items}
      </div>
    );
    listItems = [];
  };

  const flushBQ = () => {
    if (bqLines.length > 0) {
      elements.push(<MDBlockquote key="bq">{bqLines.join(' ')}</MDBlockquote>);
      bqLines = [];
    }
  };

  const flushTable = () => {
    if (tableHeader.length > 0 && tableRows.length > 0) {
      elements.push(<MDTable key="tbl" header={tableHeader} rows={tableRows} />);
    }
    tableHeader = [];
    tableRows = [];
    isTableRow = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trim = raw.trim();

    // ── 代码块 ──
    if (trim.startsWith('```')) {
      flushList(); flushBQ(); flushTable();
      if (!inCode) {
        inCode = true;
        codeLang = trim.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(<MDCodeBlock key={`cb-${i}`} lang={codeLang} code={codeLines.join('\n')} />);
        inCode = false; codeLang = ''; codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(raw); continue; }

    // ── 空行 ──
    if (trim === '') {
      flushList(); flushBQ(); flushTable();
      continue;
    }

    // ── 分割线 ──
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) {
      flushList(); flushBQ(); flushTable();
      elements.push(<MDHR key={`hr-${i}`} />);
      continue;
    }

    // ── 表行检测 ──
    if (trim.startsWith('|') && trim.endsWith('|')) {
      flushList(); flushBQ();
      const cells = trim.split('|').slice(1, -1).map(c => c.trim());
      if (/^[\s:|-]+$/.test(trim)) {
        isTableRow = true; // 分隔行，跳过
      } else if (!isTableRow) {
        tableHeader = cells;
        isTableRow = true;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // ── 引用块 ──
    if (trim.startsWith('>')) {
      flushList();
      if (!inBQ) inBQ = true;
      bqLines.push(trim.replace(/^>\s?/, ''));
      continue;
    } else {
      flushBQ();
    }

    // ── Callout ──
    const calloutMatch = trim.match(/^>\s*\[!(INFO|WARN|SUCCESS|NOTE)\]\s*(.*)/);
    if (calloutMatch) {
      flushList();
      const typeMap: Record<string, 'info' | 'warn' | 'success'> = { INFO: 'info', WARN: 'warn', NOTE: 'info', SUCCESS: 'success' };
      const type = typeMap[calloutMatch[1]?.toUpperCase()] ?? 'info';
      elements.push(<MDCallout key={`co-${i}`} type={type}>{parseInline(calloutMatch[2] || '', `co-${i}`)}</MDCallout>);
      continue;
    }

    // ── 标题 ──
    const headingMatch = trim.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const txt = headingMatch[2];
      const size = level === 1 ? 13 : level === 2 ? 12 : 11;
      const weight = level === 1 ? 'font-semibold' : 'font-medium';
      const mg = level === 1 ? 'mt-2 mb-1.5' : level === 2 ? 'mt-1.5 mb-1' : 'mt-1 mb-0.5';
      elements.push(
        <div key={`h-${i}`} className={`${weight} ${mg}`} style={{ fontSize: size, color: level <= 2 ? 'var(--color-neutral-900, #0f172a)' : 'var(--color-neutral-600, #475569)' }}>
          {parseInline(txt, `h-${i}`)}
        </div>
      );
      continue;
    }

    // ── 列表项 ──
    const ulMatch = trim.match(/^[-*]\s+(.*)/);
    const olMatch = trim.match(/^(\d+)\.\s+(.*)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      inList = true; listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }
    if (olMatch) {
      if (listType === 'ul') flushList();
      inList = true; listType = 'ol';
      listItems.push(olMatch[2]);
      continue;
    }
    if (inList) flushList();

    // ── 普通段落 ──
    elements.push(
      <InlineLine key={`p-${i}`} text={trim} />
    );
  }

  flushList(); flushBQ(); flushTable();
  return <>{elements}</>;
}

// ── 对话预览组件 ────────────────────────────────────────────────
export interface ChatPreviewState {
  messageCount: number;
  status: DemoState['status'];
}

interface ChatPreviewProps {
  /** 递增触发重置（清空消息 + 回到 idle） */
  resetToken: number;
  /** 状态变化回调，父组件用于状态栏 */
  onStateChange?: (state: ChatPreviewState) => void;
}

export default function ChatPreview({ resetToken, onStateChange }: ChatPreviewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [demoState, setDemoState] = useState<DemoState>({ status: 'idle', message: '' });
  const [thinkingStep, setThinkingStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 外部重置信号
  useEffect(() => {
    if (resetToken > 0) {
      setMessages([]);
      setDemoState({ status: 'idle', message: '' });
    }
  }, [resetToken]);

  // 消息滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, demoState.status]);

  // 思考步骤动画
  useEffect(() => {
    if (demoState.status !== 'thinking') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThinkingStep(0);
    const interval = setInterval(() => {
      setThinkingStep(prev => Math.min(prev + 1, THINKING_STEPS.length - 1));
    }, 600);
    return () => clearInterval(interval);
  }, [demoState.status]);

  // textarea 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
    }
  }, [input]);

  // 状态上报（供父组件状态栏使用）
  useEffect(() => {
    onStateChange?.({ messageCount: messages.length, status: demoState.status });
  }, [messages.length, demoState.status, onStateChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || demoState.status === 'thinking') return;
    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setDemoState({ status: 'thinking', message: '' });
    try {
      const result = await cachedDemoChat(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply, timestamp: Date.now() }]);
      setDemoState({ status: 'success', message: result.reply });
    } catch (error) {
      const errorMsg = friendlyError(error, '请求失败，请稍后重试');
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: Date.now() }]);
      setDemoState({ status: 'error', message: errorMsg });
    }
  };

  const triggerPreset = (q: string) => {
    setInput(q);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }]);
      setDemoState({ status: 'thinking', message: '' });
      cachedDemoChat(q).then(result => {
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply, timestamp: Date.now() }]);
        setDemoState({ status: 'success', message: result.reply });
      }).catch((error: unknown) => {
        const errorMsg = friendlyError(error, '请求失败，请稍后重试');
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: Date.now() }]);
        setDemoState({ status: 'error', message: errorMsg });
      });
    }, 80);
  };

  const isConversing = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-[var(--space-apple-md)] py-4">
        {!isConversing ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center mb-[var(--space-apple-md)] lp-welcome-icon" style={{ background: 'linear-gradient(135deg, var(--color-success-50, #ecfdf5) 0%, var(--color-success-100, #d1fae5) 100%)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>
              <Sparkles size={16} style={{ color: 'var(--color-primary-600, #059669)' }} />
            </div>
            <p className="lp-label font-semibold mb-1" style={{ color: 'var(--color-neutral-700, #334155)' }}>与配方顾问对话</p>
            <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center leading-relaxed mb-6 max-w-[220px]">输入您的研发需求，获取专业配方设计与安全评估</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[280px]">
              {PRESET_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => triggerPreset(q)}
                  className="text-left px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-[12px] leading-relaxed text-[var(--text-secondary)] transition-all duration-150 border min-h-[44px] flex items-center"
                  style={{ background: 'var(--color-neutral-50, #f8fafc)', borderColor: 'var(--color-neutral-100, #eef2f7)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-success-50, #f0fdf4)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-success-200, #bbf7d0)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary-800, #065f46)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-neutral-50, #f8fafc)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-neutral-100, #eef2f7)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral-600, #475569)'; }}
                >{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-[var(--space-apple-sm)]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} lp-chat-bubble-in`} style={{ animationDelay: `${i * 0.04}s` }}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-success-50, #ecfdf5)', border: '1px solid var(--color-success-100, #d1fae5)' }}>
                    <Sparkles size={10} style={{ color: 'var(--color-primary-700, #047857)' }} />
                  </div>
                )}
                <div className="px-[var(--space-apple-sm)] py-2 max-w-[80%] leading-relaxed" style={{ background: msg.role === 'user' ? 'linear-gradient(135deg, var(--color-primary-600, #059669) 0%, var(--color-primary-700, #047857) 100%)' : '#ffffff', color: msg.role === 'user' ? '#fff' : 'var(--color-neutral-800, #1e293b)', borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 3px', border: msg.role === 'assistant' ? '1px solid var(--color-neutral-200, #e2e8f0)' : 'none', lineHeight: '1.65', boxShadow: msg.role === 'assistant' ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' : 'none' }}>
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            ))}
            {demoState.status === 'thinking' && (
              <div className="flex justify-start lp-chat-bubble-in">
                <div className="w-5 h-5 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-success-50, #ecfdf5)', border: '1px solid var(--color-success-100, #d1fae5)' }}>
                  <Sparkles size={10} style={{ color: 'var(--color-primary-700, #047857)' }} />
                </div>
                <div className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)]" style={{ background: '#ffffff', border: '1px solid var(--color-neutral-200, #e2e8f0)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
                  <div className="flex items-center gap-2 mb-2">
                    {THINKING_STEPS.map((step, i) => (
                      <div key={step.label} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-[var(--radius-pill)] transition-all duration-300" style={{ background: i <= thinkingStep ? step.color : 'var(--color-neutral-200, #e2e8f0)', opacity: i <= thinkingStep ? 1 : 0.4 }} />
                        <span className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{step.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] lp-dot-1" />
                    <div className="w-1 h-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] lp-dot-2" />
                    <div className="w-1 h-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] lp-dot-3" />
                  </div>
                </div>
              </div>
            )}
            {demoState.status === 'error' && (
              <div className="flex justify-start lp-chat-bubble-in">
                <div className="w-5 h-5 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-danger-50, #fef2f2)', border: '1px solid var(--color-danger-200, #fecaca)' }}>
                  <AlertCircle size={10} style={{ color: 'var(--color-danger-700, #dc2626)' }} />
                </div>
                <div className="px-[var(--space-apple-sm)] py-2 text-[12px] text-danger-600 rounded-[var(--radius-Apple-md)]" style={{ background: 'var(--color-danger-50, #fef2f2)', border: '1px solid var(--color-danger-300, #fca5a5)' }}>{demoState.message}</div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 px-[var(--space-apple-md)] py-[var(--space-apple-md)] border-t" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative rounded-[var(--radius-Apple-sm)] border overflow-hidden transition-all lp-input-border" style={{ borderColor: 'var(--border-color, #e2e8f0)', background: 'var(--bg-canvas, #f8fafc)' }}>
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder="描述您的研发需求…" rows={1} disabled={demoState.status === 'thinking'}
              aria-label="配方研发需求输入"
              className="w-full resize-none px-[var(--space-apple-sm)] py-2.5 text-[12px] text-neutral-800 placeholder:text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] bg-transparent outline-none leading-[1.6]" style={{ maxHeight: 80 }} />
            <div className="absolute bottom-1.5 right-2"><kbd className="text-[12px] font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] px-1 py-0.5 rounded" style={{ border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>⏎</kbd></div>
          </div>
          <button type="submit" disabled={!input.trim() || demoState.status === 'thinking'}
            aria-label="发送"
            className="w-11 h-11 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 transition-all duration-150 disabled:opacity-30 hover:opacity-90 active:scale-95"
            style={{ background: 'var(--color-primary-700, #047857)' }}>
            {demoState.status === 'thinking' ? <Loader2 size={14} color="white" className="animate-spin" /> : <Send size={14} color="white" />}
          </button>
        </form>
      </div>
    </div>
  );
}
