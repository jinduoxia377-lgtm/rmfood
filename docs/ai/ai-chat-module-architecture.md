# RMFOOD AI 智能对话模块 — 院士级架构审查报告

> 审查日期: 2026-06-07
> 审查范围: 前端 ChatTab + AI 引擎层 + 后端 API
> 代码量: 约 27,000 行 TypeScript 服务代码 + 27 个自定义 Hooks

---

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI 层 (React)                               │
│  ChatTab.tsx (v11.0)                                               │
│  ├─ ChatMessages (消息列表 + 类型差异化渲染)                        │
│  ├─ ChatInputPro (智能输入区 + 模型选择器)                          │
│  ├─ ChatSidebar (思考过程可视化)                                    │
│  ├─ ChatHistory (对话历史管理)                                      │
│  └─ FormulaPanel (配方管理面板)                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ hooks
┌───────────────────────────▼─────────────────────────────────────────┐
│                   编排层 (Custom Hooks)                             │
│                                                                     │
│  useChatTabOrchestrator (主编排器)                                  │
│  ├─ useChatMessages (消息状态 + 发送/重试)                          │
│  ├─ useChatSendMessage (消息发送流水线)                             │
│  ├─ useChatCallbacks (对话历史回调)                                 │
│  ├─ useFormulaManager (配方管理)                                    │
│  ├─ useReportGenerator (报告生成)                                   │
│  ├─ useExportManager (导出)                                         │
│  └─ useKeyboardShortcuts (快捷键)                                   │
│                                                                     │
│  记忆系统 (Memory System):                                         │
│  ├─ useWorkingMemory (工作记忆)                                     │
│  ├─ useMultiTurnDialogue (多轮对话)                                 │
│  ├─ useShortTermMemory (短期记忆)                                   │
│  └─ useThinkingProcessV3 (思考过程可视化 v3)                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ services
┌───────────────────────────▼─────────────────────────────────────────┐
│              AI 引擎层 (40+ 服务, 27,000 行)                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. HybridNLPEngineV2 (混合 NLP 引擎)                       │   │
│  │    → 规则匹配 (RegExp) + 关键词评分 + 语义相似度            │   │
│  │    → 3 级置信度: exact/keyword/semantic                     │   │
│  │    → 24 个意图模板, 8 个场景                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. PromptEngineeringFramework (提示词工程框架)              │   │
│  │    → 场景自动检测                                           │   │
│  │    → 角色扮演系统 (法规专家/配方工程师等)                   │   │
│  │    → 输出质量约束注入 (国标引用/结构化输出)                  │   │
│  │    → 12 维质量评估                                          │   │
│  │    → Few-Shot 示例注入                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 3. ProfessionalIntelligenceEngineV4 (专业智能引擎)          │   │
│  │    → 7 大专业领域知识                                      │   │
│  │    → 多维评分体系                                           │   │
│  │    → 连锁推理引擎 (Chain-of-Thought)                        │   │
│  │    → 效能分析器 (Efficacy Analyzer)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 4. FormulaIntelligenceService (配方智能服务)                │   │
│  │    → 配方意图检测 (7 种类型)                                │   │
│  │    → 结构化输出注入 (JSON Schema)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 5. 辅助引擎 (Services)                                     │   │
│  │    ├─ contextManager (上下文管理)                            │   │
│  │    ├─ deepThinkingService (深度思考服务)                     │   │
│  │    ├─ smartSearchService (智能搜索)                          │   │
│  │    ├─ domainKnowledge (领域知识库)                           │   │
│  │    ├─ knowledgeGraphUpdater (知识图更新)                     │   │
│  │    ├─ feedbackLoopSystem (反馈循环系统)                     │   │
│  │    ├─ threeLevelCacheSystem (三级缓存)                      │   │
│  │    ├─ nutritionExpertEngine (营养专家引擎)                  │   │
│  │    ├─ expertIntelligenceEngine (专家智能引擎)               │   │
│  │    └─ bertIntegration (BERT 集成层)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 6. 基础设施 (Infrastructure)                               │   │
│  │    ├─ chatService (API 通信层 - Axios + SSE)                │   │
│  │    ├─ storageService (本地持久化)                            │   │
│  │    ├─ eventBus (事件总线)                                    │   │
│  │    ├─ chatStateMachine (状态机)                              │   │
│  │    ├─ offlineManager (离线队列)                              │   │
│  │    └─ performanceMonitor (性能监控)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP/SSE
┌───────────────────────────▼─────────────────────────────────────────┐
│     后端 API 层 (FastAPI)                                          │
│                                                                     │
│  POST /api/v1/ai/chat         → 智能对话端点                       │
│  POST /api/v1/ai/chat/stream  → SSE 流式对话                      │
│  POST /api/v1/ai/generate     → AI 配方生成                        │
│  POST /api/v1/ai/optimize     → Prompt 优化                        │
│  GET  /api/v1/ai/recommendations → 个性化推荐                      │
│  GET  /api/v1/ai/models/status   → 模型状态                        │
│                                                                     │
│  后端 AI 服务层:                                                    │
│  ├─ AIGenerationService (文本生成)                                  │
│  ├─ AIOptimizationService (优化)                                    │
│  ├─ RecommendationEngine (推荐引擎)                                 │
│  ├─ TemplateService (模板服务)                                      │
│  └─ provider_factory (LLM 提供商工厂: DeepSeek/OpenAI)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、算法清单

