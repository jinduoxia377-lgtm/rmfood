/**
 * check-version.js 退出码语义集成测试（node:test，零第三方依赖）
 *
 * 通过 node:child_process.spawn 直接驱动真实脚本，验证：
 *   exit 0  全部一致且双写清单一致
 *   exit 1  双写清单漂移（JSON 输出 verifySourceList.ok === false）
 *   exit 2  权威源缺失（临时仓库中删除 package.json）
 *   exit 2  参数错误
 *
 * 注意：退出码 2 的用例在 os.tmpdir() 下构造临时仓库，通过 NODE_PATH 指向
 * scripts/version 让 check-version.js 的 require('./version-sources') 可解析，
 * 全程不触碰真实仓库的 8 个版本承载点。
 *
 * 运行：node --test scripts/version/*.test.js
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(__dirname, 'check-version.js');

/** 在 cwd 下运行 check-version.js，返回 { code, stdout, stderr } */
function run(args, opts) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [opts && opts.script ? opts.script : SCRIPT, ...args], {
      cwd: opts && opts.cwd ? opts.cwd : REPO,
      env: { ...process.env, ...(opts && opts.env) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('close', (code) => resolve({ code: code === null ? -1 : code, stdout: out, stderr: err }));
  });
}

/** 建一个只含最小骨架的临时仓库（不含任何版本文件） */
function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rmfood-version-gate-'));
}

/**
 * 建一个 8 处承载点全部预置为 `version` 且互相一致的临时仓库。
 *
 * 用于端到端验证 bump-version.js：真实仓库的 8 处版本号是红线（必须 2.0.0），
 * 所以发布流程只能在临时仓库里跑。toolDir 里同时放三份工具脚本，
 * 让 version-sources.js 的 ROOT 解析到临时仓库而不是真实仓库。
 *
 * bump-version.js 内部会跑 `git status`，因此临时目录必须先 `git init`。
 */
function makeReleaseRepo(version) {
  const tmp = makeTempRepo();
  const toolDir = path.join(tmp, 'scripts', 'version');
  fs.mkdirSync(toolDir, { recursive: true });
  for (const f of ['version-sources.js', 'bump-version.js', 'check-version.js']) {
    fs.copyFileSync(path.join(__dirname, f), path.join(toolDir, f));
  }

  const pkg = JSON.stringify({ name: 'tmp', version }, null, 2) + '\n';
  const files = {
    'package.json': pkg,
    'frontend/package.json': pkg,
    'miniprogram/package.json': pkg,
    'backend/pyproject.toml': `[project]\nname = "tmp"\nversion = "${version}"\n`,
    'backend/app/version.py': [
      `__version__ = "${version}"`,
      'VERSION_TUPLE: tuple[int, int, int] = (2, 0, 0)',
      'RELEASE_DATE = "2026-10-25"',
      'VERSION_SOURCE_FILES = (' +
        ' "package.json", "frontend/package.json", "miniprogram/package.json", ' +
        '"backend/pyproject.toml", "backend/app/version.py", ".env.example", ' +
        '"backend/.env.example", "CHANGELOG.md",\n)',
      '',
    ].join('\n'),
    '.env.example': `APP_VERSION=${version}\n`,
    'backend/.env.example': `APP_VERSION=${version}\n`,
    'CHANGELOG.md': `## [${version}] - 2026-10-25\n\n### Added\n\n- 候选版\n`,
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }

  const init = spawnSync('git', ['init', '-q'], { cwd: tmp, stdio: 'pipe' });
  if (init.status !== 0) throw new Error(`git init 失败：${init.stderr}`);

  return { tmp, toolDir, files };
}

/** 找一个能跑的 python（ast.parse 语法校验用） */
function findPython() {
  for (const b of ['python', 'py', 'python3']) {
    const r = spawnSync(b, ['--version'], { stdio: 'pipe' });
    if (!r.error && r.status === 0) return b;
  }
  return null;
}

/** 运行 scripts/version 下任意脚本（用于参数错误等不产出文件的场景） */
function runScript(script, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: opts && opts.cwd ? opts.cwd : REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('close', (code) => resolve({ code: code === null ? -1 : code, stdout: out, stderr: err }));
  });
}

