/**
 * Algorithms 组件 v1 — 算法引擎展示区块
 *
 * 内容结构：
 *   1. 标题区
 *   2. 7 大优化算法引擎卡片（2列网格）
 *   3. 5 种协同作用机制（带公式）
 *   4. 性能基准数据表
 */
import { useState } from 'react';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  algorithms, synergyMechanisms, performanceMetrics,
  getAlgoIcon, type Algorithm, type AlgoCategory,
} from '../data/algorithms';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// ── 维度标签映射 ─────────────────────────────────────────────────
const ALGO_COLORS: Record<AlgoCategory, {
  primary: string;
  primaryLight: string;
  primaryBorder: string;
  primaryRGB: string;
  /** P0 对比度修复：文本专用深色（白底 4.5:1+） */
  primaryText: string;
}> = {
  optimizer: {
    primary: '#059669',
    primaryLight: '#ecfdf5',
    primaryBorder: '#a7f3d0',
    primaryRGB: '5,150,105',
    primaryText: '#047857',
  },
};

const CATEGORY_LABELS: Record<AlgoCategory, string> = {
  optimizer: '优化算法引擎',
};

// ── 算法卡片 ─────────────────────────────────────────────────────
function AlgoCard({ algo, index }: { algo: Algorithm; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = ALGO_COLORS[algo.category];
  const IconComp = getAlgoIcon(algo.icon);

  const handleCopy = () => {
    if (algo.backendClass) {
      navigator.clipboard.writeText(algo.backendClass).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="rounded-md overflow-hidden transition-all duration-200"
        style={{
          border: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        {/* 顶部色条 */}
        <div className="h-0.5 w-full" style={{ background: cfg.primary + '60' }} />

        <div className="p-5">
          {/* 头部 */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: cfg.primaryLight, color: cfg.primaryText, border: `1px solid ${cfg.primaryBorder}` }}
            >
              <IconComp size={15} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[14px] font-bold text-slate-900">{algo.title}</h3>
                {algo.metric && (
                  <span className="lp-caption font-mono shrink-0" style={{ color: '#047857' }}>
                    {algo.metric.value}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-500">{algo.subtitle}</div>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[13px] leading-[1.7] text-slate-600 mb-3">
            {algo.desc}
          </p>

          {/* 技术标签 */}
          <div className="flex flex-wrap gap-1 mb-3">
            {algo.tech.map((t) => (
              <span
                key={t}
                className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: cfg.primaryLight, color: cfg.primaryText, border: `1px solid ${cfg.primaryBorder}` }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* 适用场景（展开时显示） */}
          {expanded && algo.applicable && (
            <div className="mb-3 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
              <div className="text-[11px] text-slate-500 mb-1.5">适用场景</div>
              <div className="flex flex-wrap gap-1">
                {algo.applicable.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] px-2 py-0.5 rounded"
                    style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 后端类名 + 展开按钮 */}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
            <div className="flex items-center gap-1.5">
              {algo.backendClass && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-mono px-2 min-h-[44px] rounded transition-colors"
                  style={{ color: '#64748b', background: 'transparent', border: 'none' }}
                  title="复制类名"
                >
                  <span className="truncate max-w-[140px]">{algo.backendClass}</span>
                  {copied
                    ? <Check size={11} style={{ color: '#047857' }} />
                    : <Copy size={11} />}
                </button>
              )}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="flex items-center gap-0.5 text-[11px] text-slate-600 hover:text-slate-800 transition-colors min-h-[44px] px-1"
            >
              {expanded ? '收起' : '详情'}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ── 协同机制卡片 ──────────────────────────────────────────────────
function SynergyCard({ mech, index }: { mech: typeof synergyMechanisms[0]; index: number }) {
  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="rounded-md p-4"
        style={{ background: '#fff', border: '1px solid #e2e8f0' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-bold text-slate-800">{mech.name}</h4>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: '#f0fdf4', color: '#047857', border: '1px solid #bbf7d0' }}
          >
            权重 {mech.weight}
          </span>
        </div>
        <div
          className="font-mono text-[11px] px-2 py-1.5 rounded mb-2"
          style={{ background: '#0f172a', color: '#6ee7b7', overflowX: 'auto' }}
        >
          {mech.formula}
        </div>
        <p className="text-[12px] leading-[1.65] text-slate-600">{mech.desc}</p>
      </div>
    </Reveal>
  );
}

// ── 性能表格 ──────────────────────────────────────────────────────
function PerformanceTable() {
  return (
    <Reveal>
      <div
        className="rounded-md overflow-hidden"
        style={{ background: '#fff', border: '1px solid #e2e8f0' }}
      >
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['操作类型', 'P50', 'P95', 'P99', 'SLA 目标'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {performanceMetrics.map((m, i) => (
              <tr key={i} style={{ borderBottom: i < performanceMetrics.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <td className="px-3 py-2 text-slate-700 font-medium">{m.operation}</td>
                <td className="px-3 py-2 font-mono" style={{ color: '#047857' }}>{m.p50}</td>
                <td className="px-3 py-2 font-mono" style={{ color: '#1d4ed8' }}>{m.p95}</td>
                <td className="px-3 py-2 font-mono" style={{ color: '#b45309' }}>{m.p99}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{m.sla}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function Algorithms() {
  const optimizerAlgos = algorithms.filter((a) => a.category === 'optimizer');

  return (
    <section id="algorithms" className="py-16 lg:py-20" style={{ background: '#fff', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="mb-10">
            <span className="lp-section-tag block mb-3">算法引擎</span>
            <h2 className="lp-h2 mb-3">
              7 种优化算法 · 5 种协同机制 ·<br className="hidden sm:block" />
              亚秒级实时推理
            </h2>
            <p className="lp-body-sm max-w-2xl" style={{ color: '#475569' }}>
              基于统一优化调度器（UnifiedOptimizer）的智能策略选择系统，内置 Bandit 在线学习自动匹配最优算法引擎。
              5 种协同作用机制量化成分间交互，NSGA-III 支持 8 维目标 Pareto 优化，完整管线 P95 &lt; 3.2s。
            </p>
          </div>
        </Reveal>

        {/* 优化算法引擎 */}
        <Reveal>
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <span
                className="lp-section-tag px-3 py-1.5 shrink-0"
                style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
              >
                优化算法引擎
              </span>
              <span className="lp-caption text-slate-500">7 种求解器 · 统一接口 · 自动策略选择</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {optimizerAlgos.map((algo, i) => (
                <AlgoCard key={algo.id} algo={algo} index={i} />
              ))}
            </div>
          </div>
        </Reveal>

        {/* 协同作用机制 */}
        <Reveal>
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <span
                className="lp-section-tag px-3 py-1.5 shrink-0"
                style={{ background: '#f0fdf4', color: '#047857', border: '1px solid #bbf7d0' }}
              >
                协同机制
              </span>
              <span className="lp-caption text-slate-500">5 种数学模型 · 加权综合指数 SI</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {synergyMechanisms.slice(0, 5).map((mech, i) => (
                <SynergyCard key={mech.id} mech={mech} index={i} />
              ))}
            </div>
          </div>
        </Reveal>

        {/* 性能基准 */}
        <Reveal>
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-5">
              <span
                className="lp-section-tag px-3 py-1.5 shrink-0"
                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
              >
                性能基准
              </span>
              <span className="lp-caption text-slate-500">实测于 Intel i7 · Python 3.10 · 5 成分配方</span>
            </div>
            <PerformanceTable />
          </div>
        </Reveal>

      </div>
    </section>
  );
}
