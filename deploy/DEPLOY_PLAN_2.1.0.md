# RMFOOD 平台 v2.1.0 部署清单与执行计划

- **目标服务器**: `106.12.20.131`，部署根目录 `/opt/rmfood`
- **平台版本**: `2.1.0`（单一事实源 `backend/app/version.py` → `__version__ = "2.1.0"`，`RELEASE_DATE = 2026-10-30`）
- **构建上下文**: 服务器 `/opt/rmfood`（`deploy/docker-compose.deploy.yml` 的 `context: ..` 相对 `deploy/`）
- **部署方式**: 本地构建产物上传 → 服务器 `docker compose build` → `up -d`
- **生成日期**: 2026-10-30
- **本计划性质**: 只读后端/前端，**不执行构建、不执行部署**；仅产出清单与执行计划。

---

## 1. 部署架构确认（依据 `deploy/Dockerfile.deploy` 与 `deploy/docker-compose.deploy.yml`）

### 1.1 服务拓扑（compose 定义 4 个必需容器 + 1 个可选容器）

| 服务 | 镜像/构建 | 容器名 | 端口 | 健康检查 | 说明 |
|:-----|:----------|:-------|:-----|:---------|:-----|
| `postgres` | `postgres:16-alpine` | `rmfood_postgres` | `127.0.0.1:5432` | `pg_isready` | 数据库 |
| `redis` | `redis:7-alpine` | `rmfood_redis` | `127.0.0.1:6379` | `redis-cli ping` | 缓存/队列 |
| `backend` | `deploy/Dockerfile.deploy` → `backend-runtime` | `rmfood_backend` | `127.0.0.1:8000` | `healthcheck.py` | FastAPI API |
| `web` | `deploy/Dockerfile.deploy` → `frontend-runtime` | `rmfood_web` | `80:80` | `wget /health` | Nginx 前端+反代 |
| `chromadb` | `chromadb/chroma:0.5.0` | `rmfood_chromadb` | —（内部） | — | **可选**，`profiles: [with-rag]` |

> 默认 `docker compose up` **不含** `chromadb`（profile 未启用）；仅当需要独立向量服务时用 `--profile with-rag`。**注意**：后端 `vector_store.py` 实际使用**进程内嵌**的 `chromadb.PersistentClient`（持久化目录默认 `data/chromadb`，见 §5.4），与独立的 `chromadb` 容器并非同一数据路径。

### 1.2 构建阶段与 COPY 内容（Dockerfile.deploy）

**后端（`backend-builder` + `backend-runtime`）**，构建上下文 = 服务器 `/opt/rmfood`：

| 阶段 | COPY / 动作 | 需要上传的上下文路径 |
|:-----|:------------|:---------------------|
| `backend-builder` | `COPY backend/requirements.txt`；`pip install --prefix=/install -r requirements.txt`（阿里云 PyPI）；兜底 `psutil alembic` | `backend/requirements.txt` |
| `backend-runtime` | `COPY backend/app/ ./app/` | `backend/app/` |
| | `COPY backend/alembic/ ./alembic/` | `backend/alembic/` |
| | `COPY backend/alembic.ini ./alembic.ini` | `backend/alembic.ini` |
| | `COPY backend/conf/ ./conf/` | `backend/conf/` |
| | `COPY backend/config/ ./config/` | `backend/config/` |
| | `COPY backend/ml_artifacts/ ./ml_artifacts/` | `backend/ml_artifacts/` |
| | `COPY backend/static/ ./static/` | `backend/static/` |
| | `COPY backend/data/ ./data/` | `backend/data/` |
| | `COPY backend/scripts/docker-healthcheck.py /usr/local/bin/healthcheck.py` | `backend/scripts/docker-healthcheck.py` |
| | `COPY deploy/scripts/start.sh /usr/local/bin/start.sh` | `deploy/scripts/start.sh` |

> **补充**：任务给出的后端 COPY 集合未列 `backend/scripts/docker-healthcheck.py`，但 Dockerfile 第 140 行 `COPY` 了它，且是 `backend` 容器 HEALTHCHECK 的入口——**必须上传**，否则镜像构建失败或健康检查缺失。已纳入 `BUNDLE_2.1.0.manifest`。

**前端（`prebuilt-dist` → `frontend-runtime`）**：

