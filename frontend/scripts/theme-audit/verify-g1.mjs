// M3 T-G1 完整性核验：14 个死代码文件已删除 + 无悬挂引用残留
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const files = [];
(function walk(dir, rel) {
  const r = rel || '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name), rr = r ? `${r}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, rr);
    else if (/\.(ts|tsx|css|js)$/.test(e.name)) files.push({ abs: p, rel: rr });
  }
})(SRC, '');

const DELETED = [
  'styles/tokens/adjustments.css',
  'docs/theme-cleanup-guide.md',
  'docs/theme-cleanup-report.md',
  'utils/theme/ThemeStorageAdapter.ts',
  'utils/theme/VersionController.ts',
  'utils/theme/ThemeShare.ts',
  'utils/theme/palette.ts',
  'utils/theme/surfaceMode.ts',
  'utils/events/ThemeEventBus.ts',
  'utils/events/index.ts',
  'types/theme-mode.ts',
  'components/theme/ThemeEditor.tsx',
  'components/theme/ThemePreviewOverlay.tsx',
  'components/theme/ThemeOnboarding.tsx',
  'components/theme/ColorEditor.tsx',
  'components/theme/VersionHistoryPanel.tsx',
  'components/theme/index.ts',
  'components/theme/KeyboardShortcutsPanel.tsx',
  'components/theme/AppShellPreview.tsx',
  'components/theme/TypeScalePreview.tsx',
  'components/theme/RealTimeAdjustPanel.tsx',
  'components/theme/SimpleSlider.tsx',
  'components/theme/SliderTest.tsx',
  'theme/themeUrlParser.ts',
];

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => { if (ok) { pass++; console.log('  ✅ ' + label); } else { fail++; console.log('  ❌ ' + label + ' ' + extra); } };

console.log('══ 删除确认 ══');
for (const d of DELETED) check(!existsSync(join(SRC, d)), `已删除 ${d}`);

// 死 barrel 判定：utils/events/index.ts 已删除
const evIndex = join(SRC, 'utils/events/index.ts');
check(!existsSync(evIndex), 'utils/events/index.ts 已删除（死 barrel）');

// 悬挂 import 扫描：除「已删目标之间的互引」外，不得有活跃代码 import 已删模块
console.log('\n══ 悬挂 import 扫描 ══');
const MODS = ['adjustments.css', 'theme-cleanup-guide', 'theme-cleanup-report', 'ThemeStorageAdapter', 'VersionController', 'ThemeShare', 'ThemeEventBus', 'theme-mode', 'ThemeEditor', 'ThemePreviewOverlay', 'ThemeOnboarding', 'ColorEditor', 'VersionHistoryPanel', 'KeyboardShortcutsPanel', 'AppShellPreview', 'TypeScalePreview', 'RealTimeAdjustPanel', 'SimpleSlider', 'SliderTest', 'themeUrlParser'];
let dangling = 0;
for (const f of files) {
  if (!f.rel.endsWith('.ts') && !f.rel.endsWith('.tsx')) continue;
  const t = readFileSync(f.abs, 'utf8');
  const code = t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const m of MODS) {
    const re = new RegExp(`from\\s+['"][^'"]*${m}`);
    if (re.test(code)) {
      console.log(`  ⚠️ 悬挂引用 ${m} ← ${f.rel}`);
      dangling++;
    }
  }
}
// 目录导入（指向已删 index.ts / 空目录）
for (const f of files) {
  if (!f.rel.endsWith('.ts') && !f.rel.endsWith('.tsx')) continue;
  const t = readFileSync(f.abs, 'utf8');
  const code = t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const dir of ["'@/components/theme'", '"@/components/theme"', "'@/utils/theme'", '"@/utils/theme"', "'@/utils/events'", '"@/utils/events"']) {
    if (code.includes(`from ${dir}`)) {
      console.log(`  ⚠️ 目录导入 ${dir} ← ${f.rel}`);
      dangling++;
    }
  }
}
check(dangling === 0, `悬挂 import = ${dangling}（应为 0）`);

console.log(`\n══ 结果：${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail ? 1 : 0);
