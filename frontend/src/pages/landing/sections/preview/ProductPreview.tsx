/**
 * ProductPreview — 产品预览窗口主体
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - 标题栏 / 侧边栏 / 内容区 / 状态栏
 *   - Tab 切换状态（activeTab）
 *   - 协调 ChatPreview / GraphTab / DataTab / ComplianceTab
 *
 * 各 Tab 组件自治其内部状态；ChatPreview 通过 onStateChange 回调
 * 上报最小快照供状态栏使用，通过 resetToken prop 支持外部重置。
 */
import { useState, useCallback } from 'react';
import { MessageSquare, GitGraph, Database, ShieldCheck, Sparkles } from 'lucide-react';
import ChatPreview, { type ChatPreviewState } from './ChatPreview';
import GraphTab from './GraphTab';
import DataTab from './DataTab';
import ComplianceTab from './ComplianceTab';

// ── 侧边栏导航项 ────────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { label: '对话',  icon: MessageSquare },
  { label: '图谱',  icon: GitGraph },
  { label: '数据',  icon: Database },
  { label: '合规',  icon: ShieldCheck },
];

// 知识图谱节点数（状态栏用）
const KG_NODE_COUNT = 12;

export default function ProductPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const [chatState, setChatState] = useState<ChatPreviewState>({ messageCount: 0, status: 'idle' });
  const [resetToken, setResetToken] = useState(0);

  // ChatPreview 状态回调（useCallback 避免每次渲染创建新引用导致子组件不必要重渲染）
  const handleChatStateChange = useCallback((state: ChatPreviewState) => {
    setChatState(prev =>
      prev.messageCount === state.messageCount && prev.status === state.status ? prev : state
    );
  }, []);

  const isConversing = chatState.messageCount > 0;

  const tabLabel = ['对话', '图谱', '数据', '合规'][activeTab];
  const tabEngine = ['thinking-engine', 'neo4j-graph', 'live-sync', 'compliance-engine'][activeTab];
  const tabStatus = activeTab === 0
    ? (chatState.status === 'idle' ? '● 就绪' : chatState.status === 'thinking' ? '◌ 分析中…' : chatState.status === 'success' ? '● 完成' : '● 出错')
    : activeTab === 1 ? `● ${tabLabel} · ${KG_NODE_COUNT} 节点`
    : activeTab === 2 ? '● 数据 · 5 源已连接'
    : '● 合规检测就绪';

  return (
    <div className="relative">
      <div className="lp-preview-glow absolute inset-0 pointer-events-none" />
      <div className="lp-preview-window relative z-10">
        {/* 标题栏 */}
        <div className="lp-titlebar flex items-center gap-0 px-[var(--space-apple-md)] py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="lp-brand tracking-wider" style={{ color: 'var(--color-neutral-300, #cbd5e1)' }}>莱茵分子</span>
            <div className="w-px h-3 bg-neutral-700" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded lp-section-tag" style={{ background: 'color-mix(in srgb, #047857 45%, transparent)', color: '#ffffff', border: '1px solid color-mix(in srgb, #047857 60%, transparent)' }}>
              <Sparkles size={10} aria-hidden="true" /><span>智能对话</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[var(--radius-pill)]" style={{ background: chatState.status === 'error' ? 'var(--color-danger-500, #ef4444)' : 'var(--color-success-500, #34d399)', boxShadow: '0 0 4px color-mix(in srgb, var(--color-primary-500, #10b981) 40%, transparent)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-400, #94a3b8)' }}>{chatState.status === 'error' ? '离线' : '在线'}</span>
            </div>
            <span className="text-[12px] font-mono" style={{ color: 'var(--color-neutral-400, #94a3b8)' }}>v2.4</span>
          </div>
        </div>

        {/* 主体 */}
        <div className="flex min-h-[400px] max-h-[480px]">
          {/* 侧边导航 */}
          <div className="lp-sidebar w-11 flex-shrink-0 flex flex-col items-center py-[var(--space-apple-md)] gap-1" role="tablist" aria-label="产品功能面板切换">
            {SIDEBAR_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isActive = activeTab === i;
              return (
                <button key={item.label} role="tab" onClick={() => setActiveTab(i)} aria-label={item.label} aria-selected={isActive} aria-controls={`tab-panel-${i}`} id={`tab-${i}`}
                  className="w-11 h-11 rounded-[var(--radius-Apple-sm)] flex items-center justify-center transition-all duration-150"
                  style={isActive ? { background: '#047857', color: '#fff', border: '1px solid #047857', boxShadow: '0 1px 2px rgba(16,185,129,0.3)' } : { background: 'transparent', color: 'var(--color-neutral-600, #475569)', border: '1px solid transparent' }}>
                  <Icon size={16} strokeWidth={1.8} />
                </button>
              );
            })}
            <div className="w-5 h-px my-1.5" style={{ background: 'var(--border-color, #e2e8f0)' }} />
            <button
              onClick={() => { if (activeTab === 0) { setResetToken(t => t + 1); } }}
              aria-label="刷新对话"
              title="刷新"
              className="w-11 h-11 rounded-[var(--radius-Apple-sm)] flex items-center justify-center transition-colors"
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
              <div id="tab-panel-0" role="tabpanel" aria-labelledby="tab-0" className="flex-1 flex flex-col overflow-hidden">
                <ChatPreview key={resetToken} onStateChange={handleChatStateChange} />
              </div>
            )}
            {activeTab === 1 && <div id="tab-panel-1" role="tabpanel" aria-labelledby="tab-1"><GraphTab /></div>}
            {activeTab === 2 && <div id="tab-panel-2" role="tabpanel" aria-labelledby="tab-2"><DataTab /></div>}
            {activeTab === 3 && <div id="tab-panel-3" role="tabpanel" aria-labelledby="tab-3"><ComplianceTab /></div>}
          </div>
        </div>

        {/* 状态栏 */}
        <div className="flex items-center justify-between px-[var(--space-apple-md)] py-1.5 border-t" style={{ background: 'var(--bg-canvas, #f8fafc)', borderColor: 'var(--border-color, #e2e8f0)' }}>
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary, #475569)' }}>{tabStatus}</span>
            {isConversing && <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted, #475569)' }}>· {chatState.messageCount} 轮</span>}
          </div>
          <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted, #475569)' }}>{tabEngine}</span>
        </div>
      </div>
    </div>
  );
}
