"""
文件生成服务模块
支持 PDF、DOCX、XLSX 等主流文档格式的动态生成
包含异步任务队列、临时文件管理、中文字体支持
"""
import os
import uuid
import logging
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Any
from pathlib import Path
from io import BytesIO
import threading
import time

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from fastapi import UploadFile

from ..core.config import settings

logger = logging.getLogger(__name__)


class FileFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ChineseFont:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.font_paths = self._detect_font_paths()
        self._register_fonts()

    def _detect_font_paths(self) -> dict:
        base_font = "C:/Windows/Fonts/"
        return {
            "source_hans_serif": os.path.join(base_font, "SourceHanSerifSC-Regular.otf"),
            "source_hans_serif_bold": os.path.join(base_font, "SourceHanSerifSC-Bold.otf"),
            "source_hans": os.path.join(base_font, "SourceHanSansSC-Regular.otf"),
            "source_hans_bold": os.path.join(base_font, "SourceHanSansSC-Bold.otf"),
            "simsun": os.path.join(base_font, "simsun.ttc"),
            "simhei": os.path.join(base_font, "simhei.ttf"),
            "msyh": os.path.join(base_font, "msyh.ttc"),
            "msyhbd": os.path.join(base_font, "msyhbd.ttc"),
        }

    def _register_fonts(self):
        for name, path in self.font_paths.items():
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    logger.info(f"成功注册字体: {name} -> {path}")
                except Exception as e:
                    logger.warning(f"注册字体失败 {name}: {e}")

    def get_font_name(self, bold: bool = False, serif: bool = True) -> str:
        if serif:
            if bold:
                if os.path.exists(self.font_paths.get("source_hans_serif_bold", "")):
                    return "source_hans_serif_bold"
                if os.path.exists(self.font_paths.get("simsun", "")):
                    return "simsun"
                return "Helvetica-Bold"
            else:
                if os.path.exists(self.font_paths.get("source_hans_serif", "")):
                    return "source_hans_serif"
                if os.path.exists(self.font_paths.get("simsun", "")):
                    return "simsun"
                return "Helvetica"
        else:
            if bold:
                if os.path.exists(self.font_paths.get("source_hans_bold", "")):
                    return "source_hans_bold"
                if os.path.exists(self.font_paths.get("msyhbd", "")):
                    return "msyhbd"
                return "Helvetica-Bold"
            else:
                if os.path.exists(self.font_paths.get("source_hans", "")):
                    return "source_hans"
                if os.path.exists(self.font_paths.get("msyh", "")):
                    return "msyh"
                return "Helvetica"

    def get_docx_font(self, bold: bool = False, serif: bool = True) -> tuple:
        if serif:
            if bold:
                if os.path.exists(self.font_paths.get("source_hans_serif_bold", "")):
                    return "Source Han Serif SC Bold", "Source Han Serif SC Bold"
                return "SimSun", "SimSun"
            else:
                if os.path.exists(self.font_paths.get("source_hans_serif", "")):
                    return "Source Han Serif SC", "Source Han Serif SC"
                return "SimSun", "SimSun"
        else:
            if bold:
                if os.path.exists(self.font_paths.get("source_hans_bold", "")):
                    return "Source Han Sans SC Bold", "Source Han Sans SC Bold"
                if os.path.exists(self.font_paths.get("msyhbd", "")):
                    return "Microsoft YaHei Bold", "Microsoft YaHei Bold"
                return "SimHei", "SimHei"
            else:
                if os.path.exists(self.font_paths.get("source_hans", "")):
                    return "Source Han Sans SC", "Source Han Sans SC"
                if os.path.exists(self.font_paths.get("msyh", "")):
                    return "Microsoft YaHei", "Microsoft YaHei"
                return "SimSun", "SimSun"


chinese_font = ChineseFont()


class TaskInfo:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.status = TaskStatus.PENDING
        self.progress = 0
        self.file_path: Optional[str] = None
        self.file_name: Optional[str] = None
        self.file_size: int = 0
        self.error_message: Optional[str] = None
        self.created_at = datetime.now()
        self.completed_at: Optional[datetime] = None


