// 独立语法检查：不经全项目编译，逐个校验指定文件
// 用途：当 `npm run build` 被**他人未提交的损坏文件**阻断时，
//       仍可验证自己的改动是否存在语法错误。
//
// 实现说明：本项目 esbuild 原生二进制与平台不匹配（Vite 8 用 rolldown 打包），
// 故改用 **TypeScript 编译器 API** 做解析级检查（纯 JS，无原生依赖）；
// CSS 用括号配平 + 引号闭合做结构性检查。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const DEFAULTS = [
  'src/stores/theme.presets.ts',
  'src/stores/themeStore.ts',
  'src/styles/components/semantic-utils.css',
  'src/styles/tokens/base.css',
  'src/styles/tokens/dark.css',
  'src/index.css',
];
const paths = (args.length ? args : DEFAULTS).map(p => resolve(process.cwd(), p));

/** TypeScript 解析级检查：只报语法错误，不做类型检查 */
function checkTs(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // @ts-expect-error 内部 API：解析诊断
  const diags = sf.parseDiagnostics ?? [];
  return diags.map(d => {
    const pos = sf.getLineAndCharacterOfPosition(d.start);
    return `${ts.flattenDiagnosticMessageText(d.messageText, ' ')}  @ 行 ${pos.line + 1}, 列 ${pos.character + 1}`;
  });
}

/** CSS 结构检查：括号/引号配平（能抓住「注释提前闭合」「字符串未闭合」类问题） */
function checkCss(text) {
  const errs = [];
  const src = text;
  let i = 0, depth = 0, line = 1;
  let inComment = false, quote = null;
  const openStack = [];
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') line++;
    if (inComment) {
      if (c === '*' && n === '/') { inComment = false; i += 2; continue; }
      i++; continue;
    }
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      else if (c === '\n') { errs.push(`未闭合的字符串/引号 ${quote}（自上一个引号起）@ 行 ${line}`); quote = null; }
      i++; continue;
    }
    if (c === '/' && n === '*') { inComment = true; i += 2; continue; }
    if (c === '"' || c === "'") { quote = c; i++; continue; }
    if (c === '{') { depth++; openStack.push(line); }
    else if (c === '}') {
      depth--;
      if (depth < 0) { errs.push(`多余的 '}' @ 行 ${line}`); depth = 0; }
      else openStack.pop();
    }
    i++;
  }
  if (inComment) errs.push('未闭合的注释 /*');
  if (depth > 0) errs.push(`缺少 ${depth} 个 '}'（最近未闭合的 '{' 起于行 ${openStack[openStack.length - 1]}）`);
  return errs;
}

let bad = 0;
console.log('══ 独立语法检查 ══');
for (const p of paths) {
  const rel = p.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
  let text;
  try { text = readFileSync(p, 'utf8'); }
  catch { console.log(`  ⏭️  ${rel}（不存在）`); continue; }

  const errs = p.endsWith('.css') ? checkCss(text) : checkTs(p, text);
  if (errs.length) {
    bad++;
    console.log(`  ❌ ${rel}`);
    for (const e of errs.slice(0, 5)) console.log(`       ${e}`);
  } else {
    console.log(`  ✅ ${rel}`);
  }
}
console.log(`\n${bad ? `❌ ${bad} 个文件存在语法/结构错误` : '✅ 全部通过'}`);
process.exit(bad ? 1 : 0);
