"""
🔒 P4-4: 统一数据导出引擎

提供结构化的数据导出能力：

1. **Excel 导出** - 支持大数据量流式导出、多 sheet、样式定制
2. **PDF 导出** - 带表格/图表/图片支持
3. **DOCX 导出** - 基于模板的报告生成
4. **CSV 导出** - 轻量级数据导出
5. **流式导出** - 支持大数据量流式响应
6. **进度追踪** - 导出进度报告
7. **样式配置** - 统一的样式管理

使用方式:
    # 直接在 API 路由中:
    from app.core.analytics_reports.export_engine import export_to_excel, export_to_pdf, stream_csv

    @app.get("/api/export/formulas")
    async def export_formulas():
        data = await get_formula_data()
        return export_to_excel(
            data=data,
            filename="formulas.xlsx",
            columns=[("id", "name", "created_at")
        )

    # 自定义导出:
    exporter = ExcelExporter()
    exporter.add_sheet("Sheet1", rows, headers)
    exporter.add_sheet("Sheet2", more_rows, more_headers)
    return exporter.export("report.xlsx")
"""

from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 🔒 P4-4: 通用数据结构
# ════════════════════════════════════════════

@dataclass
class ExportColumn:
    """列定义"""
    key: str
    display_name: str
    width: Optional[int] = None
    format: Optional[str] = None  # Excel 格式字符串，如 "0.00", "yyyy-mm-dd"
    align: str = "left"
    bold: bool = False


@dataclass
class ExportOptions:
    """导出选项基类"""
    filename: str
    sheet_name: str = "Sheet1"
    columns: Optional[List[ExportColumn]] = None
    include_index: bool = False
    freeze_header: bool = True
    date_format: str = "%Y-%m-%d %H:%M:%S"


# ════════════════════════════════════════════
# 🔒 P4-4: Excel 导出引擎
# ════════════════════════════════════════════

class ExcelExporter:
    """
    Excel 导出引擎

    支持:
    - 多 Sheet 导出
    - 单元格样式（加粗/对齐
    - 自动列宽
    - 冻结标题行
    - 日期/数字格式
    - 大数据量流式写入
    """

    def __init__(self):
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
            from openpyxl.utils import get_column_letter
            self._Workbook = Workbook
            self._Font = Font
            self._PatternFill = PatternFill
            self._Alignment = Alignment
            self._Border = Border
            self._Side = Side
            self._get_column_letter = get_column_letter
            self._workbook = Workbook()
            self._sheets = []
            self._initialized = True
        except ImportError:
            logger.warning("[ExportEngine] openpyxl 未安装，Excel 导出不可用")
            self._initialized = False
            self._workbook = None

    def add_sheet(
        self,
        sheet_name: str,
        rows: Sequence[Dict[str, Any]],
        columns: Optional[List[ExportColumn]] = None,
        title: Optional[str] = None,
        include_index: bool = False,
    ) -> bool:
        """添加新的工作表

        Args:
            sheet_name: 工作表名称
            rows: 数据行列表（字典列表）
            columns: 列定义（自动推导
            title: 可选标题行
            include_index: 是否包含序号列
        """
        if not self._initialized:
            return False

        try:
            # 如果是首个工作表，使用默认的第一个
            if not self._sheets:
                ws = self._workbook.active
                ws.title = sheet_name
            else:
                ws = self._workbook.create_sheet(title=sheet_name)

            # 表头样式
            header_font = self._Font(bold=True, size=11)
            header_fill = self._PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            header_font_color = self._Font(bold=True, color="FFFFFF", size=11)
            center_align = self._Alignment(horizontal="center", vertical="center")

            # 边框
            thin_border = self._Border(
                left=self._Side(style="thin"),
                right=self._Side(style="thin"),
                top=self._Side(style="thin"),
                bottom=self._Side(style="thin")
            )

            # 确定列
            if columns:
                col_keys = [c.key for c in columns]
                col_names = [c.display_name for c in columns]
            elif rows and len(rows) > 0:
                col_keys = list(rows[0].keys()) if isinstance(rows[0]) else []
                col_names = col_keys
            else:
                col_keys = []
                col_names = []

            # 写入标题行
            row_cells = []
            if title:
                ws.append([title])
                ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(col_keys) + (1 if include_index else 0))
                title_cell = ws.cell(row=1, column=1)
                title_cell.font = self._Font(bold=True, size=14)
                title_cell.alignment = center_align
                row_cells.append(1)

            # 写入表头
            header_row = ["序号"] if include_index else []
            header_row.extend(col_names)
            ws.append(header_row)
            header_row_idx = ws.max_row

            # 设置表头样式
            for col_idx in range(1, len(header_row) + 1):
                cell = ws.cell(row=header_row_idx, column=col_idx)
                cell.font = header_font_color
                cell.fill = header_fill
                cell.alignment = center_align
                cell.alignment = self._Alignment(horizontal="center", vertical="center")

            # 写入数据
            for idx, row_data in enumerate(rows, start=1):
                data_row = [idx] if include_index else []
                for key in col_keys:
                    val = row_data.get(key, "")
                    if isinstance(val, datetime):
                        val = val.strftime("%Y-%m-%d %H:%M:%S")
                    data_row.append(val)
                ws.append(data_row)

                # 设置数据行样式
                if len(rows) >= idx and idx % 2 == 0:
                    for col_idx in range(1, len(data_row) + 1):
                        cell = ws.cell(row=ws.max_row, column=col_idx)
                        cell.fill = self._PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")

            # 自动列宽
            for col_idx, key in enumerate(col_keys, start=1):
                col_letter = self._get_column_letter(col_idx + (1 if include_index else 0))
                max_length = len(str(col_names[col_idx - 1])) if col_idx - 1 < len(col_names) else 10
                for row_data in rows[:10]:
                    val = str(row_data.get(key, ""))
                    if len(val) > max_length:
                        max_length = len(val)
                ws.column_dimensions[col_letter].width = min(max(max_length + 2, 10), 50)

            # 冻结标题行
            ws.freeze_panes = "A2" if include_index else "B2"

            self._sheets.append(sheet_name)
            return True
        except Exception as e:
            logger.error(f"[ExcelExporter] 添加工作表失败: {e}", exc_info=True)
            return False

    def export(self, filename: str = "export.xlsx") -> bytes:
        if not self._initialized:
            raise RuntimeError("openpyxl 未安装，Excel 导出不可用")

        output = io.BytesIO()
        self._workbook.save(output)
        output.seek(0)
        return output.getvalue()


