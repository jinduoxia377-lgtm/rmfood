# AI 对话模块 Phase 2: RAG 知识库问答系统 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 构建基于 RAG（检索增强生成）的知识库问答系统，使用户能上传配方文档并基于文档内容进行 AI 问答

**Architecture:** 后端使用 ChromaDB（轻量级向量数据库）+ embedding API，前端新增知识库管理面板，与现有 ChatTab 集成实现上下文增强

**Tech Stack:** Python 3.14, FastAPI, ChromaDB, React 19, TanStack Query

---

### Task 1: 安装依赖 + 创建 RAG 基础设施

**Files:**
- Modify: `backend/requirements.txt` (add chromadb)
- Create: `backend/app/services/ai/rag/__init__.py`
- Create: `backend/app/services/ai/rag/document_processor.py` (PDF/text chunking)
- Create: `backend/app/services/ai/rag/vector_store.py` (ChromaDB wrapper)
- Create: `backend/app/services/ai/rag/models.py` (Data models)

- [ ] **Step 1: Install chromadb**

Run: `cd /d/RMFOOD配方平台 && .venv/Scripts/python.exe -m pip install chromadb`

- [ ] **Step 2: Create RAG package structure**

```bash
mkdir -p /d/RMFOOD配方平台/backend/app/services/ai/rag
touch /d/RMFOOD配方平台/backend/app/services/ai/rag/__init__.py
```

- [ ] **Step 3: Create `backend/app/services/ai/rag/models.py`**

```python
"""RAG 数据模型"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentChunk(BaseModel):
    """文档分块"""
    id: str
    content: str
    metadata: dict = Field(default_factory=dict)
    embedding: Optional[list[float]] = None


class ChunkResult(BaseModel):
    """检索结果"""
    chunk: DocumentChunk
    score: float


class RAGQueryResult(BaseModel):
    """RAG 查询结果"""
    chunks: list[ChunkResult]
    augmented_prompt: str
    total_chunks: int


class DocumentInfo(BaseModel):
    """文档信息"""
    id: str
    filename: str
    content_type: str
    chunk_count: int
    created_at: datetime
    file_size: int
```

- [ ] **Step 4: Create `backend/app/services/ai/rag/document_processor.py`**

```python
"""文档处理器 — PDF/文本解析与分块"""
import re
import hashlib
from typing import Optional
from .models import DocumentChunk


class DocumentProcessor:
    """文档解析与分块"""

    CHUNK_SIZE = 500       # 每块字符数
    CHUNK_OVERLAP = 50     # 块间重叠字符数

    def extract_text(self, content: bytes, filename: str) -> str:
        """根据文件类型提取文本"""
        ext = filename.lower().split('.')[-1] if '.' in filename else ''

        if ext == 'pdf':
            return self._extract_pdf(content)
        elif ext in ('txt', 'md'):
            return content.decode('utf-8', errors='replace')
        elif ext == 'csv':
            return self._extract_csv(content)
        else:
            # 默认按文本处理
            return content.decode('utf-8', errors='replace')

    def _extract_pdf(self, content: bytes) -> str:
        """从 PDF 提取文本（简易实现）"""
        try:
            import PyPDF2
            from io import BytesIO
            reader = PyPDF2.PdfReader(BytesIO(content))
            texts = []
            for page in reader.pages:
                texts.append(page.extract_text() or '')
            return '\n'.join(texts)
        except ImportError:
            # fallback: 尝试 pdfminer
            try:
                from io import BytesIO
                from pdfminer.high_level import extract_text
                return extract_text(BytesIO(content))
            except ImportError:
                return "[PDF 解析需要安装 PyPDF2 或 pdfminer.six]"

    def _extract_csv(self, content: bytes) -> str:
        """CSV 转文本"""
        try:
            import csv
            from io import StringIO
            text = content.decode('utf-8', errors='replace')
            reader = csv.reader(StringIO(text))
            rows = []
            for row in reader:
                rows.append(' | '.join(row))
            return '\n'.join(rows)
        except Exception:
            return content.decode('utf-8', errors='replace')

    def chunk_text(self, text: str, filename: str = "") -> list[DocumentChunk]:
        """将文本分割为重叠块"""
        # 清理文本
        text = re.sub(r'\s+', ' ', text).strip()
        if not text:
            return []

        chunks = []
        start = 0
        while start < len(text):
            end = start + self.CHUNK_SIZE
            if end >= len(text):
                end = len(text)
            else:
                # 在边界附近找句子结尾
                search_start = max(start + self.CHUNK_SIZE - 100, start)
                last_period = text.rfind('。', search_start, end)
                last_newline = text.rfind('\n', search_start, end)
                split_at = max(last_period, last_newline)
                if split_at > search_start:
                    end = split_at + 1

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunk_id = hashlib.md5(chunk_text.encode()).hexdigest()[:12]
                chunks.append(DocumentChunk(
                    id=f"chunk_{chunk_id}",
                    content=chunk_text,
                    metadata={"source": filename, "chunk_index": len(chunks)},
                ))

            start = end - self.CHUNK_OVERLAP

        return chunks
```

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/services/ai/rag/
git commit -m "feat(rag): add document processor and RAG models"
```

---

### Task 2: ChromaDB 向量存储封装

**Files:**
- Create: `backend/app/services/ai/rag/vector_store.py` (update)
- Create: `backend/app/services/ai/rag/embedding_service.py`

- [ ] **Step 1: Update `vector_store.py`**

```python
"""向量存储 — ChromaDB 封装"""
import os
from typing import Optional
import chromadb
from chromadb.config import Settings
from .models import DocumentChunk, ChunkResult


