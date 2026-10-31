/**
 * DataTab — 数据看板 Tab
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - DS_DATA / ACTIVITY_LOG 数据
 *   - 卡片展开 / 自动动画 key
 *
 * 该组件仅依赖 React + lucide-react 图标。
 */
import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Clock, Database as DBIcon } from 'lucide-react';

// ── 类型定义 ────────────────────────────────────────────────────
interface DSItem {
  name: string;
  status: 'online' | 'syncing' | 'update';
  stat: string;
  unit: string;
  color: string;
  desc: string;
  features: string[];
}

// ── 数据源数据 ──────────────────────────────────────────────────
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

export default function DataTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, setAnimKey] = useState(0);

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
      <div className="flex items-center justify-between px-[var(--space-apple-sm)] py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <div className="flex items-center gap-2">
          <DBIcon size={11} style={{ color: 'var(--color-neutral-500, #64748b)' }} />
          <span className="lp-tiny font-medium text-[var(--text-secondary)]">数据源概览</span>
          <span className="text-[12px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-success-50, #ecfdf5)', color: 'var(--color-primary-700, #047857)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>5 个活跃</span>
        </div>
        <button onClick={() => setAnimKey(k => k + 1)} className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-primary-text)] transition-colors flex items-center gap-1" title="刷新">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          同步
        </button>
      </div>

      {/* 数据卡片网格 */}
      <div className="flex-1 overflow-y-auto p-[var(--space-apple-sm)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DS_DATA.map(ds => {
            const isExpanded = expanded === ds.name;
            return (
              <div key={ds.name} role="button" tabIndex={0} onClick={() => setExpanded(isExpanded ? null : ds.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : ds.name) } }}
                className="rounded-[var(--radius-Apple-sm)] overflow-hidden transition-all duration-200 cursor-pointer"
                style={{
                  background: isExpanded ? '#fff' : '#fff',
                  border: `1px solid ${isExpanded ? ds.color + '40' : 'var(--color-neutral-200, #e2e8f0)'}`,
                  boxShadow: isExpanded ? `0 2px 8px ${ds.color}15` : 'none',
                }}>
                {/* 顶部色条 */}
                <div className="h-0.5 w-full" style={{ background: ds.color + '40' }} />
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="lp-tiny font-semibold text-neutral-800 leading-tight">{ds.name}</span>
                    {statusIcon(ds.status)}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-base font-bold font-mono leading-none" style={{ color: 'var(--color-neutral-900, #0f172a)' }}>{ds.stat}</span>
                    <span className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ds.unit}</span>
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
                    <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-[1.55] mt-1.5">{ds.desc}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
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
        <div className="mt-2.5 rounded-[var(--radius-Apple-sm)] border p-2.5" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
          <div className="text-[12px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            同步活动记录
          </div>
          {ACTIVITY_LOG.map((log, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-t" style={{ borderColor: 'var(--color-neutral-100, #f1f5f9)', fontSize: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ color: 'var(--color-neutral-500, #64748b)' }}>{log.time}</span>
              <span className="text-[var(--text-secondary)] flex-1 truncate">{log.action}</span>
              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0">{log.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