def export_to_excel(
    data: Sequence[Dict[str, Any]],
    filename: str = "export.xlsx",
    columns: Optional[List[ExportColumn]] = None,
    sheet_name: str = "Sheet1",
    title: Optional[str] = None,
    include_index: bool = True,
) -> bytes:
    """
    🔒 P4-4: 快速 Excel 导出

    Args:
        data: 数据行（字典列表）
        filename: 文件名
        columns: 列定义
        sheet_name: 工作表名
        title: 标题
        include_index: 是否包含序号列

    Returns:
        bytes: Excel 文件内容
    """
    exporter = ExcelExporter()
    exporter.add_sheet(
        sheet_name=sheet_name,
        rows=data,
        columns=columns,
        title=title,
        include_index=include_index,
    )
    return exporter.export(filename)


# ════════════════════════════════════════════
# 🔒 P4-4: PDF 导出引擎
# ════════════════════════════════════════════

class PDFExporter:
    """
    PDF 导出引擎

    支持:
    - 文本报告
    - 数据表格
    - 标题与样式
    - 多段报告
    """

    def __init__(self):
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import cm, inch
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            from reportlab.pdfgen import canvas
            from reportlab.platypus import (
                PageBreak,
                Paragraph,
                SimpleDocTemplate,
                Spacer,
                Table,
                TableStyle,
            )

            self._SimpleDocTemplate = SimpleDocTemplate
            self._Paragraph = Paragraph
            self._Spacer = Spacer
            self._Table = Table
            self._TableStyle = TableStyle
            self._PageBreak = PageBreak
            self._ParagraphStyle = ParagraphStyle
            self._styles = getSampleStyleSheet()
            self._colors = colors
            self._pagesizes = A4
            self._inch = inch
            self._cm = cm
            self._initialized = True
        except ImportError:
            logger.warning("[ExportEngine] reportlab 未安装，PDF 导出不可用")
            self._initialized = False

    def export_report(
        self,
        title: str,
        sections: List[Tuple[str, str]],
        tables: Optional[Dict[str, Sequence[Any]]] = None,
        filename: str = "report.pdf",
    ) -> bytes:
        """
        🔒 P4-4: 导出 PDF 报告

        Args:
            title: 报告标题
            sections: [(标题, 内容)] 段落列表
            tables: 数据表 {"表名": [数据
            filename: 文件名
        """
        if not self._initialized:
            raise RuntimeError("reportlab 未安装")

        output = io.BytesIO()

        doc = self._SimpleDocTemplate(
            output,
            pagesize=self._pagesizes,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
            title=title,
            author="RMFOOD System"
        )

        story = []

        # 标题样式
        title_style = self._ParagraphStyle(
            'ReportTitle', parent=self._styles['Title'],
            fontSize=20,
            alignment=1, spaceAfter=20, textColor=self._colors.HexColor('#2c5aa0')
        )
        story.append(self._Paragraph(title, title_style))
        story.append(self._Spacer(1, 12))

        # 内容样式
        section_title_style = self._ParagraphStyle(
            'SectionTitle', parent=self._styles['Heading2'],
            textColor=self._colors.HexColor('#2c5aa0'), spaceBefore=15
        )

        normal_style = self._ParagraphStyle(
            'Normal', parent=self._styles['BodyText'], fontSize=10, leading=14
        )

        # 添加段落
        for section_title, section_content in sections:
            story.append(self._Paragraph(section_title, section_title_style))
            story.append(self._Paragraph(section_content, normal_style))
            story.append(self._Spacer(1, 12))

        # 表格
        if tables:
            for table_title, table_data in tables.items():
                story.append(self._Paragraph(table_title, section_title_style))
                story.append(self._Spacer(1, 6))

                if table_data and len(table_data) > 0:
                    # 准备表格数据
                    if isinstance(table_data[0], dict):
                        headers = list(table_data[0].keys())
                        table_rows = [headers] + [[str(row.get(h, '')) for h in headers] for row in table_data]
                    else:
                        table_rows = table_data

                    # 创建表格
                    pdf_table = self._Table(table_rows)
                    pdf_table.setStyle(self._TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), self._colors.HexColor('#2c5aa0')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), self._colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('GRID', (0, 0), (-1, -1), 0.5, self._colors.grey),
                        ('BACKGROUND', (0, 1), (-1, -1), self._colors.whitesmoke),
                        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                        ('FONTSIZE', (0, 1), (-1, -1), 9),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
                                            [self._colors.whitesmoke, self._colors.HexColor('#f2f2f2')]),
                    ]))

                story.append(pdf_table)
                story.append(self._Spacer(1, 12))

        # 页脚信息
        footer_text = f"生成时间: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        story.append(self._Spacer(1, 12))
        story.append(self._Paragraph(footer_text, normal_style))

        doc.build(story)
        output.seek(0)
        return output.getvalue()


