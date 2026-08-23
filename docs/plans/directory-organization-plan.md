# RMFOOD 项目目录结构规整方案

> 生成时间: 2026-08-15
> 状态: 待审核
> 涉及范围: D:/RMFOODFP 全部根目录

---

## 一、当前目录总览（根目录 44 个条目）

```
D:/RMFOODFP/
├── 📁 .claude/           # Claude Code 配置（规则、计划、worktrees）
├── 📁 .codegraph/        # 代码图谱索引
├── 📁 .devcontainer/     # Dev Container 配置
├── 📁 .github/           # GitHub Actions CI/CD
├── 📁 .gstack/           # gstack 工具配置
├── 📁 .husky/            # Git hooks
├── 📁 .local/            # 本地工具链
├── 📁 .pytest_cache/     # pytest 缓存
├── 📁 .trae/             # Trae IDE 配置
├── 📁 .venv/             # Python 虚拟环境（根级别，冗余）
├── 📁 .vscode/           # VS Code 配置
├── 📁 .workbuddy/        # WorkBuddy 工具配置
├── 📁 ai-docs/           # AI 相关文档（PDF/DOCX）
├── 📁 andrej-karpathy-skills/  # Karpathy 行为指南（git submodule）
├── 📁 backend/           # FastAPI 后端主项目
├── 📁 data/              # ChromaDB 向量数据库
├── 📁 development-plan/  # 开发计划文档
├── 📁 docker/            # Docker Compose 各服务配置
├── 📁 docs/              # 项目主文档（设计/架构/部署）
├── 📁 documents/         # 文档（重复！应与 docs/ 合并）
├── 📁 frontend/          # React/Vite 前端主项目
├── 📁 logs/              # 日志（与 backend/logs/ 重复）
├── 📁 models/            # 预训练模型权重
├── 📁 node_modules/      # Node.js 依赖
├── 📁 openfoodfacts/     # OpenFoodFacts CSV 数据
├── 📁 plans/             # 计划文档（重复！应与 development-plan/ 合并）
├── 📁 projects/          # 子项目（rmfood_microservices）
├── 📁 screenshots/       # 截图
├── 📁 scripts/           # 根级别脚本
├── 📁 tcmsp_data/        # TCMSP 药材数据库
├── 📁 temp_files/        # 临时文件（应定期清理）
├── 📁 tests/             # 集成/安全/E2E 测试
├── 📁 tests-reports/     # 测试报告
└── 30+ 个分散的脚本文件（start/restart/kill/debug）
```

---

## 二、问题清单

### 🔴 P0 - 严重重复/混乱

| 问题 | 位置 | 说明 |
|------|------|------|
| **文档目录重复** | `docs/` vs `documents/` | 两者都是 Markdown 文档，应合并 |
| **计划目录重复** | `plans/` vs `development-plan/` | 两者都是开发计划，应合并 |
| **日志目录重复** | `logs/` vs `backend/logs/` vs `backend/backend_output.log` | 多处日志存放，无统一目录 |
| **服务脚本泛滥** | 根目录有 14+ 个 start/restart/kill 脚本 | 全部重复，应统一到 `scripts/dev/` |
| **Python venv 冗余** | `.venv/` 在根目录 + `backend/.venv/` + `backend/venv/` | 三个虚拟环境，应该只用一个 |
| **日志文件散落** | 根目录 `server_v5.log` + backend 18 个 server*.log + logs/ 10 个 | 需要统一归档 |

### 🟡 P1 - 结构不清

| 问题 | 位置 | 说明 |
|------|------|------|
| **temp_files 四处散落** | 根/前端/后端 各有 `temp_files/` | 应统一到根 `temp/` |
| **tests-reports 冗余** | 根 `tests-reports/` + 前端/后端各有 `tests-reports/` | 应统一到 `tests-reports/` |
| **frontend/docs/ 多余** | `frontend/docs/` 内容是重复的部署文档 | 应删除或移至 `docs/deployment/` |
| **frontend/data/ 多余** | 仅含 `chromadb/`，与根 `data/chromadb/` 重复 | 应删除 frontend/data/ |
| **frontend/temp_files/ 多余** | 与根 temp_files/ 重复 | 应删除 |
| **data/test_chromadb/ 等** | 多个测试 chromaDB 实例 | 应移至 `tests/fixtures/` |

