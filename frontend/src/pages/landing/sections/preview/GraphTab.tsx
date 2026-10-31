/**
 * GraphTab — 知识图谱 Tab
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - KG_NODES / KG_LINKS 数据
 *   - KG_TYPE_STYLE 样式映射
 *   - 交互状态（搜索 / 选中 / hover）
 *
 * 该组件仅依赖 React + lucide-react Search 图标。
 */
import { useState } from 'react';
import { Search } from 'lucide-react';

// ── 类型定义 ────────────────────────────────────────────────────
interface KGNode {
  id: string;
  name: string;
  type: 'herb' | 'compound' | 'target' | 'disease';
  x: number;
  y: number;
  desc: string;
  connections: number;
}
interface KGLink { source: string; target: string; }

// ── 知识图谱数据 ────────────────────────────────────────────────
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

export default function GraphTab() {
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
      <div className="w-full px-[var(--space-apple-sm)] py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--color-neutral-50, #fafbfc)' }}>
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-neutral-400, #94a3b8)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索药材 / 成分 / 靶点…"
            aria-label="搜索知识图谱节点"
            className="w-full min-h-[36px] pl-7 pr-2 text-[12px] rounded-[var(--radius-Apple-sm)] border outline-none transition-all focus:ring-1 focus:ring-[var(--color-primary)]"
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
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded-[var(--radius-Apple-sm)]" style={{ background: 'color-mix(in srgb, var(--color-neutral-50, #f8fafc) 95%, transparent)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>
          {(['herb','compound','target','disease'] as const).map(t => (
            <div key={t} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-[var(--radius-pill)]" style={{ background: KG_TYPE_STYLE[t].color }} />
              <span className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{KG_TYPE_STYLE[t].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧详情面板 */}
      {selectedNode && (
        <div className="w-32 flex-shrink-0 border-l p-[var(--space-apple-sm)] overflow-y-auto" style={{ background: 'var(--color-neutral-50, #fafbfc)', borderColor: 'var(--color-neutral-200, #e2e8f0)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-[var(--radius-pill)]" style={{ background: KG_TYPE_STYLE[selectedNode.type].color }} />
            <span className="lp-tiny font-semibold text-neutral-800">{selectedNode.name}</span>
          </div>
          <div className="text-[12px] font-mono px-1.5 py-0.5 rounded mb-2 inline-block" style={{ background: KG_TYPE_STYLE[selectedNode.type].bg, color: KG_TYPE_STYLE[selectedNode.type].color, border: `1px solid ${KG_TYPE_STYLE[selectedNode.type].border}` }}>
            {KG_TYPE_STYLE[selectedNode.type].label}
          </div>
          <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-[1.55] mb-2">{selectedNode.desc}</p>
          <div className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">关联节点</div>
          <div className="mt-1 space-y-0.5">
            {KG_LINKS.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map((l, i) => {
              const otherId = l.source === selectedNode.id ? l.target : l.source;
              const other = KG_NODES.find(n => n.id === otherId);
              if (!other) return null;
              return (
                <div key={i} role="button" tabIndex={0} onClick={() => setSelectedNode(other)}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNode(other); } }}
                   className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--color-primary-text)] transition-colors min-h-[22px]"
                >
                  <span className="w-1 h-1 rounded-[var(--radius-pill)] flex-shrink-0" style={{ background: KG_TYPE_STYLE[other.type].color }} />
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
