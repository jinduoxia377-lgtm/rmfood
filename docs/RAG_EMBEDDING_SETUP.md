# RAG 知识库 Embedding 配置指南

> 适用范围：RMFOODFP 后端 RAG 知识库（`/api/v1/rag/*`，ChromaDB + Embedding + BM25/RRF）
> 更新时间：2026-10-22

## 背景

知识库的「向量化」依赖 Embedding 服务。后端 `backend/app/services/ai/rag/embedding_service.py` 支持三种提供方：

| 提供方 | 环境变量 | 是否需要 API Key | 适用场景 |
|--------|----------|------------------|----------|
| `local` | `EMBEDDING_PROVIDER=local` | 否（离线） | 开发/内网/无外网 |
| `deepseek` | `EMBEDDING_PROVIDER=deepseek` + `OPENAI_API_KEY` | 是 | 已有 DeepSeek Key |
| `openai` | `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` | 是 | 已有 OpenAI Key |

> ⚠️ 若**不设置** `EMBEDDING_PROVIDER`，会回退到 `LLM_PROVIDER`（当前项目为 `deepseek`），此时 seed 需要有效的 `OPENAI_API_KEY`。没有有效 Key 时，`POST /api/v1/rag/seed` 会返回 `seeded=false`、`documents=0`（这是**正确的**降级行为，前端会如实提示「知识库初始化失败」）。

## 方案 A：本地 Embedding（推荐，离线可用）

### 1. 安装依赖

```bash
cd D:\RMFOODFP\backend
pip install fastembed
```

> 本项目使用的 Python 环境示例：`D:\RMFOODFP\.venv\Scripts\pip.exe install fastembed`

### 2. 配置环境变量

在 `backend/.env` 中设置：

```dotenv
EMBEDDING_PROVIDER=local
# 可选：EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5
```

默认模型为 `BAAI/bge-small-zh-v1.5`（384 维，中文优化）。首次加载会自动下载模型（约 100MB）。

> 💡 本机已检测到 HuggingFace 缓存中存在 `models--BAAI--bge-small-zh-v1.5`，安装 `fastembed` 后**无需再下载**，可直接离线使用。

### 3. 触发知识库种子注入

后端 `uvicorn --reload` 会自动加载新环境变量；若未自动生效，需人工重启后端（本项目约定不擅自重启进程）。

```bash
curl -X POST "http://localhost:8000/api/v1/rag/seed"
```

期望响应：

```json
{ "seeded": true, "documents": 3, "total_chunks": 123, "files": ["tcm_herb_encyclopedia.md", "food_homology_catalog.md", "food_safety_regulations.md"] }
```

### 4. 验证

```bash
curl "http://localhost:8000/api/v1/rag/seed/status"
# 期望：{"is_seeded": true, "total_chunks": >0, "documents": [...]}

curl "http://localhost:8000/api/v1/rag/search?question=人参的功效&top_k=3"
# 期望：{"success": true, "data": {"chunks": [...]}}
```

## 方案 B：DeepSeek Embeddings API

```dotenv
EMBEDDING_PROVIDER=deepseek
OPENAI_API_KEY=sk-你的deepseek密钥
# OPENAI_BASE_URL=https://api.deepseek.com/v1   # 不设置时自动使用 deepseek 默认地址
# EMBEDDING_MODEL=deepseek-embedding
```

## 方案 C：OpenAI Embeddings API

```dotenv
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-你的openai密钥
# OPENAI_BASE_URL=https://api.openai.com/v1
# EMBEDDING_MODEL=text-embedding-3-small
```

## 常见问题

- **seed 返回 `seeded=false, documents=0`**：说明 Embedding 不可用（未安装 fastembed / API Key 无效 / 网络不通）。按上面方案配置后重试。
- **seed 返回 `seeded=true, documents=0`**：这是已修复的旧 bug（2026-10-22 已修复）。若仍出现，请检查 `backend/app/services/ai/rag/seeder.py` 是否为最新。
- **如何确认本地模型可用**：

```bash
python -c "from fastembed import TextEmbedding; m=TextEmbedding(model_name='BAAI/bge-small-zh-v1.5'); v=list(m.embed(['人参']))[0]; print(len(v))"
# 期望输出：384
```

## 相关文件

- `backend/app/services/ai/rag/embedding_service.py`（Embedding 服务）
- `backend/app/services/ai/rag/seeder.py`（内置知识注入）
- `backend/app/api/rag_router.py`（RAG API）
- `backend/.env.example`（配置示例，已含 EMBEDDING_* 注释）