class FileGeneratorService:
    _temp_dir = Path("./temp_files")
    _max_file_size_mb = 50
    _cleanup_interval_hours = 24

    def __init__(self):
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        self._tasks: dict[str, TaskInfo] = {}
        self._tasks_lock = threading.Lock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._running = False

    def start_cleanup_timer(self):
        if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
            self._running = True
            self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
            self._cleanup_thread.start()
            logger.info("临时文件清理线程已启动")

    def _cleanup_loop(self):
        while self._running:
            time.sleep(3600)
            if not self._running:
                break
            self._cleanup_old_files()

    def _cleanup_old_files(self):
        cutoff = datetime.now() - timedelta(hours=self._cleanup_interval_hours)
        cleaned = 0
        for file in self._temp_dir.glob("*"):
            if file.is_file():
                mtime = datetime.fromtimestamp(file.stat().st_mtime)
                if mtime < cutoff:
                    try:
                        file.unlink()
                        cleaned += 1
                    except Exception as e:
                        logger.warning(f"清理文件失败 {file}: {e}")
        if cleaned > 0:
            logger.info(f"已清理 {cleaned} 个过期临时文件")

    def stop_cleanup_timer(self):
        self._running = False

    def _create_task(self) -> TaskInfo:
        task_id = str(uuid.uuid4())
        task_info = TaskInfo(task_id)
        with self._tasks_lock:
            self._tasks[task_id] = task_info
        self.start_cleanup_timer()
        return task_info

    def _update_task(self, task_id: str, **kwargs):
        with self._tasks_lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)

    def get_task_status(self, task_id: str) -> Optional[TaskInfo]:
        with self._tasks_lock:
            return self._tasks.get(task_id)

    def generate_file(
        self,
        content: dict,
        format: FileFormat,
        file_name: str,
        task_id: Optional[str] = None
    ) -> tuple[str, str]:
        if task_id is None:
            task_info = self._create_task()
            task_id = task_info.task_id
        else:
            task_info = self._create_task()
            task_id = task_info.task_id

        self._update_task(task_id, status=TaskStatus.PROCESSING)

        try:
            if format == FileFormat.PDF:
                file_path, size = self._generate_pdf(content, file_name, task_id)
            elif format == FileFormat.DOCX:
                file_path, size = self._generate_docx(content, file_name, task_id)
            elif format == FileFormat.XLSX:
                file_path, size = self._generate_xlsx(content, file_name, task_id)
            else:
                raise ValueError(f"不支持的格式: {format}")

            self._update_task(
                task_id,
                status=TaskStatus.COMPLETED,
                progress=100,
                file_path=file_path,
                file_name=file_name,
                file_size=size,
                completed_at=datetime.now()
            )

            logger.info(f"文件生成完成: {file_name} ({size} bytes)")
            return file_path, file_name

        except Exception as e:
            logger.error(f"文件生成失败: {e}")
            self._update_task(
                task_id,
                status=TaskStatus.FAILED,
                error_message=str(e)
            )
            raise

    async def generate_file_async(
        self,
        content: dict,
        format: FileFormat,
        file_name: str
    ) -> str:
        loop = asyncio.get_event_loop()
        task_info = self._create_task()
        task_id = task_info.task_id

        def sync_generate():
            return self.generate_file(content, format, file_name, task_id)

        file_path, _ = await loop.run_in_executor(None, sync_generate)
        return task_id

    def _generate_pdf(self, content: dict, file_name: str, task_id: str) -> tuple[str, int]:
        self._update_task(task_id, progress=10)

        file_path = self._temp_dir / f"{uuid.uuid4()}.pdf"
        doc = SimpleDocTemplate(
            str(file_path),
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )

        styles = getSampleStyleSheet()
        font_name = chinese_font.get_font_name(serif=True)
        font_name_bold = chinese_font.get_font_name(bold=True, serif=True)

        styles.add(ParagraphStyle(
            name='ChineseTitle',
            fontName=font_name_bold,
            fontSize=18,
            leading=26,
            alignment=TA_CENTER,
            spaceAfter=24,
            spaceBefore=12
        ))
        styles.add(ParagraphStyle(
            name='ChineseHeading1',
            fontName=font_name_bold,
            fontSize=15,
            leading=22,
            alignment=TA_LEFT,
            spaceBefore=18,
            spaceAfter=12,
            leftIndent=0,
            borderPadding=(0, 0, 4, 0),
            borderWidth=0,
            borderColor=None,
        ))
        styles.add(ParagraphStyle(
            name='ChineseHeading2',
            fontName=font_name_bold,
            fontSize=13,
            leading=18,
            alignment=TA_LEFT,
            spaceBefore=14,
            spaceAfter=8
        ))
        styles.add(ParagraphStyle(
            name='ChineseBody',
            fontName=font_name,
            fontSize=11,
            leading=20,
            alignment=TA_JUSTIFY,
            spaceBefore=8,
            spaceAfter=8,
            firstLineIndent=22
        ))
        styles.add(ParagraphStyle(
            name='ChineseCoverTitle',
            fontName=font_name_bold,
            fontSize=26,
            leading=34,
            alignment=TA_CENTER,
            spaceAfter=36
        ))
        styles.add(ParagraphStyle(
            name='ChineseCoverSubtitle',
            fontName=font_name,
            fontSize=14,
            leading=20,
            alignment=TA_CENTER,
            spaceAfter=20
        ))

        self._update_task(task_id, progress=30)

        story = []

        # 处理封面
        if "cover" in content:
            cover = content["cover"]
            story.append(Paragraph(cover.get("title", ""), styles["ChineseCoverTitle"]))
            story.append(Paragraph(cover.get("subtitle", ""), styles["ChineseCoverSubtitle"]))
            story.append(Paragraph(cover.get("date", ""), styles["ChineseBody"]))
            story.append(PageBreak())

        # 处理目录
        if "table_of_contents" in content:
            toc = content["table_of_contents"]
            story.append(Paragraph("目录", styles["ChineseTitle"]))
            for item in toc:
                level = item.get("level", 1)
                indent = (level - 1) * 20
                story.append(Paragraph(item.get("title", ""), styles["ChineseBody"]))
            story.append(PageBreak())

        # 处理传统内容结构
        if "title" in content:
            story.append(Paragraph(content["title"], styles["ChineseTitle"]))
            story.append(Spacer(1, 12))

        # 处理特殊结构（中药配方报告）
        special_sections = [
            ("basic_info", "基本信息"),
            ("ingredients", "成分表"),
            ("effects", "功效主治"),
            ("usage", "用法用量"),
            ("notes", "注意事项"),
            ("references", "参考文献")
        ]

        for section_key, section_title in special_sections:
            if section_key in content:
                section_items = content[section_key]
                if section_items:
                    story.append(Paragraph(section_title, styles["ChineseHeading1"]))
                    for item in section_items:
                        if isinstance(item, dict):
                            if "heading" in item:
                                story.append(Paragraph(item["heading"], styles["ChineseHeading2"]))
                            if "content" in item:
                                for para in item["content"]:
                                    story.append(Paragraph(str(para), styles["ChineseBody"]))
                            if "table" in item:
                                table_data = item["table"].get("data", [])
                                headers = item["table"].get("headers", [])
                                if headers:
                                    table_data.insert(0, headers)
                                if table_data:
                                    t = Table(table_data)
                                    t.setStyle(TableStyle([
                                        ('BACKGROUND', (0, 0), (-1, 0), '#4472C4'),
                                        ('TEXTCOLOR', (0, 0), (-1, 0), '#ffffff'),
                                        ('FONTNAME', (0, 0), (-1, -1), font_name),
                                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                        ('GRID', (0, 0), (-1, -1), 0.5, '#000000'),
                                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                                    ]))
                                    story.append(t)
                                    story.append(Spacer(1, 12))
                        else:
                            story.append(Paragraph(str(item), styles["ChineseBody"]))

        # 处理通用sections
        if "sections" in content:
            total_sections = len(content["sections"])
            for i, section in enumerate(content["sections"]):
                if "heading" in section:
                    story.append(Paragraph(section["heading"], styles["ChineseHeading1"]))
                if "content" in section:
                    for para in section["content"]:
                        story.append(Paragraph(str(para), styles["ChineseBody"]))
                if "table" in section:
                    table_data = section["table"].get("data", [])
                    headers = section["table"].get("headers", [])
                    if headers:
                        table_data.insert(0, headers)
                    if table_data:
                        t = Table(table_data)
                        t.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), '#4472C4'),
                            ('TEXTCOLOR', (0, 0), (-1, 0), '#ffffff'),
                            ('FONTNAME', (0, 0), (-1, -1), font_name),
                            ('FONTSIZE', (0, 0), (-1, -1), 9),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('GRID', (0, 0), (-1, -1), 0.5, '#000000'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('TOPPADDING', (0, 0), (-1, -1), 6),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ]))
                        story.append(t)
                        story.append(Spacer(1, 12))
                self._update_task(task_id, progress=30 + int((i + 1) / total_sections * 50))

        if "footer" in content:
            story.append(Spacer(1, 30))
            story.append(Paragraph(content["footer"], styles["ChineseBody"]))

        self._update_task(task_id, progress=85)

        doc.build(story)
        size = file_path.stat().st_size

        if size > self._max_file_size_mb * 1024 * 1024:
            file_path.unlink()
            raise ValueError(f"文件大小超过限制 ({self._max_file_size_mb}MB)")

        self._update_task(task_id, progress=100)
        return str(file_path), size

    def _generate_docx(self, content: dict, file_name: str, task_id: str) -> tuple[str, int]:
        self._update_task(task_id, progress=10)

        file_path = self._temp_dir / f"{uuid.uuid4()}.docx"
        doc = Document()
        font_name, font_name_bold = chinese_font.get_docx_font(serif=True)
        style = doc.styles['Normal']
        style.font.name = font_name
        style.font.size = Pt(11)
        style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        style.paragraph_format.space_after = Pt(10)
        style.paragraph_format.line_spacing = 1.5

        self._update_task(task_id, progress=30)

        # 处理封面
        if "cover" in content:
            cover = content["cover"]
            title = doc.add_heading(cover.get("title", ""), 0)
            title.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in title.runs:
                run.font.name = font_name_bold
                run.font.size = Pt(28)
                run.font.color.rgb = RGBColor(0, 51, 102)
            
            subtitle = doc.add_paragraph(cover.get("subtitle", ""))
            subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in subtitle.runs:
                run.font.name = font_name
                run.font.size = Pt(16)
                run.font.color.rgb = RGBColor(0, 82, 155)
            
            date = doc.add_paragraph(cover.get("date", ""))
            date.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in date.runs:
                run.font.name = font_name
                run.font.size = Pt(12)
            
            doc.add_page_break()

        # 处理目录
        if "table_of_contents" in content:
            toc = content["table_of_contents"]
            title = doc.add_heading("目录", 0)
            title.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in title.runs:
                run.font.name = font_name_bold
                run.font.size = Pt(18)
                run.font.color.rgb = RGBColor(0, 51, 102)
            
            for item in toc:
                level = item.get("level", 1)
                indent = (level - 1) * 0.5
                p = doc.add_paragraph(item.get("title", ""))
                p.paragraph_format.left_indent = Inches(indent)
                for run in p.runs:
                    run.font.name = font_name
                    run.font.size = Pt(11)
            
            doc.add_page_break()

        # 处理传统内容结构
        if "title" in content:
            title = doc.add_heading(content["title"], 0)
            title.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in title.runs:
                run.font.name = font_name_bold
                run.font.size = Pt(22)
                run.font.color.rgb = RGBColor(0, 51, 102)

        # 处理特殊结构（中药配方报告）
        special_sections = [
            ("basic_info", "基本信息"),
            ("ingredients", "成分表"),
            ("effects", "功效主治"),
            ("usage", "用法用量"),
            ("notes", "注意事项"),
            ("references", "参考文献")
        ]

        for section_key, section_title in special_sections:
            if section_key in content:
                section_items = content[section_key]
                if section_items:
                    heading = doc.add_heading(section_title, level=1)
                    heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    for run in heading.runs:
                        run.font.name = font_name_bold
                        run.font.size = Pt(14)
                        run.font.color.rgb = RGBColor(0, 82, 155)
                    
                    for item in section_items:
                        if isinstance(item, dict):
                            if "heading" in item:
                                subheading = doc.add_heading(item["heading"], level=2)
                                subheading.alignment = WD_ALIGN_PARAGRAPH.LEFT
                                for run in subheading.runs:
                                    run.font.name = font_name_bold
                                    run.font.size = Pt(12)
                            if "content" in item:
                                for para_text in item["content"]:
                                    p = doc.add_paragraph(str(para_text))
                                    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                                    for run in p.runs:
                                        run.font.name = font_name
                                        run.font.size = Pt(11)
                            if "table" in item:
                                table_data = item["table"].get("data", [])
                                headers = item["table"].get("headers", [])
                                if headers:
                                    table_data.insert(0, headers)
                                if table_data:
                                    num_cols = max((len(row) for row in table_data), default=0)
                                    t = doc.add_table(rows=len(table_data), cols=num_cols)
                                    t.style = 'Table Grid'
                                    header_row = headers if headers else table_data[0]
                                    role_col_idx = None
                                    for idx, h in enumerate(header_row):
                                        if any(keyword in str(h) for keyword in ['角色', '组分类型', '组方位置']):
                                            role_col_idx = idx
                                            break
                                    for row_idx, row_data in enumerate(table_data):
                                        row = t.rows[row_idx]
                                        for col_idx, cell_text in enumerate(row_data):
                                            cell = row.cells[col_idx]
                                            cell_text_str = str(cell_text)
                                            is_highlight = role_col_idx is not None and col_idx == role_col_idx and any(r in cell_text_str for r in ['君', '臣', '佐', '使'])
                                            para = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
                                            para.alignment = WD_ALIGN_PARAGRAPH.CENTER if (col_idx == 0 or (role_col_idx is not None and col_idx == role_col_idx)) else WD_ALIGN_PARAGRAPH.LEFT
                                            run = para.add_run(cell_text_str)
                                            run.font.name = font_name_bold if (row_idx == 0 or is_highlight) else font_name
                                            run.font.size = Pt(10)
                                            if row_idx == 0:
                                                run.font.bold = True
                                                run.font.color.rgb = RGBColor(255, 255, 255)
                                            elif is_highlight:
                                                run.font.color.rgb = RGBColor(20, 85, 80)
                                    doc.add_paragraph()
                        else:
                            p = doc.add_paragraph(str(item))
                            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                            for run in p.runs:
                                run.font.name = font_name
                                run.font.size = Pt(11)

        # 处理通用sections
        if "sections" in content:
            total_sections = len(content["sections"])
            for i, section in enumerate(content["sections"]):
                if "heading" in section:
                    heading = doc.add_heading(section["heading"], level=1)
                    heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    for run in heading.runs:
                        run.font.name = font_name_bold
                        run.font.size = Pt(14)
                        run.font.color.rgb = RGBColor(0, 82, 155)

                if "content" in section:
                    for para_text in section["content"]:
                        p = doc.add_paragraph(str(para_text))
                        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                        for run in p.runs:
                            run.font.name = font_name
                            run.font.size = Pt(11)

                if "table" in section:
                    table_data = section["table"].get("data", [])
                    headers = section["table"].get("headers", [])
                    if headers:
                        table_data.insert(0, headers)
                    if table_data:
                        num_cols = max((len(row) for row in table_data), default=0)
                        t = doc.add_table(rows=len(table_data), cols=num_cols)
                        t.style = 'Table Grid'
                        header_row = headers if headers else table_data[0]
                        role_col_idx = None
                        for idx, h in enumerate(header_row):
                            if any(keyword in str(h) for keyword in ['角色', '组分类型', '组方位置']):
                                role_col_idx = idx
                                break
                        for row_idx, row_data in enumerate(table_data):
                            row = t.rows[row_idx]
                            for col_idx, cell_text in enumerate(row_data):
                                cell = row.cells[col_idx]
                                cell_text_str = str(cell_text)
                                is_highlight = role_col_idx is not None and col_idx == role_col_idx and any(r in cell_text_str for r in ['君', '臣', '佐', '使'])
                                para = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
                                para.alignment = WD_ALIGN_PARAGRAPH.CENTER if (col_idx == 0 or (role_col_idx is not None and col_idx == role_col_idx)) else WD_ALIGN_PARAGRAPH.LEFT
                                run = para.add_run(cell_text_str)
                                run.font.name = font_name_bold if (row_idx == 0 or is_highlight) else font_name
                                run.font.size = Pt(10)
                                if row_idx == 0:
                                    run.font.bold = True
                                    run.font.color.rgb = RGBColor(255, 255, 255)
                                elif is_highlight:
                                    run.font.color.rgb = RGBColor(20, 85, 80)
                        doc.add_paragraph()

                self._update_task(task_id, progress=30 + int((i + 1) / total_sections * 50))

        if "footer" in content:
            doc.add_paragraph()
            footer = doc.add_paragraph(content["footer"])
            footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in footer.runs:
                run.font.name = font_name
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(128, 128, 128)

        self._update_task(task_id, progress=90)

        doc.save(str(file_path))
        size = file_path.stat().st_size

        if size > self._max_file_size_mb * 1024 * 1024:
            file_path.unlink()
            raise ValueError(f"文件大小超过限制 ({self._max_file_size_mb}MB)")

        self._update_task(task_id, progress=100)
        return str(file_path), size

    def _generate_xlsx(self, content: dict, file_name: str, task_id: str) -> tuple[str, int]:
        self._update_task(task_id, progress=10)

        file_path = self._temp_dir / f"{uuid.uuid4()}.xlsx"
        wb = Workbook()
        ws = wb.active
        ws.title = content.get("sheet_name", "数据表")

        header_font = Font(name='Microsoft YaHei', bold=True, size=11, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_alignment = Alignment(horizontal='center', vertical='center')
        cell_font = Font(name='Microsoft YaHei', size=10)
        cell_alignment = Alignment(horizontal='left', vertical='center')
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )

        current_row = 1

        # 处理封面信息（简化版）
        if "cover" in content:
            cover = content["cover"]
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=10)
            title_cell = ws.cell(row=current_row, column=1, value=cover.get("title", ""))
            title_cell.font = Font(name='Microsoft YaHei', bold=True, size=16)
            title_cell.alignment = Alignment(horizontal='center', vertical='center')
            ws.row_dimensions[current_row].height = 30
            current_row += 1
            
            if cover.get("subtitle"):
                ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=10)
                subtitle_cell = ws.cell(row=current_row, column=1, value=cover.get("subtitle"))
                subtitle_cell.font = Font(name='Microsoft YaHei', size=12)
                subtitle_cell.alignment = Alignment(horizontal='center', vertical='center')
                current_row += 1
            
            if cover.get("date"):
                ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=10)
                date_cell = ws.cell(row=current_row, column=1, value=cover.get("date"))
                date_cell.font = Font(name='Microsoft YaHei', size=10)
                date_cell.alignment = Alignment(horizontal='center', vertical='center')
                current_row += 2

        # 处理传统内容结构
        if "title" in content:
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=10)
            title_cell = ws.cell(row=current_row, column=1, value=content["title"])
            title_cell.font = Font(name='Microsoft YaHei', bold=True, size=16)
            title_cell.alignment = Alignment(horizontal='center', vertical='center')
            ws.row_dimensions[current_row].height = 30
            current_row += 2

        self._update_task(task_id, progress=30)

        # 处理特殊结构（中药配方报告）
        special_sections = [
            ("basic_info", "基本信息"),
            ("ingredients", "成分表"),
            ("effects", "功效主治"),
            ("usage", "用法用量"),
            ("notes", "注意事项"),
            ("references", "参考文献")
        ]

        for section_key, section_title in special_sections:
            if section_key in content:
                section_items = content[section_key]
                if section_items:
                    ws.merge_cells(
                        start_row=current_row, start_column=1,
                        end_row=current_row, end_column=10
                    )
                    heading_cell = ws.cell(row=current_row, column=1, value=section_title)
                    heading_cell.font = Font(name='Microsoft YaHei', bold=True, size=12, color="00529B")
                    heading_cell.alignment = Alignment(horizontal='left', vertical='center')
                    ws.row_dimensions[current_row].height = 22
                    current_row += 1
                    
                    for item in section_items:
                        if isinstance(item, dict):
                            if "heading" in item:
                                ws.merge_cells(
                                    start_row=current_row, start_column=1,
                                    end_row=current_row, end_column=10
                                )
                                subheading_cell = ws.cell(row=current_row, column=1, value=item["heading"])
                                subheading_cell.font = Font(name='Microsoft YaHei', bold=True, size=10)
                                subheading_cell.alignment = Alignment(horizontal='left', vertical='center')
                                current_row += 1
                            if "content" in item:
                                for para_text in item["content"]:
                                    ws.cell(row=current_row, column=1, value=str(para_text))
                                    ws.merge_cells(
                                        start_row=current_row, start_column=1,
                                        end_row=current_row, end_column=10
                                    )
                                    current_row += 1
                            if "table" in item:
                                table_data = item["table"].get("data", [])
                                headers = item["table"].get("headers", [])
                                if headers:
                                    for col_idx, header in enumerate(headers, 1):
                                        cell = ws.cell(row=current_row, column=col_idx, value=header)
                                        cell.font = header_font
                                        cell.fill = header_fill
                                        cell.alignment = header_alignment
                                        cell.border = thin_border
                                    current_row += 1

                                for row_data in table_data:
                                    for col_idx, value in enumerate(row_data, 1):
                                        cell = ws.cell(row=current_row, column=col_idx, value=value)
                                        cell.font = cell_font
                                        cell.alignment = cell_alignment
                                        cell.border = thin_border
                                    current_row += 1

                                current_row += 1
                        else:
                            ws.cell(row=current_row, column=1, value=str(item))
                            ws.merge_cells(
                                start_row=current_row, start_column=1,
                                end_row=current_row, end_column=10
                            )
                            current_row += 1
                    current_row += 1

        # 处理通用sections
        if "sections" in content:
            total_sections = len(content["sections"])
            for i, section in enumerate(content["sections"]):
                if "heading" in section:
                    ws.merge_cells(
                        start_row=current_row, start_column=1,
                        end_row=current_row, end_column=10
                    )
                    heading_cell = ws.cell(row=current_row, column=1, value=section["heading"])
                    heading_cell.font = Font(name='Microsoft YaHei', bold=True, size=12, color="00529B")
                    heading_cell.alignment = Alignment(horizontal='left', vertical='center')
                    ws.row_dimensions[current_row].height = 22
                    current_row += 1

                if "table" in section:
                    table_data = section["table"].get("data", [])
                    headers = section["table"].get("headers", [])
                    if headers:
                        for col_idx, header in enumerate(headers, 1):
                            cell = ws.cell(row=current_row, column=col_idx, value=header)
                            cell.font = header_font
                            cell.fill = header_fill
                            cell.alignment = header_alignment
                            cell.border = thin_border
                        current_row += 1

                    for row_data in table_data:
                        for col_idx, value in enumerate(row_data, 1):
                            cell = ws.cell(row=current_row, column=col_idx, value=value)
                            cell.font = cell_font
                            cell.alignment = cell_alignment
                            cell.border = thin_border
                        current_row += 1

                    current_row += 1

                elif "content" in section:
                    for para_text in section["content"]:
                        ws.cell(row=current_row, column=1, value=str(para_text))
                        ws.merge_cells(
                            start_row=current_row, start_column=1,
                            end_row=current_row, end_column=10
                        )
                        current_row += 1
                    current_row += 1

                self._update_task(task_id, progress=30 + int((i + 1) / total_sections * 50))

        if "footer" in content:
            current_row += 1
            ws.cell(row=current_row, column=1, value=content["footer"])

        self._update_task(task_id, progress=90)

        for col_idx in range(1, 11):
            ws.column_dimensions[get_column_letter(col_idx)].width = 15

        ws.column_dimensions['A'].width = 20

        wb.save(str(file_path))
        size = file_path.stat().st_size

        if size > self._max_file_size_mb * 1024 * 1024:
            file_path.unlink()
            raise ValueError(f"文件大小超过限制 ({self._max_file_size_mb}MB)")

        self._update_task(task_id, progress=100)
        return str(file_path), size

    def get_file_path(self, task_id: str) -> Optional[str]:
        task = self.get_task_status(task_id)
        if task and task.status == TaskStatus.COMPLETED and task.file_path:
            if os.path.exists(task.file_path):
                return task.file_path
        return None

    def delete_file(self, task_id: str) -> bool:
        task = self.get_task_status(task_id)
        if task and task.file_path and os.path.exists(task.file_path):
            try:
                os.remove(task.file_path)
                return True
            except Exception as e:
                logger.warning(f"删除文件失败 {task.file_path}: {e}")
        return False


file_generator_service = FileGeneratorService()
