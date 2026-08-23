"""CSV/TSV 数据源适配器

支持:
- 自定义分隔符（tab、comma、pipe、semicolon）
- UTF-8 / GBK 自动编码检测
- 大文件分块读取（chunked），避免内存溢出
- 跳过空行和仅含空白字符的行
- 可选的 header_row 配置
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
from pathlib import Path
from typing import Any, Dict, List, AsyncIterator

from .base import BaseAdapter

logger = logging.getLogger(__name__)


def _detect_encoding(file_path: Path, sample_size: int = 8192) -> str:
    """简单编码检测：先试 UTF-8，失败则试 GBK"""
    encodings = ["utf-8", "utf-8-sig", "gbk", "gb2312", "latin-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc, errors="strict") as f:
                f.read(sample_size)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue
    return "utf-8"  # fallback


class CsvAdapter(BaseAdapter):
    """CSV / TSV 文件适配器"""

    def __init__(
        self,
        file_path: str | Path,
        delimiter: str = "auto",
        encoding: str | None = None,
        header_row: int = 0,
        skip_blank_rows: bool = True,
        chunk_size: int = 1000,
    ):
        super().__init__({
            "file_path": str(file_path),
            "delimiter": delimiter,
            "encoding": encoding,
            "header_row": header_row,
            "skip_blank_rows": skip_blank_rows,
            "chunk_size": chunk_size,
        })
        self.file_path = Path(file_path)
        self._delimiter = delimiter
        self._encoding = encoding
        self._header_row = header_row
        self._skip_blank = skip_blank_rows
        self._chunk_size = chunk_size

    async def validate(self) -> tuple[bool, str]:
        if not self.file_path.exists():
            return False, f"File not found: {self.file_path}"
        if not self.file_path.is_file():
            return False, f"Not a file: {self.file_path}"
        size = self.file_path.stat().st_size
        if size == 0:
            return False, "File is empty"
        self.stats.total_rows = 0  # 会在 count() 中设置
        return True, "OK"

    async def count(self) -> int:
        """统计文件的非空行数（不含 header）"""
        encoding = self._encoding or _detect_encoding(self.file_path)
        delimiter = self._resolve_delimiter()

        count = 0
        with open(self.file_path, "r", encoding=encoding, errors="replace") as f:
            for i, line in enumerate(f):
                if i <= self._header_row:
                    continue
                if self._skip_blank and not line.strip():
                    continue
                count += 1
        self.stats.total_rows = count
        return count

    async def preview(self, limit: int = 10) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        encoding = self._encoding or _detect_encoding(self.file_path)
        delimiter = self._resolve_delimiter()

        # Read header for column names
        header_row_list: List[str] = []
        with open(self.file_path, "r", encoding=encoding, errors="replace") as f:
            reader = csv.reader(f, delimiter=delimiter)
            for i, row in enumerate(reader):
                if i == self._header_row:
                    header_row_list = [c.strip() for c in row]
                    break

        has_header = bool(header_row_list)

        with open(self.file_path, "r", encoding=encoding, errors="replace") as f:
            reader = csv.reader(f, delimiter=delimiter)
            for i, row in enumerate(reader):
                if i <= self._header_row:
                    continue
                if self._skip_blank and all(not c.strip() for c in row):
                    continue
                if len(results) >= limit:
                    break
                if has_header:
                    mapped = {header_row_list[int(idx)]: val for idx, val in enumerate(row) if int(idx) < len(header_row_list)}
                    results.append(mapped)
                else:
                    results.append({str(j): v for j, v in enumerate(row)})
        return results

    async def iterate(self) -> AsyncIterator[Dict[str, Any]]:
        """异步迭代每一行原始数据"""
        encoding = self._encoding or _detect_encoding(self.file_path)
        delimiter = self._resolve_delimiter()

        loop = asyncio.get_event_loop()

        def _read_chunk():
            """Read one chunk of rows from the CSV file"""
            results = []
            with open(self.file_path, "r", encoding=encoding, errors="replace") as f:
                reader = csv.reader(f, delimiter=delimiter)

                for i, row in enumerate(reader):
                    if i <= self._header_row:
                        continue
                    if self._skip_blank and all(not c.strip() for c in row):
                        continue
                    # 用 header 值做 key（如果 header_row 指定了实际列名行）
                    if self._header_row == 0 and i == 1:
                        # First data row after header — store header
                        pass
                    results.append({str(j): v for j, v in enumerate(row)})
                    if len(results) >= self._chunk_size:
                        break
            return results

        # Read header row for column names
        header_row_list: List[str] = []
        with open(self.file_path, "r", encoding=encoding, errors="replace") as f:
            reader = csv.reader(f, delimiter=delimiter)
            for i, row in enumerate(reader):
                if i == self._header_row:
                    header_row_list = [c.strip() for c in row]
                    break

        has_header = bool(header_row_list)

        while True:
            rows = await loop.run_in_executor(None, _read_chunk)
            if not rows:
                break
            for row_dict in rows:
                self.stats.valid_rows += 1
                if has_header:
                    # Map index-based keys to header names
                    mapped = {}
                    for idx, val in row_dict.items():
                        if int(idx) < len(header_row_list):
                            mapped[header_row_list[int(idx)]] = val
                        else:
                            mapped[idx] = val
                    yield mapped
                else:
                    yield row_dict

    def _resolve_delimiter(self) -> str:
        if self._delimiter != "auto":
            return self._delimiter
        # Auto-detect from first few lines
        sample = self.file_path.read_text(encoding=_detect_encoding(self.file_path))[:4096]
        delims = ["\t", ",", ";", "|"]
        counts = {d: sample.count(d) for d in delims}
        best = max(counts, key=counts.get)
        if counts[best] > 0:
            logger.info(f"Auto-detected delimiter: '{best}' ({counts[best]} occurrences)")
            return best
        return ","
