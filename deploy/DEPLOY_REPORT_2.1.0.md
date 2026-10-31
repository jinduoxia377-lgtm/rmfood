# RMFOOD 2.1.0 部署报告

- 目标服务器：`106.12.20.131`（root，端口 22）
- 部署目录：`/opt/rmfood`（构建上下文）
- 镜像标签：`DEPLOY_TAG=v2.1.0`
- 部署时间：2026-10-30
- 结果：**成功**，4 容器全部 `healthy`，`/health` 返回 `version=2.1.0`

---

## 1. 部署摘要

| 组件 | 结果 |
|:--|:--|
| 版本升级 | 2.0.0 → **2.1.0**（8 承载点一致，`npm run version:check` 门禁通过） |
| 前端构建 | `frontend/dist` 完成，入口 `index-DojctaDC.js`，tsc 零错 |
| 后端镜像 | `rmfood-backend:v2.1.0`（2.48GB）构建成功 |
| 前端镜像 | `rmfood-web:v2.1.0`（147MB）构建成功 |
| 容器 | postgres / redis / backend / web 全部 `Up (healthy)` |
| 迁移 | alembic head = `20261030_000001`（含本次新增同步迁移） |
| 磁盘 | 清理后 6.8GB 可用（82%） |

## 2. 验证结果

- `GET /` → **200**（入口 `index-DojctaDC.js`）
- `GET /health` → **200** `{"status":"healthy","version":"2.1.0",...}`
- `GET /api/v1/health` → **200** `version=2.1.0`
- `GET /api/v1/databases/cfam/herbs` → **200** `total=106`
- `GET /api/v1/databases/rmchm/herbs` → **200**（返回药材数据）
- `GET /api/v1/databases/cfam/stats` → **200**
- `GET /api/v1/terminology/terms` → **200**
- `GET /api/v1/ingredients/food-homology` → **200**
- `POST /api/v1/auth/login`（admin）→ 成功，`/api/v1/auth/me` → **200**

## 3. 部署过程中发现并修复的问题

### 3.1 `start.sh` 带 UTF-8 BOM → 容器 `exec format error`
- **症状**：backend 容器 crash-loop，日志 `exec /usr/local/bin/start.sh: exec format error`。
- **根因**：`deploy/scripts/start.sh` 首字节为 `EF BB BF`（UTF-8 BOM），污染 shebang，内核无法 exec。
- **修复**：去掉 BOM（本地 + 服务器构建上下文）。

### 3.2 `nginx.conf` 带 CRLF 行尾
- **症状**：web 容器重启（`host not found in upstream "backend"`，系 backend 未起导致，非 CRLF 直接原因）。
- **修复**：`deploy/nginx/nginx.conf` 转为 LF（110 处 CRLF → 0）。

### 3.3 `docker commit` 产物无法 chmod（overlayfs metacopy）
- **症状**：注入修复文件后 `start.sh` 变 666（不可执行），容器内 `chmod` 报 `Operation not permitted`，`docker build FROM` + `RUN chmod` 也 exit 1。
- **修复**：compose 的 backend 服务加 `command: ["/bin/bash", "/usr/local/bin/start.sh"]`（bash 在镜像中，绕开 exec 位）。

### 3.4 生产库由旧部署 `create_all` 创建、无 `alembic_version` 表
- **症状**：新 `start.sh` 的 `alembic upgrade head` 从 base 重跑全部迁移，撞 `relation "users" already exists` 而失败（非致命，app 照常启动）。
- **根因**：旧部署未用 alembic 跟踪，`alembic_version` 表不存在。
- **修复**：① 直接 SQL 同步 schema（见 3.5）；② `alembic stamp 20261030_000001` 使后续 `upgrade head` 变为 no-op。

### 3.5 模型/迁移不同步（cfam/rmchm 端点 503）
- **症状**：`/api/v1/databases/cfam/herbs`、`/rmchm/herbs` 返回 503。
  - `rmchm_herbs.function_en` / `source_versions` 列不存在（模型有、迁移未建）。
  - `hf_enriched_herbs` 表不存在（模型有、服务器从未创建）。
  - `pre_register_requests.review_deadline` 列不存在。
- **修复**：新增迁移 `backend/alembic/versions/20261030_000001_sync_herb_schema.py`（幂等 SQL），在服务器执行：
  - `rmchm_herbs` 补 `function_en TEXT`、`source_versions JSON`（并从旧列 `source_info` 迁移 714 行数据）。
  - 创建 `hf_enriched_herbs` 表（与 `HFEHerb` 模型一致）+ 索引。
  - `pre_register_requests` 补 `review_deadline TIMESTAMPTZ`。

### 3.6 `hf_enriched_herbs` 空表 → cfam 目录无数据
- **症状**：cfam/herbs 返回 200 但 `items:[]`。
- **根因**：新表刚建，无数据；`cfam_merged.json` 在仓库 `data/CFAM/`（app 期望 `backend/data/CFAM/`，路径不匹配，容器内不存在）。
- **修复**：从既有 `cfam_herbs`（106 行）映射 seed `hf_enriched_herbs`（含公告批次 → `source_version` 反向映射），`total=106`。

## 4. 已处理：药食同源目录 DB 化（原「丁香」硬编码问题）

原 `/api/v1/knowledge-base/tcm/homology/{name}` 的 `catalog_count` 来自 `tcmsp_client.FOOD_HOMOLOGY_CATALOG`（**硬编码 133 项目录**），与 `hf_enriched_herbs` 无关，个别药材如「丁香」按该目录匹配显示非药食同源。**已改造**：`tcmsp_client.check_food_homology` 现优先从 `hf_enriched_herbs`（DB，106 种）加载目录，失败回退内置目录，并新增 `catalog_source` 字段标注来源。验证：`丁香` → `is_food_homology:true, catalog_count:106, catalog_source:"hf_enriched_herbs(db)"`；`人参` → `false`（人参不在官方 106 目录，符合平台数据口径）。

## 5. 其他已知观察（非部署回归）

- `data/CFAM/cfam_merged.json`（仓库根）为**双重编码损坏**（mojibake，非合法 UTF-8/GBK），且 app 期待路径为 `backend/data/CFAM/cfam_merged.json`（路径不匹配）。该文件仅由 `/databases/cfam/sync` 端点引用，服务器上不存在、sync 端点 404，故不影响运行；如需修复需从药典 PDF 重新导出，不在本次范围。

## 6. 本地仓库变更（待提交）

| 文件 | 变更 |
|:--|:--|
| `deploy/scripts/start.sh` | 去掉 UTF-8 BOM |
| `deploy/nginx/nginx.conf` | CRLF → LF |
| `deploy/docker-compose.deploy.yml` | backend 服务增加 `command: ["/bin/bash", "/usr/local/bin/start.sh"]` |
| `backend/app/services/data_sources/tcmsp_client.py` | `check_food_homology` 改为 DB 目录优先 + `catalog_source` |
| `backend/alembic/versions/20261030_000001_sync_herb_schema.py` | 新增 schema 同步迁移 |
