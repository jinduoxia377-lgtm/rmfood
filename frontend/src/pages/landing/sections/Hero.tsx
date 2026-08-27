/**
 * Hero 组件 v10 — 专业产品着陆页首屏（升级 v10：交互式预览）
 *
 * 升级要点（v10）：
 *   - 产品预览窗口改为真实可交互对话界面
 *   - 支持用户实时输入并调用后端 demo API
 *   - 保留学术风格视觉设计
 */
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Send, Loader2, AlertCircle, MessageSquare, GitGraph, Database, ShieldCheck, Sparkles, Copy, Check } from 'lucide-react';
import { CountdownBanner } from './LaunchCountdown';
import { Reveal } from '../shared/Reveal';
import { useAuthStore } from '@/stores/auth';
import { testimonials } from '../data/socialProof';

// ── 类型定义 ────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface DemoState {
  status: 'idle' | 'thinking' | 'success' | 'error';
  message: string;
  error?: string;
}

// ── Demo API 调用 ────────────────────────────────────────────────
const DEMO_API_BASE = '/api/v1/ai/demo';

async function callDemoChat(message: string): Promise<{ reply: string; confidence: number }> {
  const response = await fetch(`${DEMO_API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail?.message || '请求失败，请稍后重试');
  }
  
  return response.json();
}

// ── 预设问题 ────────────────────────────────────────────────────
const PRESET_QUESTIONS = [
  '设计一款增强免疫的配方',
  '黄芪和枸杞可以搭配吗？',
  '检测配方的安全性',
  '推荐抗氧化药材组合',
];

// ── 侧边栏导航项 ────────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { label: '对话',  icon: MessageSquare },
  { label: '图谱',  icon: GitGraph },
  { label: '数据',  icon: Database },
  { label: '合规',  icon: ShieldCheck },
];

// ── 思考步骤 ────────────────────────────────────────────────────
const THINKING_STEPS = [
  { label: '分析意图',   color: '#059669' },
  { label: '检索知识',   color: '#2563eb' },
  { label: '生成配方',   color: '#7c3aed' },
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
      parts.push(<strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-slate-900">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<em key={`${keyPrefix}-i-${idx++}`} className="italic text-slate-600">{m[3]}</em>);
    } else if (m[4] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c-${idx++}`} className="px-1 py-0.5 rounded text-[10px] font-mono"
          style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0' }}>
          {m[4]}
        </code>
      );
    } else if (m[5] !== undefined) {
      parts.push(
        <a key={`${keyPrefix}-l-${idx++}`} href={m[6]} target="_blank" rel="noreferrer"
          className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-300 underline-offset-2"
          style={{ fontSize: 10 }}>
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
    <div className="flex items-start gap-1" style={{ fontSize: 10.5, lineHeight: '1.65', color: '#334155' }}>
      {prefix && <span className="flex-shrink-0 mt-0.5 text-emerald-500" style={{ fontSize: 9 }}>{prefix}</span>}
      <span className="flex-1">{parseInline(text, 'line')}</span>
    </div>
  );
}

/** 分割线 */
function MDHR() {
  return <div className="my-1.5" style={{ height: 1, background: 'linear-gradient(90deg, transparent 0%, #e2e8f0 15%, #e2e8f0 85%, transparent 100%)' }} />;
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
    <div className="my-1.5 rounded-md overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#0f172a' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#1e293b' }}>
        <span className="text-[9px] font-mono" style={{ color: '#94a3b8' }}>{lang || 'text'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 transition-opacity hover:opacity-80" style={{ opacity: 0.6 }}>
          {copied
            ? <><Check size={10} style={{ color: '#059669' }} /><span className="text-[9px]" style={{ color: '#059669' }}>已复制</span></>
            : <Copy size={10} style={{ color: '#94a3b8' }} />}
        </button>
      </div>
      <pre className="m-0 p-2.5 overflow-x-auto">
        <code className="text-[10px] font-mono leading-[1.7]" style={{ color: '#e2e8f0' }}>{code}</code>
      </pre>
    </div>
  );
}

/** 引用块 */
function MDBlockquote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1.5 pl-2.5 py-1.5 rounded-r-md" style={{ background: '#f8fafc', borderLeft: '2px solid #94a3b8' }}>
      <div className="text-[10px] italic text-slate-500 leading-relaxed">{children}</div>
    </div>
  );
}

