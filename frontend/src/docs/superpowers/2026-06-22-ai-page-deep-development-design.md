# AI 智能助手中心 — 深度开发设计方案

> **文档版本**: v1.0
> **编制人**: OWL（院士级 AI 系统架构专家）
> **日期**: 2026-06-22
> **页面**: http://localhost:3000/ai
> **密级**: 公开

---

## 1. 现状审计

### 1.1 页面结构

AI 智能助手中心 (`AIAssistantPage.tsx`, 731 行) 包含 **11 个 Tab**，分为 3 组：

| 分组 | Tab 数量 | Tab 列表 |
|------|---------|----------|
| 核心功能 | 4 | 智能对话、配方生成、安全检查、协同分析 |
| 高级分析 | 5 | 口感预测、稳定性评估、遗传优化、肽序列分析、肽设计优化 |
| 管理 | 2 | 知识库、配置管理 |

### 1.2 代码规模

| 文件 | 行数 | 深度评级 |
|------|------|---------|
| ChatTab.tsx | 663 | ⭐⭐⭐⭐⭐ 工业级 |
| MultiObjectivePanel.tsx | 2,445 | ⭐⭐⭐⭐⭐ 极深（过大） |
| GeneticAlgorithmPanel.tsx | 1,199 | ⭐⭐⭐⭐ 较深 |
| AdvancedPeptideDesign.tsx | 951 | ⭐⭐⭐ 中等 |
| AdvancedPeptideAnalyzer.tsx | 787 | ⭐⭐⭐⭐ 较深 |
| SafetyTab.tsx | 761 | ⭐⭐⭐⭐ 较深（有遗留） |
| StabilityPredictTab.tsx | 560 | ⭐⭐⭐⭐ 较深 |
| TastePredictTab.tsx | 488 | ⭐⭐⭐⭐ 较深 |
| GenerateTab.tsx | 239 | ⭐⭐⭐ 中等 |
| SynergyTab.tsx | 213 | ⭐⭐ 浅 |
| KnowledgeBasePanel.tsx | 141 | ⭐ 极浅 |
| AIAssistantPage.tsx | 731 | ⭐⭐⭐ 中等 |
| **合计** | **9,178** | |

### 1.3 关键问题

1. **SynergyTab (213 行)** — 纯输入+API+矩阵，无交互可视化、无本地降级
2. **KnowledgeBasePanel (141 行)** — 占位符级别，RAG 系统存在但管理界面缺失
3. **配置管理** — 内联 20 行，无实际管理功能
4. **硬编码统计数据** — 8 个统计卡片全部写死数字
5. **`as any` 类型丢失** — GenerateTab, StabilityTab, TastePredictTab 多处使用
6. **SafetyTab 遗留** — `// 模块?` 注释说明有未完成重构
7. **全局搜索** — 存在但无功能
8. **MultiObjectivePanel (2,445 行)** — 代码量过大，需拆分

---

## 2. 开发策略：分层批量开发

采用 **4 层分批策略**，每层独立可测试、可部署：

```
Layer 1: 基础设施层 (API 类型 + 统计真实化 + 搜索)
    ↓
Layer 2: 浅层 Tab (配置管理 + 知识库 + 协同分析)
    ↓
Layer 3: 中层 Tab (配方生成 + 肽分析/设计 + 稳定性 + 口感)
    ↓
Layer 4: 深层 Tab (安全检查 + 遗传优化 + 多目标优化 + 智能对话审核)
```

---

## 3. Layer 1 — 基础设施层

### 3.1 统一 API 类型体系

**目标文件**: `src/types/ai.api.ts`（新建）

**动作**:
1. 将 `src/api/ai.ts` 中所有 interface 迁移到此文件
2. 为 TastePredict 和 StabilityPredict 定义完整响应类型
3. 新增 `APIStatus` 类型用于统计卡片
4. 新增 `KnowledgeBaseStats` 类型
5. 消除所有 `as any` 类型断言

**影响范围**:
- `src/api/ai.ts` — 移除 interface 定义，改为 `export type { ... } from '@/types/ai.api'`
- `src/components/ai/features/TastePredictTab.tsx` — 移除 `as any`
- `src/components/ai/features/StabilityPredictTab.tsx` — 移除 `as any`
- `src/components/ai/features/GenerateTab.tsx` — 修复类型丢失