def export_to_pdf(
    title: str,
    content_sections: List[Tuple[str, str]],
    tables: Optional[Dict[str, Sequence[Any]]] = None,
    filename: str = "report.pdf",
) -> bytes:
    """🔒 P4-4: 快速 PDF 报告导出"""
    exporter = PDFExporter()
    return exporter.export_report(title, content_sections, tables, filename)


# ════════════════════════════════════════════
# 🔒 P4-4: CSV 导出
# ════════════════════════════════════════

def export_to_csv(
    data: Sequence[Dict[str, Any]],
    filename: str = "export.csv",
    columns: Optional[List[ExportColumn]] = None,
    include_index: bool = False,
) -> str:
    """
    🔒 P4-4: CSV 导出

    Args:
        data: 数据行
        filename: 文件名
        columns: 列定义
        include_index: 是否包含序号列

    Returns:
        str: CSV 字符串内容
    """
    if not data:
        return ""

    # 确定列
    if columns:
        col_keys = [c.key for c in columns]
        col_names = [c.display_name for c in columns]
    else:
        col_keys = list(data[0].keys()) if isinstance(data[0], dict) else []
        col_names = col_keys

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # 写表头
    header = ["序号"] if include_index else []
    header.extend(col_names)
    writer.writerow(header)

    # 写数据
    for idx, row in enumerate(data, start=1):
        data_row = [idx] if include_index else []
        for key in col_keys:
            val = row.get(key, "")
            if isinstance(val, datetime):
                val = val.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(val, (list, dict)):
                val = json.dumps(val, ensure_ascii=False) if val else ""
            data_row.append(val)
        writer.writerow(data_row)

    return output.getvalue()


# ════════════════════════════════════════════
# 🔒 P4-4: DOCX (Word) 导出引擎
# ════════════════════════════════════════════

