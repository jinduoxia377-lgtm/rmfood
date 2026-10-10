#!/usr/bin/env node
/**
 * 按【人工核定的 file:line → 属性】精确落盘 —— A-36
 *
 * 为什么不继续用启发式自动取词：fix-anon-controls.mjs 的「向前找最近 <label>」
 * 在实测里取到过「生成中...」「跳转到」「实时推送」这类明显不对的文案（verbatim 见
 * 项目记忆 A-33）。可访问名称一旦取错，比缺失更糟 —— 屏幕阅读器会念出一个误导性的
 * 名字，而用户没法察觉。所以这里改成人工核定、脚本只负责精确插入。
 *
 * 安全约束（承接 A-31 的教训）：
 *   · 属性插入位置由 tagExtent 解析（跳过字符串与注释里的 '>'）
 *   · 同一文件内多个改动【按 offset 倒序】回填，避免前面插入把后面 offset 推后
 *
 * 用法：node scripts/apply-aria-map.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

/** 人工核定的标签表：相对路径:行号 -> 要插入的属性原文 */
const MAP = {
  'src/components/academic/ChapterTree.tsx:231': 'aria-label="章节名称"',
  'src/components/academic/CitationPanel.tsx:585': 'aria-label="访问日期"',
  'src/components/academic/DocumentEditor.tsx:366': 'aria-label="行数"',
  'src/components/academic/DocumentEditor.tsx:376': 'aria-label="列数"',
  'src/components/academic/editor/AcademicElementEditor.tsx:253': 'aria-label="代码"',
  'src/components/academic/editor/AcademicElementEditor.tsx:376': 'aria-label={`表头第${index + 1}列`}',
  'src/components/academic/editor/AcademicElementEditor.tsx:414': 'aria-label={`第${rowIndex + 1}行第${cellIndex + 1}列`}',
  'src/components/ai/AcademicReportEnhanced.tsx:233': 'aria-label="报告标题"',
  'src/components/ai/AcademicReportEnhanced.tsx:242': 'aria-label="作者"',
  'src/components/ai/AcademicReportEnhanced.tsx:251': 'aria-label="单位"',
  'src/components/ai/AcademicReportEnhanced.tsx:260': 'aria-label="关键词"',
  'src/components/ai/components/BatchEditDialog.tsx:155': 'aria-label={columnLabel}',
  'src/components/ai/components/FilterBuilder.tsx:186': 'aria-label={selectedField.label}',
  'src/components/ai/components/ShareDialog.tsx:171': 'aria-label="有效期至"',
  'src/components/ai/components/StructureEditor.tsx:302': 'aria-label="标题"',
  'src/components/ai/features/AcademicReportTab.tsx:440': 'aria-label="报告标题"',
  'src/components/ai/features/AcademicReportTab.tsx:481': 'aria-label="摘要"',
  'src/components/ai/features/AcademicReportTab.tsx:497': 'aria-label="章节标题"',
  'src/components/ai/features/AcademicReportTab.tsx:502': 'aria-label="章节内容"',
  'src/components/ai/features/components/ChatSharePanel.tsx:754': 'aria-label="分享链接"',
  'src/components/ai/features/components/FormulaCard.tsx:519': 'aria-label="配方名称"',
  'src/components/ai/features/components/FormulaShareModal.tsx:163': 'aria-label="分享链接"',
  'src/components/ai/features/components/pro/ChatHistory.tsx:137': 'aria-label="会话标题"',
  'src/components/ai/features/FormulaInputWithOptimization.tsx:328': 'aria-label="种群大小"',
  'src/components/ai/features/FormulaInputWithOptimization.tsx:339': 'aria-label="进化代数"',
  'src/components/ai/features/FormulaInputWithOptimization.tsx:389': 'aria-label="候选数量"',
  'src/components/ai/features/plugins/PluginSettings.tsx:147': 'aria-label={item.label}',
  'src/components/ai/FormulaSharePanel.tsx:312': 'aria-label="分享链接"',
  'src/components/analytics/PerformanceOptimizer.tsx:204': 'aria-label="跳转页码"',
  'src/components/notification/NotificationCenter.tsx:296': 'aria-label="免打扰开始时间"',
  'src/components/notification/NotificationCenter.tsx:302': 'aria-label="免打扰结束时间"',
  'src/pages/analytics/tabs/CustomTab.tsx:226': 'aria-label="布局名称"',
  // 行号已按 A-35 插入注释后的实际位置校正（原 1084/1086/1682）
  'src/pages/formula/FormulaListPage.tsx:1087': 'aria-label="创建日期（起）"',
  'src/pages/formula/FormulaListPage.tsx:1089': 'aria-label="创建日期（止）"',
  'src/pages/formula/FormulaListPage.tsx:1687': 'aria-label="跳转页码"',
  'src/pages/organizations/components/DataExportDialog.tsx:328': 'aria-label="文件名"',
};

/** 取一个 JSX 标签的完整文本：从 '<' 起，跳过字符串/注释里的 '>' */
function tagExtent(src, start) {
  let i = start, depth = 0, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (!quote && c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (!quote && c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

// 按文件分组
const byFile = new Map();
for (const [key, attr] of Object.entries(MAP)) {
  const idx = key.lastIndexOf(':');
  const file = key.slice(0, idx), line = Number(key.slice(idx + 1));
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line, attr });
}

let done = 0, missing = [];
for (const [rel, items] of byFile) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { missing.push(rel + ' (文件不存在)'); continue; }
  const src = fs.readFileSync(abs, 'utf8');
  const edits = [];
  for (const m of [...src.matchAll(/<(input|textarea)\b/g)]) {
    const lineNo = src.slice(0, m.index).split('\n').length;
    const item = items.find(i => i.line === lineNo);
    if (!item) continue;
    const tag = tagExtent(src, m.index);
    if (/aria-label|aria-labelledby/.test(tag)) { missing.push(`${rel}:${lineNo} (已有 aria-label，跳过)`); continue; }
    const close = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1;
    const next = tag.slice(0, close).replace(/\s+$/, '') + '\n        ' + item.attr + '\n      ' + tag.slice(close);
    edits.push({ start: m.index, tag, next, line: lineNo });
  }
  const found = edits.map(e => e.line);
  for (const it of items) if (!found.includes(it.line)) missing.push(`${rel}:${it.line} (该行未匹配到 input/textarea)`);

  if (!edits.length) continue;
  let out = src;
  // 倒序回填：offset 取自改写前的快照，正序应用会互相推后（A-31 教训）
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.next + out.slice(e.start + e.tag.length);
  if (!DRY) fs.writeFileSync(abs, out);
  done += edits.length;
  console.log(`${rel}  +${edits.length}`);
}

console.log(`\n${DRY ? '[DRY] ' : ''}落盘 ${done} 处`);
if (missing.length) { console.log('未处理：'); for (const m of missing) console.log('  ' + m); }
