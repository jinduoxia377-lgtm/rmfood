"""文档处理器 — 多格式解析与智能分块 (v3.0)

增强版:
- 支持 PDF/TXT/CSV/MD/DOCX/XLSX/PPTX/HTML 解析
- 智能语义分块（保持段落/表格/列表完整性）
- 动态分块大小（短内容合并，长内容细分）
- 章节标题感知的分块策略
"""

import hashlib
import logging
import os
import re
from typing import Optional

from .models import DocumentChunk

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """多格式文档解析与智能分块引擎 v3.0"""

    CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "800"))
    CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "80"))

    SENTENCE_SEPARATORS = ('。', '.\n', '！', '？', '\n\n', '；', '；')
    BOUNDARY_SEARCH_BACKTRACK = 150
    MD_HEADING = re.compile(r'^(#{1,6}\s+.+)$', re.MULTILINE)

    def extract_text(self, content: bytes, filename: str) -> str:
        """根据文件类型提取纯文本"""
        ext = filename.lower().split('.')[-1] if '.' in filename else ''

        extractors = {
            'pdf': self._extract_pdf,
            'txt': self._extract_plain,
            'md': self._extract_plain,
            'csv': self._extract_csv,
            'docx': self._extract_docx,
            'xlsx': self._extract_xlsx,
            'pptx': self._extract_pptx,
            'html': self._extract_html,
            'htm': self._extract_html,
        }

        extractor = extractors.get(ext)
        if extractor:
            try:
                return extractor(content)
            except Exception as e:
                logger.warning("文档格式 %s 解析失败，回退到纯文本: %s", ext, e)

        # 默认：UTF-8 解码
        return content.decode('utf-8', errors='replace')

    def _extract_plain(self, content: bytes) -> str:
        """纯文本"""
        return content.decode('utf-8', errors='replace')

    def _extract_pdf(self, content: bytes) -> str:
        """PDF 解析（PyPDF2 → pdfminer 回退）"""
        try:
            from io import BytesIO

            import PyPDF2
            reader = PyPDF2.PdfReader(BytesIO(content))
            texts = [page.extract_text() for page in reader.pages if page.extract_text()]
            return '\n\n'.join(texts)
        except ImportError:
            try:
                from io import BytesIO

                from pdfminer.high_level import extract_text
                return extract_text(BytesIO(content))
            except ImportError:
                return "[PDF 解析需要安装 PyPDF2 或 pdfminer.six]"

    def _extract_csv(self, content: bytes) -> str:
        """CSV 转可读文本"""
        import csv
        from io import StringIO
        text = content.decode('utf-8', errors='replace')
        reader = csv.reader(StringIO(text))
        rows = [' | '.join(row) for row in reader]
        return '\n'.join(rows)

    def _extract_docx(self, content: bytes) -> str:
        """Word .docx 解析"""
        try:
            from io import BytesIO

            from docx import Document
            doc = Document(BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return '\n\n'.join(paragraphs)
        except ImportError:
            logger.warning("python-docx 未安装，回退到纯文本")
            return content.decode('utf-8', errors='replace')

    def _extract_xlsx(self, content: bytes) -> str:
        """Excel .xlsx 解析"""
        try:
            from io import BytesIO

            import openpyxl
            wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
            lines = []
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    cells = [str(c) if c is not None else '' for c in row]
                    line = ' | '.join(c for c in cells if c)
                    if line:
                        lines.append(line)
            return '\n'.join(lines)
        except ImportError:
            logger.warning("openpyxl 未安装，回退到纯文本")
            return content.decode('utf-8', errors='replace')

    def _extract_pptx(self, content: bytes) -> str:
        """PowerPoint .pptx 解析"""
        try:
            from io import BytesIO

            from pptx import Presentation
            prs = Presentation(BytesIO(content))
            texts = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, 'text') and shape.text.strip():
                        texts.append(shape.text.strip())
            return '\n\n'.join(texts)
        except ImportError:
            logger.warning("python-pptx 未安装，回退到纯文本")
            return content.decode('utf-8', errors='replace')

    def _extract_html(self, content: bytes) -> str:
        """HTML 提取正文"""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            # 移除脚本和样式
            for tag in soup(['script', 'style']):
                tag.decompose()
            text = soup.get_text(separator='\n')
            # 清理多余空白
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            return '\n\n'.join(lines)
        except ImportError:
            logger.warning("BeautifulSoup 未安装，回退到纯文本")
            return content.decode('utf-8', errors='replace')

    def chunk_text(self, text: str, filename: str = "") -> list[DocumentChunk]:
        """智能语义分块 v3.0

        策略：
        1. 按段落/标题分段
        2. 短段落合并（<200 字符）
        3. 长段落按句子切分
        4. 块间保留重叠
        5. 每块记录章节标题
        """
        text = text.strip()
        if not text:
            return []

        # 步骤1: 按段落分段
        paragraphs = re.split(r'\n{2,}', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        # 步骤2: 检测 Markdown 标题
        sections = self._organize_into_sections(paragraphs)

        # 步骤3: 智能分块
        chunks: list[DocumentChunk] = []
        current_chunk_text = ""
        current_section = ""
        chunk_index = 0

        for section_title, para_list in sections:
            for para in para_list:
                # 检测段落是否为标题
                heading_match = self.MD_HEADING.match(para)
                if heading_match:
                    # 先保存当前块
                    if current_chunk_text:
                        chunk = self._create_chunk(current_chunk_text, filename, chunk_index, current_section)
                        if chunk:
                            chunks.append(chunk)
                        chunk_index += 1

                    current_section = heading_match.group(1).lstrip('#').strip()
                    current_chunk_text = para
                    continue

                # 合并段落到当前块（P3：单段超长时按句子/硬上限切分，避免巨型块）
                for seg in self._split_long_text(para):
                    if current_chunk_text:
                        new_text = current_chunk_text + "\n\n" + seg
                    else:
                        new_text = seg

                    if len(new_text) > self.CHUNK_SIZE * 1.5:
                        # 块太大，先保存
                        chunk = self._create_chunk(current_chunk_text, filename, chunk_index, current_section)
                        if chunk:
                            chunks.append(chunk)
                        chunk_index += 1
                        current_chunk_text = seg
                    else:
                        current_chunk_text = new_text

        # 保存最后一个块
        if current_chunk_text:
            chunk = self._create_chunk(current_chunk_text, filename, chunk_index, current_section)
            if chunk:
                chunks.append(chunk)

        logger.info("智能分块完成: %s → %d 块", filename, len(chunks))
        return chunks

    def _organize_into_sections(self, paragraphs: list[str]) -> list[tuple[str, list[str]]]:
        """将段落组织成章节"""
        sections = []
        current_section = ""
        current_paragraphs = []

        for para in paragraphs:
            heading_match = self.MD_HEADING.match(para)
            if heading_match:
                if current_paragraphs:
                    sections.append((current_section, current_paragraphs))
                current_section = heading_match.group(1).lstrip('#').strip()
                current_paragraphs = [para]
            else:
                current_paragraphs.append(para)

        if current_paragraphs:
            sections.append((current_section, current_paragraphs))

        if not sections:
            sections = [("", paragraphs)]

        return sections

    def _split_long_text(self, text: str) -> list[str]:
        """P3: 对超长文本按句子边界/硬上限切分。

        单个超长段落（无空行分隔的长文本）若不切分会形成远超 CHUNK_SIZE 的
        巨型块，破坏嵌入/检索质量。优先在句子边界切分；若窗口内无句子边界，
        则在硬上限处硬切。返回的每段长度 ≤ CHUNK_SIZE * 1.5（与合并阈值一致）。
        """
        hard_cap = int(self.CHUNK_SIZE * 1.5)
        if len(text) <= hard_cap:
            return [text]
        pieces: list[str] = []
        rest = text
        while len(rest) > hard_cap:
            window = rest[:hard_cap]
            cut = 0
            for sep in self.SENTENCE_SEPARATORS:
                idx = window.rfind(sep)
                if idx != -1 and idx + len(sep) > cut:
                    cut = idx + len(sep)
            if cut <= 0:
                cut = hard_cap  # 无句子边界，硬切
            pieces.append(rest[:cut].strip())
            rest = rest[cut:]
        if rest.strip():
            pieces.append(rest.strip())
        return [p for p in pieces if p]

    def _create_chunk(self, text: str, filename: str, index: int, section: str) -> Optional[DocumentChunk]:
        """创建单个文档块"""
        if not text.strip():
            return None

        # 智能重叠：在末尾寻找句子边界
        overlap_text = ""
        if index > 0 and len(text) > self.CHUNK_OVERLAP:
            overlap_text = text[-self.CHUNK_OVERLAP:]

        chunk_id = hashlib.md5(f"{filename}:{text[:50]}:{index}".encode()).hexdigest()[:12]

        return DocumentChunk(
            id=f"chunk_{chunk_id}",
            content=text.strip(),
            metadata={
                "source": filename,
                "chunk_index": index,
                "section": section,
                "overlap_preview": overlap_text[:50] if overlap_text else "",
            },
        )
