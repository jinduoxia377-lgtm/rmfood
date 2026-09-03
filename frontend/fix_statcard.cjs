const fs = require('fs');
const fp = 'D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx';
let c = fs.readFileSync(fp, 'utf8');

// Fix StatCard usage: change config={config} to individual props
const oldStatCard = '<StatCard key={config.label} config={config} onClick={() => setTab(config.tab)} />';
const newStatCard = '<button key={config.label} onClick={() => setTab(config.tab)} type="button" className="w-full text-left"><StatCard label={config.label} value={config.value} icon={config.icon} variant={config.variant} subtitle={config.subtitle} trend={config.trend} /></button>';

if (c.includes(oldStatCard)) {
  c = c.replace(oldStatCard, newStatCard);
  console.log('Fixed StatCard props');
} else {
  console.log('StatCard pattern not found, checking alternative...');
  // Try to find and replace
  const idx = c.indexOf('config={config}');
  if (idx >= 0) {
    console.log('Found config={config} at', idx);
    console.log('Context:', JSON.stringify(c.substring(idx - 50, idx + 100)));
  }
}

// Fix closing divs if needed
const lines = c.split('\n');
let d = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const o = (l.match(/<div\b/g) || []).length;
  const cl = (l.match(/<\/div>/g) || []).length;
  d += o - cl;
}
console.log('Div balance:', d);

// If depth != 0, add closing divs
if (d > 0) {
  const closers = Array(d).fill('    </div>').join('\n');
  c = c.replace('  );\n}', closers + '\n  );\n}');
  console.log('Added', d, 'closing divs');
}

fs.writeFileSync(fp, c, 'utf8');
console.log('Lines:', c.split('\n').length);

// Build check
const esbuild = require('esbuild');
esbuild.transform(c, { loader: 'tsx', jsx: 'automatic' })
  .then(() => console.log('BUILD OK'))
  .catch(e => console.log('ERROR:' + e.message));
