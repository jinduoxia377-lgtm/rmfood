"""批量导入服务 — CSV/Excel/JSON 格式批量导入

支持从 CSV、Excel、JSON 文件批量导入文档到知识库，
支持自定义字段映射、批量处理、错误处理等。

特性：
- CSV 导入（UTF-8 编码，支持分隔符配置）
- Excel 导入（.xlsx 格式，多 sheet 支持）
- JSON 导入（数组或对象格式）
- 字段映射配置
- 批量处理与进度回调
- 错误收集与报告
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, List, Optional

from .models import DocumentInfo
from .rag_service import RAGService

logger = logging.getLogger(__name__)


@dataclass
class ImportError:
    """导入错误"""
    row: int
    field: str
    message: str
    value: Optional[str] = None


@dataclass
class BatchImportResult:
    """批量导入结果"""
    total: int
    success: int
    failed: int
    errors: List[ImportError]
    documents: List[DocumentInfo]
    duration_ms: float
    message: str


@dataclass
class FieldMapping:
    """字段映射配置"""
    content_field: str = "content"
    title_field: Optional[str] = None
    source_field: Optional[str] = None
    metadata_fields: List[str] = field(default_factory=list)


class BatchImporter:
    """批量导入器

    支持从 CSV、Excel、JSON 文件批量导入文档。
    """

    def __init__(self, rag_service: RAGService, user_id: str = "system"):
        """
        Args:
            rag_service: RAG 服务实例
            user_id: 用户 ID（租户隔离）
        """
        self.rag_service = rag_service
        self.user_id = user_id
        self.progress_callback: Optional[Callable[[int, int, str], None]] = None

    async def import_csv(
        self,
        content: bytes,
        filename: str,
        mapping: FieldMapping = None,
        delimiter: str = ",",
        encoding: str = "utf-8",
    ) -> BatchImportResult:
        """从 CSV 导入文档

        Args:
            content: 文件二进制内容
            filename: 文件名
            mapping: 字段映射配置
            delimiter: 分隔符
            encoding: 文件编码

        Returns:
            导入结果
        """
        import csv
        from io import StringIO

        mapping = mapping or FieldMapping()
        start_time = datetime.now().timestamp()
        errors: List[ImportError] = []
        documents: List[DocumentInfo] = []

        try:
            text = content.decode(encoding)
            reader = csv.DictReader(StringIO(text), delimiter=delimiter)

            if not reader.fieldnames:
                raise ValueError("CSV 文件为空或缺少表头")

            total = 0
            for row_idx, row in enumerate(reader, start=1):
                total += 1

                # 获取内容字段
                content_field = mapping.content_field
                if content_field not in row:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="字段不存在",
                        value=None,
                    ))
                    continue

                content = row.get(content_field, "").strip()
                if not content:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="内容字段为空",
                        value=None,
                    ))
                    continue

                # 获取标题
                title = None
                if mapping.title_field and mapping.title_field in row:
                    title = row.get(mapping.title_field)

                # 获取来源
                source = None
                if mapping.source_field and mapping.source_field in row:
                    source = row.get(mapping.source_field)

                # 构建文档元数据
                metadata = {}
                for field_name in mapping.metadata_fields:
                    if field_name in row:
                        metadata[field_name] = row[field_name]

                # 生成文档名
                doc_filename = f"{os.path.splitext(filename)[0]}_{row_idx}"
                if title:
                    doc_filename = f"{title}_{row_idx}"

                # 调用 RAG 服务索引
                doc_info = await self.rag_service.ingest_document(
                    content=content.encode(encoding),
                    filename=doc_filename,
                    user_id=self.user_id,
                )
                documents.append(doc_info)

                # 进度回调
                if self.progress_callback:
                    self.progress_callback(row_idx, total, f"已导入 {row_idx}/{total}")

        except Exception as e:
            errors.append(ImportError(
                row=0,
                field="file",
                message=str(e),
                value=None,
            ))
            logger.error("CSV 导入失败: %s", e, exc_info=True)

        duration_ms = (datetime.now().timestamp() - start_time) * 1000

        return BatchImportResult(
            total=len(documents) + len(errors),
            success=len(documents),
            failed=len(errors),
            errors=errors,
            documents=documents,
            duration_ms=duration_ms,
            message=f"成功导入 {len(documents)} 条，失败 {len(errors)} 条",
        )

    async def import_excel(
        self,
        content: bytes,
        filename: str,
        mapping: FieldMapping = None,
        sheet_name: Optional[str] = None,
    ) -> BatchImportResult:
        """从 Excel 导入文档

        Args:
            content: 文件二进制内容
            filename: 文件名
            mapping: 字段映射配置
            sheet_name: 工作表名称（None 表示第一个 sheet）

        Returns:
            导入结果
        """
        try:
            from io import BytesIO

            import openpyxl
        except ImportError:
            return BatchImportResult(
                total=0,
                success=0,
                failed=1,
                errors=[ImportError(
                    row=0,
                    field="library",
                    message="openpyxl 未安装，请运行: pip install openpyxl",
                    value=None,
                )],
                documents=[],
                duration_ms=0,
                message="openpyxl 未安装",
            )

        mapping = mapping or FieldMapping()
        start_time = datetime.now().timestamp()
        errors: List[ImportError] = []
        documents: List[DocumentInfo] = []

        try:
            wb = openpyxl.load_workbook(BytesIO(content), read_only=True)

            # 选择工作表
            if sheet_name:
                if sheet_name not in wb.sheetnames:
                    raise ValueError(f"工作表不存在: {sheet_name}")
                ws = wb[sheet_name]
            else:
                ws = wb.active

            # 获取表头
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                raise ValueError("Excel 文件为空")

            headers = [str(h) if h else f"col_{i}" for i, h in enumerate(rows[0])]

            total = len(rows) - 1
            for row_idx, row in enumerate(rows[1:], start=1):
                # 构建行字典
                row_dict = {}
                for i, header in enumerate(headers):
                    value = row[i] if i < len(row) else None
                    row_dict[header] = str(value) if value is not None else ""

                # 获取内容字段
                content_field = mapping.content_field
                if content_field not in row_dict:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="字段不存在",
                        value=None,
                    ))
                    continue

                content = row_dict.get(content_field, "").strip()
                if not content:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="内容字段为空",
                        value=None,
                    ))
                    continue

                # 获取标题
                title = None
                if mapping.title_field and mapping.title_field in row_dict:
                    title = row_dict.get(mapping.title_field)

                # 生成文档名
                doc_filename = f"{os.path.splitext(filename)[0]}_{row_idx}"
                if title:
                    doc_filename = f"{title}_{row_idx}"

                # 调用 RAG 服务索引
                doc_info = await self.rag_service.ingest_document(
                    content=content.encode('utf-8'),
                    filename=doc_filename,
                    user_id=self.user_id,
                )
                documents.append(doc_info)

                # 进度回调
                if self.progress_callback:
                    self.progress_callback(row_idx, total, f"已导入 {row_idx}/{total}")

            wb.close()

        except Exception as e:
            errors.append(ImportError(
                row=0,
                field="file",
                message=str(e),
                value=None,
            ))
            logger.error("Excel 导入失败: %s", e, exc_info=True)

        duration_ms = (datetime.now().timestamp() - start_time) * 1000

        return BatchImportResult(
            total=len(documents) + len(errors),
            success=len(documents),
            failed=len(errors),
            errors=errors,
            documents=documents,
            duration_ms=duration_ms,
            message=f"成功导入 {len(documents)} 条，失败 {len(errors)} 条",
        )

    async def import_json(
        self,
        content: bytes,
        filename: str,
        mapping: FieldMapping = None,
        array_path: Optional[str] = None,
    ) -> BatchImportResult:
        """从 JSON 导入文档

        Args:
            content: 文件二进制内容
            filename: 文件名
            mapping: 字段映射配置
            array_path: 数组路径（如 "data.items"）

        Returns:
            导入结果
        """
        mapping = mapping or FieldMapping()
        start_time = datetime.now().timestamp()
        errors: List[ImportError] = []
        documents: List[DocumentInfo] = []

        try:
            data = json.loads(content.decode('utf-8'))

            # 导航到数组路径
            if array_path:
                parts = array_path.split('.')
                for part in parts:
                    if isinstance(data, list):
                        break
                    if isinstance(data, dict) and part in data:
                        data = data[part]
                    else:
                        raise ValueError(f"路径不存在: {array_path}")

            # 确保是数组
            if isinstance(data, dict):
                data = [data]

            if not isinstance(data, list):
                raise ValueError("JSON 数据必须是数组或对象")

            total = len(data)
            for row_idx, item in enumerate(data, start=1):
                if not isinstance(item, dict):
                    errors.append(ImportError(
                        row=row_idx,
                        field="item",
                        message="JSON 项必须是对象",
                        value=str(item)[:100],
                    ))
                    continue

                # 获取内容字段
                content_field = mapping.content_field
                if content_field not in item:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="字段不存在",
                        value=None,
                    ))
                    continue

                content = str(item.get(content_field, "")).strip()
                if not content:
                    errors.append(ImportError(
                        row=row_idx,
                        field=content_field,
                        message="内容字段为空",
                        value=None,
                    ))
                    continue

                # 获取标题
                title = None
                if mapping.title_field and mapping.title_field in item:
                    title = str(item.get(mapping.title_field))

                # 生成文档名
                doc_filename = f"{os.path.splitext(filename)[0]}_{row_idx}"
                if title:
                    doc_filename = f"{title}_{row_idx}"

                # 调用 RAG 服务索引
                doc_info = await self.rag_service.ingest_document(
                    content=content.encode('utf-8'),
                    filename=doc_filename,
                    user_id=self.user_id,
                )
                documents.append(doc_info)

                # 进度回调
                if self.progress_callback:
                    self.progress_callback(row_idx, total, f"已导入 {row_idx}/{total}")

        except Exception as e:
            errors.append(ImportError(
                row=0,
                field="file",
                message=str(e),
                value=None,
            ))
            logger.error("JSON 导入失败: %s", e, exc_info=True)

        duration_ms = (datetime.now().timestamp() - start_time) * 1000

        return BatchImportResult(
            total=len(documents) + len(errors),
            success=len(documents),
            failed=len(errors),
            errors=errors,
            documents=documents,
            duration_ms=duration_ms,
            message=f"成功导入 {len(documents)} 条，失败 {len(errors)} 条",
        )

    async def import_file(
        self,
        content: bytes,
        filename: str,
        mapping: FieldMapping = None,
        **kwargs,
    ) -> BatchImportResult:
        """自动检测文件类型并导入

        Args:
            content: 文件二进制内容
            filename: 文件名
            mapping: 字段映射配置
            **kwargs: 额外参数

        Returns:
            导入结果
        """
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.csv':
            return await self.import_csv(
                content, filename, mapping,
                delimiter=kwargs.get('delimiter', ','),
                encoding=kwargs.get('encoding', 'utf-8'),
            )
        elif ext in ('.xlsx', '.xls'):
            return await self.import_excel(
                content, filename, mapping,
                sheet_name=kwargs.get('sheet_name'),
            )
        elif ext == '.json':
            return await self.import_json(
                content, filename, mapping,
                array_path=kwargs.get('array_path'),
            )
        else:
            return BatchImportResult(
                total=0,
                success=0,
                failed=1,
                errors=[ImportError(
                    row=0,
                    field="file",
                    message=f"不支持的文件格式: {ext}",
                    value=None,
                )],
                documents=[],
                duration_ms=0,
                message=f"不支持的文件格式: {ext}",
            )


# 全局单例
_importer_instance: Optional[BatchImporter] = None


def get_batch_importer(rag_service: RAGService, user_id: str = "system") -> BatchImporter:
    """获取全局批量导入器单例"""
    global _importer_instance
    if _importer_instance is None:
        _importer_instance = BatchImporter(rag_service, user_id)
    return _importer_instance