### 🟢 P2 - 可优化

| 问题 | 位置 | 说明 |
|------|------|------|
| **requirements 分散** | `backend/requirements/*.in` 和顶层 `pyproject.toml` | pyproject.toml 是权威来源，.in 可删除 |
| **backend/scripts/ 过大** | 100+ 个脚本混在一起 | 应按功能分类 |
| **backend/config/ 与 app/core/config.py** | 两套配置管理 | 应统一到 app/core/ |
| **backend/services/ 顶层目录** | 与 app/services/ 重叠 | 应删除 backend/services/ 或将内容迁移 |
| **root package.json** | 根目录有 package.json 但主要用于 scripts | 应移至 scripts/ 或用 pyproject 管理 |

---

## 三、建议的目标目录结构

```
D:/RMFOODFP/
│
├── 📄 README.md                    # 项目主入口
├── 📄 CLAUDE.md                    # Claude Code 项目指令
├── 📄 package.json                 # 根 npm 配置（scripts 脚本）
├── 📄 pytest.ini                   # pytest 配置
│
├── 📁 backend/                     # 🏗️ FastAPI 后端
│   ├── app/                        # 应用源码
│   │   ├── api/                    # API 路由层
│   │   ├── core/                   # 核心配置、数据库、中间件
│   │   ├── models/                 # 数据模型
│   │   ├── schemas/                # Pydantic 模式
│   │   ├── services/               # 业务服务层
│   │   └── ...
│   ├── alembic/                    # 数据库迁移
│   ├── config/                     # 配置（统一来源）
│   ├── plugins/                    # 插件系统
│   ├── scripts/                    # 运维脚本（已分类）
│   ├── tests/                      # 单元测试
│   ├── uploads/                    # 用户上传文件
│   ├── requirements.txt            # pip 兼容格式
│   ├── pyproject.toml              # 项目元数据（权威源）
│   ├── uv.lock                     # uv 锁定文件
│   ├── rmfood.db                   # SQLite 备份（开发用）
│   ├── pg_data/                    # PostgreSQL 数据目录
│   └── logs/                       # 统一日志（所有 server*.log 归档于此）
│
├── 📁 frontend/                    # 🏗️ React/Vite 前端
│   ├── src/                        # 源码
│   ├── public/                     # 静态资源
│   ├── tests/                      # 前端测试
│   ├── design-system/              # 设计系统
│   ├── benchmarks/                 # 性能基准
│   └── coverage/                   # 覆盖率报告
│
├── 📁 scripts/                     # 🛠️ 运维脚本（根级别入口）
│   ├── dev/                        # 开发服务管理（start/restart/kill）
│   ├── deploy/                     # 部署脚本
│   ├── import/                     # 数据导入工具
│   ├── maintenance/                # 数据库维护
│   ├── monitoring/                 # 监控工具
│   └── tools/                      # 辅助工具
│
├── 📁 docs/                        # 📚 项目文档（合并 documents/）
│   ├── adr/                        # 架构决策记录
│   ├── architecture/               # 架构文档
│   ├── deployment/                 # 部署文档（合并 frontend/docs/）
│   ├── design/                     # 设计文档
│   ├── getting-started/            # 入门指南
│   ├── guides/                     # 使用指南
│   ├── plans/                      # 开发计划（合并 plans/）
│   ├── reports/                    # 报告
│   ├── reviews/                    # 审查记录
│   └── tests/                      # 测试文档
│
├── 📁 data/                        # 💾 数据文件
│   ├── chromadb/                   # 向量数据库
│   └── synergy/                    # 协同数据
│
├── 📁 tests/                       # 🧪 集成测试
│   ├── e2e/                        # E2E 测试
│   ├── performance/                # 性能测试
│   ├── security/                   # 安全测试
│   └── fixtures/                   # 测试数据（含 test_chromadb*）
│
├── 📁 tests-reports/               # 📊 测试报告（合并各子目录）
│
├── 📁 docker/                      # 🐳 Docker 配置
│   ├── nginx/                      # Nginx 配置
│   ├── prometheus/                 # 监控
│   ├── grafana/                    # 可视化
│   ├── loki/                       # 日志
│   └── tempo/                      # 链路追踪
│
├── 📁 models/                      # 🤖 预训练模型权重
│
├── 📁 ai-docs/                     # 🧠 AI 相关文档/PDF
│
├── 📁 tcmsp_data/                  # 🌿 TCMSP 药材数据
│
├── 📁 openfoodfacts/               # 🍎 OpenFoodFacts 数据
│
├── 📁 projects/                    # 📂 子项目
│   └── rmfood_microservices/       # 微服务项目
│
├── 📁 screenshots/                 # 📸 截图
│
├── 📁 temp/                        # 🗑️ 临时文件（合并所有 temp_files/）
│
├── 📁 logs/                        # 📝 根级别日志（保留用于 Docker 挂载）
│
├── 📁 .github/                     # CI/CD
├── 📁 .claude/                     # Claude Code 配置
├── 📁 .vscode/                     # VS Code 配置
├── 📁 .devcontainer/               # Dev Container
├── 📁 .husky/                      # Git Hooks
│
├── 📄 .env                         # 环境变量（不提交）
├── 📄 .env.example                 # 环境变量模板
├── 📄 .gitignore
├── 📄 docker-compose.yml
├── 📄 Dockerfile
└── 📄 Dockerfile.backend-only
```