| 阶段 | COPY / 动作 | 需要上传的上下文路径 |
|:-----|:------------|:---------------------|
| `prebuilt-dist` | `COPY frontend/dist/ /` | `frontend/dist/`（本地构建产物） |
| `frontend-runtime` | `COPY --from=prebuilt-dist / /usr/share/nginx/html`；`COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf` | `deploy/nginx/nginx.conf` |

> `prebuilt-dist` 为**首选**路径（使用现成 `frontend/dist`）。`frontend-builder`（node:20-alpine，`npm ci && npm run build`）为**回退**，仅在 `prebuilt-dist` 缺失/为空时启用；本机 `frontend/dist` 已存在（241 文件），故采用 prebuilt-dist，**不需要**上传 `frontend/` 源码。

**部署/运行时配置（不进入镜像、但服务器需要）**：

| 文件 | 用途 |
|:-----|:-----|
| `deploy/docker-compose.deploy.yml` | compose 定义（`dockerfile: deploy/Dockerfile.deploy`） |
| `deploy/Dockerfile.deploy` | 构建定义 |
| `deploy/.env`（由本地 `deploy/.env.deploy` 改名上传） | `--env-file` 注入 `${POSTGRES_PASSWORD}`/`${SECRET_KEY}`/`${ADMIN_PASSWORD}` 等 |
| `deploy/nginx/nginx.conf` | `web` 服务 bind-mount（`./nginx/nginx.conf` → 容器 `default.conf`），覆盖镜像内置配置 |
| `deploy/scripts/start.sh` | 后端启动（等待 PG → `alembic upgrade head` → `uvicorn`） |
| `deploy/temp_files/` | `backend` 服务 bind-mount（`./temp_files:/app/temp_files`），**服务器需存在该目录** |

---

## 2. 待上传文件清单（来源本地路径 → 服务器 `/opt/rmfood` 目标路径）

**权威逐文件清单见同目录 `deploy/BUNDLE_2.1.0.manifest`**（1340 行，每行 `本地相对路径 -> 服务器相对路径`，服务器根 = `/opt/rmfood`）。上传脚本可按行解析：`local -> server`，将 `local` 复制到 `/opt/rmfood/<server>`。

### 2.1 上传分组汇总

| 分组 | 目录/文件（相对仓库根） | 文件数 | 体积 | 是否入 manifest |
|:-----|:------------------------|:-------|:-----|:----------------|
| 后端源码 | `backend/app/`、`backend/alembic/`、`backend/conf/`、`backend/config/`、`backend/ml_artifacts/` | 973 | ≈14.2 MB | ✅ |
| 后端静态 | `backend/static/`（106FAM 药材图 + swagger） | 109 | ≈1.6 MB | ✅ |
| 后端运行时数据 | `backend/data/`（RAG 语料/配置，见 §2.3） | 9 | ≈50.5 MB | ✅ |
| 后端单文件 | `backend/requirements.txt`、`backend/alembic.ini`、`backend/scripts/docker-healthcheck.py` | 3 | ≈0.0 MB | ✅ |
| 前端构建产物 | `frontend/dist/`（prebuilt-dist） | 241 | ≈18.8 MB | ✅ |
| 部署配置 | `deploy/Dockerfile.deploy`、`docker-compose.deploy.yml`、`nginx/nginx.conf`、`scripts/start.sh` | 4 | ≈0.0 MB | ✅ |
| 环境文件 | `deploy/.env.deploy` → 服务器 `deploy/.env` | 1 | ≈0.0 MB | ✅（改名） |
| **合计（默认）** | | **1340** | **≈85.1 MB** | ✅ |
| *可选：RAG 精排模型* | `backend/data/models/bge-reranker-base/` | 6 | ≈1081.8 MB | ❌（可选，见 §2.4） |
| *可选：Chroma 向量库* | `backend/data/chromadb_v2/`、`backend/data/chromadb/`（部分） | 19 | ≈16.2 MB | ❌（建议重建，见 §5.4） |

### 2.2 逐项上传条目（目录级，供人工核对）

