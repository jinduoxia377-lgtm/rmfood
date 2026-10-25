/**
 * RMFOOD 版本承载点解析层（单一事实源定义）
 * ==========================================
 *
 * 零依赖（仅使用 Node.js 内置模块），供 check-version.js / bump-version.js 共用。
 *
 * ⚠️  VERSION_SOURCES 的清单必须与 backend/app/version.py 的
 *     VERSION_SOURCE_FILES 保持同步。任一侧新增/删除承载点时必须同时改另一侧。
 *
 * 版本权威源：package.json（仓库根）
 *   其余 7 处均为镜像，check-version.js 强制它们与权威源一致。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/** 平台发布版本号正则：严格 SemVer，含可选 prerelease / build metadata */
const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?/;

/**
 * 解析 SemVer 版本号。
 *
 * 唯一取数值 M.N.P 的入口。不要用 `version.split('.')` 取补丁位：build metadata
 * 里的 dot 段会被并进补丁分量，再剥非数字后既可能算错、也可能造出前导零。
 *   '2.0.0+2026.10.25'.split('.') -> ['2','0','0+2026','10','25'] -> '02026'
 *     -> VERSION_TUPLE = (2, 0, 02026) -> Python 3 SyntaxError（前导零）
 *   '2.0.5+2026.10'.split('.')     -> ['2','0','5+2026','10']      -> '52026'
 *     -> VERSION_TUPLE = (2, 0, 52026) -> 能过 ast.parse，但数值静默算错，更危险
 * 注：`build.7` 这种形式恰好安全（'0+build' 剥非数字仍是 '0'），别被它误导。
 *
 * @param {string} v 版本号字符串
 * @returns {{major:number, minor:number, patch:number,
 *            prerelease:(string|null), build:(string|null)} | null}
 */
function parseSemVer(v) {
  const m = String(v).match(SEMVER_RE);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || null,
    build: m[5] || null,
  };
}

/**
 * 全部版本承载点。
 * kind 决定 extract() / write() 使用哪套解析规则。
 */
const VERSION_SOURCES = [
  { file: 'package.json', kind: 'package-json', role: '权威源（平台版本）' },
  { file: 'frontend/package.json', kind: 'package-json', role: 'Web 前端镜像' },
  { file: 'miniprogram/package.json', kind: 'package-json', role: '微信小程序镜像' },
  { file: 'backend/pyproject.toml', kind: 'pyproject-toml', role: '后端构建元数据' },
  { file: 'backend/app/version.py', kind: 'python-version', role: '后端运行时（单一事实源）' },
  { file: '.env.example', kind: 'env-example', role: '环境变量示例（根）' },
  { file: 'backend/.env.example', kind: 'env-example', role: '环境变量示例（后端）' },
  { file: 'CHANGELOG.md', kind: 'changelog', role: '变更历史条目' },
];

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

/** 读取仓库根的相对路径文件（供漂移检测等直接取原始文本的调用方使用） */
function readFile(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(abs(file), content, 'utf8');
}

function normalize(v) {
  return typeof v === 'string' ? v.trim() : v;
}