---

## 四、具体操作计划

### Phase 1: 清理重复（立即执行）

#### 4.1 合并日志目录
```bash
# 将所有 server*.log 归档到 backend/logs/
mv backend/server*.log backend/logs/ 2>/dev/null
mv backend/backend_output.log backend/logs/ 2>/dev/null
mv backend/import_runner.log backend/logs/ 2>/dev/null
mv backend/import_test.log backend/logs/ 2>/dev/null
mv server_v5.log logs/backend/ 2>/dev/null
mv server_restart.log logs/backend/ 2>/dev/null
```

#### 4.2 清理根目录冗余脚本
根目录目前有 **14 个** 重复的服务管理脚本，应全部移动到 `scripts/dev/`：

| 根目录脚本 | 目标位置 | 动作 |
|-----------|---------|------|
| `start_backend.bat` / `.sh` / `.py` | `scripts/dev/start-backend.sh` | 合并为单一入口 |
| `start_frontend.bat` | `scripts/dev/start-frontend.sh` | 合并 |
| `restart_all.bat` / `restart_services.*` / `_restart.*` | `scripts/dev/restart.sh` | 合并为单一入口 |
| `kill_all.*` / `kill_processes.py` / `_kill_services.py` | `scripts/dev/kill.sh` | 合并为单一入口 |
| `debug_backend.py` | `scripts/dev/debug-backend.py` | 移动 |
| `healthcheck_remote.py` | `scripts/dev/healthcheck.py` | 移动 |
| `test_results.txt` | `tests-reports/` | 移动 |
| `server_restart.log` / `server_v5.log` | `logs/backend/` | 移动 |
| `openapi_raw.json` | `docs/api/` | 移动 |
| `test_results.txt` | `tests-reports/` | 移动 |
| `unused_ai_modules.md` | `docs/reviews/` | 移动 |

#### 4.3 删除冗余虚拟环境
```bash
# 只保留 backend/.venv/，删除根目录 .venv/ 和 backend/venv/
rm -rf .venv/          # 根目录冗余 venv
rm -rf backend/venv/   # 与 .venv/ 重复
```

### Phase 2: 合并重复目录

#### 4.4 合并 documents/ → docs/
```bash
# 检查 documents/ 内容是否与 docs/ 重复
# 将 documents/ 中的 unique 文件移到 docs/ 对应子目录
# 然后删除 documents/
```

#### 4.5 合并 plans/ → docs/plans/
```bash
# plans/scalable-twirling-mochi.md → docs/plans/
# 删除 plans/
```

#### 4.6 清理前端冗余目录
```bash
rm -rf frontend/docs/      # 内容与 docs/deployment/ 重复
rm -rf frontend/data/      # 内容与 data/chromadb/ 重复  
rm -rf frontend/temp_files/# 内容与 temp/ 重复
```