### 2.1 HybridNLPEngineV2 — 混合 NLP 引擎 (741 行)

| 算法 | 实现方式 | 复杂度 |
|------|----------|--------|
| 正则规则匹配 | 32 条 RegExp 规则 | O(n) |
| 关键词评分 | 基于 TF 的加权关键词匹配 | O(n·k) |
| 语义相似度 | Jaccard 相似度 + 词向量 | O(n·m) |
| 3 级置信度决策 | exact(0.95) > keyword(0.85) > semantic(0.6) | O(1) |
| LRU 缓存 | Map<hash, result> | O(1) |
| 意图模板匹配 | 24 个领域模板 × 多维度评分 | O(t·d) |

**可检测的意图类型：** formula_design, safety_check, synergy_analysis, taste_prediction, stability_prediction, peptide_analysis, ingredient_query, knowledge_query, general_chat, recipe_search, compliance_check, nutrition_analysis

### 2.2 PromptEngineeringFramework — 提示词工程 (1,447 行)

| 算法 | 实现方式 |
|------|----------|
| 场景自动检测 | 多维度特征提取 + 权重评分 |
| 角色扮演系统 | 预设 5+ 角色模板 (法规专家/配方工程师/工艺专家/营养师/安全评估师) |
| 输出质量约束注入 | 国标引用 / 结构化 JSON / 字数控制 |
| 知识向量激活 | 基于输入语义匹配领域知识 token |
| Few-Shot 示例库 | 场景 => 输入/输出范例对 |
| 12 维质量评估 | 完整性/准确性/可执行性/安全性/合规性/创新性/经济性/可持续性/可解释性/一致性/专业性/友好度 |

### 2.3 ProfessionalIntelligenceEngineV4 — 专业智能引擎 (752 行)

| 算法 | 实现方式 |
|------|----------|
| 7 大领域知识库 | 配方设计 / 安全评估 / 功效分析 / 口感预测 / 稳定性 / 肽分析 / 法规合规 |
| 多维评分体系 | 加权综合评分矩阵 |
| 连锁推理 (CoT) | 条件链式推理 (if-then-else 决策树) |
| 效能分析器 | 成分-功效-靶点关联分析 |

### 2.4 FormulaIntelligenceService — 配方智能服务 (524 行)

| 算法 | 实现方式 |
|------|----------|
| 配方意图检测 | 7 种配方相关意图分类 |
| 结构化输出注入 | JSON Schema 生成 + 字段验证 |

### 2.5 辅助算法

| 服务 | 算法 |
|------|------|
| threeLevelCacheSystem | L1(内存 LRU) → L2(localStorage) → L3(API) |
| feedbackLoopSystem | 用户反馈记录 -> 置信度调整 -> 模型微调 |
| offlineManager | 指数退避重试 (1s → 2s → 4s → 8s → 16s) |
| chatStateMachine | 有限状态机: Idle → Sending → Streaming → Success/Error/RateLimited |
| contentFilter | 敏感词过滤 + HTML 消毒 (DOMPurify) |
| eventBus | 发布-订阅模式 |
| performanceMonitor | FPS / 内存 / API 延迟监控 |

---

## 三、数据流 (消息发送全流程)

