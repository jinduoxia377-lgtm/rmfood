/**
 * DataSources 组件 v10 — Dashboard 数据基础设施风格
 *
 * 升级要点（v10）：
 *   - 顶部深色聚合统计横幅，仿数据看板头部
 *   - 卡片布局改为 2+3 双行结构（主数据源优先）
 *   - 每张卡片左侧彩色竖条标识数据来源
 *   - 统计数字升级为等宽字体 + 大字号，突出数据感
 *   - 功能标签改为内联小药丸，更紧凑
 *   - hover 显示"连接就绪"状态指示
 */
import { useState } from 'react';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  dataSources, type DataSource,
} from '../data/dataSources';
import { Database, Network, Shield, Scale, FlaskConical, RefreshCw } from 'lucide-react';

// ── 聚合统计 ──────────────────────────────────────────────────────
const TOTAL_ENTITIES = '38,074';
const SYNC_STATUS   = '实时同步';

// ── 状态指示点 ──────────────────────────────────────────────────────
function StatusDot({ status }: { status: DataSource['status'] }) {
  const cfg = {
    online:  { color: '#059669', label: '在线' },
    syncing: { color: '#2563eb', label: '同步中' },
    update:  { color: '#d97706', label: '已更新' },
  };
  const c = cfg[status];
  return (
    <div className="flex items-center gap-1.5" title={c.label}>
      <span
        className="lp-data-card-status-dot"
        style={{ background: c.color, boxShadow: `0 0 0 2px ${c.color}25` }}
      />
      <span className="lp-data-card-subtitle" style={{ color: c.color }}>{c.label}</span>
    </div>
  );
}

// ── 单张卡片 ────────────────────────────────────────────────────────
function DataSourceCard({ data, index }: { data: DataSource; index: number }) {
  const [hovered, setHovered] = useState(false);

  const iconMap: Record<string, React.ReactNode> = {
    'flask-conical': <FlaskConical size={14} />,
    'dna':           <Database size={14} />,
    'network':       <Network size={14} />,
    'shield-check':  <Shield size={14} />,
    'scale':         <Scale size={14} />,
  };

  const isPrimary = index < 2; // 前两张为主数据源，更大更显眼

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className={cn('lp-data-card', isPrimary && 'lp-data-card--primary')}
        style={{
          '--card-accent-color': data.color,
          '--card-hover-border': data.colorBorder,
        } as React.CSSProperties}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 左侧彩色竖条 */}
        <div className="lp-data-card-accent" style={{ background: data.color }} />

        {/* 头部：图标 + 名称 + 状态 */}
        <div className="lp-data-card-header">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="lp-data-card-icon"
              style={{ background: data.colorLight, color: data.color, borderColor: data.colorBorder }}
            >
              {iconMap[data.icon] ?? <Database size={14} />}
            </div>
            <div className="lp-data-card-title-group">
              <div className="lp-data-card-name">{data.name}</div>
              <div className="lp-data-card-subtitle" style={{ color: data.color }}>{data.subtitle}</div>
            </div>
          </div>
          <StatusDot status={data.status} />
        </div>

        {/* 描述 */}
        <div className="lp-data-card-body">
          <p className="lp-data-card-desc">{data.desc}</p>
          {/* 能力标签 */}
          <div className="lp-data-card-features">
            {data.features.map(f => (
              <span
                key={f}
                className="lp-data-card-feature"
                style={{
                  background: data.colorLight,
                  color: data.color,
                  border: `1px solid ${data.colorBorder}`,
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* 底部：统计 + 连接状态 */}
        <div className="lp-data-card-footer">
          <div className="lp-data-card-stat">
            <span className="lp-data-card-stat-value" style={{ color: data.color }}>{data.stat}</span>
            <span className="lp-data-card-stat-label">{data.statLabel}</span>
          </div>
          <span
            className="lp-data-card-connect"
            style={{ color: data.color, background: data.colorLight, border: `1px solid ${data.colorBorder}` }}
          >
            <RefreshCw size={8} className={data.status === 'syncing' ? 'animate-spin' : ''} />
            连接就绪
          </span>
        </div>
      </div>
    </Reveal>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────────
export default function DataSources() {
  return (
    <section id="data-sources" className="py-16 lg:py-20" style={{ background: 'var(--bg-canvas, #f8fafc)', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="lp-data-section-header">
            <div className="lp-data-section-title-group">
              <span className="lp-section-tag block mb-2">数据底座</span>
              <h2 className="lp-h2 mb-1">5 大数据源 · 128,000+ 知识节点</h2>
              <p className="lp-data-section-desc">
                覆盖中药材、活性肽、知识图谱、法规标准五大维度，支持跨库联合查询与实时同步。
              </p>
            </div>
            <span className="lp-caption shrink-0 hidden sm:block" style={{ color: '#64748b' }}>
              最后更新：刚刚
            </span>
          </div>
        </Reveal>

        {/* 聚合统计横幅 */}
        <Reveal>
          <div className="lp-data-panel mb-6" style={{ background: '#0f172a' }}>
            {[
              { value: '5',  label: '数据源',  color: '#34d399' },
              { value: '38K+', label: '知识实体', color: '#60a5fa' },
              { value: '128K', label: '图谱节点', color: '#a78bfa' },
              { value: SYNC_STATUS, label: '同步状态', color: '#64748b' },
            ].map((s, i) => (
              <div key={i} className="flex-1 flex items-center gap-0">
                {i > 0 && <div className="lp-data-panel-divider mr-4" />}
                <div className="lp-data-panel-stat">
                  <span className="lp-data-panel-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="lp-data-panel-label">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 主数据源（前2张） */}
        <div className="lp-data-primary-row mb-2.5">
          {dataSources.slice(0, 2).map((ds, i) => (
            <DataSourceCard key={ds.id} data={ds} index={i} />
          ))}
        </div>

        {/* 次数据源（后3张） */}
        <div className="lp-data-secondary-row">
          {dataSources.slice(2).map((ds, i) => (
            <DataSourceCard key={ds.id} data={ds} index={i + 2} />
          ))}
        </div>

      </div>
    </section>
  );
}