test('check-version: 干净仓库 exit 0，并报告 8 个承载点 + 双写清单通过', async () => {
  const r = await run(['--no-color']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /全部 8 个承载点一致：2\.0\.0/);
  assert.match(r.stdout, /双写清单一致/);
});

test('check-version: --json 模式输出结构化结果（verifySourceList 字段存在）', async () => {
  const r = await run(['--json', '--no-color']);
  assert.equal(r.code, 0, r.stdout);
  const data = JSON.parse(r.stdout);
  assert.equal(data.ok, true);
  assert.equal(data.exitCode, 0);
  assert.equal(data.version, '2.0.0');
  assert.equal(data.drifted.length, 0);
  assert.equal(data.missing.length, 0);
  assert.equal(data.verifySourceList.enabled, true);
  assert.equal(data.verifySourceList.ok, true);
  assert.equal(data.verifySourceList.expected.length, 8);
  assert.equal(data.verifySourceList.actual.length, 8);
  assert.deepEqual(data.verifySourceList.missing, []);
  assert.deepEqual(data.verifySourceList.extra, []);
  assert.deepEqual(data.verifySourceList.orderMismatch, []);
});

test('check-version: --no-verify-source-list 跳过双写检测并在 JSON 中标记 enabled=false', async () => {
  const r = await run(['--json', '--no-color', '--no-verify-source-list']);
  assert.equal(r.code, 0, r.stdout);
  const data = JSON.parse(r.stdout);
  assert.equal(data.verifySourceList.enabled, false);
  assert.equal(data.verifySourceList.ok, true);
});

test('check-version: 人类可读模式开启双写检测（默认行为）', async () => {
  const r = await run(['--no-color']);
  assert.match(r.stdout, /双写清单一致/);
});

test('check-version: 双写清单漂移 → exit 1（完整往返：制造 → 被抓 → 改回）', async () => {
  const pyFile = path.join(REPO, 'backend', 'app', 'version.py');
  const original = fs.readFileSync(pyFile, 'utf8');
  try {
    // 1) 人为制造漂移：把 Python 侧一项改成不存在的名字
    const mutated = original.replace(
      '    "backend/.env.example",',
      '    "backend/.env.example.TYPO",'
    );
    assert.notEqual(mutated, original, '制造漂移失败：替换点未命中，请检查 version.py 格式');
    fs.writeFileSync(pyFile, mutated, 'utf8');

    // 2) 人类可读模式应被抓到
    const r1 = await run(['--no-color']);
    assert.equal(r1.code, 1, r1.stdout + r1.stderr);
    assert.match(r1.stdout, /双写清单漂移/);
    assert.match(r1.stdout, /backend\/\.env\.example\.TYPO/);
    assert.doesNotMatch(r1.stdout, /全部 8 个承载点一致/);

    // 3) JSON 模式应被抓到并给出结构化差异
    const r2 = await run(['--json', '--no-color']);
    assert.equal(r2.code, 1, r2.stdout);
    const data = JSON.parse(r2.stdout);
    assert.equal(data.ok, false);
    assert.equal(data.verifySourceList.ok, false);
    assert.deepEqual(data.verifySourceList.missing, ['backend/.env.example']);
    assert.deepEqual(data.verifySourceList.extra, ['backend/.env.example.TYPO']);
    assert.equal(data.verifySourceList.orderMismatch.length, 1);
    assert.equal(data.drifted.length, 0); // 版本号本身没有漂移

    // 4) --no-verify-source-list 可优雅跳过（不算漂移）
    const r3 = await run(['--json', '--no-color', '--no-verify-source-list']);
    assert.equal(r3.code, 0, r3.stdout);
  } finally {
    // 5) 无论成败都改回来
    fs.writeFileSync(pyFile, original, 'utf8');
  }

  // 6) 恢复后必须重新通过
  const r4 = await run(['--json', '--no-color']);
  assert.equal(r4.code, 0, r4.stdout);
  assert.equal(JSON.parse(r4.stdout).verifySourceList.ok, true);
  assert.equal(fs.readFileSync(pyFile, 'utf8'), original, 'version.py 未能恢复原样');
});

