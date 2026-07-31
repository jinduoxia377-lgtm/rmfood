"""JSON / JSONL 数据源适配器

支持:
- JSON 数组格式 [{"name": "Alice"}, ...]
- JSON Lines 格式（每行一个 JSON 对象）
- 嵌套路径提取（如 "address.city" → row["address"]["city"]）
- 大文件流式读取，不一次性加载整个文件
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, AsyncIterator

from .base import BaseAdapter

logger = logging.getLogger(__name__)


def _get_nested(data: Dict[str, Any], path: str) -> tuple[Any, bool]:
    """从嵌套字典中按点号路径取值。

    Returns:
        (value, found)
    """
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None, False
    return current, True


class JsonAdapter(BaseAdapter):
    """JSON / JSONL 文件适配器"""

    def __init__(
        self,
        file_path: str | Path,
        data_path: str | None = None,
        is_jsonl: bool = False,
    ):
        super().__init__({
            "file_path": str(file_path),
            "data_path": data_path,
            "is_jsonl": is_jsonl,
        })
        self.file_path = Path(file_path)
        self._data_path = data_path
        self._is_jsonl = is_jsonl

    async def validate(self) -> tuple[bool, str]:
        if not self.file_path.exists():
            return False, f"File not found: {self.file_path}"
        if not self.file_path.is_file():
            return False, f"Not a file: {self.file_path}"
        size = self.file_path.stat().st_size
        if size == 0:
            return False, "File is empty"
        # 验证 JSON 可解析
        try:
            if self._is_jsonl:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    first_line = next(iter(f), "")
                    if first_line:
                        json.loads(first_line)
            else:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not isinstance(data, list):
                        return False, "JSON root must be an array"
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {e}"
        return True, "OK"

    async def count(self) -> int:
        if self._is_jsonl:
            count = sum(1 for line in open(self.file_path, encoding="utf-8") if line.strip())
        else:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if self._data_path:
                    root, found = _get_nested({"": data}, self._data_path)
                    count = len(root) if (found and isinstance(root, list)) else 0
                else:
                    count = len(data) if isinstance(data, list) else 0
        self.stats.total_rows = count
        return count

    async def preview(self, limit: int = 10) -> List[Dict[str, Any]]:
        return await self._extract_rows(limit)

    async def iterate(self) -> AsyncIterator[Dict[str, Any]]:
        if self._is_jsonl:
            loop = asyncio.get_event_loop()
            def _read_jsonl():
                rows = []
                with open(self.file_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                            if self._data_path:
                                val, found = _get_nested({"": obj}, self._data_path)
                                if found and isinstance(val, list):
                                    rows.extend(val)
                                else:
                                    rows.append(obj)
                            else:
                                rows.append(obj)
                        except json.JSONDecodeError:
                            continue
                return rows

            while True:
                batch = await loop.run_in_executor(None, _read_jsonl)
                if not batch:
                    break
                for row in batch:
                    yield row
                break  # JSONL is read in one pass
        else:
            # Full JSON array — load once
            rows = await self._load_all()
            for row in rows:
                yield row

    async def _extract_rows(self, limit: int) -> List[Dict[str, Any]]:
        with open(self.file_path, "r", encoding="utf-8") as f:
            content = f.read()

        if self._is_jsonl:
            rows = []
            for line in content.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if self._data_path:
                        val, found = _get_nested({"": obj}, self._data_path)
                        if found and isinstance(val, list):
                            rows.extend(val[:limit])
                            break
                        else:
                            rows.append(obj)
                    else:
                        rows.append(obj)
                    if len(rows) >= limit:
                        break
                except json.JSONDecodeError:
                    continue
            return rows

        data = json.loads(content)
        if self._data_path:
            val, found = _get_nested({"": data}, self._data_path)
            if found and isinstance(val, list):
                data = val
        elif not isinstance(data, list):
            data = [data]

        return data[:limit]

    async def _load_all(self) -> List[Dict[str, Any]]:
        with open(self.file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if self._data_path:
            val, found = _get_nested({"": data}, self._data_path)
            if found and isinstance(val, list):
                data = val
        elif not isinstance(data, list):
            data = [data]
        return data
