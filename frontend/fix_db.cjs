const fs = require('fs');
const filePath = 'D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx';
let c = fs.readFileSync(filePath, 'utf8');

// 1. Fix outer wrapper and header
const oldHeader = `  return (
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

const newHeader = `  return (
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

if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  console.log('1. Wrapper+header: OK');
} else {
  console.log('1. Wrapper+header: FAILED - searching alternative');
  // Try to find the pattern with different whitespace
  const m = c.match(/return \(\s*<div className="max-w-7xl[^>]*>[\s\S]*?<\/div>\s*<\/div>/);
  if (m) console.log('Found pattern, length:', m[0].length);
}

// 2. Fix text-text-muted -> text-neutral-500
const before = c.length;
c = c.replace(/text-text-muted/g, 'text-neutral-500');
console.log('2. text-text-muted replacements:', c.length - before > 0 ? 'done' : 'none');

// 3. Fix text-text-primary -> text-neutral-900
c = c.replace(/text-text-primary/g, 'text-neutral-900');
console.log('3. text-text-primary -> text-neutral-900: done');

// 4. Fix font-bold -> font-medium in CardTitle components
c = c.replace(/className="text-sm font-bold"/g, 'className="text-sm font-medium"');
console.log('4. CardTitle font-bold -> font-medium: done');

// 5. Fix bg-slate-50 -> bg-neutral-50
c = c.replace(/bg-slate-50/g, 'bg-neutral-50');
console.log('5. bg-slate-50 -> bg-neutral-50: done');

// 6. Fix hover:bg-slate-50 -> hover:bg-neutral-50
c = c.replace(/hover:bg-slate-50/g, 'hover:bg-neutral-50');
console.log('6. hover:bg-slate-50 -> hover:bg-neutral-50: done');

// 7. Fix keyboard shortcuts modal h1 font-bold -> font-semibold
c = c.replace(/text-xl font-bold tracking-tight/g, 'text-xl font-semibold tracking-tight');
console.log('7. keyboard modal font-bold -> font-semibold: done');

// 8. Fix dark:text-text-muted -> dark:text-neutral-400
c = c.replace(/dark:text-text-muted/g, 'dark:text-neutral-400');
console.log('8. dark:text-text-muted fix: done');

// 9. Fix text-text-muted in style props
c = c.replace(/fill: 'var\(--text-muted\)'/g, "fill: 'var(--text-muted)'"); // keep as is for SVG
c = c.replace(/fill: "var\(--text-muted\)"/g, 'fill: "var(--text-muted)"');

fs.writeFileSync(filePath, c, 'utf8');
console.log('Complete. Lines:', c.split('\n').length);
