#!/usr/bin/env node
/**
 * AST 级嵌套交互元素探针
 * 用 typescript 编译器 API 解析每个 tsx/ts 文件，
 * 找出「交互元素包含另一个交互元素」的违规（button 套 button / a /
 * input / role=button 等）。用于评估 ui-guard 新增第 6 条规则的存量影响。
 *
 * 保守设计：只识别字面 JSX 标签（<button>、<a>、<input>…）与显式 role=
 * "button"/"link" 等；组件级展开（如 <TooltipTrigger><Button/></TooltipTrigger>
 * 在运行时渲染出 button 套 button）无法从 AST 静态捕捉——这正是本轮要量化
 * 「静态能抓住多少」而不是「运行时有多少」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e && (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOENT')) return out;
    throw e;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'checkbox', 'switch', 'radio', 'option']);

function isInteractive(el) {
  let opening;
  if (ts.isJsxElement(el)) opening = el.openingElement;
  else if (ts.isJsxSelfClosingElement(el)) opening = el;
  else return false;
  const tagName = opening.tagName.getText(opening.getSourceFile());
  // 仅「原生小写标签」视为交互；大写标签是组件（如 <Button/>、<Input/>），
  // 静态无法确定其渲染内容（可能渲染 div），不计入。
  if (INTERACTIVE_TAGS.has(tagName)) return true;
  if (!/^[a-z][\w-]*$/.test(tagName)) return false;

  // role 属性
  const attrs = opening.attributes.properties;
  for (const attr of attrs) {
    if (ts.isJsxAttribute(attr) && attr.name.text === 'role' && attr.initializer) {
      const t = attr.initializer.getText().replace(/['"`]/g, '');
      if (INTERACTIVE_ROLES.has(t)) return true;
    }
  }
  return false;
}

const total = { violations: 0, files: 0 };
const perFile = [];

for (const file of walk(SRC)) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'EISDIR')) continue;
    throw e;
  }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];

  function visit(node, outerInteractive) {
    if (!node) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (isInteractive(node)) {
        const pos = node.getStart(sf);
        const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
        const inner = node.getText(sf).split('\n')[0].trim().slice(0, 90);
        if (outerInteractive) {
          hits.push({ line, outer: outerInteractive, inner, kind: '交互元素嵌套交互元素' });
        }
        // 递归其子节点：跨过任何非交互 JSX 容器，但记录当前交互元素为外层
        if (ts.isJsxElement(node)) {
          const cur = node.openingElement.getText(sf).replace(/\s+/g, ' ').trim().slice(0, 100);
          for (const child of node.children) visit(child, cur);
        }
        return;
      }
      // 非交互 JSX 元素：继续递归，保留 outerInteractive 状态
      if (ts.isJsxElement(node)) {
        for (const child of node.children) visit(child, outerInteractive);
      }
      return;
    }
    // 普通节点（含 JsxExpression、函数体等）：穿透函数边界
    ts.forEachChild(node, (c) => visit(c, outerInteractive));
  }

  visit(sf, false);

  if (hits.length) {
    total.violations += hits.length;
    total.files += 1;
    perFile.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), hits });
  }
}

console.log(`AST 嵌套交互元素探针结果：${total.files} 个文件 / ${total.violations} 处违规\n`);
for (const f of perFile) {
  console.log(f.file + `  (${f.hits.length} 处)`);
  for (const h of f.hits) console.log(`    :${h.line}  外层<${h.outer}>  内含<${h.inner}>`);
}
console.log(`\n总计 ${total.violations} 处违规（作为 ui-guard 第 6 条规则的潜在基线）`);

// ── 自测：确保探针能抓住违规，避免「永远 0」的假阴性 ──
if (process.argv.includes('--self-test')) {
  const cases = [
    ['嵌套 button', '<button onClick={x}>a<button type="button">b</button></button>'],
    ['role=button 嵌套', '<div role="button" tabIndex={0}><span role="button">x</span></div>'],
    ['button 套 a', '<button><a href="/x">链接</a></button>'],
    ['正常：按钮内只有 span/文本', '<button><span>ok</span></button>'],
    ['正常：卡片 div 非交互', '<div className="card"><button>ok</button></div>'],
    ['正常：label 包 input（标准写法，不应命中）', '<label><input type="text" /></label>'],
    ['正常：组件边界（不应命中）', '<TooltipTrigger><Button>ok</Button></TooltipTrigger>'],
  ];
  let pass = 0, fail = 0;
  for (const [name, code] of cases) {
    const sf = ts.createSourceFile('self-test.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hits = [];
    (function visit(node, outerInteractive) {
      if (!node) return;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (isInteractive(node)) {
          if (outerInteractive) hits.push(node.getText(sf));
          if (ts.isJsxElement(node)) for (const child of node.children) visit(child, true);
          return;
        }
        if (ts.isJsxElement(node)) for (const child of node.children) visit(child, outerInteractive);
        return;
      }
      ts.forEachChild(node, (c) => visit(c, outerInteractive));
    })(sf, null);
    const expected = /正常/.test(name) ? 0 : 1;
    const ok = hits.length === expected;
    console.log(`${ok ? '✅' : '❌'} ${name}  → 命中 ${hits.length} 条${ok ? '' : `（期望 ${expected}）`}`);
    if (ok) pass++; else fail++;
  }
  console.log(`\n自测：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}