class VectorStore:
    """ChromaDB 向量数据库封装"""

    def __init__(self, persist_dir: str = "data/chromadb"):
        self.persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self.collection_name = "rag_documents"

    @property
    def collection(self):
        return self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list[DocumentChunk], embeddings: list[list[float]]):
        """批量添加文档块"""
        if not chunks:
            return
        self.collection.add(
            ids=[c.id for c in chunks],
            documents=[c.content for c in chunks],
            metadatas=[c.metadata for c in chunks],
            embeddings=embeddings,
        )

    def search(self, query_embedding: list[float], top_k: int = 5) -> list[ChunkResult]:
        """向量检索"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
        if not results["ids"]:
            return []

        chunks = []
        for i in range(len(results["ids"][0])):
            chunk = DocumentChunk(
                id=results["ids"][0][i],
                content=results["documents"][0][i],
                metadata=results["metadatas"][0][i] if results["metadatas"] else {},
            )
            score = 1 - results["distances"][0][i] if results["distances"] else 0
            chunks.append(ChunkResult(chunk=chunk, score=score))

        return chunks

    def list_documents(self) -> list[str]:
        """列出所有文档源"""
        all_meta = self.collection.get(include=["metadatas"])
        sources = set()
        for meta in all_meta["metadatas"]:
            if meta and "source" in meta:
                sources.add(meta["source"])
        return sorted(sources)

    def delete_document(self, filename: str):
        """删除指定文档的所有块"""
        self.collection.delete(where={"source": filename})

    def count_chunks(self) -> int:
        """统计块总数"""
        return self.collection.count()
```

- [ ] **Step 2: Create `backend/app/services/ai/rag/embedding_service.py`**

```python
"""Embedding 服务 — 支持多种 embedding API"""
import json
import os
from typing import Optional
import httpx


class EmbeddingService:
    """向量化服务

    支持策略：
    1. OpenAI Embeddings API
    2. DeepSeek Embeddings API
    3. 本地 sentence-transformers（需安装）
    """

    def __init__(self, provider: str = "openai", api_key: Optional[str] = None):
        self.provider = provider
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.base_url = os.getenv("EMBEDDING_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量文本向量化"""
        if not texts:
            return []

        try:
            return await self._embed_via_api(texts)
        except Exception as e:
            # fallback: 简单哈希向量（仅用于开发测试）
            return self._embed_fallback(texts)

    async def _embed_via_api(self, texts: list[str]) -> list[list[float]]:
        """调用 Embedding API"""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": texts,
                    "encoding_format": "float",
                },
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]

    def _embed_fallback(self, texts: list[str]) -> list[list[float]]:
        """开发用 fallback：基于哈希的简单向量（不推荐生产使用）"""
        import hashlib
        result = []
        for text in texts:
            h = hashlib.sha256(text.encode()).digest()
            # 归一化到 128 维
            vec = [b / 255.0 for b in h[:128]]
            result.append(vec)
        return result
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/ai/rag/vector_store.py backend/app/services/ai/rag/embedding_service.py
git commit -m "feat(rag): add vector store and embedding service"
```

---

### Task 3: RAG 主服务 + API 路由

**Files:**
- Create: `backend/app/services/ai/rag/rag_service.py`
- Create: `backend/app/api/rag_router.py`
- Modify: `backend/app/api/__init__.py` (register router)

- [ ] **Step 1: Create `backend/app/services/ai/rag/rag_service.py`**

```python
"""RAG 主服务 — 文档处理 + 向量检索 + Prompt 增强"""
import os
import uuid
from datetime import datetime
from typing import Optional
from .models import DocumentChunk, ChunkResult, RAGQueryResult, DocumentInfo
from .document_processor import DocumentProcessor
from .vector_store import VectorStore
from .embedding_service import EmbeddingService


