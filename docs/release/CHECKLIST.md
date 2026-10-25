# 发布 Checklist（可勾选）

> 配套总览：[README.md](./README.md)；回滚专题：[ROLLBACK.md](./ROLLBACK.md)。
> 政策依据：[ADR-038 语义化版本发布体系](../adr/ADR-038-语义化版本发布体系.md)。
>
> **环境基线**：Windows + PowerShell 7（`pwsh`）、Node v22.22.0、Python 3.12、
> 分支 `main`、远端 `origin` = `https://github.com/RMFOOD/platform.git`。
> 下文所有命令均为 **Windows pwsh 语法**；bash 等价命令以 `# bash:` 标注。
>
> **用法**：复制到发布工单 / PR 描述中，逐条勾选。任一步失败 → 对照
> [§8 中止点](#8-失败时的中止点) 判断是否停下。

---

## 1. 发布前（Pre-flight）

### 1.1 环境与身份

- [ ] 确认操作系统与工具链版本
  ```powershell
  $PSVersionTable.PSVersion     # 需 7.x（下文使用 && 语法）
  node --version                # 需 >= 20（仓库 engines 要求），实测 22.22.0
  python --version              # 需 3.12
  # bash: pwsh --version; node -v; python --version
  ```
- [ ] 确认处于 `main` 分支并已同步远端
  ```powershell
  git branch --show-current                 # 必须输出 main
  git fetch origin main --tags
  git switch main
  git pull --ff-only                        # 非快进立即停止，见 §8-1
  # bash: git switch main && git pull --ff-only
  ```
- [ ] 确认工作区没有会混入发布的改动
  ```powershell
  git status --porcelain
  # 有输出不必然阻断，但必须确认后续用「显式暂存」而非 git add -A。
  # 本仓库为多人/多任务共享工作区，实测存在数百处并发任务的未提交改动
  # （数量随时变化），因此 git add -A 几乎必然混入无关内容。
  ```
- [ ] 确认本地 tag 与远端 tag 状态一致（**远端校验需网络**）
  ```powershell
  git tag --sort=-creatordate               # 本地 tag 列表
  git describe --tags --always              # 最近的可达 tag，实测 v2.0.0
  git ls-remote --tags origin "v*"          # 远端 tag（网络不通会挂起，见 §9.5）
  # bash: git ls-remote --tags origin 'v*'
  ```
- [ ] 本地启动验证（**不使用 Docker**）
  ```powershell
  .\start.ps1                               # 后端 :8000 + 前端 :3000
  Invoke-WebRequest -Uri http://127.0.0.1:8000/api/v1/health -UseBasicParsing |
      Select-Object -ExpandProperty Content
  Invoke-WebRequest -Uri http://127.0.0.1:8000/api/v1/info -UseBasicParsing |
      Select-Object -ExpandProperty Content
  ```
  期望：`health` 返回 `{"status": "healthy", ...}`；`info` 返回
  `{"api_version": "1.0.0", "app_version": "2.0.0", ...}`。
- [ ] 服务验证完毕即停止，避免端口占用影响后续操作
  ```powershell
  .\stop.ps1
  ```

### 1.2 本次发布范围

- [ ] 列出本次发布涵盖的提交
  ```powershell
  $LAST_TAG = git describe --tags --always      # 例如 v2.0.0
  git log --oneline "$LAST_TAG..HEAD"
  git diff --stat "$LAST_TAG..HEAD"
  # bash: LAST_TAG=$(git describe --tags --always); git log --oneline $LAST_TAG..HEAD
  ```
- [ ] 人工确认每个提交的性质（feat / fix / refactor / docs / revert / migration），
  对照 [README §1.1 两轴判定表](./README.md#11-改动--轴-判定表) 得出轴 A 级别与是否涉及轴 B。
- [ ] 若涉及**数据库迁移**，先执行 `alembic current` / `heads` 并确认只有一个 head
  ```powershell
  cd backend
  .\venv\Scripts\python.exe -m alembic heads       # 必须只输出一个 revision
  .\venv\Scripts\python.exe -m alembic current     # 记录当前基线，回滚要用
  cd ..
  ```
  → 迁移损坏的处置见 [ROLLBACK.md 场景 D](./ROLLBACK.md#场景-d数据库迁移损坏)。
- [ ] 若涉及**破坏性变更**，确认已写好对应 ADR（`docs/adr/ADR-039-*.md`）
  与迁移期方案，否则**不要发布**，先回到设计阶段。

---

## 2. 版本号与文档

### 2.1 bump 版本号

- [ ] 确认当前版本与一致性门禁
  ```powershell
  npm run version:current         # 实测 2.0.0
  npm run version:check           # 8 个承载点全绿才继续
  npm run version:check:ci        # JSON 输出：{"ok": true, "exitCode": 0, ...}
  # bash: npm run version:check
  ```
- [ ] 执行 bump（把 `<kind>` 替换为 §1.2 判定出的类型）
  ```powershell
  npm run version:bump -- <patch|minor|major>
  # 例：npm run version:bump -- minor        # 2.0.0 -> 2.1.0
  # 非交互场景（CI 脚本内）追加 --yes：
  # npm run version:bump -- minor -- --yes
  # bash: npm run version:bump -- minor
  ```
  脚本会：读权威源 → 打印目标版本 → 提示确认 → 原子化写回 8 个承载点 →
  内置一次 `check-version.js` 复核 → 打印后续待执行命令。
- [ ] **复核脚本输出**：确认 8 行承载点全部出现 `✓`，且最后一行是
  `✅ 版本号已原子化更新并通过一致性校验`。任一行显示失败 → 见 §9.1。
- [ ] 再次独立校验
  ```powershell
  npm run version:check
  ```
- [ ] 确认脚本**没有**执行 commit
  ```powershell
  git status --porcelain        # 应能看到 8 个承载点处于 modified 状态
  git log -1 --oneline          # HEAD 不应变化
  ```

### 2.2 审阅 diff

- [ ] 查看本次版本改动的规模
  ```powershell
  git diff --stat
  git diff -- package.json backend/app/version.py backend/pyproject.toml
  ```
- [ ] **逐处核对 8 个承载点都指向同一版本号**（禁止手工编辑任何一个）
  ```powershell
  npm run version:check         # 以脚本结论为准，不要肉眼看
  ```

### 2.3 手写 CHANGELOG（必须，脚本只生成占位）

- [ ] 查看脚本写入的占位
  ```powershell
  git diff -- CHANGELOG.md
  ```
- [ ] 打开 `CHANGELOG.md`，把本版本条目中的
  `- **待补充**：请对照 git log 与本版本区间的提交，填写实际变更明细`
  替换为实际变更明细，格式沿用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)
  的 `### Added` / `### Changed` / `### Fixed` / `### Deprecated` / `### Removed` / `### Security` 分组。
  内容来源：`git log --oneline $LAST_TAG..HEAD`。
- [ ] 若本版本含破坏性变更，在 CHANGELOG 条目中显式标注 `### Breaking Changes`
  并链接到对应 ADR 与迁移说明。
- [ ] 保持文件顶部 `## [Unreleased]` 段存在（可为空占位 `- 暂无`）。
- [ ] 确认 `backend/app/version.py` 的 `RELEASE_DATE` 与 CHANGELOG 条目日期一致
  （脚本会自动刷新为当天 ISO 日期）。

### 2.4 关联文档同步（可选但推荐）

- [ ] 若本次是 MAJOR，确认 [README.md](../../README.md)「版本与代际地图」已同步。
- [ ] 若新增可配置项，确认 `.env.example` 与 `backend/.env.example` 的注释已更新
  （这两个文件本身是版本承载点，脚本只改 `APP_VERSION=` 行，注释需手写）。

---

## 3. 提交与打 tag

### 3.1 提交（**显式暂存，禁止 `git add -A`**）

- [ ] 显式暂存 8 个版本承载点
  ```powershell
  git add package.json frontend/package.json miniprogram/package.json `
          backend/pyproject.toml backend/app/version.py `
          .env.example backend/.env.example CHANGELOG.md
  git status --short            # 确认只这 8 个文件在暂存区（列 M）
  # bash: git add package.json frontend/package.json miniprogram/package.json \
  #   backend/pyproject.toml backend/app/version.py .env.example backend/.env.example CHANGELOG.md
  ```
  若本次发布还包含功能代码（feat/fix 提交），它们应**已经单独提交**过；
  发布提交只承载版本号与 CHANGELOG。不要把功能改动和版本号塞进同一个提交。
- [ ] 提交
  ```powershell
  git commit -m "release: v2.1.0 (ADR-038)"
  # bash: git commit -m "release: v2.1.0 (ADR-038)"
  ```
- [ ] pre-commit 钩子通过后确认
  `.husky/pre-commit` 会依次跑：后端 `print()` 扫描 → 前端 `console.log` 扫描 →
  `as any` 统计 → `tsc --noEmit` → ruff → UI/可访问性护栏（棘轮）→ `scan_undefined.py app/api`。
  任何一步非零 → 见 §8-3，**禁止 `--no-verify` 绕过**。

### 3.2 打 tag（必须 annotated）

- [ ] 创建 annotated tag
  ```powershell
  $TAG = "v2.1.0"
  $DATE = Get-Date -Format "yyyy-MM-dd"
  git tag -a $TAG -m "$TAG - RMFOOD 平台 $DATE"
  # bash: git tag -a v2.1.0 -m "v2.1.0 - RMFOOD 平台 $(date +%F)"
  ```
- [ ] **验证 tag 类型是 annotated**
  ```powershell
  git cat-file -t $TAG         # 必须输出 tag；输出 commit 说明是轻量 tag，需重建
  git show --no-patch $TAG     # 应能看到 tag 对象与发布说明
  # bash: git cat-file -t $TAG
  ```
  → tag 打错的重建方法见 [ROLLBACK.md 场景 A](./ROLLBACK.md#场景-a未推送的-tag-打错)。
- [ ] 确认 tag 指向正确的提交
  ```powershell
  git rev-list -n 1 $TAG       # 应等于 git rev-parse HEAD
  git rev-parse HEAD
  git log --oneline -1 $TAG
  ```

---

## 4. 推送与 CI

### 4.1 推送

- [ ] 先推提交
  ```powershell
  git push origin HEAD
  if ($LASTEXITCODE -ne 0) { throw "push 失败，停止" }
  # bash: git push origin HEAD
  ```
- [ ] 再推 tag
  ```powershell
  git push origin $TAG
  if ($LASTEXITCODE -ne 0) { throw "tag 推送失败，停止" }
  # bash: git push origin $TAG
  ```
- [ ] 确认远端可见
  ```powershell
  git ls-remote --tags origin $TAG
  # bash: git ls-remote --tags origin $TAG
  ```
  > ⚠️ **tag 一旦推送，不要强推改写。** 见 [ROLLBACK.md 场景 B](./ROLLBACK.md#场景-b已推送的-tag-指向错误提交)。

### 4.2 CI 验证

- [ ] 在 GitHub Actions 查看 workflow run（触发源：push 到 `main`）
- [ ] 逐个确认 11 个 job 结果（依赖顺序见 [README §3.3](./README.md#33-ci-门禁githubworkflowsci-cdyml实测-11-个-job)）
  ```text
  1  version-gate         ← 最先出结果（无 needs，秒级）
  2  lint
  3  security-scan        (needs: lint)
  4  test-backend         (needs: lint)
  5  test-frontend        (needs: lint)
  6  theme-gate           (needs: lint)
  7  build                (needs: 3,4,5；仅 push / workflow_dispatch)
  8  deploy-staging       (needs: build；develop 或 environment=staging)
  9  deploy-production    (needs: build；main 或 environment=production)
  10 smoke-test           (needs: 8,9；always() 且至少一个部署成功)
  11 rollback             (needs: smoke-test；仅 failure() 且 main 分支)
  ```
- [ ] 特别关注 `version-gate` 的 summary：若 `package.json` 或 `CHANGELOG.md` 有变更，
  它会打印提示要求补全 CHANGELOG 与打 tag（本 checklist 已完成这两步，属正常提示）。
- [ ] 若某个部署 job 因分支条件未触发（例如手动从 `main` 跑 staging），手动补跑
  ```text
  GitHub → Actions → RMFOOD CI/CD Pipeline → Run workflow
    → workflow_dispatch → environment = staging 或 production
  ```
- [ ] 若 `smoke-test` 失败，`rollback` job 会自动触发（仅 `main` 分支）。
  **不要手动干预**，先等自动回滚完成并观察其日志，再走
  [ROLLBACK.md](./ROLLBACK.md) 的手工流程。

---

## 5. 部署与验证

### 5.1 部署

- [ ] 确认部署分支映射正确
  ```text
  develop 推送  → deploy-staging 自动触发
  main   推送  → deploy-production 自动触发（CI 中 production environment 需人工审批）
  ```
- [ ] 生产主机上的实际执行动作（CI 通过 SSH 执行，无需本地操作）
  ```bash
  # 仅记录，CI 内部执行；供人工排查时对照
  cd /opt/rmfood
  docker compose pull
  docker compose up -d --no-deps backend      # 先后端
  # 等待 /health 就绪（最多 30s）
  docker compose up -d --no-deps frontend     # 再前端
  ```
- [ ] 本地等价验证（不使用 Docker，用于在本地复现部署后行为）
  ```powershell
  .\start.ps1
  Invoke-WebRequest -Uri http://127.0.0.1:8000/api/v1/health -UseBasicParsing |
      Select-Object -ExpandProperty Content
  .\stop.ps1
  ```

### 5.2 冒烟验证（**以运行时为准，不以本地文件为准**）

- [ ] 平台版本端点
  ```powershell
  Invoke-WebRequest -Uri https://rmfood.example.com/api/v1/info -UseBasicParsing |
      Select-Object -ExpandProperty Content
  # 期望：app_version = 2.1.0（新版本），api_version = 1.0.0
  ```
- [ ] API 契约版本响应头
  ```powershell
  (Invoke-WebRequest -Uri https://rmfood.example.com/api/v1/info -UseBasicParsing).
      Headers["X-API-Version"]
  # 期望：1.0.0
  ```
- [ ] API 根端点矩阵
  ```powershell
  Invoke-WebRequest -Uri https://rmfood.example.com/api -UseBasicParsing |
      Select-Object -ExpandProperty Content
  # 期望：version = 2.1.0，api_versions 含 v1(current) / v2(planning)
  ```
- [ ] 健康检查
  ```powershell
  Invoke-WebRequest -Uri https://rmfood.example.com/health -UseBasicParsing |
      Select-Object -ExpandProperty Content
  # 期望：status = healthy
  ```
- [ ] 前端首页可用
  ```powershell
  (Invoke-WebRequest -Uri https://rmfood.example.com/ -UseBasicParsing).StatusCode
  # 期望：200
  ```
- [ ] 数据库迁移状态（生产主机）
  ```bash
  cd /opt/rmfood
  docker compose exec backend python -m alembic current
  # 期望：与 backend/alembic/versions/ 的最新 revision 一致
  ```
- [ ] 若本次包含破坏性变更，抽查一条受影响的核心业务流程（登录 → 配方生成 → 导出）。

---

## 6. 发布后

- [ ] 把 CHANGELOG 的 `## [Unreleased]` 段清空为占位
  ```markdown
  ## [Unreleased]

  ### Added

  - 暂无
  ```
  作为独立小提交（`docs: clear unreleased section after v2.1.0`）。
- [ ] 确认 [docs/adr/index.md](../adr/index.md) 已登记本次新增的 ADR（若有）。
- [ ] 确认 README「版本与代际地图」与 badge 与本次版本一致（MAJOR 时必需）。
- [ ] 通知下游集成方：
  - 平台版本 `v2.1.0` 已发布；
  - 是否含破坏性变更、迁移截止时间；
  - `X-API-Version` 是否变化。
- [ ] 记录发布事实（建议存入团队记忆 / 工单）：版本号、tag、commit hash、
  CI run 链接、部署时间、回滚锚点（上一个 tag）。
- [ ] 观察 24 小时：错误率、`/health` 状态、`/api/v1/info` 返回的版本字段。

---

## 7. rc 预发布分支流程

> ⚠️ **先读实测行为再动手**：`bump-version.js` 的 `rc` 子命令**不会**把 `rc.N` 转正为正式版本，
> 而是递增为 `rc.(N+1)`。实测 `bump()` 全组合（2026-10-25）：
>
> | 当前版本 | 子命令 | 实际产出 |
> |:---------|:-------|:---------|
> | `2.0.0` | `rc` | `2.0.0-rc.1` |
> | `2.0.0` | `prerelease` | `2.0.0-alpha.1` |
> | `2.0.0-rc.1` | `rc` | `2.0.0-rc.2` |
> | `2.0.0-rc.1` | `prerelease` | `2.1.0`（**推进 minor 并去掉后缀**） |
> | `2.0.0-rc.2` | `patch` | `2.0.1-rc.2`（后缀被保留，**不符合预期**） |
> | `2.0.0-rc.2` | `minor` | `2.1.0-rc.2`（后缀被保留，**不符合预期**） |
> | `2.0.0-rc.2` | `major` | `3.0.0-rc.2`（后缀被保留，**不符合预期**） |
> | `2.0.0-rc.2` | `prerelease` | `2.1.0` |
> | `2.0.0-alpha.1` | `rc` | `2.1.0` |
>
> 结论：**`patch` / `minor` / `major` 都不会剥离 `-rc.N` 后缀**。
> 唯一的转正路径是 `-- prerelease`，但它会把 minor 推进（`2.0.0-rc.2` → `2.1.0`），
> 无法产出 `2.0.0` 正式版。这是脚本的实现缺口，见
> [§10 建议 lead 决策](#10-超出本清单范围建议-lead-决策)。

### 7.1 进入 rc

- [ ] 从当前正式版 bump 出 rc
  ```powershell
  npm run version:bump -- rc          # 2.0.0 -> 2.0.0-rc.1
  npm run version:check
  ```
- [ ] CHANGELOG 会新增 `## [2.0.0-rc.1] - <日期>` 条目，位于 `[Unreleased]` 之后、
  `## [2.0.0]` 之前。手写本次 rc 的实际变更明细。
- [ ] 显式暂存 8 个承载点并提交
  ```powershell
  git add package.json frontend/package.json miniprogram/package.json `
          backend/pyproject.toml backend/app/version.py `
          .env.example backend/.env.example CHANGELOG.md
  git commit -m "release: v2.0.0-rc.1 (pre-release)"
  ```
- [ ] 打 tag 并推送
  ```powershell
  $TAG = "v2.0.0-rc.1"
  git tag -a $TAG -m "$TAG - RMFOOD 平台 $(Get-Date -Format yyyy-MM-dd) (release candidate)"
  git cat-file -t $TAG                          # 必须是 tag
  git push origin HEAD
  git push origin $TAG
  ```
- [ ] rc 部署到 **staging**（不要推生产）
  ```text
  GitHub → Actions → workflow_dispatch → environment = staging
  # 或推到 develop 分支触发 deploy-staging
  ```
- [ ] rc 冒烟（同 §5.2，目标为 staging 域名）
  ```powershell
  Invoke-WebRequest -Uri https://staging.rmfood.example.com/api/v1/info -UseBasicParsing |
      Select-Object -ExpandProperty Content
  # 期望：app_version = 2.0.0-rc.1
  ```

### 7.2 rc 迭代

- [ ] 发现缺陷 → 修复 → 追加新 rc
  ```powershell
  git commit -m "fix: ..."                        # 功能修复走正常提交
  npm run version:bump -- rc                      # 2.0.0-rc.1 -> 2.0.0-rc.2
  npm run version:check
  ```
  编辑 CHANGELOG 的 `## [2.0.0-rc.2]` 条目 → 显式暂存 8 文件 → commit →
  `git tag -a v2.0.0-rc.2` → 推送 → 重新部署 staging。
- [ ] rc 编号连续递增，**不要**跳号或复用编号。

### 7.3 rc 转正（**需人工判断**）

脚本当前**无法**直接产出 `2.0.0` 正式版（见 §7 顶部的实测表）。可选路径，二选一：

- [ ] **路径 A（推荐，需 lead 确认版本号语义）**：接受 minor 推进，`2.0.0-rc.N` 转
  `2.0.1` 正式版
  ```powershell
  npm run version:bump -- prerelease             # 2.0.0-rc.2 -> 2.1.0
  npm run version:check
  git diff -- CHANGELOG.md                       # 确认新版本条目已插入 Unreleased 之后
  ```
  然后走 §3 → §6 正常发布流程。CHANGELOG 中会保留 `2.0.0-rc.2` / `2.0.0-rc.1`
  历史条目，位于新版本条目之下，`version:check` 仍一致（实测验证）。
- [ ] **路径 B（保守）**：不把 rc 转正，正式版本仍从上一个正式版推进
  ```powershell
  # 前提：把工作区版本恢复到 v2.0.0（不要手工改，见下）
  git checkout v2.0.0 -- package.json CHANGELOG.md backend/app/version.py `
                  frontend/package.json miniprogram/package.json backend/pyproject.toml `
                  .env.example backend/.env.example
  npm run version:check                          # 确认回到 2.0.0 一致态
  npm run version:bump -- minor                  # 2.0.0 -> 2.1.0 正式版
  ```
  然后把 rc 区间的实际变更并入 `2.1.0` 的 CHANGELOG 条目。
- [ ] **无论选哪条路径**：在发布说明中明确写出「rc 系列最终转为哪个正式版本号」，
  避免下游按 `2.0.0` 寻找正式版却发现 tag 不存在。

---

## 8. 失败时的中止点

| # | 中止点 | 触发信号 | 正确处置 |
|:-:|:-------|:---------|:---------|
| 1 | `git pull --ff-only` 失败 | `not a fast-forward` | 停下。先合并 / rebase 解决冲突，**不要** `--force` |
| 2 | `npm run version:check` 非 0 | 输出漂移文件列表 | 停下。**不要**手工改单个文件，跑 `npm run version:bump -- patch` 统一（见 §9.1） |
| 3 | pre-commit 钩子失败 | 钩子输出 `❌` | 停下。修完重新 commit，**禁止** `--no-verify` |
| 4 | `git cat-file -t` 输出 `commit` | tag 是轻量 tag | 停下。删掉重建 annotated tag（ROLLBACK.md 场景 A） |
| 5 | `git push origin $TAG` 后才发现 tag 指错 | tag 已在远端 | 停下。**不要**强推改写，走 ROLLBACK.md 场景 B（新建 `v2.0.1`） |
| 6 | CI `version-gate` 失败 | summary 显示 drift | 停下。查本地与 CI 检出差异，通常是漏了某个承载点或 CHANGELOG 顶部条目错位 |
| 7 | CI `test-backend` 的 Alembic 步骤失败 | `alembic heads` 输出多个 head 或 `current` 报错 | 停下。多个 head 需 `alembic merge -m "merge heads" -c <a> -c <b>` 后重新提交，**不要**发布 |
| 8 | CI `security-scan` 出现 CRITICAL / HIGH | bandit 报告计数 > 0 | 停下。修复后再发 |
| 9 | `deploy-production` 失败 | job 失败 | 等 `rollback` job 自动执行；不要手动 push 覆盖 |
| 10 | `smoke-test` 失败 | `/api/health` 非 healthy 或首页非 200 | 停下。**不要**打下一个 tag，先走 ROLLBACK.md |
| 11 | 冒烟发现 `app_version` 不是新版本 | `/api/v1/info` 返回旧版本 | 停下。优先怀疑镜像未更新或 `APP_VERSION` 环境变量覆盖，见 §9.4 |
| 12 | 发现已有业务数据依赖新 schema，而迁移需回滚 | 人工判断 | **绝对不能自动回滚**，见 ROLLBACK.md 场景 D 的「绝不回滚」条件 |

通用原则：**任何「已经推到远端 / 已经部署」的环节失败，都不要试图改写历史**——
改写本地与远端不一致的历史是本项目最贵的错误。宁可多打一个补丁版本。

---

## 9. 常见错误与处置

### 9.1 手工改了版本号导致 8 处漂移

**症状**：`npm run version:check` 输出 `❌ 检测到 N 处版本漂移`，并列出漂移文件。
**根因**：有人直接编辑了 `backend/app/version.py` / `pyproject.toml` / `.env.example` 等文件，
绕过了 `version:bump`。

**处置**：
```powershell
npm run version:check:ci          # JSON 定位漂移：{"drifted": [{"file": "...", "version": "..."}]}
# 1. 先把「权威版本」修正为期望值 —— 但不要手工改，见下
# 2. 用 bump 统一。若期望值就是权威源当前的值，跑 patch 会跳号，
#    正确做法是先 git checkout 掉漂移文件，再用 bump 重新写入：
git checkout -- frontend/package.json backend/pyproject.toml backend/app/version.py `
                 .env.example backend/.env.example CHANGELOG.md
npm run version:check             # 应恢复全绿
```
**不要**逐文件手改版本号再提交——那会把同一版本号分散到 8 处，且 `RELEASE_DATE`、
CHANGELOG 日期不会同步。

### 9.2 CHANGELOG 顶部条目与权威版本不一致

**症状**：`version:check` 显示 `CHANGELOG.md` 漂移，例如权威 `2.1.0` 但 CHANGELOG 顶部条目是 `2.1.0-rc.2`。
**根因**：rc 条目留在最上面，而正式版条目被插到了更下方，或人工编辑打乱了顺序。

**处置**：`bump-version.js` 的 `updateChangelog()` 始终把新版本条目插入到 `[Unreleased]`
段之后（实测：`Unreleased → 2.1.0 → 2.0.0-rc.2 → 2.0.0-rc.1 → 2.0.0`），
因此**正确做法是重跑一次 bump 让脚本归位**，而不是手工移动条目：
```powershell
npm run version:check:ci          # 确认漂移方向
# 若只是条目顺序错乱、版本号本身正确：手工调整顺序即可（这是 CHANGELOG 唯一允许手工编辑的场景），
# 调整后必须复跑门禁：
npm run version:check
```

### 9.3 打的是轻量 tag

**症状**：`git cat-file -t v2.1.0` 输出 `commit` 而非 `tag`。
**处置**：见 [ROLLBACK.md 场景 A](./ROLLBACK.md#场景-a未推送的-tag-打错)
（未推送）或 [场景 B](./ROLLBACK.md#场景-b已推送的-tag-指向错误提交)（已推送）。

### 9.4 部署后 `/api/v1/info` 返回旧版本

按优先级排查：
```powershell
# 1. 是不是 APP_VERSION 环境变量覆盖了内嵌版本（优先级：环境变量 > 内嵌）
docker compose exec backend printenv APP_VERSION    # 生产主机
# 2. 镜像是不是新的
docker compose ps --format "table {{.Name}}\t{{.Image}}"
# 3. 后端容器是不是真的重启了
docker compose logs --tail 50 backend
# 4. 本地交叉验证内嵌版本
cd backend
.\venv\Scripts\python.exe -c "from app.version import __version__; print(__version__)"
cd ..
```
**结论提示**：`APP_VERSION=9.9.9` 覆盖内嵌版本的行为已在本地实测确认（ADR-038 验证记录）。
生产流水线（Docker / Compose）**尚未实际注入**该变量，首次生产发布需重点观察。

### 9.5 `git ls-remote --tags origin` 长时间无响应

**症状**：命令挂起超过 2 分钟。
**根因**：网络不通或代理拦截 GitHub 访问（本机实测即为此状态）。
**处置**：不要依赖远端查询作为发布前置门禁。用本地 `git describe --tags` 判断上一个 tag，
推送结果以 `git push` 的退出码为准。远端状态在能联网时（例如 GitHub Web 界面 Tags 页）复核。

### 9.6 pre-commit 的 UI 护栏（棘轮）失败

**症状**：`❌ UI/可访问性护栏未通过：新增了违规`。
**说明**：该护栏是「只减不增」的棘轮基线，不是「零违规即失败」。
**处置**：要么修掉新增违规，要么确认是有意引入后重设基线
（`node scripts/ui-guard.mjs --baseline`）。**不要**直接 `--no-verify`。

### 9.7 版本号与 tag 已推送，但 CHANGELOG 明细忘了写

**处置**：补一个文档提交即可，不需要动版本号：
```powershell
# 编辑 CHANGELOG.md 的本版本条目
git add CHANGELOG.md
git commit -m "docs: complete changelog for v2.1.0"
git push origin HEAD
```
注意：`CHANGELOG.md` 是版本承载点，`version:check` 读的是**顶部条目**的版本号，
因此**只改条目内容、不动标题**就不会造成漂移。改完务必复跑 `npm run version:check`。

---

## 10. 超出本清单范围，建议 lead 决策

1. **`rc` 转正缺失**：`bump-version.js` 的 `patch`/`minor`/`major` 都会保留 `-rc.N` 后缀，
   无法产出 `2.0.0` 正式版；`-- prerelease` 会推进 minor。建议在脚本中新增
   `final`（或 `release`）子命令，语义为「剥离当前 prerelease 后缀，保持 MAJOR.MINOR.PATCH 不变」。
2. **`bump-version.js --tag` 的取舍**：脚本支持 `--tag` 直接打 tag 并推送，但本团队约定不使用。
   建议要么在脚本帮助文本中明确标注「团队约定禁用」，要么移除该选项避免误用。
3. **文档中的承载点计数笔误**：`scripts/version/check-version.js` 头部注释写「7 个版本承载点」、
   `scripts/version/version-sources.js` 头部注释写「其余 6 处均为镜像」、
   `backend/app/version.py` 头部注释写「更新全部 7 个版本承载点」，
   实测 `VERSION_SOURCES` 为 **8 项**（1 权威源 + 7 镜像）。CHANGELOG.md L36 同样写「7 个承载点」。
   建议统一改为 8。
4. **`backend/app/version.py` L26 拼写错误**：文档串引用 `CURRENT_API_API_VERSION`，
   实际常量名为 `CURRENT_API_VERSION`。
5. **ADR-007 迁移目录过期**：ADR-007 写 `backend/app/migrations/versions/`，
   实测 `alembic.ini` 的 `script_location = alembic`，真实目录是 `backend/alembic/versions/`。
6. **v2.0.0 tag 尚未推送**（任务背景所述）：当前环境网络不通，无法用
   `git ls-remote --tags origin` 验证远端状态。需联网环境确认
   `v2.0.0` 是否已在远端；若未推送，按 §4.1 补推：
   ```powershell
   git push origin v2.0.0
   ```
