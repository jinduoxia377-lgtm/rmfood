/**
 * version-sources.js 单元测试（node:test，零第三方依赖）
 *
 * 覆盖：
 *   1. SemVer bump 运算（patch / minor / major / rc，含 rc 递进与转正式）
 *   2. 各 kind 的 extractVersion 对真实承载点文件的读取
 *      （package-json / pyproject-toml / python-version / env-example / changelog）
 *   3. 双写清单漂移检测（一致通过 / 缺失 / 多余 / 顺序 / 解析失败）
 *   4. VERSION_SOURCE_FILES 元组的 Python 纯文本解析（引号风格 / 多条目 / 注释 / 转义）
 *
 * 运行：node --test scripts/version/*.test.js
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// 测试环境：关闭颜色，避免干扰断言
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
if (process.stdout.isTTY !== false) process.stdout.isTTY = false;

const {
  VERSION_SOURCES,
  bump,
  extractVersion,
  verifySourceList,
  parsePythonVersionSourceList,
  extractTupleItems,
  parseSemVer,
} = require('./version-sources');

/** 按 file 查找承载点定义 */
const src = (file) => VERSION_SOURCES.find((s) => s.file === file);
/** 内联构造 Python 元组字面量 */
const tuple = (files, head = 'VERSION_SOURCE_FILES: tuple[str, ...] = (') =>
  `${head}\n${files.map((f) => `    "${f}",`).join('\n')}\n)\n`;

/* ──────────────────────────── 1. SemVer bump ──────────────────────────── */

test('bump: patch 递增补丁位', () => {
  assert.equal(bump('2.0.0', 'patch'), '2.0.1');
  assert.equal(bump('1.9.42', 'patch'), '1.9.43');
  assert.equal(bump('0.0.9', 'patch'), '0.0.10');
});

test('bump: minor 递增次版本并归零补丁位', () => {
  assert.equal(bump('2.0.0', 'minor'), '2.1.0');
  assert.equal(bump('2.3.9', 'minor'), '2.4.0');
});

test('bump: major 递增主版本并归零次/补丁位', () => {
  assert.equal(bump('2.0.0', 'major'), '3.0.0');
  assert.equal(bump('2.9.4', 'major'), '3.0.0');
});

test('bump: rc 从稳定版进入发布候选，再逐次递进', () => {
  assert.equal(bump('2.0.0', 'rc'), '2.0.0-rc.1');
  assert.equal(bump('2.0.0-rc.1', 'rc'), '2.0.0-rc.2');
  assert.equal(bump('2.0.0-rc.9', 'rc'), '2.0.0-rc.10');
});

test('bump: rc 递进不改变主/次/补丁位（只推进候选序号）', () => {
  assert.equal(bump('2.1.7-rc.3', 'rc'), '2.1.7-rc.4');
});

test('bump: rc 只造候选，永不剥离后缀（因此不能用于转正）', () => {
  // 2.0.0-alpha.1 + rc 过去会得到 2.1.0（把转正混进了 rc），现在只会造 rc 候选
  assert.equal(bump('2.0.0-alpha.1', 'rc'), '2.0.0-rc.1');
  assert.equal(bump('2.0.0-rc.2', 'rc'), '2.0.0-rc.3');
});

test('bump: prerelease 为下一版本的预发布，不负责转正', () => {
  // 正式版 -> 预发布：先 bump patch，再加 alpha.0（npm version prerelease 惯例）
  assert.equal(bump('2.0.0', 'prerelease'), '2.0.1-alpha.0');
  assert.equal(bump('1.2.3', 'prerelease'), '1.2.4-alpha.0');
  assert.equal(bump('1.2.3-alpha.1', 'prerelease'), '1.2.3-alpha.2');
  // 已是预发布：基线不变，沿用同一标识符，序号 +1
  assert.equal(bump('2.0.0-rc.1', 'prerelease'), '2.0.0-rc.2');
  assert.equal(bump('1.9.3-rc.5', 'prerelease'), '1.9.3-rc.6');
  // 无序号的标识符不可递进 → 走「正式版 -> 预发布」分支
  assert.equal(bump('2.0.0-beta', 'prerelease'), '2.0.1-alpha.0');
});