class RAGService:
    """RAG 检索增强生成服务"""

    def __init__(self):
        self.processor = DocumentProcessor()
        self.vector_store = VectorStore()
        self.embedding_service = EmbeddingService()

    async def ingest_document(self, content: bytes, filename: str) -> DocumentInfo:
        """导入文档：解析 → 分块 → 向量化 → 存储"""
        # 1. 提取文本
        text = self.processor.extract_text(content, filename)

        # 2. 分块
        chunks = self.processor.chunk_text(text, filename)

        if not chunks:
            raise ValueError(f"无法从 {filename} 中提取内容")

        # 3. 向量化
        texts = [c.content for c in chunks]
        embeddings = await self.embedding_service.embed_texts(texts)

        # 4. 存储
        self.vector_store.add_chunks(chunks, embeddings)

        return DocumentInfo(
            id=str(uuid.uuid4()),
            filename=filename,
            content_type=filename.split('.')[-1] if '.' in filename else 'unknown',
            chunk_count=len(chunks),
            created_at=datetime.now(),
            file_size=len(content),
        )

    async def query(self, question: str, top_k: int = 5) -> RAGQueryResult:
        """查询：向量检索 → Prompt 增强"""
        # 1. 向量化问题
        embeddings = await self.embedding_service.embed_texts([question])
        if not embeddings:
            return RAGQueryResult(chunks=[], augmented_prompt=question, total_chunks=0)

        # 2. 检索相关块
        chunks = self.vector_store.search(embeddings[0], top_k=top_k)

        # 3. 构建增强 Prompt
        if chunks:
            context = "\n\n---\n".join([
                f"[来源: {c.chunk.metadata.get('source', '未知')}]\n{c.chunk.content}"
                for c in chunks
            ])
            augmented = (
                "请基于以下参考文档回答用户的问题。\n\n"
                "【参考文档】\n" + context + "\n\n---\n"
                "【用户问题】\n" + question
            )
        else:
            augmented = question

        return RAGQueryResult(
            chunks=chunks,
            augmented_prompt=augmented,
            total_chunks=self.vector_store.count_chunks(),
        )

    def list_documents(self) -> list[str]:
        """列出已导入的文档"""
        return self.vector_store.list_documents()

    def delete_document(self, filename: str):
        """删除文档"""
        self.vector_store.delete_document(filename)


# 全局单例
rag_service = RAGService()
```

- [ ] **Step 2: Create `backend/app/api/rag_router.py`**

```python
"""RAG 知识库 API 路由"""
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from app.services.ai.rag.rag_service import rag_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG知识库"])


@router.post("/upload", summary="上传文档到知识库")
async def upload_document(
    file: UploadFile = File(..., description="文档文件 (PDF/TXT/CSV/MD)"),
):
    """上传文档，自动解析、分块、向量化后存入知识库"""
    allowed_types = {"application/pdf", "text/plain", "text/csv", "text/markdown", "application/octet-stream"}

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20MB
        raise HTTPException(status_code=413, detail="文件大小超过 20MB 限制")

    try:
        doc_info = await rag_service.ingest_document(content, file.filename or "unknown")
        logger.info(f"文档导入成功: {doc_info.filename} ({doc_info.chunk_count} 个分块)")
        return doc_info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"文档导入失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")


@router.get("/documents", summary="列出知识库中的文档")
async def list_documents():
    """返回知识库中所有文档的文件名列表"""
    return {"documents": rag_service.list_documents()}