来源（本地，`D:\RMFOODFP\`） → 目标（服务器，`/opt/rmfood/`）：

```
backend/app/            -> /opt/rmfood/backend/app/          (后端应用源码, 876 项)
backend/alembic/        -> /opt/rmfood/backend/alembic/      (Alembic 迁移)
backend/alembic.ini     -> /opt/rmfood/backend/alembic.ini
backend/conf/           -> /opt/rmfood/backend/conf/
backend/config/         -> /opt/rmfood/backend/config/
backend/ml_artifacts/   -> /opt/rmfood/backend/ml_artifacts/ (ML 权重/系数)
backend/static/         -> /opt/rmfood/backend/static/       (药材图 + swagger)
backend/data/           -> /opt/rmfood/backend/data/         (RAG 语料, 见 §2.3)
backend/requirements.txt-> /opt/rmfood/backend/requirements.txt
backend/scripts/docker-healthcheck.py -> /opt/rmfood/backend/scripts/docker-healthcheck.py
frontend/dist/          -> /opt/rmfood/frontend/dist/        (构建产物, prebuilt-dist)
deploy/Dockerfile.deploy      -> /opt/rmfood/deploy/Dockerfile.deploy
deploy/docker-compose.deploy.yml -> /opt/rmfood/deploy/docker-compose.deploy.yml
deploy/nginx/nginx.conf       -> /opt/rmfood/deploy/nginx/nginx.conf
deploy/scripts/start.sh       -> /opt/rmfood/deploy/scripts/start.sh
deploy/.env.deploy            -> /opt/rmfood/deploy/.env      (⚠️ 改名: .env.deploy -> .env)
deploy/temp_files/            -> /opt/rmfood/deploy/temp_files/  (仅确保目录存在; 后端 bind-mount)
```

### 2.3 `backend/data/` 默认包含项（RAG 知识库语料/配置）

| 文件 | 体积 | 说明 |
|:-----|:-----|:-----|
| `backend/data/pharmacopoeia2020_part1.pdf` | 34.8 MB | 《中国药典》2020 原文 |
| `backend/data/pharmacopoeia2020_part1.txt` | 15.6 MB | 药典文本（RAG 语料） |
| `backend/data/pharmacopoeia_cautions.json` | 6.0 KB | 药典禁忌 |
| `backend/data/pharmacopoeia_cautions_v2.json` | 0.4 KB | 药典禁忌 v2 |
| `backend/data/bencaogangmu_cautions.json` | 36.0 KB | 《本草纲目》禁忌 |
| `backend/data/herb_image_map.json` | 7.4 KB | 药材图映射 |
| `backend/data/rmchm_image_map.json` | 5.5 KB | RMCHM 图映射 |
| `backend/data/synergy/synergy_coefficients.json` | 1.9 KB | 协同系数 |
| `backend/data/synergy/version_history.json` | 6.6 KB | 协同版本历史 |

### 2.4 可选项：RAG 精排模型（默认**不**上传，建议按需追加）

`backend/app/services/ai/rag/reranker.py:37` 从 `backend/data/models/bge-reranker-base` 加载 `bge-reranker-base`（`model.safetensors` **≈1.06 GB**）。**模型缺失时 reranker 自动降级**（返回 `None`，RAG 走纯 embedding/BM25 排序，功能不中断）。如需完整 RAG 精排质量，在上传清单末尾**追加**以下行（本地相对路径 → 服务器相对路径）：

```
backend/data/models/bge-reranker-base/config.json -> backend/data/models/bge-reranker-base/config.json
backend/data/models/bge-reranker-base/model.safetensors -> backend/data/models/bge-reranker-base/model.safetensors
backend/data/models/bge-reranker-base/sentencepiece.bpe.model -> backend/data/models/bge-reranker-base/sentencepiece.bpe.model
backend/data/models/bge-reranker-base/special_tokens_map.json -> backend/data/models/bge-reranker-base/special_tokens_map.json
backend/data/models/bge-reranker-base/tokenizer.json -> backend/data/models/bge-reranker-base/tokenizer.json
backend/data/models/bge-reranker-base/tokenizer_config.json -> backend/data/models/bge-reranker-base/tokenizer_config.json
```

> 上传后约 +1.08 GB（总传输约 1.17 GB），`2C4G` 服务器需注意磁盘/传输耗时。

---

## 3. 服务器端命令序列（上传完成后）

```bash
cd /opt/rmfood

# 1) 校验上传物完整（可选）
test -f deploy/docker-compose.deploy.yml && test -f deploy/Dockerfile.deploy \
  && test -f backend/requirements.txt && test -f deploy/.env && echo "OK: upload present"

# 2) 构建镜像（上下文=/opt/rmfood）
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml build

# 3) 启动/重建（强制重建，应用新镜像）
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml up -d --force-recreate