test('bump: final 只剥离 prerelease 后缀，M.N.P 不变', () => {
  assert.equal(bump('2.0.0-rc.2', 'final'), '2.0.0');
  assert.equal(bump('2.1.0-alpha.1', 'final'), '2.1.0');
  assert.equal(bump('1.9.3-rc.5', 'final'), '1.9.3');
});

test('bump: final 保留 build metadata', () => {
  assert.equal(bump('2.0.0-rc.1+build.7', 'final'), '2.0.0+build.7');
});

test('bump: 对正式版执行 final 必须报错，不能静默原样返回', () => {
  assert.throws(() => bump('2.0.0', 'final'), /已是正式版/);
  assert.throws(() => bump('2.0.0+build.7', 'final'), /已是正式版/);
});

test('bump: final 与 patch 是两条不同的路（rc 转正只走 final）', () => {
  // patch/minor/major 产出「发布版本号」，会连 prerelease 一起剥离；
  // 它们永远得不到 2.0.0，只有 final 能。
  assert.equal(bump('2.0.0-rc.2', 'patch'), '2.0.1');
  assert.equal(bump('2.0.0-rc.2', 'minor'), '2.1.0');
  assert.equal(bump('2.0.0-rc.2', 'major'), '3.0.0');
  assert.equal(bump('2.0.0-rc.2', 'final'), '2.0.0');
});

test('bump: 发布时有意丢弃 build metadata（构建元数据不进入发布版本）', () => {
  // SemVer 规定 build metadata 不参与优先级比较，发布流程不把它带入下一个版本
  assert.equal(bump('2.0.0+build.7', 'patch'), '2.0.1');
  assert.equal(bump('1.2.3+20261025.abc', 'major'), '2.0.0');
});

test('bump: 拒绝未知类型与非法版本号', () => {
  assert.throws(() => bump('2.0.0', 'hotfix'), /未知的 bump 类型/);
  assert.throws(() => bump('not-a-version', 'patch'), /无法解析版本号/);
});

/* ──────────────────── 2. 各 kind 的解析（真实文件） ──────────────────── */

test('parseSemVer: 数值位由正则解析，build metadata 不会污染补丁位', () => {
  assert.deepEqual(parseSemVer('2.0.0'), {
    major: 2,
    minor: 0,
    patch: 0,
    prerelease: null,
    build: null,
  });
  assert.deepEqual(parseSemVer('2.0.0+build.7'), {
    major: 2,
    minor: 0,
    patch: 0,
    prerelease: null,
    build: 'build.7',
  });
  assert.deepEqual(parseSemVer('2.0.0-rc.1+build.7'), {
    major: 2,
    minor: 0,
    patch: 0,
    prerelease: 'rc.1',
    build: 'build.7',
  });
  assert.equal(parseSemVer('不是版本'), null);

  // 对照：字符串切片会把 build metadata 的 dot 段并进补丁位。
  // 注意触发条件比 build.7 更刁钻——'0+build' 剥非数字恰好仍是 '0'，
  // 真正出事的是 build 段带数字（如 2026.10.25）。
  const oldPatch = (v) => v.split('.')[2].replace(/[^0-9]/g, '') || 0;
  assert.equal(oldPatch('2.0.0+build.7'), '0');          // 侥幸安全
  assert.equal(oldPatch('2.0.0+2026.10.25'), '02026');   // 前导零 → Python SyntaxError
  assert.equal(oldPatch('2.0.5+2026.10'), '52026');      // 静默算错，更危险
  assert.equal(parseSemVer('2.0.0+2026.10.25').patch, 0);
  assert.equal(parseSemVer('2.0.5+2026.10').patch, 5);
});

test('extractVersion: 8 个承载点全部解析到同一版本', () => {
  assert.equal(VERSION_SOURCES.length, 8);
  const versions = VERSION_SOURCES.map((s) => ({ file: s.file, v: extractVersion(s) }));
  assert.deepEqual(versions, [
    { file: 'package.json', v: '2.0.0' },
    { file: 'frontend/package.json', v: '2.0.0' },
    { file: 'miniprogram/package.json', v: '2.0.0' },
    { file: 'backend/pyproject.toml', v: '2.0.0' },
    { file: 'backend/app/version.py', v: '2.0.0' },
    { file: '.env.example', v: '2.0.0' },
    { file: 'backend/.env.example', v: '2.0.0' },
    { file: 'CHANGELOG.md', v: '2.0.0' },
  ]);
});