### 3.2 统计卡片真实化

**目标文件**: `src/hooks/useAISummaryStats.ts`（新建）

**动作**:
1. 创建 `useAISummaryStats` hook，调用 `GET /ai/stats/summary`
2. 替换 `AIAssistantPage.tsx` 中 8 个硬编码数字
3. 添加 loading skeleton（复用 `TabLoadingSkeleton` 模式）
4. 添加 error fallback（Toast 通知 + 重试按钮）

**API 契约**（后端需提供）:
```typescript
interface AISummaryStats {
  chatCount: number
  generateCount: number
  safetyChecks: number
  synergyCount: number
  tasteCount: number
  stabilityCount: number
  peptideAnalyzeCount: number
  peptideDesignCount: number
  knowledgeDocCount: number
  modelStatus: { llm: string; status: 'active' | 'inactive' }
}
```

### 3.3 全局搜索功能

**目标文件**: `src/components/ai/SearchModal.tsx`（新建）

**动作**:
1. 实现 `Ctrl+K` / `Cmd+K` 快捷键
2. 创建搜索模态框组件
3. 搜索范围：配方名称、药材名、分析结果标题
4. 调用 `GET /ai/search?q=...` 后端 API
5. 搜索结果按类型分组展示

---

## 4. Layer 2 — 浅层 Tab 深度开发

### 4.1 配置管理 Tab

**目标**: 从 20 行内联 → 300+ 行独立组件

**组件结构**:
```
src/components/ai/ConfigManagementPanel.tsx
├── 模型健康监控卡片
│   ├── 各模型延迟/成功率/错误率
│   └── 实时状态指示器
├── API Key 管理卡片
│   ├── 可视化配置/轮换
│   └── 复用 ApiKeyDiagnosticTool
├── 速率限制面板
│   ├── 配额使用进度条
│   └── 剩余请求数
└── 模型热切换
    └── 一键切换默认模型
```

**API 契约**（后端需提供）:
```typescript
interface ModelHealth {
  model: string
  latency_ms: number
  success_rate: number
  error_count: number
  uptime_percentage: number
}

interface RateLimitInfo {
  requests_per_minute: number
  requests_used: number
  requests_remaining: number
  reset_at: string
}
```

### 4.2 知识库 Tab

**目标**: 从 141 行 → 500+ 行

**组件结构**:
```
src/components/ai/KnowledgeBasePanel.tsx (重构)
├── 文档管理
│   ├── 上传/删除/搜索/分类
│   └── 文档列表 + 分页
├── 知识块可视化
│   ├── 文档→知识块→实体→关系图谱
│   └── 力导向图展示
├── 检索测试
│   ├── 输入查询词
│   └── 实时显示召回知识块和来源
└── 质量指标
    ├── 索引覆盖率
    ├── 知识块总数
    └── 最后更新时间
```

**与 RAG 联动**: 知识库管理的文档直接影响 `ChatTab` 的 RAG 增强效果，通过 `useRAGContext` 共享状态。

**API 契约**（后端需提供）:
```typescript
interface KnowledgeDoc {
  id: string
  title: string
  type: 'pdf' | 'txt' | 'md' | 'url'
  chunks_count: number
  uploaded_at: string
  last_indexed_at: string
}

interface KnowledgeChunk {
  id: string
  doc_id: string
  content: string
  embedding_dimension: number
  metadata: Record<string, unknown>
}
```

### 4.3 协同分析 Tab

**目标**: 从 213 行 → 400+ 行

**组件结构**:
```
src/components/ai/features/SynergyTab.tsx (重构)
├── 交互矩阵
│   ├── 可点击单元格
│   └── 悬停显示详细分析
├── 网络图谱
│   └── 力导向图展示协同/拮抗关系
├── 本地算法降级
│   └── 规则引擎基础协同评分
├── 历史对比
│   └── 保存多次分析结果
└── 八纲配伍可视化
    └── 相须/相使/相畏/相恶/相杀/相反/单行/复方
```

---

## 5. Layer 3 — 中层 Tab 深度开发

### 5.1 配方生成 Tab

**目标**: 从 239 行 → 500+ 行

