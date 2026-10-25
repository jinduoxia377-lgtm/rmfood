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
 *   其余 6 处均为镜像，check-version.js 强制它们与权威源一致。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/** 平台发布版本号正则：严格 SemVer，含可选 prerelease / build metadata */
const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?/;

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
      const [maj, min, pat] = version.split('.');
      after = before
        .replace(/(^__version__\s*=\s*["'])([^"']+)(["'])/m, `$1${version}$3`)
        .replace(
          /^VERSION_TUPLE:\s*[^=]*=\s*\(\d+,\s*\d+,\s*\d+\)/m,
          `VERSION_TUPLE: tuple[int, int, int] = (${maj}, ${min}, ${pat.replace(/[^0-9]/g, '') || 0})`
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** 语义化版本运算 */
function bump(current, kind) {
  const m = current.match(SEMVER_RE);
  if (!m) throw new Error(`无法解析版本号：${current}`);

  const [full, maj, min, pat, pre] = m;
  let M = Number(maj);
  let N = Number(min);
  let P = Number(pat);
  let suffix = pre ? `-${pre}` : '';

  switch (kind) {
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
    case 'prerelease':
    case 'rc': {
      // 2.0.0 -> 2.0.0-rc.1 ；2.0.0-rc.1 -> 2.0.0-rc.2 ；2.0.0-rc.2 -> 2.0.1（正式发布）
      const tag = kind === 'rc' ? 'rc' : 'alpha';
      if (pre && pre.startsWith(`${tag}.`)) {
        const n = Number(pre.slice(tag.length + 1));
        if (Number.isInteger(n)) {
          suffix = `-${tag}.${n + 1}`;
          return `${M}.${N}.${P}${suffix}`;
        }
      }
      if (pre) {
        // 已有其他 prerelease → 推进 minor 并去掉后缀（视为正式发布）
        return `${M}.${N + 1}.${P}`;
      }
      suffix = `-${tag}.1`;
      break;
    }
    default:
      throw new Error(`未知的 bump 类型：${kind}（可选 patch | minor | major | rc | prerelease）`);
  }

  return `${M}.${N}.${P}${suffix}`;
}

module.exports = {
  ROOT,
  VERSION_SOURCES,
  SEMVER_RE,
  abs,
  read,
  write,
  extractVersion,
  writeVersion,
  bump,
  todayISO,
  updateChangelog,
};