test('extractVersion: package-json 从 JSON 顶层 version 字段读取', () => {
  assert.equal(extractVersion(src('package.json')), '2.0.0');
  assert.equal(extractVersion(src('frontend/package.json')), '2.0.0');
  assert.equal(extractVersion(src('miniprogram/package.json')), '2.0.0');
});

test('extractVersion: pyproject-toml 仅取 [project] 段内的 version', () => {
  assert.equal(extractVersion(src('backend/pyproject.toml')), '2.0.0');
});

test('extractVersion: python-version 读取 __version__ 赋值行', () => {
  assert.equal(extractVersion(src('backend/app/version.py')), '2.0.0');
});

test('extractVersion: env-example 读取 APP_VERSION 并去掉包裹引号', () => {
  assert.equal(extractVersion(src('.env.example')), '2.0.0');
  assert.equal(extractVersion(src('backend/.env.example')), '2.0.0');
});

test('extractVersion: changelog 读取第一个非 Unreleased 的 [x.y.z] 条目', () => {
  assert.equal(extractVersion(src('CHANGELOG.md')), '2.0.0');
});

/* ──────────────────── 3. 双写清单漂移检测 ──────────────────── */

test('verifySourceList: 真实仓库两侧清单一致', () => {
  const r = verifySourceList();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.expected.length, 8);
  assert.deepEqual(r.actual, VERSION_SOURCES.map((s) => s.file));
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.deepEqual(r.orderMismatch, []);
});