test('check-version: 权威源缺失 → exit 2', async () => {
  const tmp = makeTempRepo();
  const versionDir = path.join(tmp, 'scripts', 'version');
  fs.mkdirSync(versionDir, { recursive: true });
  // 两个脚本一起拷过去：check-version.js 的 require('./version-sources') 按相对路径解析
  fs.copyFileSync(SCRIPT, path.join(versionDir, 'check-version.js'));
  fs.copyFileSync(
    path.join(__dirname, 'version-sources.js'),
    path.join(versionDir, 'version-sources.js')
  );
  fs.mkdirSync(path.join(tmp, 'backend', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'backend', 'app', 'version.py'),
    'VERSION_SOURCE_FILES = ("package.json",)\n'
  );

  try {
    const r = await run(['--json', '--no-color'], {
      cwd: tmp,
      script: path.join(versionDir, 'check-version.js'),
    });
    assert.equal(r.code, 2, r.stdout + r.stderr);
    const data = JSON.parse(r.stdout);
    assert.equal(data.ok, false);
    assert.equal(data.version, null);
    assert.equal(data.missing.length, 8); // 8 个承载点在临时仓库里都不存在
    assert.equal(data.verifySourceList.ok, false);
    // 临时仓库的 VERSION_SOURCE_FILES 只有 1 项 → 其余 7 项被判为漂移
    assert.deepEqual(data.verifySourceList.actual, ['package.json']);
    assert.equal(data.verifySourceList.missing.length, 7);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('bump-version: 缺少类型参数 → exit 2', async () => {
  const r = await runScript(path.join(__dirname, 'bump-version.js'), []);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /用法：/);
});

test('bump-version: 未知 bump 类型 → exit 2', async () => {
  const r = await runScript(path.join(__dirname, 'bump-version.js'), ['hotfix']);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /用法：/);
});

test('bump-version: final 已进 CLI 白名单，但对正式版执行 → exit 2 且不落盘', async () => {
  const authFile = path.join(REPO, 'package.json');
  const before = fs.readFileSync(authFile, 'utf8');
  try {
    const r = await runScript(path.join(__dirname, 'bump-version.js'), ['final']);
    assert.equal(r.code, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /已是正式版/);
    assert.match(r.stderr, /可选类型：patch \| minor \| major \| rc \| prerelease \| final/);
  } finally {
    // 红线：8 处版本号必须是 2.0.0，测试不得污染承载点
    assert.equal(fs.readFileSync(authFile, 'utf8'), before, 'package.json 被测试改动了');
  }
});

test('bump-version: final 端到端把 8 处 2.0.0-rc.2 原子转正为 2.0.0（临时仓库，不碰真实承载点）', async () => {
  const RC = '2.0.0-rc.2';
  const FINAL = '2.0.0';
  const { tmp, toolDir, files } = makeReleaseRepo(RC);
  try {
    const check = () =>
      run(['--json', '--no-color'], { cwd: tmp, script: path.join(toolDir, 'check-version.js') });

    // 起跑线：8 处一致，都是候选版
    const beforeGate = await check();
    assert.equal(beforeGate.code, 0, beforeGate.stdout);
    assert.equal(JSON.parse(beforeGate.stdout).version, RC);

    // 转正
    const b = await runScript(path.join(toolDir, 'bump-version.js'), ['final', '--yes'], {
      cwd: tmp,
    });
    assert.equal(b.code, 0, b.stdout + b.stderr);
    assert.match(b.stdout, new RegExp(FINAL));

    // 复核：门禁通过，8 处全部指向正式版
    const afterGate = await check();
    assert.equal(afterGate.code, 0, afterGate.stdout);
    const data = JSON.parse(afterGate.stdout);
    assert.equal(data.ok, true);
    assert.equal(data.version, FINAL);
    assert.equal(data.drifted.length, 0);
    assert.equal(data.missing.length, 0);
    assert.equal(data.verifySourceList.ok, true);

    // 逐点确认没有一处残留候选版后缀（CHANGELOG 是历史记录，允许保留旧条目）
    for (const rel of Object.keys(files)) {
      if (rel === 'CHANGELOG.md') continue;
      const text = fs.readFileSync(path.join(tmp, rel), 'utf8');
      assert.doesNotMatch(text, /2\.0\.0-rc\.2/, `${rel} 仍残留候选版后缀`);
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8')).version, FINAL);
    assert.match(
      fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8'),
      /^##\s*\[2\.0\.0\]/m,
      'CHANGELOG 未写入正式版条目'
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('bump-version: final 后 __version__ 保留 build metadata，VERSION_TUPLE 只留数值 M.N.P', async () => {
  // 回归：写 VERSION_TUPLE 曾用 version.split('.') 取补丁位。
  //   2.0.0+2026.10.25 -> split 得 ['2','0','0+2026','10','25'] -> 剥非数字 '02026'
  //     -> VERSION_TUPLE = (2, 0, 02026) -> Python SyntaxError（前导零）
  //   2.0.5+2026.10    -> '5+2026' -> '52026' -> (2, 0, 52026) -> 静默算错，更危险
  //   build.7 这种形式恰好安全：'0+build' 剥非数字仍是 '0'
  const pyBin = findPython();
  assert.ok(pyBin, '本测试需要 python 可执行（backend 本身依赖 Python）');

  for (const { rc, expected } of [
    { rc: '2.0.0-rc.1+build.7', expected: '2.0.0+build.7' },
    { rc: '2.0.0-rc.1+2026.10.25', expected: '2.0.0+2026.10.25' },
  ]) {
    const { tmp, toolDir } = makeReleaseRepo(rc);
    try {
      const b = await runScript(path.join(toolDir, 'bump-version.js'), ['final', '--yes'], {
        cwd: tmp,
      });
      assert.equal(b.code, 0, `${rc}\n${b.stdout}${b.stderr}`);

      const pyPath = path.join(tmp, 'backend', 'app', 'version.py');
      const pyOut = fs.readFileSync(pyPath, 'utf8');

      // (a) __version__ 完整保留 build metadata（这是 final 的价值所在）
      assert.match(
        pyOut,
        new RegExp(`__version__\\s*=\\s*"${expected.replace(/[.+]/g, '\\$&')}"`),
        `${rc}：未保留 build metadata`
      );

      // (b) VERSION_TUPLE 精确等于 (2, 0, 0)，不含 build metadata，也不含前导零
      const tupleLine = pyOut.split(/\r?\n/).find((l) => /^VERSION_TUPLE:/.test(l));
      assert.ok(tupleLine, `${rc}：VERSION_TUPLE 行缺失`);
      assert.match(tupleLine, /= \(2, 0, 0\)\s*$/, `${rc}：VERSION_TUPLE 取值不对：${tupleLine}`);
      assert.doesNotMatch(tupleLine, /\b0\d+\b/, `${rc}：VERSION_TUPLE 出现前导零：${tupleLine}`);
      assert.doesNotMatch(
        tupleLine,
        /build|\d{5,}/i,
        `${rc}：VERSION_TUPLE 混入了 build metadata：${tupleLine}`
      );

      // (c) 用 Python 的 ast.parse 做真实语法校验，抓 leading-zero 这类 SyntaxError
      const ast = spawnSync(
        pyBin,
        ['-c', 'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())', pyPath],
        { cwd: tmp, stdio: 'pipe' }
      );
      assert.equal(ast.status, 0, `${rc}：ast.parse 失败：${ast.stdout}${ast.stderr}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('check-version: 门禁是纯本地文件读取，单次执行应在 3 秒内', async () => {
  const started = Date.now();
  const r = await run(['--json', '--no-color']);
  const elapsed = Date.now() - started;
  assert.equal(r.code, 0, r.stdout);
  assert.ok(
    elapsed < 3000,
    `version:check 耗时 ${elapsed}ms，pre-commit 钩子需要快速通过`
  );
});
