# 回滚指南（Rollback SOP）

> 配套总览：[README.md](./README.md)；发布清单：[CHECKLIST.md](./CHECKLIST.md)。
> 版本治理政策：[ADR-038](../adr/ADR-038-语义化版本发布体系.md)；
> 数据库迁移政策：[ADR-007](../adr/ADR-007-数据库迁移与版本管理策略.md)；
> CI/CD 与自动回滚：[ADR-008](../adr/ADR-008-CI-CD流水线与持续交付策略.md)。
>
> **环境基线**：Windows + PowerShell 7（`pwsh`）；生产主机 Linux，
> 部署目录 `/opt/rmfood`，编排工具 `docker compose`；数据库 PostgreSQL 16；
> 本地迁移工具在 `backend/venv/`，Alembic 迁移目录 **`backend/alembic/versions/`**
> （实测 `backend/alembic.ini` 的 `script_location = alembic`，75 个迁移版本）。
>
> **一句话原则**：**已推送的历史是共享事实，不可改写；有业务数据的数据库不可自动回退。**
> 宁可多打一个补丁版本，也不要强推 tag 或 `reset --hard`。

---

## 0. 先分清「回滚什么」

RMFOOD 的一次发布牵涉四个可独立回滚的面。**选错面是回滚失败的第一大原因。**

| 面 | 承载物 | 回滚手段 | 是否影响数据 |
|:---|:-------|:---------|:-------------|
| 代码 | git commit / tag | `git revert` 后发布新补丁版本 | 否 |
| 部署 | 容器镜像 / compose 编排 | 拉取旧镜像 + `docker compose up -d` | 否 |
| 配置 | 环境变量 / `.env` | 恢复旧值 + 重启服务 | 否 |
| **数据库** | Alembic migration + 数据行 | `alembic downgrade`（**慎用**） | **是** |

> ⚠️ **CI 的 `rollback` job 只回滚镜像，不回滚数据库。**
> 实测 `.github/workflows/ci-cd.yml` 的 `rollback` job 步骤为：
> 取上一 commit 的镜像 tag → `docker compose down --remove-orphans` →
> `docker pull <旧镜像>` → `docker compose up -d --no-deps backend` / `frontend`
> → 等 30s → `curl /health`。**全程没有任何 `alembic downgrade` 调用。**
> 因此只要本次发布包含数据库迁移，镜像回滚后数据库仍停留在新 schema，
> 必须**人工**执行场景 D，且要先确认兼容性。

---

## 1. 按事故类型选回滚手段