# 4) 等待 backend 健康（容器内 healthcheck.py 探测 /app 就绪; start-period 60s）
#    轮询: docker inspect 的 State.Health.Status == healthy
for i in $(seq 1 30); do
  st=$(docker inspect --format '{{.State.Health.Status}}' rmfood_backend 2>/dev/null)
  echo "[$i] backend health=$st"
  [ "$st" = "healthy" ] && break
  sleep 5
done

# 5) 检查 4 个必需容器状态（postgres/redis/backend/web）
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'rmfood_(postgres|redis|backend|web)|NAMES'
```

**预期：4 个容器均为 `Up ... (healthy)`（或 `Up`）**。若启用 RAG 独立向量服务：追加 `--profile with-rag` 到 build/up 命令，并核对 `rmfood_chromadb`。

**`.env` 说明（重要）**：任务给出的构建命令为 `--env-file deploy/.env`，因此本地 `deploy/.env.deploy` 上传时应改名为服务器 `deploy/.env`（见 §2.2）。`deploy/.env.deploy` 文件头注释写作「`cp .env.deploy /opt/rmfood/.env`」（即仓库根 `.env`）；两处不一致，**以本计划 `deploy/.env` 为准**（与命令匹配）。若运维实际希望用仓库根 `.env`，请把命令改为 `--env-file .env` 并相应调整上传目标。

---

## 4. 健康验证命令（部署后）

服务器本机验证（经 `web` 容器 Nginx `:80`）：

```bash
# 1) 前端入口（Nginx 返回 index.html）
curl -sS -o /dev/null -w 'GET / -> %{http_code}\n' http://127.0.0.1/

# 2) 根健康检查（Dockerfile HEALTHCHECK 目标; 返回 version）
curl -sS http://127.0.0.1/health
# 预期: {"status":"healthy","version":"2.1.0","api_version":"v1","timestamp":"..."}

# 3) v1 健康检查（register_version_routes 注册, 同样返回 version）
curl -sS http://127.0.0.1/api/v1/health
# 预期: {"status":"healthy","version":"2.1.0","api_version":"v1",...}

# 4) 数据库检索接口（注意: 实际路由为 /databases/cfam/herbs 或 /rmchm/herbs）
curl -sS -o /dev/null -w 'GET /api/v1/databases/cfm/herbs -> %{http_code}\n' http://127.0.0.1/api/v1/databases/cfam/herbs
curl -sS -o /dev/null -w 'GET /api/v1/databases/rmchm/herbs -> %{http_code}\n' http://127.0.0.1/api/v1/databases/rmchm/herbs
# 预期: 200（公开检索，通常无需认证）

# 5) 登录接口（OAuth2/JWT; 返回 token / user）
curl -sS -X POST http://127.0.0.1/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' \
  -w '\nHTTP %{http_code}\n'