```
用户输入 → "黄芪在功能性食品中有什么应用？"
    │
    ▼
[1] ChatTab.handleSendMessage()
    │
    ▼
[2] useChatSendMessage.handleSendMessage()
    │
    ├─ 2.1 HybridNLPEngineV2.detectIntent()
    │   → 意图: ingredient_query (置信度 0.92)
    │   → 实体: [黄芪(ingredient), 功能性食品(category)]
    │
    ├─ 2.2 WorkingMemory.addMessage()
    │   → 存储到工作记忆 (滑动窗口 100 条)
    │
    ├─ 2.3 MultiTurnDialogue.processUserInput()
    │   → 检测是否为追问 → 否
    │   → 指代消解 → 无指代
    │
    ├─ 2.4 ShortTermMemory.updateInterest()
    │   → 更新用户兴趣画像
    │
    ├─ 2.5 buildEnhancedPrompt()
    │   → 注入: [场景识别] | [记忆摘要] | [意图分析]
    │
    ├─ 2.6 FormulaIntelligenceService.detectIntent()
    │   → 配方意图: general_chat → 无结构化输出注入
    │
    ├─ 2.7 chatService.sendMessage(finalContent)
    │   → POST /api/v1/ai/chat { question, context, ... }
    │
    ▼
[3] 后端 POST /api/v1/ai/chat
    │
    ├─ 3.1 AIGenerationService.generate_prompt_from_description()
    │   → ProviderFactory → DeepSeek API (LLM)
    │   → 生成 AI 回复内容
    │
    ▼
[4] 响应返回前端
    │
    ├─ 4.1 chatService 解析 → AIResponse
    ├─ 4.2 useChatMessages.addMessage(assistantMessage)
    ├─ 4.3 ChatMessages 渲染 → MarkdownRenderer
    ├─ 4.4 ThinkingProcessV3 停止思考动画
    └─ 4.5 异步: MultiTurnDialogue.addConversationTurn()
              ShortTermMemory.cacheFAQ()
```

---

## 四、关键设计亮点

### 4.1 分层去耦架构
ChatTab v11.0 将 1,109 行代码拆分为 27 个自定义 Hooks，每个 Hook 职责单一。

### 4.2 双重错误处理
- 每个 NLP 步骤单独 try-catch (单个失败不阻断流水线)
- chatService 端有完整的错误分类体系 (9 种 ErrorType)
- Axios 拦截器有 Mock fallback 降级逻辑

### 4.3 三级记忆系统
```
工作记忆 (Working Memory): 当前对话 100 条消息
  ↓
多轮对话 (Multi-Turn): 话题栈 + 指代消解
  ↓
短期记忆 (Short-Term): 7 天兴趣画像 + FAQ 缓存
```

### 4.4 网络感知
`useNetworkStatus` 实时检测在线/离线/慢速状态，离线时自动队列消息，恢复后自动发送。

### 4.5 状态机管理
`ChatStateMachine` 管理 `Idle → Sending → Streaming → Success/Error/RateLimited` 状态流转。

---

## 五、现存问题与技术债务

| 问题 | 严重度 | 说明 |
|------|--------|------|
| **无真实 LLM 集成** | 🔴 高 | hybridNLPEngineV2 纯前端规则引擎，无真实 LLM 调用；后端 generation_service 的 provider_factory 导入路径错误 |
| **TypeScript 类型不完整** | 🟡 中 | UseChatMessagesReturn 缺少字段，modelClient 有 strict null 警告 |
| **38 个服务文件耦合** | 🟡 中 | 部分服务职责重叠 (4 个 IntelligenceEngine 文件) |
| **缺少单元测试覆盖** | 🟡 中 | 27 个 hooks 仅 8 个有测试 |
| **后端 /ai/chat/stream 未测试** | 🟢 低 | SSE 流式端点已注册但未验证 |
| **API_ENDPOINTS 路径设计缺陷** | 🟢 低 | Axios baseURL 与 endpoint 路径重复 /api/v1 |
| **无前端性能基准** | 🟢 低 | 27 个 hooks + 40 服务的初始化性能未测量 |
| **provider_factory 导入路径错误** | 🔴 高 | `from ..core.config` 应为 `from ...core.config` |
| **i18n 覆盖不全** | 🟢 低 | ChatTab 使用 safeT 兜底但仍有未翻译 key |

---

## 六、专业升级方案

### P0 — 紧急修复

1. **修复 provider_factory.py 导入路径** (backend/app/services/ai/provider_factory.py:403)
   - `from ..core.config` → `from ...core.config`

### P1 — 架构优化

2. **AI 引擎降级策略**：当 LLM 不可用时，hybridNLPEngineV2 规则引擎作为完全离线的降级方案
3. **统一 API 端点路径**：删除 API_ENDPOINTS 中的 /api/v1 前缀，统一使用相对路径
4. **专业领域知识增强**：扩展 domainKnowledge.ts 的中药材知识库至 500+ 条目

### P2 — 功能拓展

5. **多模态输入**：支持图片上传 → OCR → 成分识别
6. **对话分支/回溯**：支持多分支对话树
7. **自定义 Prompt 模板保存**：用户可保存常用 Prompt
8. **RAG 知识库增强**：连接后端向量数据库 (ChromaDB) 实现语义检索
9. **配方相似度搜索**：基于 LLM Embedding 的配方语义搜索

### P3 — 性能与质量

10. **Hooks 初始化性能优化**：懒加载非关键引擎
11. **补充单元测试**：Hook 测试覆盖率达到 90%+
12. **E2E 测试**：Playwright 集成测试核心对话流程