test('verifySourceList: Python 缺项 → 报 missing 且失败', () => {
  const expected = VERSION_SOURCES.map((s) => s.file);
  const r = verifySourceList({
    expected,
    pythonSource: tuple(expected.filter((f) => f !== 'backend/.env.example')),
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['backend/.env.example']);
  assert.deepEqual(r.extra, []);
  // 缺 1 项后 Python 侧总长从 8 变 7，第 7 项起全部错位，故报 2 处顺序差异
  assert.equal(r.orderMismatch.length, 2);
  assert.equal(r.orderMismatch[0].index, 6);
  assert.equal(r.orderMismatch[0].expected, 'backend/.env.example');
  assert.equal(r.orderMismatch[0].actual, 'CHANGELOG.md');
  assert.equal(r.orderMismatch[1].actual, '(缺失)');
});

test('verifySourceList: Python 多一项（指向不存在的名字）→ 报 extra', () => {
  const expected = VERSION_SOURCES.map((s) => s.file);
  const r = verifySourceList({
    expected,
    pythonSource: tuple([...expected, 'backend/DOES_NOT_EXIST.md']),
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, ['backend/DOES_NOT_EXIST.md']);
});

test('verifySourceList: 集合相同但顺序不同 → 报 orderMismatch', () => {
  const expected = VERSION_SOURCES.map((s) => s.file);
  const swapped = [expected[1], expected[0]].concat(expected.slice(2));
  const r = verifySourceList({ expected, pythonSource: tuple(swapped) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.deepEqual(r.orderMismatch, [
    { index: 0, expected: 'package.json', actual: 'frontend/package.json' },
    { index: 1, expected: 'frontend/package.json', actual: 'package.json' },
  ]);
});

test('verifySourceList: 无法解析元组时给出明确 note；两侧均空算一致', () => {
  const a = verifySourceList({ pythonSource: '# 里面没有 VERSION_SOURCE_FILES' });
  assert.equal(a.ok, false);
  assert.match(a.note, /未能从 backend\/app\/version.py 解析出 VERSION_SOURCE_FILES 元组/);
  assert.deepEqual(a.actual, []);

  // 空对空：集合与顺序都一致（新仓库尚未登记任何承载点的过渡期不误报）
  const b = verifySourceList({ expected: [], pythonSource: 'VERSION_SOURCE_FILES = (\n)\n' });
  assert.equal(b.ok, true);
  assert.deepEqual(b.actual, []);
});

test('verifySourceList: opts.expected 兼容 {file} 对象数组与纯字符串数组', () => {
  const fromObjects = verifySourceList({
    expected: VERSION_SOURCES,
    pythonSource: tuple(VERSION_SOURCES.map((s) => s.file)),
  });
  const fromStrings = verifySourceList({
    expected: VERSION_SOURCES.map((s) => s.file),
    pythonSource: tuple(VERSION_SOURCES.map((s) => s.file)),
  });
  assert.deepEqual(fromObjects.actual, fromStrings.actual);
  assert.equal(fromObjects.ok, fromStrings.ok);
});

/* ──────── 4. VERSION_SOURCE_FILES 的 Python 纯文本解析 ──────── */

test('parsePythonVersionSourceList: 容忍双/单引号混用、一行多个条目、行内注释', () => {
  const src = [
    'VERSION_SOURCE_FILES: tuple[str, ...] = (',
    '    "package.json", "frontend/package.json",  # Web 镜像',
    "    'miniprogram/package.json',   # 微信小程序",
    '    "backend/pyproject.toml",',
    '    "backend/app/version.py",',
    '    ".env.example",',
    '    "backend/.env.example",',
    '    "CHANGELOG.md",',
    ')',
  ].join('\n');
  assert.deepEqual(parsePythonVersionSourceList(src), VERSION_SOURCES.map((s) => s.file));
});

test('parsePythonVersionSourceList: 容忍制表符缩进与括号尾部注释', () => {
  const src = ['VERSION_SOURCE_FILES = (  # 相对仓库根目录', '\t"package.json",', '\t"CHANGELOG.md",', ')  # noqa: E501'].join('\n');
  assert.deepEqual(parsePythonVersionSourceList(src), ['package.json', 'CHANGELOG.md']);
});

test('parsePythonVersionSourceList: 字符串内部的 # 不被当作注释', () => {
  assert.deepEqual(
    parsePythonVersionSourceList('VERSION_SOURCE_FILES = (\n    "a#b.md",\n    "CHANGELOG.md",\n)\n'),
    ['a#b.md', 'CHANGELOG.md']
  );
});

test('parsePythonVersionSourceList: 字符串内部的转义引号不被误判为闭合', () => {
  // 返回原始字面量内容（不做 Python 反转义）；关键是 \' 之后的转义引号没有提前闭合字符串
  assert.deepEqual(
    parsePythonVersionSourceList('VERSION_SOURCE_FILES = (\n    \'a\\"b.md\',\n    "CHANGELOG.md",\n)\n'),
    ['a\\"b.md', 'CHANGELOG.md']
  );
});

test('parsePythonVersionSourceList: 无标注 / 有标注 / 列表字面量', () => {
  assert.deepEqual(parsePythonVersionSourceList('VERSION_SOURCE_FILES = (\n    "package.json"\n)\n'), [
    'package.json',
  ]);
  assert.deepEqual(
    parsePythonVersionSourceList('VERSION_SOURCE_FILES: tuple[str, ...] = (\n    "package.json"\n)\n'),
    ['package.json']
  );
  // 列表字面量不是元组 → 不猜，返回 null
  assert.equal(parsePythonVersionSourceList('VERSION_SOURCE_FILES = [\n    "package.json"\n]\n'), null);
});

test('parsePythonVersionSourceList: 条目不是字符串或定义缺失时返回 null', () => {
  assert.equal(parsePythonVersionSourceList('VERSION_SOURCE_FILES = (OTHER_VAR,)\n'), null);
  assert.equal(parsePythonVersionSourceList('VERSION_SOURCE_FILES = 42\n'), null);
  assert.equal(parsePythonVersionSourceList('完全没有定义的文本'), null);
  assert.equal(parsePythonVersionSourceList(null), null);
});

test('extractTupleItems: 括号深度扫描不会被嵌套元组干扰', () => {
  const r = extractTupleItems(
    'VERSION_SOURCE_FILES = ("package.json", ("nested", "ignored"), "CHANGELOG.md")\n',
    'VERSION_SOURCE_FILES'
  );
  assert.ok(r);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0], '"package.json"');
  // 嵌套元组内部的逗号不被切分，整个子元组保留为单一项
  assert.equal(r.items[1], '("nested", "ignored")');
  assert.equal(r.items[2], '"CHANGELOG.md"');
  assert.equal(extractTupleItems('nothing', 'VERSION_SOURCE_FILES'), null);
});
