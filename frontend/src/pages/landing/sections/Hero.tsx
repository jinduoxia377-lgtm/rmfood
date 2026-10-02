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
import { ArrowRight, ChevronRight, Send, Loader2, AlertCircle, MessageSquare, GitGraph, Database, ShieldCheck, Sparkles, Copy, Check, Search, FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink, ChevronDown, Clock, Database as DBIcon, Users } from 'lucide-react';
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
      parts.push(<strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-slate-900">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<em key={`${keyPrefix}-i-${idx++}`} className="italic text-slate-600">{m[3]}</em>);
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
          className="text-emerald-700 hover:text-emerald-800 underline decoration-emerald-400 underline-offset-2"
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
      {prefix && <span className="flex-shrink-0 mt-0.5 text-emerald-600" style={{ fontSize: 12 }}>{prefix}</span>}
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
    <div className="my-1.5 rounded-md overflow-hidden" style={{ border: '1px solid var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-900, #0f172a)' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--color-neutral-800, #1e293b)' }}>
        <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-300, #cbd5e1)' }}>{lang || 'text'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 transition-opacity hover:opacity-80 min-h-[44px] min-w-[44px] justify-center py-1" style={{ opacity: 0.9 }}>
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
      <div className="text-[12px] italic text-slate-500 leading-relaxed">{children}</div>
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
    <div className="my-1.5 rounded-md px-2.5 py-2 flex items-start gap-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: cfg.dot }} />
      <div className="text-[12px] leading-relaxed text-slate-700">{children}</div>
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

// ── Tab 2：知识图谱 ──────────────────────────────────────────────
interface KGNode { id: string; name: string; type: 'herb' | 'compound' | 'target' | 'disease'; x: number; y: number; desc: string; connections: number; }
interface KGLink { source: string; target: string; }

const KG_NODES: KGNode[] = [
  { id: 'jyh',  name: '金银花',  type: 'herb',   x: 50,  y: 60,  desc: '清热解毒，疏散风热。含绿原酸、木犀草素等活性成分。', connections: 4 },
  { id: 'lq',   name: '连翘',    type: 'herb',   x: 130, y: 30,  desc: '清热解毒，消肿散结。与金银花为经典药对。',           connections: 3 },
  { id: 'hs',   name: '黄芪',    type: 'herb',   x: 190, y: 80,  desc: '补气升阳，固表止汗。含黄芪多糖、皂苷类成分。',       connections: 3 },
  { id: 'gc',   name: '甘草',    type: 'herb',   x: 70,  y: 130, desc: '补脾益气，调和诸药。含甘草酸、甘草次酸。',            connections: 5 },
  { id: 'gjs',  name: '枸杞子',  type: 'herb',   x: 150, y: 140, desc: '滋补肝肾，益精明目。富含枸杞多糖和胡萝卜素。',        connections: 2 },
  { id: 'lzw',  name: '五味子',  type: 'herb',   x: 220, y: 130, desc: '收敛固涩，益气生津。含木脂素类成分。',               connections: 2 },
  { id: 'lzy',  name: '绿原酸',  type: 'compound', x: 100, y: 90, desc: '广泛存在于金银花、枸杞等药材中，具有抗氧化活性。',     connections: 3 },
  { id: 'hsz',  name: '黄芪皂苷', type: 'compound', x: 170, y: 110, desc: '黄芪主要活性成分，具有免疫调节作用。',                connections: 2 },
  { id: 'tnf',  name: 'TNF-α',   type: 'target', x: 230, y: 50,  desc: '肿瘤坏死因子-α，炎症关键介质。金银花提取物可抑制其表达。', connections: 2 },
  { id: 'nfkb', name: 'NF-κB',   type: 'target', x: 250, y: 110, desc: '核因子κB，调控炎症反应的核心转录因子。',               connections: 2 },
  { id: 'ganyan', name: '感冒',  type: 'disease', x: 30,  y: 40,  desc: '上呼吸道感染。金银花、连翘为常用解表药。',              connections: 2 },
  { id: 'xiyan',  name: '咽炎',  type: 'disease', x: 110, y: 170, desc: '咽部炎症。甘草、金银花具抗炎镇痛作用。',                connections: 2 },
];

const KG_LINKS: KGLink[] = [
  { source: 'jyh', target: 'lq' }, { source: 'jyh', target: 'lzy' }, { source: 'jyh', target: 'tnf' }, { source: 'jyh', target: 'ganyan' },
  { source: 'lq', target: 'hs' }, { source: 'lq', target: 'ganyan' },
  { source: 'hs', target: 'hsz' }, { source: 'hs', target: 'nfkb' },
  { source: 'gc', target: 'hs' }, { source: 'gc', target: 'lzy' }, { source: 'gc', target: 'xiyan' }, { source: 'gc', target: 'nfkb' },
  { source: 'gjs', target: 'lzy' }, { source: 'gjs', target: 'xiyan' },
  { source: 'lzw', target: 'hsz' },
  { source: 'lzy', target: 'tnf' }, { source: 'hsz', target: 'nfkb' },
];

const KG_TYPE_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  herb:      { color: 'var(--color-primary-700, #047857)', bg: 'var(--color-success-50, #ecfdf5)',  border: 'var(--color-success-200, #a7f3d0)',  label: '药材' },
  compound:  { color: 'var(--color-secondary-700, #1d4ed8)', bg: 'var(--color-secondary-50, #eff6ff)',  border: 'var(--color-secondary-200, #bfdbfe)',  label: '成分' },
  target:    { color: 'var(--color-accent-700, #6d28d9)', bg: 'var(--color-accent-50, #f5f3ff)',  border: 'var(--color-accent-200, #ddd6fe)',  label: '靶点' },
  disease:   { color: 'var(--color-warning-700, #b45309)', bg: 'var(--color-warning-50, #fffbeb)',  border: 'var(--color-warning-200, #fde68a)',  label: '适应症' },
};

function GraphTab() {
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const filtered = search
    ? KG_NODES.filter(n => n.name.includes(search) || KG_TYPE_STYLE[n.type].label.includes(search))
    : KG_NODES;

  const connectedIds = new Set<string>();
  if (selectedNode) {
    KG_LINKS.forEach(l => { if (l.source === selectedNode.id) connectedIds.add(l.target); if (l.target === selectedNode.id) connectedIds.add(l.source); });
    connectedIds.add(selectedNode.id);
  }

  return (
    <div className="flex h-full">
      {/* 搜索栏 */}
      <div className="w-full px-3 py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-neutral-400, #94a3b8)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索药材 / 成分 / 靶点…"
            aria-label="搜索知识图谱节点"
            className="w-full min-h-[36px] pl-7 pr-2 text-[12px] rounded-md border outline-none transition-all focus:ring-1 focus:ring-emerald-500"
            style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: '#fff', color: 'var(--color-neutral-700, #334155)' }}
          />
        </div>
      </div>

      {/* SVG 图谱区 */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#fff' }}>
        <svg viewBox="0 0 280 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* 连线 */}
          {KG_LINKS.filter(l => {
            const s = KG_NODES.find(n => n.id === l.source);
            const t = KG_NODES.find(n => n.id === l.target);
            if (!s || !t) return false;
            if (search && !filtered.includes(s) && !filtered.includes(t)) return false;
            return true;
          }).map((l, i) => {
            const s = KG_NODES.find(n => n.id === l.source)!;
            const t = KG_NODES.find(n => n.id === l.target)!;
            const isDimmed = selectedNode && !(connectedIds.has(s.id) && connectedIds.has(t.id));
            return (
              <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isDimmed ? 'var(--color-neutral-100, #f1f5f9)' : 'var(--color-neutral-300, #cbd5e1)'} strokeWidth={isDimmed ? 0.5 : 1}
                strokeDasharray={isDimmed ? 'none' : '3 2'}
                style={{ transition: 'all 0.3s' }} />
            );
          })}
          {/* 节点 */}
          {filtered.map(node => {
            const cfg = KG_TYPE_STYLE[node.type];
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode === node.id;
            const isDimmed = selectedNode && !connectedIds.has(node.id);
            return (
              <g key={node.id} onClick={() => setSelectedNode(isSelected ? null : node)}
                onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.25 : 1, transition: 'opacity 0.2s' }}>
                {/* 脉冲圈 */}
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={10} fill="none" stroke={cfg.color} strokeWidth={0.5} opacity={0.4}>
                    <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={node.x} cy={node.y} r={isSelected || isHovered ? 7 : 5.5}
                  fill={cfg.bg} stroke={cfg.color} strokeWidth={isSelected ? 2 : 1.2}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }} />
                <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize={5.5} fill="var(--color-neutral-600, #475569)" fontWeight={isSelected ? 600 : 400}>
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 图例 */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-neutral-50, #f8fafc) 95%, transparent)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>
          {(['herb','compound','target','disease'] as const).map(t => (
            <div key={t} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: KG_TYPE_STYLE[t].color }} />
              <span className="text-[12px] text-slate-500">{KG_TYPE_STYLE[t].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧详情面板 */}
      {selectedNode && (
        <div className="w-32 flex-shrink-0 border-l p-3 overflow-y-auto" style={{ background: 'var(--color-neutral-50, #fafbfc)', borderColor: 'var(--color-neutral-200, #e2e8f0)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: KG_TYPE_STYLE[selectedNode.type].color }} />
            <span className="lp-tiny font-semibold text-slate-800">{selectedNode.name}</span>
          </div>
          <div className="text-[12px] font-mono px-1.5 py-0.5 rounded mb-2 inline-block" style={{ background: KG_TYPE_STYLE[selectedNode.type].bg, color: KG_TYPE_STYLE[selectedNode.type].color, border: `1px solid ${KG_TYPE_STYLE[selectedNode.type].border}` }}>
            {KG_TYPE_STYLE[selectedNode.type].label}
          </div>
          <p className="text-[12px] text-slate-500 leading-[1.55] mb-2">{selectedNode.desc}</p>
          <div className="text-[12px] text-slate-500">关联节点</div>
          <div className="mt-1 space-y-0.5">
            {KG_LINKS.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map((l, i) => {
              const otherId = l.source === selectedNode.id ? l.target : l.source;
              const other = KG_NODES.find(n => n.id === otherId);
              if (!other) return null;
              return (
                <div key={i} role="button" tabIndex={0} onClick={() => setSelectedNode(other)}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNode(other); } }}
                   className="flex items-center gap-1 text-[12px] text-slate-600 cursor-pointer hover:text-emerald-700 transition-colors min-h-[22px]"
                >
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: KG_TYPE_STYLE[other.type].color }} />
                  {other.name}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3：数据看板 ──────────────────────────────────────────────
interface DSItem { name: string; status: 'online' | 'syncing' | 'update'; stat: string; unit: string; color: string; desc: string; features: string[]; }

const DS_DATA: DSItem[] = [
  { name: 'TCMSP',      status: 'online',  stat: '29,361', unit: '药材条目',  color: 'var(--color-primary-700, #047857)', desc: '中药材化学成分与靶点数据库，覆盖 16 个 Alembic 迁移版本', features: ['化学成分检索', '靶点匹配', '药理作用分析'] },
  { name: 'DFBP',       status: 'online',  stat: '5,200+', unit: '活性肽结构', color: 'var(--color-secondary-700, #1d4ed8)', desc: '食源性活性肽序列数据库，PepINVENT 引擎实时集成',         features: ['肽序列预测', 'ADMET 评估', '毒性致敏性分析'] },
  { name: 'Neo4j 图谱', status: 'online',  stat: '128K',   unit: '知识节点',   color: 'var(--color-accent-700, #6d28d9)', desc: '药食同源多维关联图谱，Cypher 查询引擎驱动',               features: ['多维关联查询', 'D3 可视化', '图谱推理'] },
  { name: '卫健委目录', status: 'syncing', stat: '130+',   unit: '法定条目',   color: 'var(--color-danger-700, #dc2626)', desc: '实时同步卫健委药食同源名单，动态法规更新',                 features: ['配伍禁忌检测', '过敏原标注', '合规预判'] },
  { name: '食品安全国标', status: 'update', stat: '380+',  unit: '国标条款',   color: 'var(--color-warning-700, #b45309)', desc: 'GB 2760 / GB 14880 / GB 28050 核心标准全文检索',          features: ['全文检索', '条款对照', '版本追溯'] },
];

const ACTIVITY_LOG = [
  { time: '刚刚', action: '卫健委目录同步', detail: '新增 3 条法规条目', type: 'syncing' },
  { time: '5 分钟前', action: 'TCMSP 增量更新', detail: '+312 味药材数据', type: 'online' },
  { time: '12 分钟前', action: 'Neo4j 图谱推理', detail: '完成 1,240 条关联推演', type: 'online' },
  { time: '1 小时前', action: '食品安全国标', detail: 'GB 2760-2024 版本已确认', type: 'update' },
];

function DataTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAnimKey(k => k + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const statusIcon = (s: string) => {
    if (s === 'online')  return <CheckCircle size={11} style={{ color: 'var(--color-primary-700, #047857)' }} />;
    if (s === 'syncing') return <Loader2 size={11} className="animate-spin" style={{ color: 'var(--color-secondary-700, #1d4ed8)' }} />;
    return <Clock size={11} style={{ color: 'var(--color-warning-700, #b45309)' }} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <div className="flex items-center gap-2">
          <DBIcon size={11} style={{ color: 'var(--color-neutral-500, #64748b)' }} />
          <span className="lp-tiny font-medium text-slate-600">数据源概览</span>
          <span className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-success-50, #ecfdf5)', color: 'var(--color-primary-700, #047857)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>5 个活跃</span>
        </div>
        <button onClick={() => setAnimKey(k => k + 1)} className="text-[12px] text-slate-500 hover:text-emerald-700 transition-colors flex items-center gap-1" title="刷新">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          同步
        </button>
      </div>

      {/* 数据卡片网格 */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {DS_DATA.map(ds => {
            const isExpanded = expanded === ds.name;
            return (
              <div key={ds.name} role="button" tabIndex={0} onClick={() => setExpanded(isExpanded ? null : ds.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : ds.name) } }}
                className="rounded-md overflow-hidden transition-all duration-200 cursor-pointer"
                style={{
                  background: isExpanded ? '#fff' : '#fff',
                  border: `1px solid ${isExpanded ? ds.color + '40' : 'var(--color-neutral-200, #e2e8f0)'}`,
                  boxShadow: isExpanded ? `0 2px 8px ${ds.color}15` : 'none',
                }}>
                {/* 顶部色条 */}
                <div className="h-0.5 w-full" style={{ background: ds.color + '40' }} />
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="lp-tiny font-semibold text-slate-800 leading-tight">{ds.name}</span>
                    {statusIcon(ds.status)}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-base font-bold font-mono leading-none" style={{ color: 'var(--color-neutral-900, #0f172a)' }}>{ds.stat}</span>
                    <span className="text-[12px] text-slate-500">{ds.unit}</span>
                  </div>
                  {/* 功能标签 */}
                  <div className="flex flex-wrap gap-0.5">
                    {ds.features.slice(0, isExpanded ? 3 : 2).map(f => (
                      <span key={f} className="text-[12px] px-1 py-0.5 rounded" style={{ background: 'var(--color-neutral-100, #f1f5f9)', color: 'var(--color-neutral-600, #475569)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>{f}</span>
                    ))}
                  </div>
                </div>
                {/* 展开详情 */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 border-t" style={{ borderColor: 'var(--color-neutral-100, #f1f5f9)' }}>
                    <p className="text-[12px] text-slate-500 leading-[1.55] mt-1.5">{ds.desc}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-[12px] text-slate-500">
                      <Clock size={9} />
                      <span>上次同步：刚刚</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 活动日志 */}
        <div className="mt-2.5 rounded-md border p-2.5" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
          <div className="text-[12px] font-medium text-slate-500 mb-1.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            同步活动记录
          </div>
          {ACTIVITY_LOG.map((log, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-t" style={{ borderColor: 'var(--color-neutral-100, #f1f5f9)', fontSize: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ color: 'var(--color-neutral-500, #64748b)' }}>{log.time}</span>
              <span className="text-slate-600 flex-1 truncate">{log.action}</span>
              <span className="text-slate-500 flex-shrink-0">{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 4：合规检测 ──────────────────────────────────────────────
interface ComplianceResult {
  status: 'idle' | 'scanning' | 'done';
  score: number;
  hazards: { label: string; severity: 'safe' | 'warn' | 'error'; detail: string }[];
  analysis: { label: string; result: 'pass' | 'warn'; detail: string }[];
}

const COMPLIANCE_RULES: Record<string, { hazards?: { label: string; severity: 'safe' | 'warn' | 'error'; detail: string }[]; compat?: { label: string; result: 'pass' | 'warn'; detail: string }[] }> = {
  '黄芪': { hazards: [{ label: '安全性', severity: 'safe', detail: '无已知配伍禁忌，孕期慎用' }], compat: [{ label: '黄芪+枸杞', result: 'pass', detail: '经典补益组合，协同增效' }, { label: '黄芪+甘草', result: 'pass', detail: '补气调和，剂量合理' }] },
  '枸杞': { hazards: [{ label: '安全性', severity: 'safe', detail: '药食同源，常规用量安全' }], compat: [{ label: '枸杞+菊花', result: 'pass', detail: '清肝明目经典配伍' }] },
  '甘草': { hazards: [{ label: '甘草酸累积', severity: 'warn', detail: '长期大剂量（>6g/日）可能引起血压升高' }], compat: [{ label: '甘草+黄芪', result: 'pass', detail: '调和诸药，剂量在安全范围' }, { label: '甘草+海藻', result: 'warn', detail: '十八反禁忌，避免同用' }] },
  '当归': { hazards: [{ label: '活血作用', severity: 'warn', detail: '经期及孕妇慎用，可能增加出血风险' }], compat: [{ label: '当归+黄芪', result: 'pass', detail: '气血双补经典配伍' }] },
  '金银花': { hazards: [{ label: '寒凉属性', severity: 'safe', detail: '脾胃虚寒者慎用' }], compat: [{ label: '金银花+连翘', result: 'pass', detail: '银翘散核心药对，协同清热' }] },
  '连翘': { hazards: [{ label: '苦寒', severity: 'safe', detail: '无特殊禁忌' }], compat: [{ label: '连翘+金银花', result: 'pass', detail: '清热解毒经典组合' }] },
};

function ComplianceTab() {
  const [ingredients, setIngredients] = useState('黄芪\n枸杞\n甘草\n当归');
  const [result, setResult] = useState<ComplianceResult>({ status: 'idle', score: 0, hazards: [], analysis: [] });
  const [progress, setProgress] = useState(0);

  const runCheck = async () => {
    const lines = ingredients.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;

    setResult({ status: 'scanning', score: 0, hazards: [], analysis: [] });
    setProgress(0);

    // 模拟检测步骤
    const steps = [
      { label: '扫描原料数据库', pct: 25, delay: 400 },
      { label: '检查配伍禁忌', pct: 50, delay: 600 },
      { label: '验证法规合规', pct: 75, delay: 500 },
      { label: '生成检测报告', pct: 100, delay: 300 },
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, step.delay));
      setProgress(step.pct);
    }

    const allHazards: ComplianceResult['hazards'] = [];
    const allAnalysis: ComplianceResult['analysis'] = [];
    let score = 100;

    lines.forEach(ing => {
      const rule = COMPLIANCE_RULES[ing.trim()];
      if (rule?.hazards) rule.hazards.forEach(h => {
        allHazards.push(h);
        if (h.severity === 'warn') score -= 5;
        if (h.severity === 'error') score -= 15;
      });
      if (rule?.compat) rule.compat.forEach(a => allAnalysis.push(a));
    });

    // 自动配对未匹配的组合
    if (lines.length >= 2) {
      allAnalysis.push({ label: '整体配伍评估', result: score >= 90 ? 'pass' : 'warn', detail: score >= 90 ? '配方整体安全，无严重禁忌' : '存在部分风险项，建议调整剂量' });
    }

    setResult({ status: 'done', score: Math.max(0, score), hazards: allHazards, analysis: allAnalysis });
  };

  const statusLabel = () => {
    if (result.status === 'idle') return '● 就绪';
    if (result.status === 'scanning') return `◌ 检测中 ${progress}%`;
    return '● 完成';
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区 */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <div className="text-[12px] font-medium text-slate-500 mb-1.5 flex items-center gap-1">
          <ShieldCheck size={11} style={{ color: 'var(--color-neutral-500, #64748b)' }} />
          输入配方成分（每行一个）
        </div>
        <textarea
          value={ingredients}
          onChange={e => { setIngredients(e.target.value); setResult({ status: 'idle', score: 0, hazards: [], analysis: [] }); }}
          rows={4}
          className="w-full text-[12px] text-slate-700 resize-none outline-none leading-[1.7] bg-transparent"
          placeholder="黄芪&#10;枸杞&#10;甘草"
        />
        <button onClick={runCheck} disabled={result.status === 'scanning'}
          className="mt-1.5 w-full min-h-[36px] rounded-md lp-tiny font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          style={{ background: result.status === 'scanning' ? 'var(--color-neutral-400, #94a3b8)' : 'var(--color-primary-700, #047857)', color: '#fff' }}>
          {result.status === 'scanning'
            ? <><Loader2 size={11} className="animate-spin" />检测中…</>
            : <><ShieldCheck size={11} />开始合规检测</>
          }
        </button>
      </div>

      {/* 进度条 */}
      {result.status === 'scanning' && (
        <div className="h-0.5 w-full" style={{ background: 'var(--color-neutral-100, #f1f5f9)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-primary-600, #059669), var(--color-success-500, #34d399))' }} />
        </div>
      )}

      {/* 检测结果 */}
      <div className="flex-1 overflow-y-auto p-3">
        {result.status === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ShieldCheck size={24} style={{ color: 'var(--color-neutral-300, #cbd5e1)', marginBottom: 8 }} />
            <p className="text-[12px] text-slate-500 mb-1">输入成分后点击检测</p>
            <p className="text-[12px] text-slate-400">覆盖配伍禁忌 · 过敏原风险 · 法规合规</p>
          </div>
        )}

        {result.status === 'scanning' && (
          <div className="h-full flex flex-col items-center justify-center">
            <Loader2 size={20} className="animate-spin mb-2" style={{ color: 'var(--color-primary-700, #047857)' }} />
            <p className="text-[12px] text-slate-500">正在扫描 {progress}%</p>
          </div>
        )}

        {result.status === 'done' && (
          <div className="space-y-2">
            {/* 总评分 */}
            <div className="rounded-md p-2.5 flex items-center gap-3" style={{ background: result.score >= 90 ? 'var(--color-success-50, #ecfdf5)' : result.score >= 70 ? 'var(--color-warning-50, #fffbeb)' : 'var(--color-danger-50, #fef2f2)', border: `1px solid ${result.score >= 90 ? 'var(--color-success-200, #a7f3d0)' : result.score >= 70 ? 'var(--color-warning-200, #fde68a)' : 'var(--color-danger-200, #fecaca)'}` }}>
              <div className="text-center">
                <div className="text-xl font-bold font-mono leading-none" style={{ color: result.score >= 90 ? 'var(--color-primary-700, #047857)' : result.score >= 70 ? 'var(--color-warning-700, #b45309)' : 'var(--color-danger-700, #dc2626)' }}>{result.score}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">安全评分</div>
              </div>
              <div className="flex-1">
                <div className="lp-tiny font-semibold" style={{ color: result.score >= 90 ? 'var(--color-primary-800, #065f46)' : result.score >= 70 ? 'var(--color-warning-800, #92400e)' : 'var(--color-danger-800, #991b1b)' }}>
                  {result.score >= 90 ? '✅ 配方整体安全' : result.score >= 70 ? '⚠️ 存在部分风险项' : '❌ 存在严重禁忌'}
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5">
                  {result.hazards.filter(h => h.severity === 'warn').length} 个警告 · {result.analysis.filter(a => a.result === 'pass').length} 项通过
                </div>
              </div>
            </div>

            {/* 风险项 */}
            {result.hazards.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-slate-500 mb-1 px-1">风险检测</div>
                {result.hazards.map((h, i) => (
                  <div key={i} className="flex items-start gap-1.5 px-1.5 py-1.5 rounded-md mb-1" style={{ background: h.severity === 'safe' ? 'var(--color-neutral-50, #f8fafc)' : h.severity === 'warn' ? 'var(--color-warning-50, #fffbeb)' : 'var(--color-danger-50, #fef2f2)', border: `1px solid ${h.severity === 'safe' ? 'var(--color-neutral-200, #e2e8f0)' : h.severity === 'warn' ? 'var(--color-warning-200, #fde68a)' : 'var(--color-danger-200, #fecaca)'}` }}>
                    {h.severity === 'safe' ? <CheckCircle size={11} style={{ color: 'var(--color-primary-700, #047857)', flexShrink: 0, marginTop: 1 }} />
                     : h.severity === 'warn' ? <AlertTriangle size={11} style={{ color: 'var(--color-warning-700, #b45309)', flexShrink: 0, marginTop: 1 }} />
                     : <XCircle size={11} style={{ color: 'var(--color-danger-700, #dc2626)', flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <div className="lp-tiny font-medium text-slate-700">{h.label}</div>
                      <div className="lp-micro text-slate-500">{h.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 配伍分析 */}
            {result.analysis.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-slate-500 mb-1 px-1">配伍分析</div>
                {result.analysis.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md mb-0.5" style={{ background: a.result === 'pass' ? 'var(--color-neutral-50, #f8fafc)' : 'var(--color-warning-50, #fffbeb)', border: `1px solid ${a.result === 'pass' ? 'var(--color-neutral-200, #e2e8f0)' : 'var(--color-warning-200, #fde68a)'}` }}>
                    {a.result === 'pass'
                      ? <CheckCircle size={11} style={{ color: 'var(--color-primary-700, #047857)' }} />
                      : <AlertTriangle size={11} style={{ color: 'var(--color-warning-700, #b45309)' }} />}
                    <span className="lp-tiny font-medium text-slate-700">{a.label}</span>
                    <span className="lp-micro text-slate-400 ml-auto">{a.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-1">
              <button onClick={runCheck} className="flex-1 h-7 rounded-md lp-tiny font-medium flex items-center justify-center gap-1" style={{ background: 'var(--color-neutral-50, #f8fafc)', border: '1px solid var(--color-neutral-200, #e2e8f0)', color: 'var(--color-neutral-600, #475569)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                重新检测
              </button>
              <button className="flex-1 min-h-[36px] rounded-md lp-tiny font-medium flex items-center justify-center gap-1" style={{ background: 'var(--color-primary-700, #047857)', color: '#fff' }}>
                <FileText size={11} />导出报告
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ProductPreview() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [demoState, setDemoState] = useState<DemoState>({ status: 'idle', message: '' });
  const [activeTab, setActiveTab] = useState(0);
  const [thinkingStep, setThinkingStep] = useState(0);
  const tabContentKey = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { tabContentKey.current += 1; }, [activeTab]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, demoState.status]);
  useEffect(() => {
    if (demoState.status !== 'thinking') return;
    setThinkingStep(0);
    const interval = setInterval(() => { setThinkingStep(prev => Math.min(prev + 1, THINKING_STEPS.length - 1)); }, 600);
    return () => clearInterval(interval);
  }, [demoState.status]);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 80)}px`; }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || demoState.status === 'thinking') return;
    const userMessage = input.trim(); setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setDemoState({ status: 'thinking', message: '' });
    try {
      const result = await callDemoChat(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply, timestamp: Date.now() }]);
      setDemoState({ status: 'success', message: result.reply });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '请求失败，请稍后重试';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: Date.now() }]);
      setDemoState({ status: 'error', message: errorMsg });
    }
  };

  const triggerPreset = (q: string) => {
    setInput(q);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }]);
      setDemoState({ status: 'thinking', message: '' });
      callDemoChat(q).then(result => {
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply, timestamp: Date.now() }]);
        setDemoState({ status: 'success', message: result.reply });
      }).catch(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: '请求失败，请稍后重试', timestamp: Date.now() }]);
        setDemoState({ status: 'error', message: '请求失败' });
      });
    }, 80);
  };

  const isConversing = messages.length > 0;
  const tabLabel = ['对话', '图谱', '数据', '合规'][activeTab];
  const tabEngine = ['thinking-engine', 'neo4j-graph', 'live-sync', 'compliance-engine'][activeTab];
  const tabStatus = activeTab === 0
    ? (demoState.status === 'idle' ? '● 就绪' : demoState.status === 'thinking' ? '◌ 分析中…' : demoState.status === 'success' ? '● 完成' : '● 出错')
    : activeTab === 1 ? `● ${tabLabel} · ${KG_NODES.length} 节点`
    : activeTab === 2 ? '● 数据 · 5 源已连接'
    : '● 合规检测就绪';

  return (
    <div className="relative">
      <div className="lp-preview-glow absolute inset-0 pointer-events-none" />
      <div className="lp-preview-window relative z-10">
        {/* 标题栏 */}
        <div className="lp-titlebar flex items-center gap-0 px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="lp-brand tracking-wider" style={{ color: 'var(--color-neutral-300, #cbd5e1)' }}>莱茵分子</span>
            <div className="w-px h-3 bg-slate-700" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded lp-section-tag" style={{ background: 'color-mix(in srgb, var(--color-primary-700, #047857) 45%, transparent)', color: '#ffffff', border: '1px solid color-mix(in srgb, var(--color-primary-700, #047857) 60%, transparent)' }}>
              <Sparkles size={10} /><span>智能对话</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: demoState.status === 'error' ? 'var(--color-danger-500, #ef4444)' : 'var(--color-success-500, #34d399)', boxShadow: '0 0 4px color-mix(in srgb, var(--color-primary-500, #10b981) 40%, transparent)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-400, #94a3b8)' }}>{demoState.status === 'error' ? '离线' : '在线'}</span>
            </div>
            <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-400, #94a3b8)' }}>v2.4</span>
          </div>
        </div>

        {/* 主体 */}
        <div className="flex min-h-[400px] max-h-[480px]">
          {/* 侧边导航 */}
          <div className="lp-sidebar w-11 flex-shrink-0 flex flex-col items-center py-3 gap-1">
            {SIDEBAR_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isActive = activeTab === i;
              return (
                <button key={item.label} onClick={() => setActiveTab(i)} aria-label={item.label} title={item.label}
                  className="w-11 h-11 rounded-md flex items-center justify-center transition-all duration-150"
                  style={isActive ? { background: 'var(--color-primary-700, #047857)', color: '#fff', border: '1px solid var(--color-primary-700, #047857)', boxShadow: '0 1px 2px color-mix(in srgb, var(--color-primary-500, #10b981) 30%, transparent)' } : { background: 'transparent', color: 'var(--color-neutral-600, #475569)', border: '1px solid transparent' }}>
                  <Icon size={16} strokeWidth={1.8} />
                </button>
              );
            })}
            <div className="w-5 h-px my-1.5" style={{ background: 'var(--border-color, #e2e8f0)' }} />
            <button
              onClick={() => { if (activeTab === 0) { setMessages([]); setDemoState({ status: 'idle', message: '' }); } }}
              aria-label="刷新对话"
              title="刷新"
              className="w-11 h-11 rounded-md flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-neutral-500, #64748b)', border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-neutral-200, #e2e8f0)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral-700, #334155)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral-500, #64748b)'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 0 && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {!isConversing ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 lp-welcome-icon" style={{ background: 'linear-gradient(135deg, var(--color-success-50, #ecfdf5) 0%, var(--color-success-100, #d1fae5) 100%)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>
                        <Sparkles size={16} style={{ color: 'var(--color-primary-600, #059669)' }} />
                      </div>
                      <p className="lp-label font-semibold mb-1" style={{ color: 'var(--color-neutral-700, #334155)' }}>与配方顾问对话</p>
                      <p className="text-[12px] text-slate-500 text-center leading-relaxed mb-6 max-w-[220px]">输入您的研发需求，获取专业配方设计与安全评估</p>
                      <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                        {PRESET_QUESTIONS.map((q, i) => (
                          <button key={i} onClick={() => triggerPreset(q)}
                            className="text-left px-3 py-2 rounded-lg text-[12px] leading-relaxed text-slate-600 transition-all duration-150 border min-h-[44px] flex items-center"
                            style={{ background: 'var(--color-neutral-50, #f8fafc)', borderColor: 'var(--color-neutral-100, #eef2f7)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-success-50, #f0fdf4)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-success-200, #bbf7d0)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary-800, #065f46)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-neutral-50, #f8fafc)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-neutral-100, #eef2f7)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-neutral-600, #475569)'; }}
                          >{q}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} lp-chat-bubble-in`} style={{ animationDelay: `${i * 0.04}s` }}>
                          {msg.role === 'assistant' && (
                            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-success-50, #ecfdf5)', border: '1px solid var(--color-success-100, #d1fae5)' }}>
                              <Sparkles size={10} style={{ color: 'var(--color-primary-700, #047857)' }} />
                            </div>
                          )}
                          <div className="px-3 py-2 max-w-[80%] leading-relaxed" style={{ background: msg.role === 'user' ? 'linear-gradient(135deg, var(--color-primary-600, #059669) 0%, var(--color-primary-700, #047857) 100%)' : '#ffffff', color: msg.role === 'user' ? '#fff' : 'var(--color-neutral-800, #1e293b)', borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 3px', border: msg.role === 'assistant' ? '1px solid var(--color-neutral-200, #e2e8f0)' : 'none', lineHeight: '1.65', boxShadow: msg.role === 'assistant' ? '0 1px 4px color-mix(in srgb, #000000 6%, transparent)' : 'none' }}>
                            <MarkdownRenderer content={msg.content} />
                          </div>
                        </div>
                      ))}
                      {demoState.status === 'thinking' && (
                        <div className="flex justify-start lp-chat-bubble-in">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-success-50, #ecfdf5)', border: '1px solid var(--color-success-100, #d1fae5)' }}>
                            <Sparkles size={10} style={{ color: 'var(--color-primary-700, #047857)' }} />
                          </div>
                          <div className="px-4 py-3 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--color-neutral-200, #e2e8f0)', boxShadow: '0 1px 4px color-mix(in srgb, #000000 6%, transparent)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              {THINKING_STEPS.map((step, i) => (
                                <div key={step.label} className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full transition-all duration-300" style={{ background: i <= thinkingStep ? step.color : 'var(--color-neutral-200, #e2e8f0)', opacity: i <= thinkingStep ? 1 : 0.4 }} />
                                  <span className="text-[12px] text-slate-500">{step.label}</span>
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
                      {demoState.status === 'error' && (
                        <div className="flex justify-start lp-chat-bubble-in">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-danger-50, #fef2f2)', border: '1px solid var(--color-danger-200, #fecaca)' }}>
                            <AlertCircle size={10} style={{ color: 'var(--color-danger-700, #dc2626)' }} />
                          </div>
                          <div className="px-3 py-2 text-[12px] text-red-600 rounded-xl" style={{ background: 'var(--color-danger-50, #fef2f2)', border: '1px solid var(--color-danger-300, #fca5a5)' }}>{demoState.message}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex-shrink-0 px-4 py-3 border-t" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
                  <form onSubmit={handleSubmit} className="flex items-end gap-2">
                    <div className="flex-1 relative rounded-lg border overflow-hidden transition-all lp-input-border" style={{ borderColor: 'var(--border-color, #e2e8f0)', background: 'var(--bg-canvas, #f8fafc)' }}>
                      <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                        placeholder="描述您的研发需求…" rows={1} disabled={demoState.status === 'thinking'}
                        aria-label="配方研发需求输入"
                        className="w-full resize-none px-3 py-2.5 text-[12px] text-slate-800 placeholder:text-slate-400 bg-transparent outline-none leading-[1.6]" style={{ maxHeight: 80 }} />
                      <div className="absolute bottom-1.5 right-2"><kbd className="text-[12px] font-mono text-slate-400 px-1 py-0.5 rounded" style={{ border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>⏎</kbd></div>
                    </div>
                    <button type="submit" disabled={!input.trim() || demoState.status === 'thinking'}
                      aria-label="发送"
                      className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 disabled:opacity-30 hover:opacity-90 active:scale-95"
                      style={{ background: 'var(--color-primary-700, #047857)' }}>
                      {demoState.status === 'thinking' ? <Loader2 size={14} color="white" className="animate-spin" /> : <Send size={14} color="white" />}
                    </button>
                  </form>
                </div>
              </div>
            )}
            {activeTab === 1 && <GraphTab key={tabContentKey.current} />}
            {activeTab === 2 && <DataTab key={tabContentKey.current} />}
            {activeTab === 3 && <ComplianceTab key={tabContentKey.current} />}
          </div>
        </div>

        {/* 状态栏 */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t" style={{ background: 'var(--bg-canvas, #f8fafc)', borderColor: 'var(--border-color, #e2e8f0)' }}>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary, #475569)' }}>{tabStatus}</span>
            {isConversing && <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted, #475569)' }}>· {messages.length} 轮</span>}
          </div>
          <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted, #475569)' }}>{tabEngine}</span>
        </div>
      </div>
    </div>
  );
}

// ── Hero 底部全宽指标浮标 ──────────────────────────────────────
function HeroMetricsBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)' }}>
      <span className="lp-hero-metric">
        <span style={{ color: 'var(--color-primary-700, #047857)' }}>●</span>
        <strong>200+</strong> 研发机构
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: 'var(--color-accent-700, #6d28d9)' }}>●</span>
        <strong>128K</strong> 知识节点
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: 'var(--color-secondary-700, #1d4ed8)' }}>●</span>
        <strong>5</strong> 大权威数据源
      </span>
      <span className="lp-hero-metric">
        <span style={{ color: 'var(--color-warning-700, #b45309)' }}>●</span>
        <strong>72h</strong> 平均研发周期
      </span>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────
export default function Hero() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="lp-grid-bg relative overflow-hidden" style={{ background: '#fff' }}>
      <CountdownBanner />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* 左侧文案 */}
          <div className="max-w-xl pt-4">
            <Reveal>
              <div className="flex items-center gap-2 mb-4">
                <span className="lp-brand" style={{ color: 'var(--color-primary-700, #047857)' }}>莱茵分子</span>
                <span className="text-slate-400">·</span>
                <span className="lp-caption">药食同源 AI 配方研发平台</span>
              </div>

              <h1 className="lp-h1 mb-5">
                让配方研发
                <br />
                <span className="text-emerald-700">像对话一样简单</span>
              </h1>

              <p className="lp-body mb-8 max-w-lg" style={{ color: 'var(--color-neutral-600, #475569)' }}>
                整合 TCMSP、DFBP、知识图谱等五大权威数据源，
                为研发团队提供从原料筛选到合规审查的完整工作流。
              </p>

              <Reveal delay="lp-reveal-delay-1">
                <div className="flex flex-col sm:flex-row items-start gap-3 mb-10">
                  <Link to="/login" className="lp-cta-primary">
                    {isAuthenticated ? '进入工作台' : '立即体验'}
                    <ArrowRight size={13} />
                  </Link>
                  <Link to="#demo-area" className="lp-cta-secondary">
                    <ChevronRight size={14} />
                    产品演示
                  </Link>
                </div>
              </Reveal>

              <Reveal delay="lp-reveal-delay-2">
                <div className="flex items-center gap-3 lp-label text-slate-500">
                  <div className="flex -space-x-1.5">
                    {testimonials.slice(0, 4).map((t, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[12px] font-bold text-white" style={{ background: t.gradient }}>
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

        <Reveal delay="lp-reveal-delay-2">
          <HeroMetricsBar />
        </Reveal>
      </div>
    </section>
  );
}

