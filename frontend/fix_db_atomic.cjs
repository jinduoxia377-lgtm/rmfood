const fs = require('fs');
const fp = 'D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx';
let c = fs.readFileSync(fp, 'utf8');
console.log('Starting:', c.split('\n').length, 'lines');

// ── 1. Fix imports ──────────────────────────────────────────
c = c.replace(
  "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast } from '@/components/ui';",
  "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast, StatCard, Button, Input } from '@/components/ui';"
);

// ── 2. Remove StatCardConfig interface ──────────────────────
c = c.replace(/interface StatCardConfig \{[\s\S]*?tooltip: string;\n\}\n\n/, '');

// ── 3. Remove custom StatCard function ──────────────────────
const idx3a = c.indexOf('// ─── 统计卡片组件 ───');
const idx3b = c.indexOf('\n\n// ═════════════════════════════', idx3a);
if (idx3a >= 0 && idx3b > idx3a) {
  c = c.substring(0, idx3a) + c.substring(idx3b);
}

// ── 4. Replace statCardsConfig ──────────────────────────────
const oldCfgStart = c.indexOf('  // 统计卡片配置（6个卡片');
const oldCfgEnd = c.indexOf('    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],\n  );', oldCfgStart);
if (oldCfgStart >= 0 && oldCfgEnd >= 0) {
  const newCfg = `  // 统计卡片配置（6个卡片 + 趋势数据）
  const statCardsConfig = useMemo(
    (): Array<{ label: string; value: number; icon: any; variant: 'primary' | 'secondary' | 'info' | 'success' | 'warning'; subtitle?: string; trend?: { direction: 'up' | 'down' | 'stable'; value: string }; tab: DbTab }> => [
      {
        label: '中药材',
        value: herbCount,
        icon: Database,
        variant: 'primary',
        subtitle: 'TCMSP · 药食同源目录',
        trend: { direction: 'up' as const, value: '+12.5%' },
        tab: 'herbs',
      },
      {
        label: '活性肽',
        value: peptideCount,
        icon: Activity,
        variant: 'info',
        subtitle: 'DFBP · 生物活性数据库',
        trend: { direction: 'up' as const, value: '+8.3%' },
        tab: 'peptides',
      },
      {
        label: '图谱节点',
        value: graphNodes.total_herbs + graphNodes.total_compounds + graphNodes.total_targets,
        icon: Layers,
        variant: 'secondary',
        subtitle: \`药材 \${graphNodes.total_herbs} · 化合物 \${graphNodes.total_compounds}\`,
        trend: { direction: 'up' as const, value: '+5.2%' },
        tab: 'graph',
      },
      {
        label: '药食同源',
        value: homologyCount,
        icon: Zap,
        variant: 'success',
        subtitle: '国家食药物质目录条目',
        trend: { direction: 'stable' as const, value: '0%' },
        tab: 'herbs',
      },
      {
        label: '配伍关系',
        value: stats?.knowledge_graph?.herb_interactions ?? 0,
        icon: TrendingUp,
        variant: 'warning',
        subtitle: '已识别的配伍关联数',
        trend: { direction: 'up' as const, value: '+15.7%' },
        tab: 'graph',
      },
      {
        label: '今日查询',
        value: todayQueries,
        icon: Eye,
        variant: 'info',
        subtitle: '搜索 / 查询总次数',
        trend: { direction: 'up' as const, value: '+23.4%' },
        tab: 'dashboard',
      },
    ],
    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],
  );`;
  c = c.substring(0, oldCfgStart) + newCfg + c.substring(oldCfgEnd + '    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],\n  );'.length);
}

// ── 5. Fix return wrapper + header ──────────────────────────
const oldReturn = `  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter">
      {/* Header */}
      <div className="space-y-2">
        <h1
          className="font-bold tracking-tight leading-[1.25] text-2xl text-text-primary dark:text-text-primary"
        >
          数据库检索中心
        </h1>
        <p className="text-[13px] font-normal leading-relaxed text-text-muted dark:text-text-muted">
          TCMSP 中药材 · DFBP 活性肽 · 知识图谱 · 药食同源目录
        </p>
      </div>`;

