# RMFOOD 配方平台 - 深度补全方案
# 生成时间: 2026-08-17
# 分析范围: 前后端全模块完整性审计

## 一、项目现状总览

### 已完成且正常工作
| 模块 | 状态 | 说明 |
|------|------|------|
| 配方管理(列表/详情/编辑) | ✅ 完整 | 前后端API+数据均连通，12条真实配方 |
| 配方案例库 | ✅ 完整 | 12条案例，前后端API连通 |
| 工作流 | ✅ 完整 | 后端有模板API，前端已连接 |
| 仪表盘 | ✅ 基本完整 | DashboardPage有API查询，数据可用 |
| 通知中心 | ✅ 基本完整 | 前端已连接后端API |

### 部分完成 - 需补全
| 模块 | 问题 | 优先级 |
|------|------|--------|
| 配方模板 | 使用静态数据，无后端API | P1 |
| 术语管理 | 后端API存在但未注册，前端12个TODO | P1 |
| 数据分析 | useAnalyticsData hook存在，但数据表多为空 | P2 |
| 实验详情 | 11个TODO占位符 | P2 |
| 组织管理 | 使用Mock数据 | P2 |
| 审计日志 | 前端有API调用但后端路由可能不完整 | P3 |
| 配方对比 | 组件部分TODO | P3 |
| 数据库首页 | 61KB但依赖多个空表 | P2 |

### 后端缺失API
| 端点 | 问题 | 影响 |
|------|------|------|
| `/api/terminology/*` | 25个路由已实现但未在main.py注册 | 术语管理页完全不可用 |
| `/api/v1/ai/chat` | ai.py仅1125字节无路由 | AI对话功能不可用 |
| `/api/v1/teams` | 401(认证需求但可能路由不存在) | 团队管理受影响 |
| `/api/v1/reports` | 404 | 报表导出受影响 |

### 后端数据为空的核心表
| 表 | 记录数 | 影响模块 |
|----|--------|----------|
| experiments | 0 | 实验管理 |
| organizations | 0 | 组织管理 |
| teams | 0 | 团队管理 |
| terms | 0 | 术语管理 |
| term_categories | 0 | 术语管理 |
| comments | 0 | 评论/互动 |
| notifications | 0 | 通知中心 |

---

## 二、补全方案（按优先级排序）

### Phase 1: 修复关键断裂（立即执行）

#### 1.1 注册术语管理API路由
**文件**: `backend/app/main.py`
**问题**: `app/api/terminology.py` 已有25个完整路由，但未注册
**方案**: 在main.py中添加 `terminology_router` 的注册

#### 1.2 完善AI聊天后端API
**文件**: `backend/app/api/ai.py` (仅1125字节)
**问题**: 缺少 `/chat` 和 `/chat/stream` 端点
**方案**: 基于 `app/services/ai/chat_service.py` 实现聊天API路由

#### 1.3 为配方模板页面添加后端API
**文件**: `frontend/src/api/formula.ts` + `frontend/src/pages/formula/FormulaTemplatesPage.tsx`
**问题**: 模板数据硬编码在前端
**方案**: 
- 后端新增 `/api/v1/formula-templates` 端点（从formulas表中筛选模板类型配方）
- 前端改为从API获取模板数据

### Phase 2: 数据填充（核心业务完整性）

#### 2.1 种子数据脚本
**文件**: `backend/scripts/seed_experiments.py`
**目标**: 填充 experiments 表（10条真实实验记录）
**数据来源**: 基于现有12个配方生成对应实验记录

#### 2.2 组织数据填充
**文件**: `backend/scripts/seed_organizations.py`
**目标**: 填充 organizations + organization_members 表（3个示例组织）

#### 2.3 术语数据填充
**文件**: `backend/scripts/seed_terminology.py`
**目标**: 填充 term_categories（10个分类）+ terms（50+术语）
**数据来源**: 中国药典标准术语

#### 2.4 通知/评论种子数据
**文件**: `backend/scripts/seed_notifications.py`
**目标**: 填充 notifications（20条）+ comments（15条）

### Phase 3: 前端页面补全

#### 3.1 实验详情页面 TODO 消除
**文件**: `frontend/src/pages/experiment/ExperimentDetailPage.tsx`
**问题**: 11个 TODO/placeholder
**方案**: 逐个补齐实验阶段、数据表格、图表等

#### 3.2 数据分析页面完善
**文件**: `frontend/src/pages/analytics/*.tsx`
**问题**: 数据表为空导致图表无数据
**方案**: 
- 后端 analytics.py 已有 `/dashboard`, `/kpi`, `/trends` 路由
- 需要确保这些端点返回实际统计数据（而非空数据）
- 为 formula_cases, formulas 表添加统计聚合

#### 3.3 组织管理页面 Mock→真实API
**文件**: `frontend/src/pages/organizations/*.tsx`
**问题**: 使用 Mock 数据
**方案**: 
- 后端 organizations.py 已有完整API（待验证注册）
- 前端替换为真实 API 调用

#### 3.4 配方对比页面优化
**文件**: `frontend/src/pages/formula/FormulaComparePage.tsx`
**问题**: 2个 placeholder
**方案**: 补齐对比维度的UI展示

### Phase 4: 体验优化

#### 4.1 审计日志页面
**文件**: `frontend/src/pages/admin/AuditLogPage.tsx`
**问题**: 1个 placeholder
**方案**: 对接 `/api/v1/admin/audit-logs`

#### 4.2 数据库首页数据完善
**文件**: `frontend/src/pages/database/DashboardOverview.tsx`
**问题**: 61KB但依赖多个空表
**方案**: 优化空状态提示，添加引导操作

---

## 三、执行计划

### 第一批：修复API断裂（约30分钟）
1. [ ] 注册 terminology_router 到 main.py
2. [ ] 完善 ai.py 的 chat 端点
3. [ ] 验证所有API可访问性

### 第二批：种子数据（约20分钟）
4. [ ] 创建 experiments 种子数据
5. [ ] 创建 organizations 种子数据
6. [ ] 创建 terminology 种子数据
7. [ ] 创建 notifications/comments 种子数据

### 第三批：前端补全（约60分钟）
8. [ ] FormulaTemplatesPage 接入后端API
9. [ ] ExperimentDetailPage 消除11个TODO
10. [ ] OrganizationsPage 替换Mock数据
11. [ ] AnalyticsPage 数据对接优化
12. [ ] FormulaComparePage 补齐placeholder

### 第四批：验证与优化（约20分钟）
13. [ ] 全页面TS编译检查
14. [ ] 所有页面API连通测试
15. [ ] 浏览器人工验证

---

## 四、风险点

1. **术语API注册**: terminology.py 的 router prefix 是 `/api/terminology`，但前端调用 `/api/v1/terminology/*` — 需要调整前缀或前端调用路径
2. **AI聊天**: ai.py 当前为空壳，需要参考 chat_service.py 实现完整逻辑
3. **数据库连接**: 部分脚本测试时遇到 asyncpg 连接问题，需确保环境一致
