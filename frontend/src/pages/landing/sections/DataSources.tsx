/**
 * DataSources 组件 v7 — 学术数据库卡片
 *
 * 设计理念：
 *   - 去除数据流管道动画（过于科技感）
 *   - 卡片如数据库条目，信息清晰
 *   - 单一绿色强调，去彩虹渐变
 *   - 状态指示如期刊标记
 */
import { useState } from 'react';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  dataSources, type DataSource,
} from '../data/dataSources';
import { Database, Network, Shield, Scale, FlaskConical, RefreshCw } from 'lucide-react';

function StatusBadge({ status }: { status: DataSource['status'] }) {
  const cfg = {
    online:  { label: '在线', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    syncing: { label: '同步中', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    update:  { label: '已更新', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  };
  const c = cfg[status];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
          style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status === 'syncing' && <RefreshCw size={8} className="animate-spin" />}
      {c.label}
    </span>
  );
}

function DataSourceCard({ data, index }: { data: DataSource; index: number }) {
  const [hovered, setHovered] = useState(false);

  const iconMap: Record<string, React.ReactNode> = {
    'flask-conical': <FlaskConical size={14} />,
    'dna': <Database size={14} />,
    'network': <Network size={14} />,
    'shield-check': <Shield size={14} />,
    'scale': <Scale size={14} />,
  };

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="rounded-sm overflow-hidden transition-all duration-200 cursor-default"
        style={{
          background: hovered ? '#fff' : '#fafafa',
          border: `1px solid ${hovered ? data.colorBorder : '#e2e8f0'}`,
          boxShadow: hovered ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 顶部标识条 */}
        <div className="h-0.5 w-full" style={{ background: data.color + '40' }} />

        <div className="p-4">
          {/* 图标 + 名称 + 状态 */}
          <div className="flex items-start gap-2.5 mb-3">
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0"
              style={{ background: data.colorLight, color: data.color, border: `1px solid ${data.colorBorder}` }}
            >
              {iconMap[data.icon] || <Database size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[12px] font-bold text-slate-900">{data.name}</span>
                <StatusBadge status={data.status} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: data.color }}>{data.subtitle}</span>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[12px] leading-relaxed text-slate-600 mb-3 min-h-[40px]">
            {data.desc}
          </p>

          {/* 能力标签 */}
          <div className="flex flex-wrap gap-1 mb-3">
            {data.features.map((f) => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-sm"
                    style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                {f}
              </span>
            ))}
          </div>

          {/* 底部统计 */}
          <div className="flex items-end justify-between pt-2.5 border-t border-slate-100">
            <div>
              <span className="text-lg font-bold font-mono leading-none" style={{ color: data.color }}>{data.stat}</span>
              <div className="text-[10px] mt-0.5 text-slate-400">{data.statLabel}</div>
            </div>
            {hovered && (
              <div className="text-[9px] font-mono" style={{ color: data.color }}>
                <RefreshCw size={9} className="inline mr-0.5" />
                连接就绪
              </div>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// 移除管道可视化，改为简洁的标题区
export default function DataSources() {
  return (
    <section className="py-16 lg:py-20" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题 */}
        <Reveal>
          <div className="text-center mb-8">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-2">
              数据底座
            </span>
            <h2 className="text-xl font-bold text-slate-900 mb-2">从权威数据出发</h2>
            <p className="text-[12px] text-slate-600 max-w-md mx-auto">
              覆盖中药材、活性肽、知识图谱、法规标准五大维度，支持跨库联合查询与实时同步。
            </p>
          </div>
        </Reveal>

        {/* 卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dataSources.map((ds, i) => (
            <DataSourceCard key={ds.id} data={ds} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