**新增功能**:
- **配方对比视图**: 多候选配方并排对比，差异高亮
- **版本管理**: 迭代追踪、diff 对比、一键回滚
- **导出增强**: LaTeX/Word/Excel/PDF
- **配方收藏与标签**: 收藏、打标签、快速筛选
- **神经生成面板深化**: 激活热力图、决策解释

### 5.2 肽序列分析 Tab

**目标**: 从 787 行 → 900+ 行

**新增功能**:
- **ADMET 可视化**: 吸收/分布/代谢/排泄/毒性 雷达图
- **二级结构预测**: α-螺旋/β-折叠/无规卷曲 环形图
- **同源比对**: BLAST-like 序列比对
- **专利相似度**: 候选肽与已知专利相似度

### 5.3 肽设计优化 Tab

**目标**: 从 951 行 → 1,100+ 行

**新增功能**:
- **迭代优化器**: 种子→多轮优化→结果对比
- **多目标权重调节**: 活性/毒性/稳定性/可合成性 滑块
- **优化路径可视化**: 树状图展示演化路径

### 5.4 稳定性评估 Tab

**目标**: 从 560 行 → 700+ 行

**新增功能**:
- **保质期计算器**: 根据储存条件精确计算
- **加速老化模型**: Arrhenius 方程模拟
- **包装建议引擎**: 基于成分推荐材料

### 5.5 口感预测 Tab

**目标**: 从 488 行 → 600+ 行

**新增功能**:
- **五味映射表增强**: 成分→五味强度详细数据表
- **工艺影响分析**: 炮制/煎煮方法影响对比
- **口味偏好模拟**: 用户偏好→推荐匹配配方

---

## 6. Layer 4 — 深层 Tab 审核加固

### 6.1 安全检查 Tab

**目标**: 从 761 行 → 900+ 行

- 完成遗留重构，消除 `// 模块?` 注释
- 检查报告导出（PDF/JSON）
- 违规成分高亮 + 替代建议引擎

### 6.2 遗传优化 Tab

**目标**: 从 1,199 行 → 1,400+ 行

- 种群多样性热力图
- 进化收敛分析（自动检测收敛代数）
- 参数敏感性分析

### 6.3 多目标优化 Tab

**目标**: 从 2,445 行 → 1,800 行（**需拆分**）

- **拆分**: 将 DetailView 提取为独立组件
- **Pareto 前沿交互**: 点击前沿点显示候选详情
- **约束管理**: 可视化约束条件，实时调整

### 6.4 智能对话 Tab

**目标**: 从 663 行 → 审核加固（不增加代码量）

- 代码审查，消除残留 `as any`
- 确保所有 hooks 有单元测试
- 性能审计（消息列表虚拟化）

---

## 7. 工作量估算

| 层级 | 文件变更数 | 新增行数 | 删除行数 | 净增 |
|------|-----------|---------|---------|------|
| Layer 1 | 6 | 800 | 200 | +600 |
| Layer 2 | 3 | 1,200 | 200 | +1,000 |
| Layer 3 | 5 | 800 | 100 | +700 |
| Layer 4 | 4 | 300 | 800 | -500 |
| **合计** | **18** | **3,100** | **1,300** | **+1,800** |

预计总代码量从 **9,178 行 → ~11,000 行**。

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 后端 API 缺失 | 高 | 高 | Layer 1 先定义 API 契约，Mock 数据并行开发 |
| MultiObjectivePanel 拆分引入回归 | 中 | 高 | 拆分后运行完整 E2E 测试 |
| 知识库功能依赖 Neo4j | 中 | 中 | 先用本地文件系统模拟，后续接入 |
| 性能退化（组件增多） | 低 | 中 | 保持懒加载，添加性能监控 |

---

## 9. 成功标准

- [ ] 所有 `as any` 类型断言消除
- [ ] 统计卡片数据来自真实 API
- [ ] 全局搜索功能可用
- [ ] 配置管理 Tab 具备完整管理能力
- [ ] 知识库 Tab 支持文档 CRUD + 检索测试
- [ ] 协同分析 Tab 有交互可视化和本地降级
- [ ] MultiObjectivePanel 拆分为 ≤1200 行/文件
- [ ] 所有 Tab 通过后端 API + 本地降级双模式
- [ ] 无回归 bug（E2E 测试通过）
- [ ] 页面 Lighthouse 性能评分 ≥ 80

---

**文档结束**
**RMFOOD AI 团队**
**2026-06-22**