@router.delete("/documents/{filename:path}", summary="从知识库删除文档")
async def delete_document(filename: str):
    """从向量库中删除指定文档的所有分块"""
    rag_service.delete_document(filename)
    return {"status": "deleted", "filename": filename}


@router.get("/stats", summary="知识库统计")
async def get_stats():
    """返回知识库统计信息"""
    return {
        "total_chunks": rag_service.vector_store.count_chunks(),
        "documents": rag_service.list_documents(),
    }
```

- [ ] **Step 3: Register router in app**

Modify `backend/app/api/__init__.py` to include:
```python
from .rag_router import router as rag_router
app.include_router(rag_router)
```

- [ ] **Step 4: Test the RAG service**

Run: `cd /d/RMFOOD配方平台 && PYTHONPATH=backend:$PYTHONPATH python -c "
from app.services.ai.rag.rag_service import rag_service
import asyncio
async def test():
    result = await rag_service.query('测试问题')
    print(f'Augmented prompt: {result.augmented_prompt[:100]}...')
asyncio.run(test())
"`
Expected: Success with default augmented prompt

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai/rag/rag_service.py backend/app/api/rag_router.py
git commit -m "feat(rag): add RAG service and API endpoints"
```

---

### Task 4: ChatTab RAG 集成 — 前端知识库组件

**Files:**
- Create: `frontend/src/api/rag.ts` (RAG API client)
- Create: `frontend/src/components/ai/rag/KnowledgeBasePanel.tsx`
- Create: `frontend/src/components/ai/rag/DocumentUploader.tsx`
- Create: `frontend/src/components/ai/rag/index.ts`

- [ ] **Step 1: Create RAG API client**

```typescript
import api from '@/api/client'
import type { AxiosProgressEvent } from 'axios'

export interface DocumentInfo {
  id: string
  filename: string
  content_type: string
  chunk_count: number
  created_at: string
  file_size: number
}

export interface RAGStats {
  total_chunks: number
  documents: string[]
}

export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<DocumentInfo> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<DocumentInfo>('/rag/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return response.data
}

export async function listDocuments(): Promise<string[]> {
  const response = await api.get<{ documents: string[] }>('/rag/documents')
  return response.data.documents
}

export async function deleteDocument(filename: string): Promise<void> {
  await api.delete(`/rag/documents/${encodeURIComponent(filename)}`)
}

export async function getRAGStats(): Promise<RAGStats> {
  const response = await api.get<RAGStats>('/rag/stats')
  return response.data
}
```

- [ ] **Step 2: Create RAG components**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/rag.ts frontend/src/components/ai/rag/
git commit -m "feat(rag): add RAG API client and frontend components"
```

---

### Task 5: ChatTab 集成 RAG 上下文

**Files:**
- Modify: `frontend/src/components/ai/features/hooks/useChatSendMessage.ts` (add RAG context injection)
- Modify: `frontend/src/components/ai/features/ChatTab.tsx` (add RAG search toggle)

- [ ] **Step 1: Create `useRAGContext.ts` hook**

```typescript
import { useState, useCallback } from 'react'
import { queryRAG } from '@/api/rag'

export function useRAGContext() {
  const [isRAGEnabled, setIsRAGEnabled] = useState(false)
  const [ragChunks, setRagChunks] = useState<any[]>([])

  const augmentWithRAG = useCallback(async (question: string): Promise<string> => {
    if (!isRAGEnabled) return question
    
    try {
      const result = await queryRAG(question)
      setRagChunks(result.chunks || [])
      return result.augmented_prompt
    } catch {
      return question // RAG 失败时回退到原始问题
    }
  }, [isRAGEnabled])

  return { isRAGEnabled, setIsRAGEnabled, ragChunks, augmentWithRAG }
}
```

- [ ] **Step 2: Modify useChatSendMessage to inject RAG context**

In the message send pipeline, add a RAG step before sending:
```typescript
// After buildEnhancedPrompt, before sending:
if (isRAGEnabled) {
  const ragResult = await queryRAG(contentToSend)
  if (ragResult.chunks?.length > 0) {
    finalContent = ragResult.augmented_prompt
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useRAGContext.ts frontend/src/components/ai/features/hooks/useChatSendMessage.ts
git commit -m "feat(rag): integrate RAG context into chat send pipeline"
```

---

## 执行策略

**推荐方式:** Subagent-Driven — 按 Task 1→5 顺序执行，每个 Task 实施后经过代码审查。
