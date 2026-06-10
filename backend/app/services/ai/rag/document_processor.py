"""文档处理器 — PDF/文本解析与分块"""

import re
import hashlib
from typing import Optional
from .models import DocumentChunk


class DocumentProcessor:
    """文档解析与分块引擎

    负责：
    - 解析 PDF/TXT/CSV/MD 等文档格式
    - 将长文本分割为有重叠的语义块
    - 为每块生成元数据（来源、索引）

    CHUNK_SIZE 和 CHUNK_OVERLAP 可通过环境变量配置。
    """

    CHUNK_SIZE = 500       # 每块目标字符数
    CHUNK_OVERLAP = 50     # 块间重叠字符数（保持上下文连贯）

    def extract_text(self, content: bytes, filename: str) -> str:
        """根据文件类型提取纯文本

        Args:
            content: 文件二进制内容
            filename: 文件名（用于判断类型）

        Returns:
            提取的纯文本
        """
        ext = filename.lower().split('.')[-1] if '.' in filename else ''

        if ext == 'pdf':
            return self._extract_pdf(content)
        elif ext in ('txt', 'md'):
            return content.decode('utf-8', errors='replace')
        elif ext == 'csv':
            return self._extract_csv(content)
        else:
            return content.decode('utf-8', errors='replace')

    def _extract_pdf(self, content: bytes) -> str:
        """从 PDF 提取文本"""
        try:
            import PyPDF2
            from io import BytesIO
            reader = PyPDF2.PdfReader(BytesIO(content))
            texts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    texts.append(page_text)
            return '\n'.join(texts)
        except ImportError:
            try:
                from io import BytesIO
                from pdfminer.high_level import extract_text as pdfminer_extract
                return pdfminer_extract(BytesIO(content))
            except ImportError:
                return "[PDF 解析需要安装 PyPDF2 或 pdfminer.six 库]"

    def _extract_csv(self, content: bytes) -> str:
        """CSV 转可读文本"""
        try:
            import csv
            from io import StringIO
            text = content.decode('utf-8', errors='replace')
            reader = csv.reader(StringIO(text))
            rows = [' | '.join(row) for row in reader]
            return '\n'.join(rows)
        except Exception:
            return content.decode('utf-8', errors='replace')

    def chunk_text(self, text: str, filename: str = "") -> list[DocumentChunk]:
        """将长文本分割为有重叠的语义块

        分块策略：
        1. 清理多余空白符
        2. 按 CHUNK_SIZE 滑动窗口切割
        3. 在边界附近查找句号/换行符作为自然断点
        4. 块间保留 CHUNK_OVERLAP 字符的重叠

        Args:
            text: 要分割的文本
            filename: 来源文件名（注入元数据）

        Returns:
            DocumentChunk 列表
        """
        text = re.sub(r'\s+', ' ', text).strip()
        if not text:
            return []

        chunks: list[DocumentChunk] = []
        start = 0

        while start < len(text):
            end = start + self.CHUNK_SIZE

            if end >= len(text):
                end = len(text)
            else:
                # 在边界附近找句子结尾（优先句号，其次换行）
                search_start = max(start + self.CHUNK_SIZE - 100, start)
                candidates = []
                for sep in ('。', '.\n', '！', '？', '\n\n'):
                    pos = text.rfind(sep, search_start, end)
                    if pos > search_start:
                        candidates.append(pos + len(sep))
                if candidates:
                    end = max(candidates)

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunk_id = hashlib.md5(chunk_text.encode()).hexdigest()[:12]
                chunks.append(DocumentChunk(
                    id=f"chunk_{chunk_id}",
                    content=chunk_text,
                    metadata={
                        "source": filename,
                        "chunk_index": len(chunks),
                        "char_start": start,
                        "char_end": end,
                    },
                ))

            start = end - self.CHUNK_OVERLAP
            if start >= end:
                break

        return chunks
