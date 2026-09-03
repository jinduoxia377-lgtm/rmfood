const fs = require('fs');
const fp = 'D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx';
let c = fs.readFileSync(fp, 'utf8');
let done = 0;

// ── 1. Fix imports ──────────────────────────────────────────
c = c.replace(
  "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast } from '@/components/ui';",
  "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast, StatCard, Button, Input } from '@/components/ui';"
);
if (c.includes('StatCard, Button, Input')) { console.log('1. imports OK'); done++; }
else { console.log('1. imports FAILED'); }

// ── 2. Remove StatCardConfig interface ──────────────────────
c = c.replace(
  /interface StatCardConfig \{[\s\S]*?tooltip: string;\n\}\n\n/,
  ''
);
if (!c.includes('interface StatCardConfig')) { console.log('2. StatCardConfig removed'); done++; }
else { console.log('2. StatCardConfig FAILED'); }

// ── 3. Remove custom StatCard function ──────────────────────
c = c.replace(
  /\/\/ ─── 统计卡片组件 ───\nfunction StatCard\(\{ config, onClick \}: \{ config: StatCardConfig; onClick\?: \(\) => void \} \) \{[\s\S]*?^ \}\n\n/m,
  ''
);
if (!c.includes('function StatCard({ config, onClick }')) { console.log('3. StatCard fn removed'); done++; }
else { console.log('3. StatCard fn FAILED - searching...');
  // Try alternative
  const idx = c.indexOf('// ─── 统计卡片组件');
  if (idx >= 0) {
    const endIdx = c.indexOf('\n\n// ════════════', idx);
    if (endIdx > idx) {
      c = c.substring(0, idx) + c.substring(endIdx);
      console.log('3. StatCard fn removed (alt)'); done++;
    }
  }
}

// ── 4. Replace statCardsConfig ──────────────────────────────
const oldConfigPattern = /  \/\/ 统计卡片配置[\s\S]*?\[herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries\],\n  \);/;
const newConfig = `  // 统计卡片配置（6个卡片 + 趋势数据）
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

if (oldConfigPattern.test(c)) {
  c = c.replace(oldConfigPattern, newConfig);
  console.log('4. statCardsConfig replaced'); done++;
} else {
  console.log('4. statCardsConfig FAILED - searching for pattern');
  const idx = c.indexOf('// 统计卡片配置（6个卡片');
  if (idx >= 0) {
    const endIdx = c.indexOf(');', idx);
    if (endIdx > idx) {
      c = c.substring(0, idx) + newConfig + c.substring(endIdx + 2);
      console.log('4. statCardsConfig replaced (alt)'); done++;
    }
  }
}

// ── 5. Fix return statement wrapper + header ───────────────
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
  console.log('5. return+header replaced'); done++;
} else {
  console.log('5. return+header FAILED - trying line-by-line match');
  // Find the return statement in the main component
  const lines = c.split('\n');
  let returnIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'return (' && i > 600) { // main component return
      returnIdx = i;
      break;
    }
  }
  if (returnIdx >= 0) {
    // Replace lines returnIdx to returnIdx+12 (the header block)
    const replacement = newReturn.split('\n');
    const before = lines.slice(0, returnIdx).join('\n');
    const afterStart = returnIdx + 13; // skip old header block
    const after = lines.slice(afterStart).join('\n');
    c = before + '\n' + replacement.join('\n') + '\n' + after;
    console.log('5. return+header replaced (line-by-line)'); done++;
  }
}

// ── 6. Fix remaining text-text-muted -> text-neutral-500 ────
c = c.replace(/text-text-muted/g, 'text-neutral-500');
console.log('6. text-text-muted fixed');

// ── 7. Fix dark:text-text-muted -> dark:text-neutral-400 ────
c = c.replace(/dark:text-text-muted/g, 'dark:text-neutral-400');
console.log('7. dark:text-text-muted fixed');

// ── 8. Fix text-text-primary -> text-neutral-900 ────────────
c = c.replace(/text-text-primary/g, 'text-neutral-900');
console.log('8. text-text-primary fixed');

// ── 9. Fix dark:text-text-primary -> dark:text-neutral-100 ──
c = c.replace(/dark:text-text-primary/g, 'dark:text-neutral-100');
console.log('9. dark:text-text-primary fixed');

// ── 10. Fix font-bold -> font-medium in CardTitle ───────────
c = c.replace(/className="text-sm font-bold/g, 'className="text-sm font-medium');
console.log('10. CardTitle font-bold fixed');

// ── 11. Fix bg-slate-50 -> bg-neutral-50 ────────────────────
c = c.replace(/bg-slate-50/g, 'bg-neutral-50');
console.log('11. bg-slate-50 fixed');

// ── 12. Fix hover:bg-slate-50 -> hover:bg-neutral-50 ────────
c = c.replace(/hover:bg-slate-50/g, 'hover:bg-neutral-50');
console.log('12. hover:bg-slate-50 fixed');

// ── 13. Fix keyboard modal font-bold -> font-semibold ───────
c = c.replace(/text-xl font-bold tracking-tight/g, 'text-xl font-semibold tracking-tight');
console.log('13. keyboard modal font-bold fixed');

// ── 14. Fix h1 font-bold -> font-semibold in banner context ─
c = c.replace(/font-bold tracking-tight leading-\[1\.25\] text-2xl/g, 'font-semibold tracking-tight leading-[1.25] text-2xl');
console.log('14. h1 font-bold fixed');

// ── 15. Add missing closing div for outer wrapper ───────────
// After the keyboard shortcuts modal, need to close the max-w-7xl and min-h-screen divs
// Check if the file ends with </div>\n  );\n}
if (c.endsWith('    </div>\n  );\n}')) {
  c = c.replace('    </div>\n  );\n}', '    </div>\n    </div>\n  );\n}');
  console.log('15. Added missing closing div'); done++;
} else {
  console.log('15. closing div check - current end:', JSON.stringify(c.slice(-50)));
}

fs.writeFileSync(fp, c, 'utf8');
console.log('\\nDone. Lines:', c.split('\\n').length, 'Checks passed:', done + '/8');
