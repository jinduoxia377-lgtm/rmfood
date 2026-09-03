const fs = require('fs');
const c = fs.readFileSync('D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx', 'utf8');
const checks = [
  ['min-h-screen bg-grid', c.includes('min-h-screen bg-grid')],
  ['bg-primary-600 banner', c.includes('bg-primary-600')],
  ['font-semibold header', c.includes('font-semibold leading-snug tracking-tight')],
  ['space-y-4', c.includes('space-y-4')],
  ['no text-text-muted', !c.includes('text-text-muted')],
  ['no text-text-primary', !c.includes('text-text-primary')],
  ['no font-bold in CardTitle', !c.includes('text-sm font-bold')],
  ['no bg-slate-50', !c.includes('bg-slate-50')],
  ['no StatCardConfig', !c.includes('StatCardConfig')],
  ['no local StatCard function', !c.includes('function StatCard({ config')],
  ['uses shared StatCard', c.includes('<StatCard')],
  ['uses Button import', c.includes('Button')],
  ['uses Input import', c.includes('Input')],
  ['variant in statCardsConfig', c.includes("variant: 'primary'")],
  ['dark:text-neutral-400', c.includes('dark:text-neutral-400')],
  ['keyboard modal font-semibold', c.includes('text-xl font-semibold tracking-tight')],
];
checks.forEach(([n, v]) => console.log(n + ':', v));
const allPass = checks.filter(([, v]) => !v).length === 0;
console.log(allPass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