#### 4.7 测试数据统一
```bash
# 将 test_chromadb* 移到 tests/fixtures/
mv data/test_chromadb tests/fixtures/chromadb-test-1/
mv data/test_chromadb2 tests/fixtures/chromadb-test-2/
mv data/chromadb_selftest tests/fixtures/chromadb-selftest/
```

### Phase 3: 整理 backend/scripts/

将 backend/scripts/ 中 100+ 个脚本按功能分类：

```
backend/scripts/
├── db/                      # 数据库管理
│   ├── init_db.py
│   ├── migrate.py
│   ├── seed.py
│   ├── backup.py
│   └── fix_*.py
├── import/                  # 数据导入
│   ├── import_openfoodfacts.py
│   ├── import_tcmsp.py
│   └── import_symmap.py
├── debug/                   # 调试工具
│   ├── diagnose_*.py
│   └── test_*.py
├── maintenance/             # 维护工具
│   ├── cleanup.py
│   └── optimize.py
└── one_time/                # 一次性脚本（已废弃标记）
    ├── complete_symmap_v*.py  # 迭代脚本，保留最新版
    └── scrape_mmid_v*.py      # 迭代脚本，保留最新版
```

### Phase 4: 整理根目录 Python 脚本

将孤立的 Python 脚本归类：

```
scripts/
├── dev/                    # 开发服务管理（上面已列出）
├── maintenance/
│   ├── db_backup.py        # 来自 backend/backup_database.py
│   ├── db_reset.py         # 来自 backend/reset_db.py
│   └── create_admin.py     # 来自 backend/create_admin.py
├── import/
│   ├── run_import.py       # 统一导入入口
│   └── import_off.py       # OpenFoodFacts 导入
├── tools/
│   ├── security_audit.py   # 来自 backend/security-audit.py
│   └── integration_verify.py
└── one_time/
    └── （已标记为 deprecated）
```

---

## 五、临时文件治理策略

项目中有 **4 处** `temp_files/` 目录，应统一治理：

| 位置 | 内容 | 建议 |
|------|------|------|
| `temp_files/` (根) | 临时生成的文件 | 定期清理，加入 gitignore |
| `backend/temp_files/` | 后端临时文件 | 删除，使用根 temp_files/ |
| `frontend/temp_files/` | 前端临时文件 | 删除，使用根 temp_files/ |
| `docs/temp_files/` | 文档临时文件 | 删除，使用根 temp_files/ |

添加至 `.gitignore`:
```gitignore
# 临时文件
temp/
**/temp_files/
**/*.log
**/__pycache__/
**/.pytest_cache/
**/node_modules/
**/.venv/
**/venv/
```

---

## 六、执行顺序

```
Phase 1 (10 min):    清理根目录脚本和日志
Phase 2 (15 min):    合并重复目录
Phase 3 (20 min):    整理 backend/scripts/
Phase 4 (10 min):    整理根目录 Python 脚本
Phase 5 (5 min):     更新 .gitignore 和文档
```

预计总耗时: **~60 分钟**

---

## 七、不变的部分

以下内容保持不动：
- `backend/app/` - 核心应用代码
- `frontend/src/` - 核心前端代码
- `docs/adr/` - 架构决策记录
- `docker/` - Docker 配置
- `data/chromadb/` - 生产向量数据库
- `models/best_generator.pt` - 预训练模型
- `.github/`, `.claude/`, `.vscode/` - 工具配置

---

## 八、验证清单

完成后检查：
- [ ] 根目录脚本从 14+ 个减少到 `scripts/dev/` 下 4 个统一入口
- [ ] `documents/` 和 `plans/` 已合并到 `docs/`
- [ ] 日志统一在 `backend/logs/` 和 `logs/` 两个位置
- [ ] 只有一个 Python venv（`backend/.venv/`）
- [ ] `frontend/docs/`, `frontend/data/`, `frontend/temp_files/` 已删除
- [ ] 测试数据（test_chromadb*）已移至 `tests/fixtures/`
- [ ] `.gitignore` 已更新排除临时文件
- [ ] 所有启动脚本通过 `scripts/dev/` 统一调用
