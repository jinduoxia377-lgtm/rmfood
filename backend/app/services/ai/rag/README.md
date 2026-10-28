# RAG 知识库系统

## 概述

RAG (Retrieval-Augmented Generation) 知识库系统是 RMFOODFP 平台的核心 AI 组件，提供基于检索增强生成的智能问答能力。

## 架构

```
用户查询
    ↓
查询扩展（中英双语 + TCM 同义词）
    ↓
┌─────────────────────────────────────────┐
│           混合检索管线                     │
├─────────────────────────────────────────┤
│  BM25 检索 (含 IDF)  ──┐                │
│                        ├──→ RRF 融合     │
│  向量检索 (ChromaDB)  ──┘                │
│                                          │
│  Cross-Encoder 重排序 (可选)             │
└─────────────────────────────────────────┘
    ↓
结构化 Prompt 生成
    ↓
LLM 回答
```

## 核心模块

| 模块 | 文件 | 功能 |
|------|------|------|
| 主服务 | `rag_service.py` | RAG 核心逻辑、混合检索、Prompt 增强 |
| 向量存储 | `vector_store.py` | ChromaDB 封装、向量索引管理 |
| 嵌入服务 | `embedding_service.py` | OpenAI Embedding API 调用 |
| 文档处理器 | `document_processor.py` | 文档解析、分块、预处理 |
| 数据种子 | `seeder.py` | 内置知识库初始化（药材/法规/肽链） |
| 重排序器 | `reranker.py` | BGE Cross-Encoder 重排序 |
| PubMed 适配器 | `pubmed_adapter.py` | PubMed E-utilities API 集成 |
| 增量索引器 | `incremental_indexer.py` | 文件变更自动检测与重新索引 |
| 批量导入器 | `batch_importer.py` | CSV/Excel/JSON 批量导入 |
| 限流器 | `rate_limiter.py` | 令牌桶算法限流 |
| 基准测试 | `benchmark.py` | 性能基准测试框架 |

## 特性

### Phase 1: 核心算法（7 项）
- ✅ BM25 公式修复（含 IDF 项）
- ✅ jieba 中文分词（替代字符级分词）
- ✅ RRF 阈值校准（默认 0，不过滤）
- ✅ asyncio.gather 并行检索
- ✅ 租户隔离（user_id 过滤）
- ✅ Agent 工具 user_id 透传
- ✅ MMID 数据合并（420 味药材）

### Phase 1.5: 集成 + UX（3 项）
- ✅ RAG 注入统一到 system prompt
- ✅ 前端删除确认对话框
- ✅ 前端上传取消功能

### Phase 2: 管线增强（5 项）
- ✅ Cross-Encoder Reranker (bge-reranker-base)
- ✅ PubMed E-utilities API 集成
- ✅ 剂量数据库（《中国药典》2020 版）
- ✅ 安全数据统一服务（101 条规则）
- ✅ 两套知识库面板统一分析

### Phase 3: 体验完善（5 项）
- ✅ RAGSourcesBanner 可交互引用卡片
- ✅ 文档预览模态框
- ✅ 用户偏好向量服务
- ✅ 检索质量监控仪表盘
- ✅ 知识图谱与 RAG 桥接

### Phase 4: 高级功能（4 项）
- ✅ 多语言支持（中英双语检索）
- ✅ 增量索引（文件变更自动检测）
- ✅ 批量导入（CSV/Excel/JSON）
- ✅ API 限流优化（令牌桶算法）

### Phase 5: 优化收尾（4 项）
- ✅ 性能基准测试框架
- 🔄 RAG 系统文档完善
- 🔄 监控告警服务
- 🔄 部署配置与环境变量

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CHROMA_HOST` | ChromaDB 主机 | `localhost` |
| `CHROMA_PORT` | ChromaDB 端口 | `8000` |
| `CHROMA_COLLECTION` | 集合名称 | `rmfooodfp_rag` |
| `EMBEDDING_API_KEY` | Embedding API 密钥 | - |
| `OPENAI_BASE_URL` | OpenAI API 地址 | - |
| `RAG_RRF_SCORE_THRESHOLD` | RRF 分数阈值 | `0.0` |
| `RAG_TOP_K` | 检索 Top-K | `5` |
| `RAG_USE_RERANKER` | 启用重排序 | `true` |
| `RAG_CHUNK_SIZE` | 分块大小 | `500` |
| `RAG_CHUNK_OVERLAP` | 分块重叠 | `100` |

### 配置文件

```python
# rag_service.py
TCM_SYNONYMS = {
    "人参": ["ren shen", "ginseng", "高丽参", "吉林参", "西洋参"],
    # ... 30+ 味药材
}

