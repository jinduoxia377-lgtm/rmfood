"""Cross-Encoder 重排序器 — bge-reranker-base

基于 BAAI/bge-reranker-base 模型对检索结果进行精排，
提升 Top-K 精度 20-30%。

模型特性：
- 模型大小：~278MB
- 支持中文/英文/多语言
- 推理延迟：~50-100ms (Top-20 结果)
- 线程安全：单例 + 懒加载
"""

import logging
import os
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 全局单例缓存
_RERANKER_CACHE: dict[str, object] = {}
_reranker_lock = threading.Lock()


def _default_model() -> str:
    """模型默认解析顺序：
    1. 环境变量 RAG_RERANKER_MODEL（显式覆盖）
    2. 本地已下载模型目录 backend/data/models/bge-reranker-base（存在则优先，规避
       huggingface_hub 在部分 Windows 环境下写缓存元数据的权限异常）
    3. HF 官方模型名 BAAI/bge-reranker-base（联网首拉）
    """
    env = os.getenv("RAG_RERANKER_MODEL")
    if env:
        return env
    local = Path(__file__).resolve().parents[4] / "data" / "models" / "bge-reranker-base"
    if local.is_dir():
        return str(local)
    return "BAAI/bge-reranker-base"


class Reranker:
    """BGE Reranker 封装

    使用方式：
        reranker = Reranker()
        ranked = reranker.rerank(query, documents, top_n=5)
        # 返回 [(index, score), ...] 按分数降序
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or _default_model()
        self._model = None
        self._model_lock = threading.Lock()

    def _get_model(self):
        """懒加载模型（线程安全）"""
        if self._model is not None:
            return self._model

        with self._model_lock:
            if self._model is not None:
                return self._model

            try:
                from rerankers import Reranker as _Reranker

                logger.info("加载 Reranker 模型: %s", self.model_name)
                self._model = _Reranker(model_name=self.model_name)
                logger.info("Reranker 模型加载成功")
                return self._model
            except ImportError:
                logger.warning(
                    "rerankers 包未安装，请运行: pip install rerankers[cross-encoders] "
                    "或使用 transformers 降级方案"
                )
                return self._get_transformers_model()
            except Exception as e:
                logger.error("Reranker 模型加载失败: %s", e, exc_info=True)
                return None

    def _get_transformers_model(self):
        """降级方案：使用 transformers 直接加载"""
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            import torch

            logger.info("使用 transformers 降级加载: %s", self.model_name)
            tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            model.eval()

            class TransformersReranker:
                """Transformers 降级实现"""
                def __init__(self, tokenizer, model, torch):
                    self.tokenizer = tokenizer
                    self.model = model
                    self.torch = torch

                def compute_score(self, query, documents):
                    """计算 query-document 相关性分数"""
                    pairs = [[query, doc] for doc in documents]
                    with self.torch.no_grad():
                        encoding = self.tokenizer(
                            pairs,
                            padding=True,
                            truncation=True,
                            return_tensors="pt",
                            max_length=512,
                        )
                        outputs = self.model(**encoding)
                        scores = outputs.logits.squeeze(-1).tolist()
                    return scores

            self._model = TransformersReranker(tokenizer, model, torch)
            logger.info("Transformers Reranker 加载成功")
            return self._model
        except Exception as e:
            logger.error("Transformers Reranker 加载失败: %s", e, exc_info=True)
            return None

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int = 5,
    ) -> list[tuple[int, float]]:
        """重排序文档

        Args:
            query: 用户查询
            documents: 待排序的文档内容列表
            top_n: 返回前 N 个结果

        Returns:
            [(原始索引, 相关性分数), ...] 按分数降序
        """
        if not documents:
            return []

        model = self._get_model()
        if model is None:
            # 降级：返回原始顺序
            logger.warning("Reranker 不可用，返回原始排序")
            return [(i, 0.0) for i in range(min(top_n, len(documents)))]

        try:
            # rerankers>=0.5 新 API：rank(query, docs) -> RankedResults（results 按分数降序）
            #   Result.document.doc_id = 输入列表中的原始索引（doc_ids 未传时自动生成）
            if hasattr(model, "rank"):
                results = model.rank(query, documents)
                indexed = [(int(r.document.doc_id), float(r.score)) for r in results.results]
            else:
                # 旧 API / transformers 降级：compute_score(query, docs) -> [score]
                scores = model.compute_score(query, documents)
                indexed = list(enumerate(scores))
            indexed.sort(key=lambda x: x[1], reverse=True)
            return indexed[:top_n]
        except Exception as e:
            logger.error("Reranker 推理失败: %s", e, exc_info=True)
            return [(i, 0.0) for i in range(min(top_n, len(documents)))]


def get_reranker(model_name: Optional[str] = None) -> Reranker:
    """获取全局 Reranker 单例"""
    key = model_name or _default_model()
    if key not in _RERANKER_CACHE:
        with _reranker_lock:
            if key not in _RERANKER_CACHE:
                _RERANKER_CACHE[key] = Reranker(key)
    return _RERANKER_CACHE[key]