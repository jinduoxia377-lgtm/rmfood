"""ChromaDB 兼容性补丁 — 修复新版 SQLite 下 seq_id 类型不匹配导致的后端启动崩溃

问题现象
--------
一键启动（start.ps1）后端健康检查超时，``logs\\backend-start.err.log`` 末尾为：

    File "...\\chromadb\\segment\\impl\\metadata\\sqlite.py", line 668, in _decode_seq_id
        if len(seq_id_bytes) == 8:
TypeError: object of type 'int' has no len()

根因
----
ChromaDB 0.5.x 的 SQLite metadata segment 假定 ``max_seqid()`` / ``peek()`` 查到的
``seq_id`` 列恒为 ``bytes``，直接传入 ``_decode_seq_id()`` 并对其执行 ``len()``：

    def _decode_seq_id(seq_id_bytes: bytes) -> SeqId:
        if len(seq_id_bytes) == 8: ...

而 SQLite >= 3.50（本机 3.53.1）会按列类型亲和性把该列还原为 ``int``，
于是 ``len(int)`` 抛出 TypeError。该异常发生在模块导入期
（``RAGService()`` 构造函数同步构建 BM25 索引 → collection.get() → segment.start()），
会中断 uvicorn 的 app 加载，8000 端口永远无法就绪，启动脚本只能等到超时。

修复方式
--------
在导入 chromadb 之后、任何 client/collection 操作之前，替换
``chromadb.segment.impl.metadata.sqlite._decode_seq_id``：

- 已是 ``int`` → 直接返回（SQLite 新版行为，本身即为合法 SeqId）
- ``bytes`` / ``bytearray`` → 沿用原解码逻辑
- 其它类型 → 记录告警并返回 0（保守降级，绝不抛异常阻断启动）

该补丁：
1. 幂等 —— 重复调用无副作用，避免多次 apply 造成递归包装；
2. 静默降级 —— chromadb 未安装或模块结构变化时返回 False，不打断降级路径；
3. 不改写 site-packages —— 重新安装依赖后补丁仍由应用侧自动生效。
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# 幂等标记：防止重复包装
_APPLIED = False


def _safe_decode_seq_id(seq_id: Any) -> int:
    """容错版 seq_id 解码：兼容 bytes（旧版 SQLite）与 int（SQLite >= 3.50）。"""
    if isinstance(seq_id, bool):
        # bool 是 int 的子类，单独处理避免误判
        return int(seq_id)
    if isinstance(seq_id, int):
        return seq_id
    if isinstance(seq_id, (bytes, bytearray)):
        raw = bytes(seq_id)
        if len(raw) == 8:
            return int.from_bytes(raw, "big")
        if len(raw) == 24:
            return int.from_bytes(raw, "big")
        raise ValueError(f"Unknown SeqID type with length {len(raw)}")
    logger.warning(
        "chromadb seq_id 返回非预期类型 %s（值=%r），按 0 处理",
        type(seq_id).__name__,
        seq_id,
    )
    return 0


def apply_chroma_compat() -> bool:
    """安装 ChromaDB / SQLite 兼容性补丁。

    Returns:
        True 表示补丁已安装或此前已安装；False 表示 chromadb 不可用（无需补丁）。
    """
    global _APPLIED
    if _APPLIED:
        return True
    try:
        import chromadb  # noqa: F401
        from chromadb.segment.impl.metadata import sqlite as _sqlite_seg
    except Exception as exc:  # chromadb 未安装或内部模块路径变化
        logger.debug("chromadb 兼容性补丁跳过：%s", exc)
        return False

    original = getattr(_sqlite_seg, "_decode_seq_id", None)
    if original is None or original is _safe_decode_seq_id:
        _APPLIED = True
        return True

    try:
        _sqlite_seg._decode_seq_id = _safe_decode_seq_id
        _APPLIED = True
        logger.info(
            "已应用 ChromaDB seq_id 兼容补丁（chromadb %s）",
            getattr(chromadb, "__version__", "unknown"),
        )
        return True
    except Exception as exc:  # 极端情况下只读模块
        logger.warning("ChromaDB 兼容性补丁安装失败：%s", exc)
        return False