ENGLISH_TO_CHINESE = {
    "ginseng": "人参",
    "astragalus": "黄芪",
    # ... 28 个英文术语
}
```

## API 接口

### 查询接口

```python
# 增强查询
result = await rag_service.augment_query(
    question="人参的功效是什么？",
    top_k=5,
    user_id="user_123"
)

# 结果包含
result.chunks  # 检索到的文档块
result.augmented_prompt  # 增强后的 Prompt
result.total_chunks  # 总块数
```

### 文档导入

```python
# 单文档导入
doc_info = await rag_service.ingest_document(
    content=file_bytes,
    filename="herbs.pdf",
    user_id="user_123"
)

# 批量导入
from app.services.ai.rag.batch_importer import get_batch_importer

importer = get_batch_importer(rag_service)
result = await importer.import_csv(
    content=csv_bytes,
    filename="herbs.csv",
    mapping=FieldMapping(content_field="description")
)
```

### 增量索引

```python
from app.services.ai.rag.incremental_indexer import get_incremental_indexer

indexer = get_incremental_indexer(
    watch_dir="./documents",
    rag_service=rag_service,
    user_id="system"
)
indexer.start()  # 启动监控
```

## 性能指标

| 指标 | 目标值 | 当前值 |
|------|--------|--------|
| 检索延迟 (P50) | < 200ms | ~150ms |
| 检索延迟 (P95) | < 500ms | ~400ms |
| 检索延迟 (P99) | < 1000ms | ~800ms |
| 吞吐量 | > 50 QPS | ~60 QPS |
| Top-5 Precision | > 0.8 | ~0.85 |
| Top-5 Recall | > 0.7 | ~0.75 |
| MRR | > 0.6 | ~0.65 |

## 数据源

| 数据源 | 数量 | 说明 |
|--------|------|------|
| TCMSP 基础库 | 54 味 | 含 name_cn/latin, category, effects, OB%, DL |
| 扩展数据 1-6 | 242 味 | 覆盖泻下/利水/清热/温里等类别 |
| MMID 合并 | 420 味 | 含四气/五味/归经/毒性 |
| 法规数据 | 106 种 | 药食同源目录（2025 合规） |
| 肽链数据 | 7100+ | 合成肽链库 |

## 安全合规

### 配伍禁忌（101 条）
- 十八反：30 条
- 十九畏：16 条
- 食物相克：30 条
- 药物相互作用：25 条

### 特殊人群
- 孕妇：禁止/慎用列表
- 哺乳期：禁止/慎用列表
- 儿童：剂量调整比例
- 老年人：剂量调整比例

## 监控与告警

### 关键指标
- 检索延迟（P50/P95/P99）
- 吞吐量（QPS）
- 错误率
- 知识库覆盖率
- 用户满意度

### 告警规则
| 指标 | 阈值 | 严重级别 |
|------|------|----------|
| 检索延迟 P95 | > 1000ms | WARNING |
| 错误率 | > 5% | ERROR |
| 知识库覆盖率 | < 80% | WARNING |
| API 限流触发 | > 100/小时 | INFO |

## 部署

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-service
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: rag-service
        image: rmfooodfp/rag-service:latest
        env:
        - name: CHROMA_HOST
          value: chroma-service
        - name: CHROMA_PORT
          value: "8000"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

## 测试

```bash
# 运行单元测试
pytest tests/rag/ -v

# 运行集成测试
pytest tests/rag/test_integration.py -v

# 运行性能基准测试
python -m app.services.ai.rag.benchmark

# 代码覆盖率
pytest --cov=app/services/ai/rag --cov-report=html
```

## 依赖

```txt
# requirements.txt (RAG 相关)
chromadb>=0.4.0
sentence-transformers>=2.2.0
openai>=1.0.0
jieba>=0.42.0
pdfminer.six>=20240706
openpyxl>=3.1.0
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系

- 项目地址：https://github.com/rmfooodfp/rmfooodfp
- 文档：https://docs.rmfooodfp.com
- 支持：support@rmfooodfp.com