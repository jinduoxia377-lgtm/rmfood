# ADR-010: AI/ML 服务集成架构策略

## 状态
OK 已接受 (2026-06-15)

## 上下文

RMFOOD 平台深度集成 AI 能力:
1. LLM 对话 (配方建议、学术报告生成)
2. RAG 检索增强生成 (知识图谱 + 向量检索)
3. 多肽分析算法 (ACE抑制、安全性评分)
4. 遗传算法配方优化 (多目标优化)
5. 外部 API 集成 (UniProt, Swiss-Prot, ChEMBL)

## 决策

### AI 服务分层架构

- Provider 层: 抽象 LLM 提供商 (OpenAI, Anthropic, 本地)
- RAG 层: 文档分块、向量化、向量存储 (pgvector)
- Algorithm 层: 多肽分析、遗传算法优化
- Knowledge 层: 知识图谱 (Neo4j) + 向量数据库
- Application 层: 配方建议、学术报告、安全分析

### 关键约定

- 所有 AI 调用通过统一 client 层 (支持 fallback)
- 向量嵌入: 768 维 (text-embedding-3-large 兼容)
- 知识图谱: Neo4j 5.x, 配方-成分-多肽关系网络
- 算法复用: 多肽分析结果缓存 (Redis, TTL=24h)

## 实施检查清单

- [x] LLM Provider 抽象层
- [x] RAG 全链路 (分块 → 向量化 → 检索 → 生成)
- [x] 多肽分析算法 (v2)
- [x] 遗传算法优化器
- [x] Neo4j 知识图谱集成
- [x] AI 服务熔断与降级
- [ ] 多模型自动路由 (计划 v2.0)
- [ ] 模型微调管道 (计划 v2.0)
