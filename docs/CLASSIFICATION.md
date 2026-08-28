# 📚 RMFOOD 文档分类索引

> 最后更新：2026-08-19
> 文件总数：217 | 子目录：19 个

---

## 📂 目录结构总览

```
docs/
├── README.md                          # 文档中心入口
├── CLASSIFICATION.md                  # 本文件 — 分类索引
│
├── adr/                               # 架构决策记录 (29 文件)
├── ai/                                # AI 模块文档 (13 文件)
├── algorithms/                        # 算法与配方设计 (8 文件)
├── integrations/                      # 集成指南 (4 文件)
├── api/                               # API 参考 (1 文件)
├── artifacts/                         # 生成产物 (3 文件)
├── assets/screenshots/                # 知识库截图 (28 文件)
├── deployment/                        # 部署运维 (8 文件)
├── design/                            # 架构设计 (4 文件)
├── getting-started/                   # 快速入门 (1 文件)
├── plans/                             # 规划方案 (29 文件)
├── reports/                           # 审查报告 (21 文件)
│   └── archive/                       # 归档报告 (22 文件)
├── reviews/                           # 专家审查 (15 文件)
├── screenshots/                       # 应用截图 (4 文件)
├── superpowers/plans/                 # Agent 规划 (4 文件)
├── superpowers/specs/                 # Agent 规格 (2 文件)
├── temp_files/                        # 临时文件 (1 文件)
├── tests/                             # 测试文档 (1 文件)
│
├── 中国普通配方设计思路/               # 传统配方方法论
├── 营养成分表公式算法/                 # 营养计算专项
│
└── [根目录 — 核心概览文件，见下方]
```

---

## 🗂️ 各分类详细说明

### `adr/` — 架构决策记录 (29 文件)

架构决策记录，记录 RMFOOD 项目的重要架构决策。

| 编号 | 标题 | 状态 |
|------|------|------|
| ADR-001 | 六边形架构重构 | ⏸️ 已暂停 |
| ADR-002 | 事件驱动架构选型 | ✅ 已接受 |
| ADR-003 | 数据分类分级体系 | ✅ 已接受 |
| ADR-004 | DDD 有界上下文划分 | ✅ 已接受 |
| ADR-005 | 可观测性体系 | ✅ 已接受 |
| ADR-006 | 认证授权与访问控制 | ✅ 已接受 |
| ADR-007 | 数据库迁移与版本管理 | ✅ 已接受 |
| ADR-008 | CI/CD 流水线 | ✅ 已接受 |
| ADR-009 | 前端架构与状态管理 | ✅ 已接受 |
| ADR-010 | AI/ML 服务集成 | ✅ 已接受 |
| ADR-011 | 架构收敛决策 | ✅ 已接受 |
| ADR-012~016 | 主题系统系列 | ✅ 已接受 |
| ADR-017~021 | Dashboard UI/UX 系列 | ✅ 已执行 |
| ADR-022~026 | 配方详情页开发系列 | ✅ 已执行 |

### `ai/` — AI 模块文档 (13 文件)

| 文件 | 说明 |
|------|------|
| `AI_8MODULES_DEEP_DEVELOPMENT_SPEC.md` | 8 模块深度开发规范 |
| `AI_8MODULES_DEVELOPMENT_REPORT.md` | 8 模块开发报告 |
| `AI_COMPLIANCE_IMPLEMENTATION_REPORT.md` | AI 合规实施报告 |
| `AI_V4_COMPLIANCE_IMPLEMENTATION_REPORT.md` | AI v4 合规报告 |
| `AI_LLM_OPTIMIZATION_PLAN.md` | LLM 优化方案 |
| `AI_PAGE_REVIEW_REPORT_2026-05-06.md` | AI 页面审查报告 |
| `AI_TROUBLESHOOTING.md` | AI 故障排查手册 |
| `ai_service_audit.md` | AI 服务审计 |
| `ai-chat-module-architecture.md` | AI 聊天模块架构 |
| `ai-chat-academician-architecture.md` | AI 聊天院士级架构 |
| `ai-chat-review-report.md` | AI 聊天审查报告 |
| `ai-chat-test-and-development-plan.md` | AI 聊天测试计划 |
| `ai-page-screenshot-initial.png` | AI 页面初始截图 |

### `algorithms/` — 算法与配方设计 (8 文件)

| 文件 | 说明 |
|------|------|
| `ALGORITHM_DESIGN_DOCUMENT.md` | 算法设计文档 |
| `recipe-generation-algorithm-analysis.md` | 配方生成算法分析 |
| `配方生成算法深度开发方案.md` | 深度开发方案 |
| `配方生成算法深度开发-实施报告.md` | 实施报告 |
| `配方生成算法深度开发-最终报告.md` | 最终报告 |
| `配方生成算法后续开发计划.md` | 后续计划 |
| `专利核心算法与配方生成逻辑树状图.md` | 核心算法专利文档 |
| `营养成分表开发方案.md` | 营养表开发方案 |