| 事故类型 | 首选手段 | 关键命令 / 动作 | 是否需新版本号 | 参考 |
|:---------|:---------|:----------------|:---------------|:-----|
| **代码缺陷**（逻辑 bug、崩溃、500） | `git revert` + 新补丁版本 | `git revert <sha>` → `version:bump -- patch` → 新 tag | 是（patch） | [场景 C](#场景-c已部署代码有缺陷) |
| **配置错误**（`.env` 值错、CORS、密钥、端口） | 恢复配置 + 重启，**不动代码** | 改回 `.env` → `docker compose up -d` 或 `.\stop.ps1; .\start.ps1` | 否 | [场景 E](#场景-e配置错误最快路径) |
| **依赖引入问题**（新依赖装不上、安全漏洞、传递依赖冲突） | `git revert` 该依赖提交；必要时同步降版本 | `git revert <sha>` → 重新锁依赖 → `version:bump -- patch` | 是（patch） | [场景 C](#场景-c已部署代码有缺陷) |
| **数据库迁移损坏**（迁移失败、schema 与代码不匹配、数据被误改） | `alembic downgrade -1` 或重建库；**先备份** | `alembic current` → 备份 → `alembic downgrade -1` | 视情况 | [场景 D](#场景-d数据库迁移损坏) |
| **tag 或发布打错**（tag 指错提交、版本跳错、CHANGELOG 没写） | 未推送 → 删重建；已推送 → 新建补丁 tag | `git tag -d` / `git push --delete` + 新 tag | 是（补丁版） | [场景 A / B](#场景-a未推送的-tag-打错) |
| 只部署到 staging 就发现问题 | 直接重部署 staging，**不影响生产** | `workflow_dispatch environment=staging` | 视情况 | CHECKLIST §7 |

选择顺序：**能不动版本号就不动 → 能不动数据库就不动 → 能不全量回滚就不全量。**

---

## 2. 场景 A：未推送的 tag 打错

适用：`git tag` 已在本地创建，但**尚未** `git push origin <tag>`。此时远端无感知，可安全重建。

- [ ] 确认 tag 确实未推送
  ```powershell
  git ls-remote --tags origin "v2.1.0*"
  # 无输出 = 远端不存在 → 可安全重建
  # 有输出 = 已推送，改走场景 B
  # 注意：网络不通时此命令会挂起，见 CHECKLIST §9.5
  ```
- [ ] 确认 tag 当前指向与错误内容
  ```powershell
  git rev-list -n 1 v2.1.0        # tag 指向的 commit
  git show --no-patch v2.1.0      # tag 对象与消息（annotated）或 commit（轻量）
  git cat-file -t v2.1.0          # tag = annotated；commit = 轻量（本身也是错误，见 §2.3）
  ```
- [ ] 删除本地错误 tag
  ```powershell
  git tag -d v2.1.0
  ```
- [ ] 删除错误 commit（若已 commit 但**未推送**）
  ```powershell
  git reset --hard HEAD~1
  # ⚠️ 仅在确认该 commit 未推送、且未基于它做过其他工作时使用。
  # 若该 commit 里还有其他有价值的改动，改用 git revert（见场景 C），不要用 reset。
  ```
- [ ] 重做：修正内容 → 重新 bump → 重新提交 → 重新打 annotated tag
  ```powershell
  npm run version:bump -- <patch|minor|major>
  npm run version:check
  # 手写 CHANGELOG 明细（CHECKLIST §2.3）
  git add package.json frontend/package.json miniprogram/package.json `
          backend/pyproject.toml backend/app/version.py `
          .env.example backend/.env.example CHANGELOG.md
  git commit -m "release: v2.1.0 (ADR-038)"
  git tag -a v2.1.0 -m "v2.1.0 - RMFOOD 平台 $(Get-Date -Format yyyy-MM-dd)"
  git cat-file -t v2.1.0          # 必须输出 tag
  ```
- [ ] 核验后再推送
  ```powershell
  git rev-list -n 1 v2.1.0
  git rev-parse HEAD              # 两者必须一致
  git push origin HEAD
  git push origin v2.1.0
  ```

### 2.1 局部修正：只改 tag 消息、不改指向

若指向正确、只是 tag 消息写错了（尚未推送）：
```powershell
git tag -f -a v2.1.0 -m "v2.1.0 - RMFOOD 平台 $(Get-Date -Format yyyy-MM-dd)（修正说明）"
git cat-file -t v2.1.0            # 仍为 tag
```

### 2.2 版本跳错（例如想发 2.1.0 却 bump 成了 3.0.0，未推送）

**不要**手工改 `package.json`。把 8 个承载点恢复到上一个 tag 的状态，再重新 bump：
```powershell
git checkout v2.0.0 -- package.json CHANGELOG.md backend/app/version.py `
                 frontend/package.json miniprogram/package.json backend/pyproject.toml `
                 .env.example backend/.env.example
npm run version:check             # 应显示全部回到 2.0.0
npm run version:bump -- minor     # 2.0.0 -> 2.1.0
npm run version:check
```

---

## 3. 场景 B：已推送的 tag 指向错误提交

适用：`git push origin <tag>` 已执行成功，远端 tag 已可见。

### 3.1 结论：不建议强推改写远端 tag

**不要**执行以下命令（后果见 §6 不可逆清单）：
```powershell
git push --force origin refs/tags/v2.1.0     # ❌ 禁止
git push --force-with-lease origin main      # ❌ 禁止（改写已推送分支历史）
```

理由：
1. 其他开发者可能已 `git fetch --tags` 拉取该 tag 并基于它建分支 / 发镜像；
2. CI 的镜像 tag、制品、部署记录都与原 tag 绑定，改写会让制品谱系与 git 谱系对不上；
3. GitHub 对 protected 分支与 tag 的强推通常被保护规则拒绝，绕过即破坏保护策略；
4. 下游客户端（读取 `X-API-Version` 或按 tag 拉镜像的集成方）会静默拿到错误代码。

### 3.2 替代路径：新建补丁 tag

**用一个更高的补丁版本号覆盖错误版本**，把错误版本标记为「作废 / 不推荐使用」。

- [ ] 确认远端 tag 现状与受影响范围
  ```powershell
  git ls-remote --tags origin "v2.1.0*"      # 网络不通时改看 GitHub Tags 页
  git show --stat v2.1.0
  git log --oneline -5 v2.1.0
  ```
- [ ] 判定错误性质
  - tag 指向了**错误提交**（内容对但指针错）→ 走 §3.2.1
  - tag 指向的提交里**混入了不该发布的内容** → 走 §3.2.2
  - **版本号本身选错**（应为 2.1.0 却发了 3.0.0）→ 走 §3.2.3
- [ ] 走 §3.2.1 / 3.2.2 / 3.2.3 对应步骤，得到新版本号（通常是下一个 patch，如 `v2.1.1`）。
- [ ] 在 CHANGELOG 中把错误版本条目标注为废弃
  ```markdown
  ## [2.1.0] - 2026-10-25

  > ⚠️ **已作废（DEPRECATED），请勿使用。** 该 tag 指向了错误的提交，
  > 已由 [v2.1.1](#211---2026-10-25) 取代。请勿从 `v2.1.0` 拉取镜像或依赖。

  ## [2.1.1] - 2026-10-25

  ### Fixed

  - 更正 v2.1.0 的 tag 指向错误（原 tag 保留但已作废）
  ```
- [ ] 重新 bump、提交、打新 tag、推送（完整流程见 [CHECKLIST §2–§5](./CHECKLIST.md)）
  ```powershell
  npm run version:bump -- patch             # 例如 2.1.0 -> 2.1.1
  npm run version:check
  # 编辑 CHANGELOG 两处（见上）
  git add package.json frontend/package.json miniprogram/package.json `
          backend/pyproject.toml backend/app/version.py `
          .env.example backend/.env.example CHANGELOG.md
  git commit -m "release: v2.1.1 (replaces deprecated v2.1.0)"
  git tag -a v2.1.1 -m "v2.1.1 - RMFOOD 平台 $(Get-Date -Format yyyy-MM-dd)"
  git cat-file -t v2.1.1
  git push origin HEAD
  git push origin v2.1.1
  ```
- [ ] 等 CI 跑完并确认新 tag 的部署已通过冒烟。
- [ ] **通知下游**（见 §3.4）。
- [ ] 生产环境若已部署错误版本，按 §3.3 切到新镜像。

### 3.3 已部署的错误版本如何切回

优先「向前修」（部署新版本），而非「向后退」（重写历史）：
```bash
# 在生产主机 /opt/rmfood 执行
cd /opt/rmfood
docker compose pull
docker compose up -d --no-deps backend      # 先后端
sleep 5
curl -sf http://localhost:8000/health
docker compose up -d --no-deps frontend     # 再前端
```
若部署的是错误 tag 的镜像，且没有可用的上一稳定镜像，就按 §3.2 打出新的补丁 tag，
由 CI 的 `deploy-production` 自动部署（`main` 分支推送触发）。

### 3.4 通知下游的模板

```text
【RMFOOD 版本作废通知】
作废版本：v2.1.0（git tag 指向错误提交 <sha7>）
替代版本：v2.1.1（commit <sha7>，已推送并通过 CI + 冒烟）
影响：
  - 请勿再从 v2.1.0 拉取容器镜像 ghcr.io/RMFOOD/platform-backend:v2.1.0
  - 已部署 v2.1.0 的环境请在 <日期> 前切换到 v2.1.1
契约影响：REST API 契约版本仍为 v1（X-API-Version: 1.0.0），无破坏性变更
详情：<GitHub Release / 工单链接>
```

---

## 4. 场景 C：已部署代码有缺陷

适用：生产环境已部署某版本，运行中发现缺陷（崩溃、500、数据展示错误、性能退化）。

### 4.1 核心原则

| 做法 | 命令 | 结论 |
|:-----|:-----|:-----|
| ✅ `git revert` | 生成一个新的反向提交 | **正确**：保留历史、可审计、远端与本地一致 |
| ❌ `git reset --hard` | 删除已推送提交、移动分支指针 | **禁止**：改写共享历史，见 §6 |
| ❌ 强推 `main` | `git push --force` | **禁止** |
| ⚠️ 只回滚镜像不改代码 | `docker compose pull <旧镜像>` | 短期止血可用，但代码库与线上不一致，**必须随后 revert** |

### 4.2 止血（先恢复服务，后修历史）

若生产完全不可用，先按部署面止血，**不要**在此期间动 git 历史：

```bash
# 生产主机 /opt/rmfood：回到上一稳定镜像
cd /opt/rmfood
docker compose ps --format "table {{.Name}}\t{{.Image}}"
docker compose down --remove-orphans
docker compose pull backend frontend
docker compose up -d --no-deps backend
sleep 30
curl -sf http://localhost:8000/health
docker compose up -d --no-deps frontend
```
或让 CI 的 `rollback` job 自动执行（`smoke-test` 失败且分支为 `main` 时自动触发）；
自动回滚**不含数据库回退**，见 §0。

### 4.3 用 `git revert` 修代码历史

- [ ] 确认要回退的提交范围
  ```powershell
  git log --oneline v2.0.0..v2.1.0          # 该版本区间的所有提交
  git show --stat <sha>                      # 单个提交的改动规模
  ```
- [ ] 回退单个提交
  ```powershell
  git revert <sha>
  # bash: git revert <sha>
  ```
- [ ] 回退一个范围（**反转序**：新 → 旧），生成多个 revert 提交
  ```powershell
  git revert --no-edit <旧sha>..<新sha>
  # 注意：git revert 范围是「含头不含尾」，实际回退 (旧, 新] 之间所有提交
  # 冲突时：解决冲突 → git add <文件> → git revert --continue
  # 放弃：git revert --abort
  ```
- [ ] 只回退某提交的**部分文件**（不推荐，慎用）
  ```powershell
  git revert -n <sha>                        # 暂存反向改动但不提交
  git reset HEAD frontend/                   # 取消暂存前端改动
  git status --short                         # 只保留后端改动的反向 patch
  git commit -m "revert: <原提交标题> (backend only)"
  ```
- [ ] 本地验证后提交（pre-commit 会自动跑）
  ```powershell
  npm run version:check
  git log --oneline -3
  ```
- [ ] 推送
  ```powershell
  git push origin HEAD
  ```
  推送会触发 CI 全链路（`version-gate` → lint → test → build → deploy-production → smoke-test）。

### 4.4 revert 后**必须**重新 bump 与重新打 tag

`git revert` 本身只改代码，**不产生版本号变化**。线上仍运行缺陷版本，
必须发一个新的补丁版本才能把 revert 结果交付到生产：

- [ ] bump patch
  ```powershell
  npm run version:bump -- patch             # 2.1.0 -> 2.1.1
  npm run version:check
  ```
- [ ] 在 CHANGELOG 的 `2.1.1` 条目中写明 revert 了什么
  ```markdown
  ## [2.1.1] - 2026-10-26

  ### Fixed

  - 回退 v2.1.0 中引入的 <缺陷描述>（revert <sha7>），恢复 <旧行为>
  ```
- [ ] 显式暂存 8 个承载点 → commit → 打 annotated tag → 推送
  ```powershell
  git add package.json frontend/package.json miniprogram/package.json `
          backend/pyproject.toml backend/app/version.py `
          .env.example backend/.env.example CHANGELOG.md
  git commit -m "release: v2.1.1 (revert regression from v2.1.0)"
  git tag -a v2.1.1 -m "v2.1.1 - RMFOOD 平台 $(Get-Date -Format yyyy-MM-dd)"
  git cat-file -t v2.1.1
  git push origin HEAD
  git push origin v2.1.1
  ```
- [ ] 若本次回滚涉及**数据库迁移**，必须先处理数据库面（§5），
  再决定是否需要把迁移提交一并 revert。
  > 注意：revert 一个 Alembic 迁移提交**只是删掉那个迁移文件**，
  > 已经在数据库里执行过的 schema 变化**不会自动撤销**。
  > 数据库侧必须显式 `alembic downgrade`，见 §5。
- [ ] 若本次回滚涉及**契约破坏**（轴 B major），还需回退 `API_MATRIX` 与
  `DEPRECATED_ROUTES` 的登记，并通知下游契约版本未变化。

---

## 5. 场景 D：数据库迁移损坏

> ⚠️ 这是唯一会丢数据的回滚面。**任何一条命令执行前，先完成 §5.2 的备份。**

### 5.1 诊断

```powershell
cd backend
# 当前实际版本
.\venv\Scripts\python.exe -m alembic current
# 当前分支的所有 head（多个 head = 迁移链分叉，必须先 merge）
.\venv\Scripts\python.exe -m alembic heads
# 迁移全历史
.\venv\Scripts\python.exe -m alembic history --verbose
# 迁移链上的分支结构
.\venv\Scripts\python.exe -m alembic branches
cd ..
```
判定：
- `current` 报错或无法解析 → 数据库与 Alembic 元数据不同步，走 §5.4 的 `stamp`；
- `heads` 输出多个 revision → 迁移链分叉，走 §5.5；
- 单一 head 且指向坏迁移 → 走 §5.3 的 `downgrade -1`。

### 5.2 迁移前必备份（强制，无例外）

**回滚前没有备份 = 事故升级为数据事故。**

```bash
# 生产主机 /opt/rmfood（compose 部署形态）
cd /opt/rmfood
TS=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres \
    pg_dump -U postgres -d rmfood --format=custom --file=/tmp/rmfood_$TS.dump
docker cp "rmfood_postgres:/tmp/rmfood_$TS.dump" "./backup_$TS.dump"
ls -lh backup_*.dump

# 只导出 schema（用于结构比对，不含数据）
docker compose exec -T postgres \
    pg_dump -U postgres -d rmfood --schema-only > schema_$TS.sql
```
备份校验（必须做一次，否则等于没备份）：
```bash
# 恢复到临时库验证可读性
docker compose exec postgres createdb rmfood_restore_test
docker compose exec -T postgres pg_restore --dbname=rmfood_restore_test \
    /tmp/rmfood_$TS.dump | tail -5
docker compose exec postgres dropdb rmfood_restore_test
```
同时把备份移出容器卷，落到宿主机持久路径或对象存储，并记录备份文件路径与时间戳。

本地开发环境（不使用 Docker）的备份：
```powershell
# 需本机已安装 psql（PostgreSQL 16）
$env:PGPASSWORD = "password"
psql -h localhost -U postgres -d rmfood -c "SELECT 1"
pg_dump -h localhost -U postgres -d rmfood -F c -f "backup_local_$([datetime]::Now.ToString('yyyyMMdd_HHmmss')).dump"
```
> ⚠️ **按环境执行**：`psql` / `pg_dump` 客户端是否安装、连接串为何，
> 需按实际环境判断，本文不假设本机具备。

### 5.3 回退一个迁移版本

```powershell
cd backend
.\venv\Scripts\python.exe -m alembic downgrade -1
# bash: alembic downgrade -1
```
语义：从当前 head 执行一步反向迁移，调用**上一个迁移文件的 `downgrade()` 函数**。

- [ ] 执行前确认反向迁移真实存在且正确
  ```powershell
  .\venv\Scripts\python.exe -m alembic history --verbose -r head:-1
  # 打开对应的版本文件，检查 downgrade() 是否有实际逻辑
  # 常见陷阱：autogenerate 生成的 downgrade() 只是 drop 了对象，
  # 没有把列上的数据写回，或反过来 upgrade() 没有处理数据回填。
  ```
- [ ] 执行并观察输出
  ```powershell
  .\venv\Scripts\python.exe -m alembic downgrade -1
  .\venv\Scripts\python.exe -m alembic current        # 确认已回到上一 revision
  ```
- [ ] 回退后启动应用做冒烟
  ```powershell
  cd ..
  .\start.ps1
  Invoke-WebRequest -Uri http://127.0.0.1:8000/api/v1/health -UseBasicParsing |
      Select-Object -ExpandProperty Content
  .\stop.ps1
  ```
- [ ] 代码侧必须回退到与旧 schema 兼容的版本（§4.3），
  否则新代码读旧 schema 会 500。

### 5.4 元数据不同步：`alembic stamp`

适用：迁移实际上已经生效（或没生效），但 `alembic_version` 表与真实 schema 不一致，
导致 `downgrade` / `upgrade` 报「目标 revision 不存在」。

```powershell
cd backend
# 把当前数据库「标记」为某个 revision（不执行任何 DDL）
.\venv\Scripts\python.exe -m alembic stamp <revision_id>
# 全部标记为 head（仅在确认 schema 已等同 head 时使用）
.\venv\Scripts\python.exe -m alembic stamp head
.\venv\Scripts\python.exe -m alembic current
cd ..
```
> ⚠️ `stamp` **只写 `alembic_version` 表，不改 schema**。用它伪装状态会掩盖真实损坏，
> 仅用于人工确认过 schema 后校准指针。

### 5.5 多个 head（迁移链分叉）

```powershell
cd backend
.\venv\Scripts\python.exe -m alembic heads           # 列出所有 head
# 合并两条分支为一个新的 head（不执行 DDL，只创建合并节点）
.\venv\Scripts\python.exe -m alembic merge -m "merge heads" -c <head_a> -c <head_b>
.\venv\Scripts\python.exe -m alembic heads           # 应只剩一个
cd ..
```
合并提交与合并节点文件（`backend/alembic/versions/` 下新生成的文件）需一起提交，
否则 CI 的 `alembic heads` 检查会失败。

### 5.6 何时必须 `downgrade base`

`alembic downgrade base` 会从当前 head **一路反向执行到第一个迁移**，
等价于把 Alembic 建过的表与约束**全部删除**。仅在以下条件**全部**满足时才可使用：

- [ ] 数据库中**没有任何需要保留的业务数据**（全新环境 / 空库 / 明确可丢弃的测试库）；
- [ ] 反向迁移链已逐个人工审查，`downgrade()` 函数逻辑正确；
- [ ] 已完成备份并通过恢复演练（§5.2）；
- [ ] 有明确的「重建路径」：`downgrade base` 之后可以 `upgrade head` 重新建立 schema；
- [ ] 已获得数据负责人（DBA / 架构委员会）书面确认——按 ADR-007 的风险矩阵，
      表结构重组属 **CRITICAL** 级别。

```powershell
cd backend
.\venv\Scripts\python.exe -m alembic downgrade base
.\venv\Scripts\python.exe -m alembic current        # 应输出空
.\venv\Scripts\python.exe -m alembic upgrade head   # 若需重建
cd ..
```

### 5.7 何时**绝对不能**自动回滚

满足以下**任一**条件，一律不得自动执行 `alembic downgrade`，必须停下来走人工评审：

| # | 条件 | 原因 |
|:-:|:-----|:-----|
| 1 | **已有业务数据依赖新 schema** | 例如新表的行已被业务写入、新 NOT NULL 列已回填、新枚举值已被外部系统消费。`downgrade` 会删表 / 删列，直接丢数据 |
| 2 | 迁移包含**数据转换**且不可逆（清洗、去重、哈希、聚合汇总） | 转换后的值无法还原为转换前的值 |
| 3 | `downgrade()` 函数为空、缺失或明显错误（autogenerate 生成但未人工校验） | 回退等于半截 schema |
| 4 | 迁移链已分叉（多个 head）或元数据不同步 | 反向路径不确定，可能跑到不可预期的 revision |
| 5 | 只回退了一半（多 revision 批量部署中失败于中间某个） | 需要按序逐个反向，不能跳步 |
| 6 | 外部系统已消费本次发布的数据（导出、回调、消息队列已投递） | 数据回退会造成外部状态与内部状态不一致 |
| 7 | 无可用备份或备份未验证 | 回滚失败后无法恢复 |
| 8 | 处于业务高峰或结算窗口 | 回滚期间的停机与数据风险不可接受 |

**替代手段**（不丢数据的前向修复）：
- 写一个**新的、正向的**补偿迁移（forward fix migration），把 schema 修回可用状态；
- 或增加兼容性层：让新代码同时兼容新旧两种 schema，读旧列、写新列；
- 或用「加列 + 双写 + 迁移 + 删旧列」的四阶段灰度策略（ADR-007 提及但未落地，
  见 [CHECKLIST §10](./CHECKLIST.md#10-超出本清单范围建议-lead-决策)）。

无论选哪种，都要走 [CHECKLIST.md](./CHECKLIST.md) 的正常发布流程，
发一个新的补丁版本（patch 或 minor，取决于破坏性），**不要**在数据库上原地改。

---

## 6. 不可逆操作清单

以下操作**一旦执行就无法真正撤销**，后果列在每条之后。执行前必须二次确认；
本文档默认**禁止**执行。

| # | 操作 | 后果 | 正确替代 |
|:-:|:-----|:-----|:---------|
| 1 | `git push --force origin <tag>` 改写已推送的 tag | 其他开发者 / CI / 制品仓库 / 下游客户端全部指向错误指针；制品谱系与 git 谱系永久错配；GitHub 保护规则通常直接拒绝 | 新建更高的补丁 tag（[场景 B](#场景-b已推送的-tag-指向错误提交)） |
| 2 | `git push --force origin main` | 改写共享分支历史，他人本地 `git pull` 会冲突或丢失提交；CI 缓存、镜像 tag、部署记录全部错位 | `git revert` + 新提交（[场景 C](#场景-c已部署代码有缺陷)） |
| 3 | `git reset --hard` 已推送的分支 | 本地丢弃所有未推送改动且不可恢复；与远端分叉后强推即等同第 2 条 | `git reset --hard` 仅可用于**未推送**的本地提交（[场景 A](#场景-a未推送的-tag-打错)） |
| 4 | `git tag -d` + 重新创建**同名**已推送 tag | 远端仍指向旧对象，本地与远端分裂；其他人拉取会得到旧指针 | 用**新名字**的 tag（如 `v2.0.1`） |
| 5 | `alembic downgrade base` 且数据库有业务数据 | **不可恢复地丢失全部数据** | `downgrade -1` 逐步回退；或写正向补偿迁移（[场景 D](#场景-d数据库迁移损坏)） |
| 6 | `alembic stamp head` 掩盖真实 schema | 数据库处于未知状态且被标记为「最新」，后续所有迁移判断失准 | 先诊断真实 schema（`alembic current` / 直接查表），再决定 |
| 7 | 跳过备份直接 `alembic downgrade` | 回滚失败后无恢复点，事故升级为数据事故 | §5.2 备份 + 恢复演练 |
| 8 | 手工编辑 8 个版本承载点之一 | 版本漂移被 CI `version-gate` 拦截，且 `RELEASE_DATE` / CHANGELOG 日期不同步 | `npm run version:bump -- patch` 统一写入 |
| 9 | 删除 `backend/alembic/versions/` 下的迁移文件 | 已应用过的迁移无法再被 Alembic 识别，`alembic_version` 指向不存在的 revision | 保留历史迁移文件；用新迁移修正（Alembic 历史不可变） |
| 10 | `docker compose down -v` | 删除 volume，**数据库数据与上传文件全部丢失** | `docker compose down --remove-orphans`（不加 `-v`） |
| 11 | `git clean -fdx` 在有未提交工作区时 | 删除全部未跟踪文件（包括他人正在写的代码、备份、日志） | `git status` 逐项确认后手工删除 |
| 12 | `--no-verify` 提交发布 | 绕过 print/console.log/tsc/ruff/ui-guard/scan_undefined 五道拦截网，缺陷直达生产 | 修完缺陷再正常提交 |

---

## 7. 回滚后收尾

### 7.1 验证回滚成功

- [ ] 运行时版本回到预期值
  ```powershell
  Invoke-WebRequest -Uri https://rmfood.example.com/api/v1/info -UseBasicParsing |
      Select-Object -ExpandProperty Content
  # 期望：app_version = 回滚目标版本；api_version 仍为 1.0.0（除非轴 B 也被回滚）
  (Invoke-WebRequest -Uri https://rmfood.example.com/api/v1/info -UseBasicParsing).
      Headers["X-API-Version"]
  ```
- [ ] 健康检查与服务可用性
  ```powershell
  Invoke-WebRequest -Uri https://rmfood.example.com/health -UseBasicParsing |
      Select-Object -ExpandProperty Content
  (Invoke-WebRequest -Uri https://rmfood.example.com/ -UseBasicParsing).StatusCode
  ```
- [ ] 数据库版本与代码一致
  ```bash
  cd /opt/rmfood
  docker compose exec backend python -m alembic current
  ```
- [ ] 代码库与线上镜像指向同一提交
  ```powershell
  git log --oneline -5
  git describe --tags --always
  ```
- [ ] CI 已全绿（`version-gate` → `smoke-test`）。
- [ ] 复现原事故场景，确认不再复现。

### 7.2 CHANGELOG 如何记录

- [ ] 回滚本身要**留下可见记录**，不要假装没发生。
  - 若已发过 `v2.1.0`，**不要删除或改写该条目**；在其下新增补丁版本条目：
    ```markdown
    ## [2.1.1] - 2026-10-26

    ### Fixed

    - 回退 v2.1.0 引入的 <缺陷>（revert <sha7>），恢复 <旧行为>
    ```
  - 若 tag 本身作废，在错误条目顶部加 `> ⚠️ 已作废（DEPRECATED）` 横幅并指向替代版本（§3.2）。
- [ ] 用词克制、可追溯：写明 revert 的 commit、恢复的行为、影响范围；
  不写情绪化表述、不隐瞒。
- [ ] 保留 `## [Unreleased]` 段（CHECKLIST §6）。

### 7.3 是否需要新 ADR

| 情形 | 是否需要新 ADR |
|:-----|:---------------|
| 纯代码缺陷 revert，无架构变化 | 不需要 |
| 回滚推翻了既有 ADR 的决策前提（例如发现某技术选型不可行） | **需要**，在原 ADR 中标注「已废弃」并新建 ADR 说明替代方案 |
| 引入了新的迁移策略（如补偿迁移、四阶段灰度） | **需要**，扩展 [ADR-007](../adr/ADR-007-数据库迁移与版本管理策略.md) |
| 变更了版本治理规则（两轴判定、承载点清单、发布流程） | **需要**，扩展 [ADR-038](../adr/ADR-038-语义化版本发布体系.md) |
| 变更了 CI/CD 或自动回滚策略 | **需要**，扩展 [ADR-008](../adr/ADR-008-CI-CD流水线与持续交付策略.md) |
| 新增了 `rc` 转正能力等发布工具能力 | **建议**，记录为 ADR-039+ |

新建 ADR 时：
- [ ] 文件命名 `docs/adr/ADR-039-<主题>.md`（下一个可用编号为 **039**，
      见 [docs/adr/index.md](../adr/index.md) 的编号登记说明）。
- [ ] 在 `docs/adr/index.md` 登记（**该文件由 lead 或其他成员维护，本任务不改动**）。
- [ ] 在 CHANGELOG 的对应版本条目中链接新 ADR。

### 7.4 复盘与防御

- [ ] 记录事故时间线：发现时间 → 止血时间 → 根因确认 → 修复发布 → 验证完成。
- [ ] 补充自动化防线：为本次事故的根因补一条测试，或在
      `.github/workflows/ci-cd.yml` 增加对应门禁（该文件由其他成员维护）。
- [ ] 若回滚暴露的是**流程漏洞**（例如 checklist 缺一步），更新
      [CHECKLIST.md](./CHECKLIST.md) 与本文件。
- [ ] 通知相关方回滚已完成、系统已恢复、后续行动项。

---

## 8. 快速参考卡

```text
【代码缺陷】  git revert <sha>  →  bump patch  →  新 tag  →  CI  →  部署
【配置错误】  改回 .env         →  docker compose up -d   （不动版本号）
【依赖问题】  git revert 依赖提交 → 重锁依赖 → bump patch → 新 tag
【迁移损坏】  备份(强制) → alembic downgrade -1 → 代码回退 → bump patch → 新 tag
【tag 打错】  未推送：tag -d 重建     已推送：新建更高补丁 tag + 通知下游
【禁止】      force push / reset --hard 已推送分支 / downgrade base 有数据 / compose down -v
```

| 常用只读诊断命令 |
|:-----------------|
| `git status --porcelain` / `git log --oneline -10` |
| `git describe --tags --always` / `git rev-list -n 1 <tag>` |
| `git cat-file -t <tag>`（`tag` = annotated，`commit` = 轻量） |
| `npm run version:current` / `npm run version:check` / `npm run version:check:ci` |
| `cd backend; .\venv\Scripts\python.exe -m alembic current` |
| `cd backend; .\venv\Scripts\python.exe -m alembic heads` |
| `cd backend; .\venv\Scripts\python.exe -m alembic history --verbose` |
| `.\start.ps1` / `.\stop.ps1`（本地验证，不使用 Docker） |