# 预期: 200 + access_token; 或 401/400 视凭据。密码来自 deploy/.env 的 ADMIN_PASSWORD。
```

**版本断言**：`/health` 与 `/api/v1/health` 响应中 `version` 字段应等于 **`2.1.0`**。来源链：`backend/app/version.py __version__="2.1.0"` → `Settings.app_version`（`APP_VERSION` 环境变量可覆盖；compose 未设置 → 2.1.0）。

**路由校正说明**：任务给出的 `/api/v1/health` 与 `/api/v1/databases/herbs` 中，`/api/v1/health` **存在**（`register_version_routes` 注册）；`/api/v1/databases/herbs` **不存在**——`db_modules` 路由前缀为 `/databases`，实际为 `/databases/cfam/herbs`（CFAM 官方目录）与 `/databases/rmchm/herbs`（RMCHM）。以上命令已按实际路由给出。

---

## 5. 前置检查与注意事项

### 5.1 版本一致性
- `backend/app/version.py` = `2.1.0`（`RELEASE_DATE=2026-10-30`）；`frontend/package.json` = `2.1.0`；版本承载点共 8 处（`VERSION_SOURCE_FILES`），已用 `npm run version:check` 门禁。健康接口返回 `version: 2.1.0`。

### 5.2 `frontend/dist` 质量提示
- `frontend/dist` 已生成（241 文件，含 `assets/index-DojctaDC.js` 等生产产物），`prebuilt-dist` 可用。
- ⚠️ dist 根目录含**调试/QA 残留**：`slider-test.html`、`slider-standalone.html`、`slider-diagnostic.html`、`react-slider-test.html`、`theme-diagnostic.html/js`、`theme-test.js`、`test-echarts*.html`、`settings-page-fix.png`、`theme-fix-success.png`、`debug-errors.js`。这些**建议从上传清单中剔除**（或上传前重新 `npm run build` 生成干净 dist），否则会作为静态文件被 Nginx 服务。剔除后不影响 `index.html`/`assets/`。

### 5.3 清单校准（git ls-files + 文件系统）
- 清单以**工作树实测**为准（本地工作树即 2.1.0 交付物），并用 `git ls-files` 交叉校验。已剔除：`__pycache__/`、`*.pyc`、`.venv/`、`node_modules/`、`.git/`、`.pytest_cache/`、`.ruff_cache/`、以及 gitignored 残留（`backend/app/.env` 废弃模板、`backend/app/api/**/*.py~RF*.TMP` 编辑器临时文件）。
- `frontend/dist` 为 gitignored 构建产物（`git ls-files` 0 项），从文件系统纳入——**必须上传**，否则 `prebuilt-dist` 为空导致构建失败/回退 node 构建。
- 工作树含未提交/未跟踪的真实源码（如 `backend/app/core/whitelist_org.py`、`whitelist_quota.py`），已纳入（它们未被 `git ls-files` 列出，但存在于工作树，为 2.1.0 组成部分）。

### 5.4 RAG 向量库与精排决策
- **向量库**：`vector_store.py` 默认持久化 `data/chromadb`（`CHROMA_PERSIST_DIR` 可覆盖；代码注释提示 2026-10-28 迁移至 `data/chromadb_v2`）。本地 `backend/data/chromadb`（约 11.4 MB）与 `chromadb_v2`（约 4.8 MB）为**运行时状态**，且引用的是本地库文档 ID，直接上传到服务器**可能与服务器数据库不一致**。
  - **推荐**：不默认上传；部署后让 RAG 在服务器**重建索引**（见附录 A.2）。
  - 若确需复用：上传 `backend/data/chromadb_v2/`（2026-10-28 后活动存储），并设 `CHROMA_PERSIST_DIR=data/chromadb_v2`。
- **精排模型**：见 §2.4（可选，缺省自动降级）。

### 5.5 环境变量
- 上传后 `deploy/.env` 必须包含：`POSTGRES_USER/PASSWORD/DB`、`SECRET_KEY`、`ENCRYPTION_KEY`、`ADMIN_PASSWORD`、`LLM_PROVIDER`、`FRONTEND_URL`（现 `.env.deploy` 已含；`FRONTEND_URL=http://106.12.20.131`）。`SECURITY__*`、`DATABASE__*` 等嵌套变量已在 compose 注入。
- 本计划不含密钥轮换；若 `SECRET_KEY`/`ADMIN_PASSWORD` 需变更，请在上传前修改 `deploy/.env.deploy`。

### 5.6 服务器前置条件
- `docker` + `docker compose` v2 已安装；`/opt/rmfood` 可写；磁盘余量 > 2 GB（镜像 + 1.08 GB 可选模型）。
- 端口占用：`80`（web）、`5432`/`6379`/`8000` 绑定 `127.0.0.1`（仅本机）；公网仅暴露 `80`。
- `backend` 依赖 `postgres`、`redis` 为 `service_healthy`；`web` 依赖 `backend`（无 health 门控，仅启动顺序）。

---

## 附录 A. 可选操作

### A.1 追加 RAG 精排模型
将 §2.4 的 6 行追加至 `deploy/BUNDLE_2.1.0.manifest`，重新上传 `backend/data/models/bge-reranker-base/`（≈1.08 GB），再 `docker compose ... up -d --force-recreate backend`。

### A.2 服务器端重建 RAG 索引（推荐，替代上传向量库）
```bash
# 进入后端容器执行 seed（示例; 具体命令以 seeder.py 为准）
docker exec -it rmfood_backend python -m app.services.ai.rag.seeder --rebuild
```

---

*本计划由 RMFOODFP 部署运维协作者基于 `deploy/Dockerfile.deploy`、`deploy/docker-compose.deploy.yml`、`deploy/.env.deploy`、`deploy/nginx/nginx.conf`、`deploy/scripts/start.sh` 及 `backend/app/version.py` 生成；版本 `2.1.0`。*