/** Callout 提示块 */
function MDCallout({ type, children }: { type: 'info' | 'warn' | 'success'; children: React.ReactNode }) {
  const cfg = {
    info:    { bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6', label: '信息' },
    warn:    { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', label: '注意' },
    success: { bg: '#ecfdf5', border: '#6ee7b7', dot: '#059669', label: '通过' },
  }[type];
  return (
    <div className="my-1.5 rounded-md px-2.5 py-2 flex items-start gap-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: cfg.dot }} />
      <div className="text-[10px] leading-relaxed text-slate-700" style={{ fontSize: 10.5 }}>{children}</div>
    </div>
  );
}

/** 表格 */
function MDTable({ header: hdr, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[10px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            {hdr.map((h, i) => (
              <th key={i} className="px-2.5 py-1.5 font-semibold text-left whitespace-nowrap"
                style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>
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
                  style={{ borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: 10, background: ri % 2 === 1 ? '#fafbfc' : 'transparent' }}>
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
        prefix={listType === 'ol' ? `${i + 1}.` : <span style={{ fontSize: 11, lineHeight: 1.5 }}>·</span>}
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
      const size = level === 1 ? 12 : level === 2 ? 11 : 10.5;
      const weight = level === 1 ? 'font-semibold' : 'font-medium';
      const mg = level === 1 ? 'mt-2 mb-1.5' : level === 2 ? 'mt-1.5 mb-1' : 'mt-1 mb-0.5';
      elements.push(
        <div key={`h-${i}`} className={`${weight} ${mg}`} style={{ fontSize: size, color: level <= 2 ? '#0f172a' : '#475569' }}>
          {parseInline(txt, `h-${i}`)}
        </div>
      );
      continue;
    }

    // ── 列表项 ──
    const ulMatch = trim.match(/^[\-\*]\s+(.*)/);
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

// ── 产品预览窗口（v11 — 仪表板风格交互对话） ───────────────────
function ProductPreview() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [demoState, setDemoState] = useState<DemoState>({
    status: 'idle',
    message: '',
  });
  const [activeTab, setActiveTab] = useState(0);
  const [thinkingStep, setThinkingStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, demoState.status]);

  // 思考步骤动画
  useEffect(() => {
    if (demoState.status !== 'thinking') return;
    setThinkingStep(0);
    const interval = setInterval(() => {
      setThinkingStep(prev => Math.min(prev + 1, THINKING_STEPS.length - 1));
    }, 600);
    return () => clearInterval(interval);
  }, [demoState.status]);

  // textarea auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
    }
  }, [input]);

  // 发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || demoState.status === 'thinking') return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }]);
    setDemoState({ status: 'thinking', message: '' });

    try {
      const result = await callDemoChat(userMessage);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
      }]);
      setDemoState({ status: 'success', message: result.reply });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '请求失败，请稍后重试';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now(),
      }]);
      setDemoState({ status: 'error', message: errorMsg });
    }
  };

  // 触发预设问题
  const triggerPreset = (q: string) => {
    setInput(q);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }]);
      setDemoState({ status: 'thinking', message: '' });
      callDemoChat(q)
        .then(result => {
          setMessages(prev => [...prev, { role: 'assistant', content: result.reply, timestamp: Date.now() }]);
          setDemoState({ status: 'success', message: result.reply });
        })
        .catch(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: '请求失败，请稍后重试', timestamp: Date.now() }]);
          setDemoState({ status: 'error', message: '请求失败' });
        });
    }, 80);
  };

  const isConversing = messages.length > 0;

  return (
    <div className="relative">
      {/* 翡翠绿环境光晕（与 Hero 背景协同） */}
      <div className="lp-preview-glow absolute inset-0 pointer-events-none" />

      {/* ── 三层深度窗口外壳 ── */}
      <div className="lp-preview-window relative z-10">
        {/* ── 顶部标题栏（深色锚点） ── */}
        <div className="lp-titlebar flex items-center gap-0 px-4 py-2 border-b">
          {/* 左侧：品牌标识 + 活跃功能 */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-400 tracking-wider">RMFOOD</span>
            <div className="w-px h-3 bg-slate-700" />
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ background: 'rgba(5,150,105,0.2)', color: '#6ee7b7', border: '1px solid rgba(5,150,105,0.3)' }}
            >
              <Sparkles size={9} />
              <span>智能对话</span>
            </div>
          </div>

          {/* 右侧：状态指示 + 版本 */}
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: demoState.status === 'error' ? '#ef4444' : '#059669', boxShadow: '0 0 4px rgba(5,150,105,0.4)' }}
              />
              <span className="text-[9px] text-slate-400 font-mono">
                {demoState.status === 'error' ? '离线' : '在线'}
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-500">v2.4</span>
          </div>
        </div>

        {/* ── 主体内容区 ── */}
        <div className="flex min-h-[400px] max-h-[480px]">
          {/* 侧边导航 */}
          <div className="lp-sidebar w-11 flex-shrink-0 flex flex-col items-center py-3 gap-1">
            {SIDEBAR_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isActive = activeTab === i;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(i)}
                  title={item.label}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150"
                  style={isActive
                    ? { background: '#059669', color: '#fff', border: '1px solid #047857', boxShadow: '0 1px 2px rgba(5,150,105,0.3)' }
                    : { background: 'transparent', color: '#64748b', border: '1px solid transparent' }
                  }
                >
                  <Icon size={13} strokeWidth={1.8} />
                </button>
              );
            })}
            {/* 分割线 */}
            <div className="w-5 h-px my-1.5" style={{ background: '#e2e8f0' }} />
            {/* 刷新按钮 */}
            <button
              onClick={() => { setMessages([]); setDemoState({ status: 'idle', message: '' }); }}
              title="清空对话"
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: '#64748b', border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* 对话内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!isConversing ? (
                /* ── 欢迎态 ── */
                <div className="h-full flex flex-col items-center justify-center">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 lp-welcome-icon"
                    style={{
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    <Sparkles size={16} style={{ color: '#059669' }} />
                  </div>
                  <p className="text-[12px] font-semibold text-slate-800 mb-1">与配方顾问对话</p>
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed mb-6 max-w-[220px]">
                    输入您的研发需求，获取专业配方设计与安全评估
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                    {PRESET_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => triggerPreset(q)}
                        className="text-left px-3 py-2 rounded-lg text-[10px] leading-relaxed text-slate-600 transition-all duration-150 border hover:shadow-sm"
                        style={{ background: '#f8fafc', borderColor: '#eef2f7' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#bbf7d0';
                          (e.currentTarget as HTMLButtonElement).style.color = '#065f46';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#eef2f7';
                          (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── 消息列表 ── */
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} lp-chat-bubble-in`}
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      {msg.role === 'assistant' && (
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                          style={{ background: '#ecfdf5', border: '1px solid #d1fae5' }}
                        >
                          <Sparkles size={10} style={{ color: '#059669' }} />
                        </div>
                      )}
                      <div
                        className="px-3 py-2 max-w-[80%] leading-relaxed"
                        style={{
                          background: msg.role === 'user'
                            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                            : '#ffffff',
                          color: msg.role === 'user' ? '#fff' : '#1e293b',
                          borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 3px',
                          border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                          lineHeight: '1.65',
                          boxShadow: msg.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                        }}
                      >
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    </div>
                  ))}

                  {/* 思考中 */}
                  {demoState.status === 'thinking' && (
                    <div className="flex justify-start lp-chat-bubble-in">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                        style={{ background: '#ecfdf5', border: '1px solid #d1fae5' }}
                      >
                        <Sparkles size={10} style={{ color: '#059669' }} />
                      </div>
                      <div
                        className="px-4 py-3 rounded-xl"
                        style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {THINKING_STEPS.map((step, i) => (
                            <div key={step.label} className="flex items-center gap-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  background: i <= thinkingStep ? step.color : '#e2e8f0',
                                  opacity: i <= thinkingStep ? 1 : 0.4,
                                }}
                              />
                              <span className="text-[9px] text-slate-400">{step.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-400 lp-dot-1" />
                          <div className="w-1 h-1 rounded-full bg-emerald-400 lp-dot-2" />
                          <div className="w-1 h-1 rounded-full bg-emerald-400 lp-dot-3" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 错误 */}
                  {demoState.status === 'error' && (
                    <div className="flex justify-start lp-chat-bubble-in">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                        style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
                      >
                        <AlertCircle size={10} style={{ color: '#dc2626' }} />
                      </div>
                      <div
                        className="px-3 py-2 text-[10px] text-red-600 rounded-xl"
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}
                      >
                        {demoState.message}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── 输入区 ── */}
            <div className="flex-shrink-0 px-4 py-3 border-t" style={{ borderColor: '#e2e8f0', background: '#fafbfc' }}>
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div
                  className="flex-1 relative rounded-lg border overflow-hidden transition-all lp-input-border"
                  style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
                >
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="描述您的研发需求…"
                    rows={1}
                    disabled={demoState.status === 'thinking'}
                    className="w-full resize-none px-3 py-2 text-[11px] text-slate-800 placeholder:text-slate-300 bg-transparent outline-none leading-[1.6]"
                    style={{ maxHeight: 80 }}
                  />
                  <div className="absolute bottom-1.5 right-2">
                    <kbd className="text-[8px] font-mono text-slate-300 px-1 py-0.5 rounded" style={{ border: '1px solid #e2e8f0' }}>⏎</kbd>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || demoState.status === 'thinking'}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 disabled:opacity-30 hover:opacity-90 active:scale-95"
                  style={{ background: '#059669' }}
                >
                  {demoState.status === 'thinking' ? (
                    <Loader2 size={14} color="white" className="animate-spin" />
                  ) : (
                    <Send size={14} color="white" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── 底部状态栏 ── */}
        <div
          className="flex items-center justify-between px-4 py-1.5 border-t"
          style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono" style={{ color: '#64748b' }}>
              {demoState.status === 'idle'   && '● 就绪'}
              {demoState.status === 'thinking' && '◌ 分析中…'}
              {demoState.status === 'success' && '● 完成'}
              {demoState.status === 'error'   && '● 出错'}
            </span>
            {isConversing && (
              <span className="text-[9px] font-mono" style={{ color: '#94a3b8' }}>· {messages.length} 轮</span>
            )}
          </div>
          <span className="text-[9px] font-mono" style={{ color: '#94a3b8' }}>thinking-engine</span>
        </div>
      </div>
    </div>
  );
}

// ── Hero 底部全宽指标浮标 ──────────────────────────────────────
function HeroMetricsBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t" style={{ borderColor: '#e2e8f0' }}>
      <span className="lp-hero-metric">
        <span style={{ color: '#059669' }}>●</span>
        <strong>200+</strong> 研发机构
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: '#7c3aed' }}>●</span>
        <strong>128K</strong> 知识节点
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: '#2563eb' }}>●</span>
        <strong>5</strong> 大权威数据源
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: '#d97706' }}>●</span>
        <strong>72h</strong> 平均研发周期
      </span>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────
export default function Hero() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="lp-grid-bg relative overflow-hidden" style={{ background: '#fff', borderTop: '1px solid #e2e8f0' }}>
      <CountdownBanner />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* 左侧文案 */}
          <div className="max-w-xl pt-4">
            <Reveal>
              {/* 分类标签（学术风格） */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">RMFOOD</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">药食同源 AI 配方研发平台</span>
              </div>

              {/* 主标题（论文标题风格）— "像对话一样简单" 加翡翠绿强调 */}
              <h1 className="text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-[1.12] mb-5 tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-sans)' }}>
                让配方研发
                <br />
                <span className="text-emerald-700">像对话一样简单</span>
              </h1>

              {/* 副标题 */}
              <p className="text-[clamp(0.9375rem,1.2vw,1rem)] leading-relaxed mb-8 text-slate-600 max-w-lg">
                整合 TCMSP、DFBP、知识图谱等五大权威数据源，
                为研发团队提供从原料筛选到合规审查的完整工作流。
              </p>

              {/* CTA 按钮组 */}
              <Reveal delay="lp-reveal-delay-1">
                <div className="flex flex-col sm:flex-row items-start gap-3 mb-10">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#0f172a' }}
                  >
                    {isAuthenticated ? '进入工作台' : '立即体验'}
                    <ArrowRight size={13} />
                  </Link>
                  <Link
                    to="#demo-area"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-900 hover:bg-slate-50"
                  >
                    <ChevronRight size={14} />
                    产品演示
                  </Link>
                </div>
              </Reveal>

              {/* 信任背书 */}
              <Reveal delay="lp-reveal-delay-2">
                <div className="flex items-center gap-4 text-[12px] text-slate-500">
                  <div className="flex -space-x-1.5">
                    {testimonials.slice(0, 4).map((t: { gradient?: string; name: string }, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white" style={{ background: t.gradient }}>
                        {t.name[0]}
                      </div>
                    ))}
                  </div>
                  <span>已有 200+ 研发机构入驻</span>
                </div>
              </Reveal>
            </Reveal>
          </div>

          {/* 右侧产品预览（交互式） */}
          <div id="demo-area" className="lg:pl-4">
            <Reveal delay="lp-reveal-delay-1">
              <ProductPreview />
            </Reveal>
          </div>
        </div>

        {/* Hero 底部全宽指标浮标 — 独立于左右列，形成稳定收尾 */}
        <Reveal delay="lp-reveal-delay-2">
          <HeroMetricsBar />
        </Reveal>
      </div>

      {/* 数据源展示（独立 section，不在 Hero 内） */}
    </section>
  );
}