/** 提取单个承载点中的版本号；找不到时返回 null */
function extractVersion(source) {
  const p = abs(source.file);
  if (!fs.existsSync(p)) return null;

  const text = read(source.file);

  switch (source.kind) {
    case 'package-json': {
      try {
        return normalize(JSON.parse(text).version);
      } catch (_) {
        return null;
      }
    }

    case 'pyproject-toml': {
      // 仅取 [project] 段内的第一个 version = "..."，避免误伤其他段的 version 键
      const lines = text.split(/\r?\n/);
      let inProject = false;
      for (const line of lines) {
        const t = line.trim();
        if (/^\[.*\]$/.test(t)) {
          inProject = t === '[project]';
          continue;
        }
        if (inProject) {
          const m = t.match(/^version\s*=\s*["']([^"']+)["']/);
          if (m) return normalize(m[1]);
        }
      }
      return null;
    }

    case 'python-version': {
      const m = text.match(/^__version__\s*=\s*["']([^"']+)["']/m);
      return m ? normalize(m[1]) : null;
    }

    case 'env-example': {
      const m = text.match(/^APP_VERSION\s*=\s*([^#\r\n]+)/m);
      return m ? normalize(m[1]).replace(/^["']|["']$/g, '') : null;
    }

    case 'changelog': {
      // 第一个非 Unreleased 的 `## [x.y.z]` 条目
      const m = text.match(/^##\s*\[([0-9][^\]]*)\]\s*(?:[-–—]\s*(.+))?$/m);
      if (!m) return null;
      return m[1].startsWith('Unreleased') ? null : normalize(m[1]);
    }

    default:
      return null;
  }
}

/** 把版本号写回单个承载点；返回 { changed, note } */
function writeVersion(source, version) {
  const p = abs(source.file);
  if (!fs.existsSync(p)) return { changed: false, note: '文件不存在，跳过' };

  const before = read(source.file);
  let after;

  switch (source.kind) {
    case 'package-json': {
      const obj = JSON.parse(before);
      obj.version = version;
      // 保留原始缩进风格：探测首层缩进
      const indent = (before.match(/\n(\s+)"name"/) || [, '  '])[1];
      after = JSON.stringify(obj, null, indent) + '\n';
      break;
    }

    case 'pyproject-toml': {
      const lines = before.split(/\r?\n/);
      let inProject = false;
      let done = false;
      after = lines
        .map((line) => {
          const t = line.trim();
          if (/^\[.*\]$/.test(t)) {
            inProject = t === '[project]';
            return line;
          }
          if (inProject && !done && /^version\s*=/.test(t)) {
            done = true;
            return `version = "${version}"`;
          }
          return line;
        })
        .join('\n');
      break;
    }

    case 'python-version': {
      // 落盘语义（两条要分开理解）：
      //   __version__     写完整版本号，含 prerelease / build metadata ——
      //                   `final` 保留 build metadata 的价值就在这里。
      //   VERSION_TUPLE   只写数值 M.N.P，**不带** build metadata。它是运行时
      //                   比较用的三元组，本来就不表达 build metadata，硬塞进去
      //                   只会重复制造炸点（见 parseSemVer 的说明）。
      const sem = parseSemVer(version);
      const tuplePatch = sem ? sem.patch : 0;
      after = before
        .replace(/(^__version__\s*=\s*["'])([^"']+)(["'])/m, `$1${version}$3`)
        .replace(
          /^VERSION_TUPLE:\s*[^=]*=\s*\(\d+,\s*\d+,\s*\d+\)/m,
          `VERSION_TUPLE: tuple[int, int, int] = (${sem ? sem.major : 0}, ${
            sem ? sem.minor : 0
          }, ${tuplePatch})`
        )
        .replace(
          /^RELEASE_DATE\s*=\s*["']([^"']+)["']/m,
          `RELEASE_DATE = "${todayISO()}"`
        );
      break;
    }

    case 'env-example': {
      if (/^APP_VERSION\s*=/m.test(before)) {
        after = before.replace(/^APP_VERSION\s*=\s*.*$/m, `APP_VERSION=${version}`);
      } else {
        after = `APP_VERSION=${version}\n${before}`;
      }
      break;
    }

    case 'changelog': {
      after = updateChangelog(before, version, todayISO());
      break;
    }

    default:
      return { changed: false, note: `未知承载点类型 ${source.kind}` };
  }

  if (after === before) return { changed: false, note: '内容未变化' };
  write(source.file, after);
  return { changed: true, note: `→ ${version}` };
}

/**
 * 更新 CHANGELOG.md：
 * - 若目标版本条目已存在，仅刷新其日期
 * - 否则在 Unreleased 之后插入新条目（带占位提示）
 * - 确保顶部存在空的 [Unreleased] 段
 */
function updateChangelog(text, version, date) {
  const headingRe = /^##\s*\[([^\]]+)\]\s*(?:[-–—]\s*(.+))?$/m;

  // 目标版本条目已存在 → 刷新日期
  const existing = text.match(new RegExp(`^##\\s*\\[${escapeRe(version)}\\][^\\n]*$`, 'm'));
  if (existing) {
    return text.replace(
      new RegExp(`^##\\s*\\[${escapeRe(version)}\\][^\\n]*$`, 'm'),
      `## [${version}] - ${date}`
    );
  }

  let result = text;

  // 顶部无 Unreleased 段 → 补一个
  if (!/^##\s*\[Unreleased\]/m.test(result)) {
    const firstHeading = result.match(headingRe);
    const anchor = firstHeading ? firstHeading.index : 0;
    const block = `## [Unreleased]\n\n### Added\n\n- 暂无\n\n`;
    result = result.slice(0, anchor) + block + result.slice(anchor);
  }

  // 在 Unreleased 段之后插入新版本条目
  const unreleasedEnd = findSectionEnd(result, 'Unreleased');
  const block = [
    `## [${version}] - ${date}`,
    '',
    '### Added',
    '',
    '- 建立正式语义化版本发布体系（ADR-038）',
    '- **待补充**：请对照 git log 与本版本区间的提交，填写实际变更明细',
    '',
  ].join('\n');

  if (unreleasedEnd >= 0) {
    result = result.slice(0, unreleasedEnd) + block + result.slice(unreleasedEnd);
  } else {
    result = block + '\n' + result;
  }

  return result;
}

/** 返回 `## [title]` 所在段落的结束偏移（下一个 `## ` 之前），找不到返回 -1 */
function findSectionEnd(text, title) {
  const start = text.search(new RegExp(`^##\\s*\\[${escapeRe(title)}\\][^\\n]*$`, 'm'));
  if (start < 0) return -1;
  const rest = text.slice(start);
  const m = rest.slice(1).match(/^##\s/m);
  if (!m) return text.length;
  // 跳过标题行本身，从换行后开始找下一个 ##
  const afterTitle = rest.indexOf('\n') + 1;
  const tail = rest.slice(afterTitle);
  const m2 = tail.match(/^##\s/m);
  if (!m2) return text.length;
  return start + afterTitle + m2.index;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 按「顶层逗号」切分元组内容：引号内、以及嵌套括号/方括号内的逗号都不切分。
 * 因此 `("a", ("x", "y"), "b")` 得到 3 项而不是 4 项。
 */
function splitTopLevelCommas(text) {
  const items = [];
  let cur = '';
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') {
        cur += text[i + 1] || '';
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth--;
      cur += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      items.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) items.push(cur);
  return items;
}

/**
 * 去掉「引号外」的行内注释（`# ...` 到行尾）。引号内的 `#` 原样保留。
 * 这是解析 VERSION_SOURCE_FILES 元组的关键一步：若先按逗号切分，
 * 上一行的注释会被粘到下一个字符串上，导致 `"x"` 前面多出 `# ...` 而失配。
 */
function stripCommentsOutsideQuotes(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] || '';
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n') i++;
      if (i < text.length) out += '\n';
      continue;
    }
    out += ch;
  }
  return out;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 从 Python 源码中截取 `NAME = (...)` 元组字面量的括号内内容。
 *
 * 纯文本扫描：从 `(` 开始逐字符走，用引号状态机跳过字符串内部（因此字符串
 * 里的括号不会被误判），用括号深度找出真正的闭合 `)`。容忍：
 *   - 任意缩进、每行一个或每行多个条目
 *   - 双引号 / 单引号 / 混用
 *   - 逗号后的行内注释、`# noqa` 之类尾部注释
 *
 * @param {string} source Python 源码全文
 * @param {string} name   变量名
 * @returns {{ items: string[], raw: string } | null}
 *          items 为逗号分隔后的单条目文本（已 trim，保留原始引号）；raw 为括号内全文
 */
function extractTupleItems(source, name) {
  // 声明形如 `NAME = (` 或 `NAME: tuple[str, ...] = (`（Python 标注写在等号前）
  const decl = new RegExp(
    '(^|\\n)[ \\t]*' + escapeRe(name) + '\\s*(?::[^=\\n]*)?=[ \\t]*\\('
  );
  const start = source.match(decl);
  if (!start) return null;

  // start[0] 已含起始的 ^ 或 \n，其末字符即左括号本身
  const open = start.index + start[0].length - 1;
  let quote = null;
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl - 1;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return null;

  const body = stripCommentsOutsideQuotes(source.slice(open + 1, close));
  // 顶层逗号切分：引号内、嵌套括号内的逗号不切，因此顺序天然与元组一致
  const items = splitTopLevelCommas(body)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { items, raw: body };
}

/**
 * 解析 `backend/app/version.py` 的 VERSION_SOURCE_FILES 元组里的文件路径字符串。
 * 容忍引号风格差异、每行一个/多个、括号后带注释；找不到定义时返回 null。
 *
 * @param {string} source Python 源码全文
 * @returns {string[] | null}
 */
function parsePythonVersionSourceList(source) {
  if (typeof source !== 'string' || !source.includes('VERSION_SOURCE_FILES')) return null;
  const hit = extractTupleItems(source, 'VERSION_SOURCE_FILES');
  if (!hit) return null;
  const files = [];
  for (const item of hit.items) {
    const m = item.match(/^(["'])(.+?)\1\s*(?:#.*)?$/);
    if (!m) return null; // 出现非字符串条目（如变量引用），不猜，按异常处理
    files.push(m[2]);
  }
  return files;
}

/**
 * 校验 backend/app/version.py 的 VERSION_SOURCE_FILES 与 JS 侧 VERSION_SOURCES
 * 的 file 字段双向一致（集合 + 顺序）。
 *
 * @param {object} [opts]
 * @param {Array<{file:string}|string>} [opts.expected]  默认 VERSION_SOURCES
 * @param {string} [opts.pythonSource]            默认读取 backend/app/version.py
 * @returns {{ ok: boolean, expected: string[], actual: string[],
 *             missing: string[], extra: string[], orderMismatch: Array<{index:number, expected:string, actual:string}>,
 *             note?: string }}
 */
function verifySourceList(opts) {
  const o = opts || {};
  // opts.expected 既可传 VERSION_SOURCES 形式的 { file } 数组，也可传纯路径数组
  const expected = (o.expected || VERSION_SOURCES).map((s) =>
    typeof s === 'string' ? s : s && s.file
  );
  let text = o.pythonSource;
  if (text === undefined) {
    try {
      text = readFile('backend/app/version.py');
    } catch (e) {
      return {
        ok: false,
        expected,
        actual: [],
        missing: expected.slice(),
        extra: [],
        orderMismatch: [],
        note: `无法读取 backend/app/version.py：${e && e.message ? e.message : e}`,
      };
    }
  }

  const actual = parsePythonVersionSourceList(text);
  if (!actual) {
    return {
      ok: false,
      expected,
      actual: [],
      missing: expected.slice(),
      extra: [],
      orderMismatch: [],
      note: '未能从 backend/app/version.py 解析出 VERSION_SOURCE_FILES 元组',
    };
  }

  const missing = expected.filter((f) => !actual.includes(f));
  const extra = actual.filter((f) => !expected.includes(f));
  const orderMismatch = [];
  const n = Math.max(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    const e = i < expected.length ? expected[i] : '(缺失)';
    const a = i < actual.length ? actual[i] : '(缺失)';
    if (e !== a) orderMismatch.push({ index: i, expected: e, actual: a });
  }

  return {
    ok: missing.length === 0 && extra.length === 0 && orderMismatch.length === 0,
    expected,
    actual,
    missing,
    extra,
    orderMismatch,
  };
}


/**
 * 语义化版本运算。
 *
 * 五个 kind 的语义边界（ADR-038）：
 *   patch / minor / major  推进主/次/补丁号；产出「发布版本号」，不带 prerelease，
 *                          也不带 build metadata（与 npm version 一致：build metadata
 *                          只属于构建产物，不属于发布版本）。
 *   rc                     为**当前基线**造候选：2.0.0 -> 2.0.0-rc.1 -> 2.0.0-rc.2。
 *                          不推进主/次/补丁号，因此可与 final 配对完成转正。
 *   prerelease             npm 语义的「下一版本预发布」：正式版 bump patch 再加标识符
 *                          （2.0.0 -> 2.0.1-alpha.0）；已是预发布则基线不变、序号 +1
 *                          （2.0.0-rc.1 -> 2.0.0-rc.2）。**不负责转正**。
 *   final                  转正：只剥离 prerelease 后缀，M.N.P 与 build metadata 都不变
 *                          （2.0.0-rc.2 -> 2.0.0）。已是正式版时抛错，不做静默无操作。
 *
 * 转正只有 final 一条路。patch/minor/major 都不剥离 prerelease 后缀，rc 只会再造候选，
 * 所以 2.0.0-rc.2 无法靠它们变成 2.0.0。
 */
function bump(current, kind) {
  const v = parseSemVer(current);
  if (!v) throw new Error(`无法解析版本号：${current}`);

  let { major: M, minor: N, patch: P } = v;
  const buildSuffix = v.build ? `+${v.build}` : '';
  // 可递进的 prerelease 形如 `rc.1` / `alpha.0`；`beta`（无序号）不算可递进
  const preMatch = v.prerelease && v.prerelease.match(/^([0-9A-Za-z]+)\.(\d+)$/);

  switch (kind) {
    // ─────────────────────────────────────────────────────────────────────
    // 决策：patch / minor / major 剥离 prerelease 与 build metadata。
    //
    // 三者是「发布版本号」生产者，产出候选版属于语义混乱（2.0.0-rc.2 + patch
    // 若保留后缀会得到 2.0.1-rc.2 —— 号称发布了，却仍是候选）。转正只有
    // final 一条路，职责边界才干净。与 npm `version` 行为一致。
    //
    // 回退这段之前先想清楚：一旦让发布类 kind 重新带上后缀，rc 的转正就必须
    // 塞回 patch/minor/major 里，ADR-038 的「同名不同义」漂移会原样复发。
    // ─────────────────────────────────────────────────────────────────────
    case 'patch':
      P += 1;
      break;
    case 'minor':
      N += 1;
      P = 0;
      break;
    case 'major':
      M += 1;
      N = 0;
      P = 0;
      break;
    case 'final': {
      if (!v.prerelease) {
        throw new Error(
          `${current} 已是正式版，没有可剥离的 prerelease 后缀；如需推进版本请用 patch | minor | major`
        );
      }
      return `${M}.${N}.${P}${buildSuffix}`;
    }
    case 'rc': {
      // 当前基线的候选版：2.0.0 -> 2.0.0-rc.1；2.0.0-rc.1 -> 2.0.0-rc.2
      if (preMatch && preMatch[1] === 'rc') {
        return `${M}.${N}.${P}-rc.${Number(preMatch[2]) + 1}${buildSuffix}`;
      }
      return `${M}.${N}.${P}-rc.1${buildSuffix}`;
    }
    case 'prerelease': {
      // 预发布 -> 预发布：基线不变，沿用同一标识符，序号 +1
      if (preMatch) {
        return `${M}.${N}.${P}-${preMatch[1]}.${Number(preMatch[2]) + 1}${buildSuffix}`;
      }
      // 正式版 -> 预发布：bump patch 再加标识符（npm version prerelease 惯例）
      P += 1;
      return `${M}.${N}.${P}-alpha.0${buildSuffix}`;
    }
    default:
      throw new Error(
        `未知的 bump 类型：${kind}（可选 patch | minor | major | rc | prerelease | final）`
      );
  }

  // patch / minor / major 共用出口：发布版本号，不带任何后缀（见上方决策）
  return `${M}.${N}.${P}`;
}

module.exports = {
  ROOT,
  VERSION_SOURCES,
  SEMVER_RE,
  abs,
  read,
  readFile,
  write,
  extractVersion,
  writeVersion,
  parseSemVer,
  bump,
  todayISO,
  updateChangelog,
  extractTupleItems,
  splitTopLevelCommas,
  parsePythonVersionSourceList,
  verifySourceList,
};
