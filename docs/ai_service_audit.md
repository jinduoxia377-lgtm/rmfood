# AI 服务裁剪评估报告

**日期**: 2026-06-30
**范围**: `backend/app/services/ai/` (41 个文件)

## 调用链分析

### 直接被 API 端点调用的模块（活跃）

| 模块 | 调用方 | 用途 |
|------|--------|------|
| `rag/rag_service.py` | `api/rag_router.py` | RAG 检索增强生成 |
| `rag/seeder.py` | `api/rag_router.py` | RAG 种子数据 |
| `multi_objective_optimizer.py` | `api/v1/ai_router.py` | 多目标优化 |
| `diagnostic_engine.py` | `api/v1/ai_router.py` | AI 诊断引擎 |

### 被其他 AI 模块间接调用的（传递活跃）

| 模块 | 被谁调用 | 用途 |
|------|---------|------|
| `unified_optimizer.py` | 自身内部 | 统一优化器，调用下方所有优化器 |
| `bayesian_formula_optimizer.py` | unified_optimizer, nutrition_adapter | 贝叶斯公式优化 |
| `genetic_formula_optimizer.py` | unified_optimizer | 遗传算法优化 |
| `binary_ga_optimizer.py` | unified_optimizer | 二进制 GA 优化 |
| `connection_pool.py` | 自身 | AI 连接池管理 |
| `metrics_collector.py` | 自身 | AI 指标收集 |
| `request_queue.py` | 自身 | 请求队列 |
| `alerting.py` | 自身 | 告警引擎 |
| `provider_factory.py` | `llm_service.py` | LLM 提供商工厂 |

### 未被任何地方引用的模块（死代码，建议删除）

| 模块 | 文件大小(估) | 说明 |
|------|-------------|------|
| `moead_cmaes_strategies.py` | ~200行 | MOEA/D-CMAES 策略，无调用方 |
| `neural_formula_network.py` | ~300行 | 神经网络公式网络，无调用方 |
| `super_intelligence_ensembler.py` | ~250行 | 超级智能集成器，无调用方 |
| `multimodal_engine.py` | ~200行 | 多模态引擎，无调用方 |
| `structure_analyzer.py` | ~150行 | 结构分析器，无调用方 |
| `syntax_checker.py` | ~150行 | 语法检查器，无调用方 |
| `effectiveness_predictor.py` | ~200行 | 有效性预测器，无调用方 |
| `herb_peptide_bridge.py` | ~150行 | 草药-肽桥接，无调用方 |
| `inference_queue.py` | ~100行 | 推理队列，无调用方 |
| `inference_store.py` | ~100行 | 推理存储，无调用方 |
| `convergence_analyzer.py` | ~150行 | 收敛分析器，无调用方 |
| `template_service.py` | ~200行 | 模板服务，无调用方 |
| `recommendation_engine.py` | ~200行 | 推荐引擎，无调用方 |
| `generation_service.py` | ~200行 | 生成服务，无调用方 |
| `herb_knowledge_service.py` | ~200行 | 草药知识服务，无调用方 |
| `chat_engine.py` | ~200行 | 聊天引擎，无调用方 |
| `formula_service.py` | ~150行 | AI 配方服务，无调用方 |
| `llm_provider.py` | ~200行 | LLM 提供者，无调用方 |

## 结论

- **活跃模块**: 8 个（直接被 API 或传递调用）
- **死代码模块**: 18 个（无任何调用方）
- **可安全删除**: 18 个死代码模块（约 3000+ 行）
- **建议保留待评估**: 4 个（`provider_factory`, `connection_pool`, `metrics_collector`, `request_queue`, `alerting` — 这些是基础设施模块，可能被未来功能使用）

## 风险

- 低：所有死代码模块均无任何 import 引用，删除不会影响现有功能
- 中：`nutrition_adapter.py`（非 AI 服务）引用了 `bayesian_formula_optimizer`，该模块属于活跃模块，不应删除