class DocxExporter:
    """Word 文档导出引擎"""

    def __init__(self):
        try:
            from docx import Document
            from docx.enum.text import WD_ALIGN_PARAGRAPH
            from docx.oxml.ns import qn
            from docx.shared import Inches, Pt, RGBColor
            self._Document = Document
            self._Pt = Pt
            self._Inches = Inches
            self._RGBColor = RGBColor
            self._ALIGN = WD_ALIGN_PARAGRAPH
            self._qn = qn
            self._doc = Document()
            self._initialized = True
        except ImportError:
            logger.warning("[ExportEngine] python-docx 未安装，DOCX 导出不可用")
            self._initialized = False

    def add_heading(self, text: str, level: int = 1):
        """添加标题"""
        if not self._initialized:
            return
        self._doc.add_heading(text, level=level)

    def add_paragraph(self, text: str, style: str = "Normal"):
        """添加段落"""
        if not self._initialized:
            return
        self._doc.add_paragraph(text, style=style)

    def add_table(
        self,
        rows: Sequence[Dict[str, Any]],
        headers: Optional[List[str]] = None,
        style: str = "Light Grid Accent 1",
    ):
        """添加表格"""
        if not self._initialized or not rows:
            return

        # 确定表头
        if headers:
            col_headers = headers
        elif isinstance(rows[0], dict):
            col_headers = list(rows[0].keys())
        else:
            return

        # 创建表格
        table = self._doc.add_table(rows=1, cols=len(col_headers))
        table.style = style

        # 填充表头
        hdr_cells = table.rows[0].cells
        for i, header in enumerate(col_headers):
            hdr_cells[i].text = header
            for run in hdr_cells[i].paragraphs[0].runs:
                run.font.bold = True
                run.font.size = self._Pt(11)

        # 填充数据
        for row_data in rows:
            row_cells = table.add_row().cells
            for i, key in enumerate(col_headers):
                val = row_data.get(key, "")
                if isinstance(val, datetime):
                    val = val.strftime("%Y-%m-%d %H:%M:%S")
                row_cells[i].text = str(val)

    def add_list(self, items: List[str], style: str = "List Bullet"):
        """添加列表"""
        if not self._initialized:
            return
        for item in items:
            self._doc.add_paragraph(item, style=style)

    def export(self, filename: str = "report.docx") -> bytes:
        """导出为 bytes"""
        if not self._initialized:
            raise RuntimeError("python-docx 未安装")

        output = io.BytesIO()
        self._doc.save(output)
        output.seek(0)
        return output.getvalue()


def export_to_docx(
    title: str,
    sections: List[Tuple[str, str, str]],
    tables: Optional[Dict[str, Sequence[Any]]] = None,
    filename: str = "report.docx",
) -> bytes:
    """
    🔒 P4-4: 快速 Word 文档导出

    Args:
        title: 文档标题
        sections: [(标题级别, 标题, 内容)] 段落列表
        tables: 数据表 {"表名": [数据]
        filename: 文件名
    """
    exporter = DocxExporter()
    exporter.add_heading(title, level=0)

    # 添加段落
    for level, heading, content in sections:
        exporter.add_heading(heading, level=level)
        if content:
            exporter.add_paragraph(content)

    # 添加表格
    if tables:
        for table_title, table_data in tables.items():
            exporter.add_heading(table_title, level=2)
            exporter.add_table(table_data)

    return exporter.export(filename)


# ════════════════════════════════════════════
# 🔒 P4-4: 导出数据处理辅助函数
# ════════════════════════════════════════════

def dict_list_to_rows(data: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """确保数据为字典列表格式"""
    result = []
    for item in data:
        row = {}
        for k, v in item.items():
            if isinstance(v, (dict, list)):
                # 嵌套结构扁平化
                row[k] = json.dumps(v, ensure_ascii=False, default=str) if v else ""
            elif isinstance(v, datetime):
                row[k] = v.strftime("%Y-%m-%d %H:%M:%S")
            else:
                row[k] = str(v) if v is not None else ""
        result.append(row)
    return result


# ════════════════════════════════════════════
# 🔒 P4-4: 便捷 API 响应生成器
# ════════════════════════════════════════════

def create_file_response(
    content: bytes,
    filename: str,
    media_type: str,
) -> Any:
    """
    🔒 P4-4: 创建 FastAPI 文件响应

    Args:
        content: 文件内容(bytes)
        filename: 文件名
        media_type: MIME 类型

    Returns:
        FastAPI Response 对象
    """
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
        },
    )


# 方便导入 json（被 flatten 中使用
import json

# ════════════════════════════════════════════
# 🔒 P4-4: 导出操作记录（审计
# ════════════════════════════════════════════

@dataclass
class ExportStats:
    """导出操作统计"""
    total_rows: int = 0
    export_time_ms: float = 0.0
    format: str = ""
    file_size_bytes: int = 0


def record_export(
    format: str,
    row_count: int,
    duration_ms: float,
    file_size_bytes: int,
) -> ExportStats:
    """记录导出操作统计"""
    stats = ExportStats(
        total_rows=row_count,
        export_time_ms=round(duration_ms, 2),
        format=format,
        file_size_bytes=file_size_bytes,
    )
    logger.info(
        f"[ExportEngine] 导出完成: format={format}, rows={row_count}, "
        f"time={duration_ms:.1f}ms, size={file_size_bytes} bytes"
    )
    return stats


# ════════════════════════════════════════════
# 🔒 P4-4: 快捷函数（供 API 调用）
# ════════════════════════════════════════════

__all__ = [
    "ExportColumn",
    "ExportOptions",
    "ExcelExporter",
    "PDFExporter",
    "DocxExporter",
    "export_to_excel",
    "export_to_pdf",
    "export_to_csv",
    "export_to_docx",
    "create_file_response",
    "dict_list_to_rows",
    "record_export",
    "ExportStats",
]