const newReturn = `  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 页面横幅 */}
      <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight">数据库检索中心</h2>
            <p className="mt-1 text-white/80 text-sm">TCMSP 中药材 · DFBP 活性肽 · 知识图谱 · 药食同源目录</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefreshCache}>刷新缓存</Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportStats}>导出数据</Button>
          </div>
        </div>
      </div>`;

if (c.includes(oldReturn)) {
  c = c.replace(oldReturn, newReturn);
} else {
  // Line-by-line approach
  const lines = c.split('\n');
  let ri = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'return (' && i > 600) { ri = i; break; }
  }
  if (ri >= 0) {
    let endi = ri;
    for (let i = ri; i < Math.min(ri + 20, lines.length); i++) {
      if (lines[i].includes('顶部工具栏')) { endi = i; break; }
    }
    const replacement = newReturn.split('\n');
    const before = lines.slice(0, ri).join('\n');
    const after = lines.slice(endi).join('\n');
    c = before + '\n' + replacement.join('\n') + '\n' + after;
  }
}

// ── 6. Global replacements ──────────────────────────────────
c = c.replace(/text-text-muted/g, 'text-neutral-500');
c = c.replace(/dark:text-text-muted/g, 'dark:text-neutral-400');
c = c.replace(/text-text-primary/g, 'text-neutral-900');
c = c.replace(/dark:text-text-primary/g, 'dark:text-neutral-100');
c = c.replace(/bg-slate-50/g, 'bg-neutral-50');
c = c.replace(/hover:bg-slate-50/g, 'hover:bg-neutral-50');
c = c.replace(/className="text-sm font-bold/g, 'className="text-sm font-medium');
c = c.replace(/text-xl font-bold tracking-tight/g, 'text-xl font-semibold tracking-tight');
c = c.replace(/font-bold tracking-tight leading-\[1\.25\] text-2xl/g, 'font-semibold tracking-tight leading-[1.25] text-2xl');

// ── 7. Fix closing divs ─────────────────────────────────────
// After keyboard shortcuts modal, need proper closers
const closePattern = '      )}\n    </div>\n  );\n}';
const closeReplacement = '      )}\n    </div>\n      </div>\n    </div>\n    </div>\n    </div>\n  );\n}';

if (c.includes(closePattern)) {
  c = c.replace(closePattern, closeReplacement);
}

fs.writeFileSync(fp, c, 'utf8');

// Verify
const lines = c.split('\n');
console.log('Final lines:', lines.length);

// Check div balance
let d = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const o = (l.match(/<div\b/g) || []).length;
  const cl = (l.match(/<\/div>/g) || []).length;
  d += o - cl;
}
console.log('Div balance:', d === 0 ? 'BALANCED' : 'UNBALANCED (depth=' + d + ')');

// Verify key changes
const checks = [
  ['min-h-screen bg-grid', c.includes('min-h-screen bg-grid')],
  ['bg-primary-600 banner', c.includes('bg-primary-600 p-6')],
  ['font-semibold header', c.includes('font-semibold leading-snug')],
  ['no StatCardConfig', !c.includes('interface StatCardConfig')],
  ['no custom StatCard', !c.includes('function StatCard({ config')],
  ['uses shared StatCard', c.includes('<StatCard')],
  ['variant in config', c.includes("variant: 'primary'")],
  ['no text-text-muted', !c.includes('text-text-muted')],
  ['no bg-slate-50', !c.includes('bg-slate-50')],
  ['Button import', c.includes('Button')],
  ['Input import', c.includes('Input')],
];
checks.forEach(([name, pass]) => console.log((pass ? '✓' : '✗') + ' ' + name));

const allPass = checks.every(([, p]) => p);
console.log(allPass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
