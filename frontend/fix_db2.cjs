const fs = require('fs');
const filePath = 'D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx';
let c = fs.readFileSync(filePath, 'utf8');

// 1. Replace the old return wrapper + header with Dashboard banner
// Match from "return (" to the closing of the header </div> before "{/*顶部工具栏*/}"
const headerMatch = c.match(/  return \(\n    <div className="max-w-7xl[^]*?<\/div>\n\n      <\/\/ \*\/ 顶部工具栏 \*\/>/);
if (headerMatch) {
  const old = headerMatch[0];
  const neu = `  return (
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
      </div>

      {/* 顶部工具栏 */}`;
  c = c.replace(old, neu);
  console.log('1. Header replaced:', old.length, '->', neu.length);
} else {
  console.log('1. Header match FAILED');
  // Try partial match
  const partial = c.indexOf('return (');
  if (partial >= 0) {
    console.log('Found return( at', partial);
    console.log('Context:', JSON.stringify(c.substring(partial, partial + 200)));
  }
}

// 2. Fix all text-text-muted -> text-neutral-500 (excluding SVG fill)
c = c.replace(/className="([^"]*?)text-text-muted([^"]*?)"/g, (m, pre, post) => {
  return `className="${pre}text-neutral-500${post}"`;
});
c = c.replace(/className={`([^`]*?)text-text-muted([^`]*?)`}/g, (m, pre, post) => {
  return `className={\`${pre}text-neutral-500${post}\``;
});
console.log('2. text-text-muted fixed');

// 3. Fix dark:text-text-muted
c = c.replace(/dark:text-text-muted/g, 'dark:text-neutral-400');
console.log('3. dark:text-text-muted fixed');

// 4. Fix text-text-primary -> text-neutral-900
c = c.replace(/text-text-primary/g, 'text-neutral-900');
console.log('4. text-text-primary fixed');

// 5. Fix dark:text-text-primary -> dark:text-neutral-100
c = c.replace(/dark:text-text-primary/g, 'dark:text-neutral-100');
console.log('5. dark:text-text-primary fixed');

// 6. Fix remaining bg-slate-50
c = c.replace(/bg-slate-50/g, 'bg-neutral-50');
console.log('6. bg-slate-50 fixed');

// 7. Fix hover:bg-slate-50
c = c.replace(/hover:bg-slate-50/g, 'hover:bg-neutral-50');
console.log('7. hover:bg-slate-50 fixed');

// 8. Fix font-bold in CardTitle (any remaining)
c = c.replace(/className="text-sm font-bold/g, 'className="text-sm font-medium');
console.log('8. CardTitle font-bold fixed');

// 9. Fix keyboard shortcuts modal h1
c = c.replace(/text-xl font-bold tracking-tight/g, 'text-xl font-semibold tracking-tight');
console.log('9. keyboard modal font-bold fixed');

// 10. Fix remaining font-bold -> font-semibold in banner context
// Only in the main component area, not in charts
// Fix the old header h1 (if still present)
c = c.replace(/font-bold tracking-tight leading-\[1\.25\] text-2xl/, 'font-semibold tracking-tight leading-[1.25] text-2xl');
console.log('10. h1 font-bold fixed');

fs.writeFileSync(filePath, c, 'utf8');
console.log('Done. Lines:', c.split('\n').length);