### `integrations/` — 集成指南 (4 文件)

| 文件 | 说明 |
|------|------|
| `PEPINVENT_INTEGRATION_GUIDE.md` | PepINVENT 集成指南 |
| `potion_vft_integration_plan.md` | Potion VFT 集成计划 |
| `logger-guide.md` | 日志系统指南 |
| `architecture-integration-plan.md` | 架构集成计划 |

### `deployment/` — 部署运维 (8 文件)

| 文件 | 说明 |
|------|------|
| `DEPLOYMENT_GUIDE.md` | 部署指南 |
| `DEPLOYMENT_CHECKLIST.md` | 部署检查清单 |
| `DEPLOYMENT_SUCCESS.md` | 部署成功记录 |
| `LAN_DEPLOYMENT.md` | 局域网部署 |
| `LAN_FIXED.md` | 局域网修复记录 |
| `NETWORK_TROUBLESHOOTING.md` | 网络故障排查 |
| `QUICK_START.md` | 快速启动 |
| `FEATURE_EXPANSION_ROADMAP.md` | 功能扩展路线图 |

### `design/` — 架构设计 (4 文件)

| 文件 | 说明 |
|------|------|
| `DESIGN.md` | 设计文档 |
| `ARCHITECTURE_OPTIMIZATION.md` | 架构优化方案 |
| `DOCKER.md` | Docker 部署设计 |
| `DEEP_DEVELOPMENT_TECHNICAL_DOC.md` | 深度开发技术文档 |

### `reports/` — 审查报告 (21 + 22 归档)

活跃报告包含开发完成报告、测试报告、优化报告等。归档目录保存历史报告。

### `reviews/` — 专家审查 (15 文件)

包括专家架构审查、安全审查、AI 模块审查、UI/UX 设计系统审查等。

### `screenshots/` & `assets/screenshots/` — 截图资源

| 目录 | 数量 | 内容 |
|------|------|------|
| `screenshots/` | 4 | 应用界面截图、Lighthouse 报告 |
| `assets/screenshots/` | 28 | 知识图谱 v7.1–v7.6 迭代截图 |

### `superpowers/` — Agent 工作流 (6 文件)

| 路径 | 说明 |
|------|------|
| `plans/` | Agent 工作流规划（4 文件） |
| `specs/` | Agent 工作流规格（2 文件） |

---

## 📊 根目录核心文件（17 个）

这些是最高优先级的入口文档：

| 文件 | 说明 |
|------|------|
| `README.md` | **文档中心入口** |
| `CLASSIFICATION.md` | **本文件** |
| `ARCHITECTURE.md` | 技术架构全景 |
| `PROJECT_DEVELOPMENT_HANDBOOK.md` | 项目开发手册 (v3.1) |
| `PROJECT_DEVELOPMENT_HANDBOOK.html` | 手册 HTML 版 |
| `RUNBOOK.md` | 运维操作手册 |
| `QUICKSTART.md` | 快速入门指南 |
| `QUICK_START_SIMPLE.md` | 简化版入门 |
| `USER_MANUAL.md` | 用户操作手册 |
| `ADMIN_CONFIG_GUIDE.md` | 管理员配置指南 |
| `module-boundaries.md` | 模块边界定义 |
| `dependency-management.md` | 依赖管理 |
| `configuration-guide.md` | 配置指南 |
| `NEO4J_DEPLOYMENT_GUIDE.md` | Neo4j 部署指南 |
| `ONBOARDING_TEST.md` | 入职测试 |
| `USER_TEST_INVITATION.md` | 用户测试邀请 |
| `VALIDATION_REPORT_TEMPLATE.md` | 验证报告模板 |

---

## 📂 专题目录

### `中国普通配方设计思路/`
传统配方设计方法论文档。

### `营养成分表公式算法/`
营养计算 Excel 与专项开发文档。

---

## 📈 文档统计

| 分类 | 文件数 |
|------|--------|
| 架构决策 (ADR) | 29 |
| AI 模块文档 | 13 |
| 算法与配方 | 8 |
| 集成指南 | 4 |
| 部署运维 | 8 |
| 架构设计 | 4 |
| 审查报告 | 21 |
| 归档报告 | 22 |
| 专家审查 | 15 |
| 规划方案 | 29 |
| 应用截图 | 4 |
| 知识库截图 | 28 |
| Agent 工作流 | 6 |
| 其他（API/artifacts/tests/专题） | 6 |
| 根目录核心 | 17 |
| **总计** | **217** |

---

## 🔗 快速链接

- [🏠 文档中心](./README.md)
- [📋 ADR 索引](./adr/index.md)
- [🚀 快速开始](./QUICKSTART.md)
- [📘 项目手册](./PROJECT_DEVELOPMENT_HANDBOOK.md)
- [🔧 运维手册](./RUNBOOK.md)
