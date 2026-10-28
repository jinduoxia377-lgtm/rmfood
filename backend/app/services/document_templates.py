"""
文档模板系统
支持 Markdown/HTML 到 DOCX/PDF 的转换，提供专业领域模板
"""
import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)


class ChineseFontManager:
    _instance = None

    def __new__(cls):
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
            "source_hans": os.path.join(base_font, "SourceHanSansSC-Regular.ttf"),
            "source_hans_bold": os.path.join(base_font, "SourceHanSansSC-Bold.ttf"),
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
                    logger.info(f"字体注册成功: {name}")
                except Exception as e:
                    logger.warning(f"字体注册失败 {name}: {e}")

    def get_pdf_font(self, bold: bool = False) -> str:
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

    def get_docx_font(self, bold: bool = False, serif: bool = False) -> tuple:
        if serif:
            if bold:
                if os.path.exists(self.font_paths.get("source_hans_bold", "")):
                    return "Source Han Sans SC Bold", "Source Han Sans SC Bold"
                if os.path.exists(self.font_paths.get("msyhbd", "")):
                    return "Microsoft YaHei Bold", "Microsoft YaHei Bold"
                if os.path.exists(self.font_paths.get("simsun", "")):
                    return "SimSun", "SimSun"
                return "SimHei", "SimHei"
            else:
                if os.path.exists(self.font_paths.get("simsun", "")):
                    return "SimSun", "SimSun"
                if os.path.exists(self.font_paths.get("source_hans", "")):
                    return "Source Han Serif SC", "Source Han Serif SC"
                if os.path.exists(self.font_paths.get("msyh", "")):
                    return "Microsoft YaHei", "Microsoft YaHei"
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


chinese_font_manager = ChineseFontManager()


class MarkdownParser:
    HEADING_PATTERNS = {
        1: r'^# (.+)$',
        2: r'^## (.+)$',
        3: r'^### (.+)$',
        4: r'^#### (.+)$',
        5: r'^##### (.+)$',
        6: r'^###### (.+)$',
    }

    def __init__(self):
        self.elements = []

    def parse(self, markdown_text: str) -> list:
        self.elements = []
        lines = markdown_text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i]
            matched = False
            for level in range(1, 7):
                pattern = self.HEADING_PATTERNS[level]
                match = re.match(pattern, line.strip())
                if match:
                    self.elements.append({
                        'type': 'heading',
                        'level': level,
                        'text': match.group(1)
                    })
                    matched = True
                    break
            if not matched:
                if line.strip().startswith('- ') or line.strip().startswith('* '):
                    list_items = []
                    while i < len(lines) and (lines[i].strip().startswith('- ') or lines[i].strip().startswith('* ')):
                        list_items.append(lines[i].strip()[2:])
                        i += 1
                    self.elements.append({'type': 'list', 'items': list_items})
                    continue
                elif line.strip().startswith('|'):
                    table_lines = []
                    while i < len(lines) and lines[i].strip().startswith('|'):
                        if '---' not in lines[i]:
                            table_lines.append(lines[i].strip())
                        i += 1
                    if table_lines:
                        table_data = []
                        for table_line in table_lines:
                            cells = [c.strip() for c in table_line.strip('|').split('|')]
                            table_data.append(cells)
                        self.elements.append({'type': 'table', 'data': table_data})
                    continue
                elif line.strip():
                    para_text = line.strip()
                    j = i + 1
                    while j < len(lines) and lines[j].strip() and not any(
                        re.match(p, lines[j].strip()) for p in [self.HEADING_PATTERNS[l] for l in range(1, 7)]
                    ) and not lines[j].strip().startswith(('|', '- ', '* ')):
                        para_text += ' ' + lines[j].strip()
                        j += 1
                    self.elements.append({'type': 'paragraph', 'text': para_text})
                    i = j - 1
            i += 1
        return self.elements

    def extract_plain_text(self, markdown_text: str) -> str:
        text = re.sub(r'#{1,6}\s*', '', markdown_text)
        text = re.sub(r'\*{2,}(.+?)\*{2,}', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
        text = re.sub(r'!\[.*?\]\(.+?\)', '', text)
        return text


class HTMLParser:
    def __init__(self):
        self.elements = []

    def parse(self, html_content: str) -> list:
        self.elements = []
        root = ET.fromstring(f'<root>{html_content}</root>')
        self._parse_element(root)
        return self.elements

    def _parse_element(self, element: ET.Element):
        for child in element:
            tag = child.tag.lower()
            if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                level = int(tag[1])
                text = ''.join(child.itertext())
                self.elements.append({'type': 'heading', 'level': level, 'text': text.strip()})
            elif tag == 'p':
                text = ''.join(child.itertext())
                if text.strip():
                    self.elements.append({'type': 'paragraph', 'text': text.strip()})
            elif tag == 'ul':
                items = []
                for li in child.findall('li'):
                    items.append(''.join(li.itertext()).strip())
                if items:
                    self.elements.append({'type': 'list', 'items': items})
            elif tag == 'ol':
                items = []
                for li in child.findall('li'):
                    items.append(''.join(li.itertext()).strip())
                if items:
                    self.elements.append({'type': 'list', 'items': items, 'ordered': True})
            elif tag == 'table':
                table_data = []
                headers = []
                for tr in child.findall('.//tr'):
                    row = [''.join(td.itertext()).strip() for td in tr.findall('td')]
                    if not headers:
                        headers = row
                    else:
                        table_data.append(row)
                if headers or table_data:
                    self.elements.append({
                        'type': 'table',
                        'headers': headers,
                        'data': table_data
                    })
            elif tag == 'img':
                src = child.get('src', '')
                alt = child.get('alt', '')
                self.elements.append({'type': 'image', 'src': src, 'alt': alt})
            else:
                self._parse_element(child)


class DocumentConverter:
    def __init__(self):
        self.markdown_parser = MarkdownParser()
        self.html_parser = HTMLParser()

    def markdown_to_docx(self, markdown_text: str, output_path: str = None) -> tuple:
        doc = Document()
        font_name, font_name_bold = chinese_font_manager.get_docx_font()

        style = doc.styles['Normal']
        style.font.name = font_name
        style.font.size = Pt(11)
        style._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        elements = self.markdown_parser.parse(markdown_text)

        for elem in elements:
            if elem['type'] == 'heading':
                heading = doc.add_heading(elem['text'], level=elem['level'] - 1)
                heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
                for run in heading.runs:
                    run.font.name = font_name_bold
                    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
                    run.font.size = Pt(18 - elem['level'] * 2)
            elif elem['type'] == 'paragraph':
                p = doc.add_paragraph(elem['text'])
                p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                for run in p.runs:
                    run.font.name = font_name
                    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
            elif elem['type'] == 'list':
                for item in elem['items']:
                    p = doc.add_paragraph(item, style='List Bullet')
                    for run in p.runs:
                        run.font.name = font_name
                        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
            elif elem['type'] == 'table':
                data = elem['data']
                if not data:
                    continue
                rows = len(data)
                cols = len(data[0]) if data else 0
                if rows > 0 and cols > 0:
                    table = doc.add_table(rows=rows, cols=cols)
                    table.style = 'Table Grid'
                    for row_idx, row_data in enumerate(data):
                        row = table.rows[row_idx]
                        for col_idx, cell_text in enumerate(row_data):
                            cell = row.cells[col_idx]
                            cell.text = str(cell_text)
                            for para in cell.paragraphs:
                                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                for run in para.runs:
                                    run.font.name = font_name
                                    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
                    doc.add_paragraph()

        if output_path:
            doc.save(output_path)
        return str(output_path), Path(output_path).name if output_path else None, doc

    def markdown_to_pdf(
        self,
        markdown_text: str,
        output_path: str,
        page_size: str = "A4"
    ) -> str:
        page = A4 if page_size == "A4" else letter
        doc = SimpleDocTemplate(
            output_path,
            pagesize=page,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        styles = getSampleStyleSheet()
        font_name = chinese_font_manager.get_pdf_font()
        font_name_bold = chinese_font_manager.get_pdf_font(bold=True)

        title_style = ParagraphStyle(
            'CustomTitle',
            fontName=font_name_bold,
            fontSize=22,
            leading=30,
            alignment=TA_CENTER,
            spaceAfter=20
        )
        h1_style = ParagraphStyle(
            'CustomH1',
            fontName=font_name_bold,
            fontSize=16,
            leading=22,
            alignment=TA_LEFT,
            spaceBefore=15,
            spaceAfter=10
        )
        h2_style = ParagraphStyle(
            'CustomH2',
            fontName=font_name_bold,
            fontSize=14,
            leading=20,
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=8
        )
        h3_style = ParagraphStyle(
            'CustomH3',
            fontName=font_name_bold,
            fontSize=12,
            leading=16,
            alignment=TA_LEFT,
            spaceBefore=10,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'CustomBody',
            fontName=font_name,
            fontSize=11,
            leading=18,
            alignment=TA_JUSTIFY,
            spaceBefore=6,
            spaceAfter=6
        )

        elements = self.markdown_parser.parse(markdown_text)
        story = []

        for elem in elements:
            if elem['type'] == 'heading':
                if elem['level'] == 1:
                    story.append(Paragraph(elem['text'], title_style))
                elif elem['level'] == 2:
                    story.append(Paragraph(elem['text'], h1_style))
                elif elem['level'] == 3:
                    story.append(Paragraph(elem['text'], h2_style))
                else:
                    story.append(Paragraph(elem['text'], h3_style))
            elif elem['type'] == 'paragraph':
                story.append(Paragraph(elem['text'], body_style))
            elif elem['type'] == 'list':
                list_items = [ListItem(Paragraph(item, body_style)) for item in elem['items']]
                list_flowable = ListFlowable(list_items, bulletFontName=font_name)
                story.append(list_flowable)
            elif elem['type'] == 'table':
                data = elem['data']
                if not data:
                    continue
                table = Table(data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#4472C4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
                    ('FONTNAME', (0, 0), (-1, -1), font_name),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#000000')),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(table)
                story.append(Spacer(1, 12))

        doc.build(story)
        return output_path

    def html_to_docx(self, html_content: str, output_path: str = None) -> tuple:
        doc = Document()
        font_name, font_name_bold = chinese_font_manager.get_docx_font()

        elements = self.html_parser.parse(html_content)

        for elem in elements:
            if elem['type'] == 'heading':
                heading = doc.add_heading(elem['text'], level=elem['level'] - 1)
                for run in heading.runs:
                    run.font.name = font_name_bold
                    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
            elif elem['type'] == 'paragraph':
                p = doc.add_paragraph(elem['text'])
                for run in p.runs:
                    run.font.name = font_name
                    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
            elif elem['type'] == 'list':
                for item in elem['items']:
                    p = doc.add_paragraph(item, style='List Bullet')
                    for run in p.runs:
                        run.font.name = font_name
                        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
            elif elem['type'] == 'table':
                headers = elem.get('headers', [])
                data = elem.get('data', [])
                if headers:
                    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
                    table.style = 'Table Grid'
                    for col_idx, h in enumerate(headers):
                        cell = table.rows[0].cells[col_idx]
                        cell.text = h
                for row_idx, row_data in enumerate(data):
                    row = table.rows[row_idx + 1]
                    for col_idx, cell_text in enumerate(row_data):
                        row.cells[col_idx].text = str(cell_text)

        if output_path:
            doc.save(output_path)
        return str(output_path), Path(output_path).name if output_path else None, doc

    def html_to_pdf(
        self,
        html_content: str,
        output_path: str,
        page_size: str = "A4"
    ) -> str:
        page = A4 if page_size == "A4" else letter
        doc = SimpleDocTemplate(
            output_path,
            pagesize=page,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        styles = getSampleStyleSheet()
        font_name = chinese_font_manager.get_pdf_font()
        font_name_bold = chinese_font_manager.get_pdf_font(bold=True)

        body_style = ParagraphStyle(
            'CustomBody',
            fontName=font_name,
            fontSize=11,
            leading=18,
            alignment=TA_JUSTIFY
        )

        elements = self.html_parser.parse(html_content)
        story = []

        for elem in elements:
            if elem['type'] == 'heading':
                style = body_style.copy()
                style.fontSize = 18 - elem['level'] * 2
                style.fontName = font_name_bold
                story.append(Paragraph(elem['text'], style))
            elif elem['type'] == 'paragraph':
                story.append(Paragraph(elem['text'], body_style))
            elif elem['type'] == 'table':
                data = elem.get('data', [])
                if not data:
                    continue
                table = Table(data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HexColor('#4472C4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
                    ('FONTNAME', (0, 0), (-1, -1), font_name),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#000000')),
                ]))
                story.append(table)

        doc.build(story)
        return output_path


class ChineseMedicineReportTemplate:
    def __init__(self):
        self.font_mgr = chinese_font_manager

    def generate_markdown(
        self,
        title: str,
        date: str,
        institution: str,
        toc: list,
        formula_name: str,
        herbs: list,
        efficacy: str,
        indications: str,
        dosage: str,
        usage: str,
        precautions: str,
        references: list
    ) -> str:
        md = f"""# {title}

---

## 封面信息

| 项目 | 内容 |
|------|------|
| 报告标题 | {title} |
| 生成日期 | {date} |
| 编制机构 | {institution} |

---

## 目录

"""
        for i, item in enumerate(toc, 1):
            md += f"{i}. {item}\n"

        md += f"""
---

## 配方基本信息

### 配方名称

**{formula_name}**

### 药材组成

| 序号 | 药材名称 | 用量 | 单位 |
|------|----------|------|------|
"""
        for i, herb in enumerate(herbs, 1):
            md += f"| {i} | {herb.get('name', '')} | {herb.get('amount', '')} | {herb.get('unit', 'g')} |\n"

        md += f"""
### 功效主治

{efficacy}

### 用法用量

{usage}

### 注意事项

{precautions}

---

## 参考文献

"""
        for i, ref in enumerate(references, 1):
            md += f"{i}. {ref}\n"

        return md

    def generate_docx(
        self,
        output_path: str,
        title: str,
        date: str,
        institution: str,
        toc: list,
        formula_name: str,
        herbs: list,
        efficacy: str,
        indications: str,
        dosage: str,
        usage: str,
        precautions: str,
        references: list
    ) -> str:
        doc = Document()
        font_name, font_name_bold = self.font_mgr.get_docx_font()

        title_para = doc.add_paragraph()
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = title_para.add_run(title)
        run.font.name = font_name_bold
        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        run.font.size = Pt(26)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0, 51, 102)

        doc.add_paragraph()

        info_table = doc.add_table(rows=3, cols=2)
        info_table.style = 'Table Grid'
        info_data = [
            ("报告标题", title),
            ("生成日期", date),
            ("编制机构", institution)
        ]
        for row_idx, (label, value) in enumerate(info_data):
            info_table.rows[row_idx].cells[0].text = label
            info_table.rows[row_idx].cells[1].text = value

        doc.add_paragraph()

        toc_heading = doc.add_paragraph()
        toc_run = toc_heading.add_run("目  录")
        toc_run.font.name = font_name_bold
        toc_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        toc_run.font.size = Pt(16)
        toc_run.font.bold = True

        for item in toc:
            p = doc.add_paragraph(item, style='List Number')
            for run in p.runs:
                run.font.name = font_name
                run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        doc.add_page_break()

        formula_heading = doc.add_paragraph()
        formula_run = formula_heading.add_run("配方基本信息")
        formula_run.font.name = font_name_bold
        formula_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        formula_run.font.size = Pt(16)
        formula_run.font.bold = True

        name_heading = doc.add_paragraph()
        name_run = name_heading.add_run("配方名称")
        name_run.font.name = font_name_bold
        name_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        name_run.font.size = Pt(14)

        name_para = doc.add_paragraph()
        name_para_run = name_para.add_run(formula_name)
        name_para_run.font.name = font_name
        name_para_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
        name_para_run.font.size = Pt(12)

        herbs_heading = doc.add_paragraph()
        herbs_run = herbs_heading.add_run("药材组成")
        herbs_run.font.name = font_name_bold
        herbs_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        herbs_run.font.size = Pt(14)

        herbs_table = doc.add_table(rows=len(herbs) + 1, cols=4)
        herbs_table.style = 'Table Grid'
        headers = ["序号", "药材名称", "用量", "单位"]
        for col_idx, h in enumerate(headers):
            cell = herbs_table.rows[0].cells[col_idx]
            cell.text = h
            for para in cell.paragraphs:
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for r in para.runs:
                    r.font.bold = True

        for i, herb in enumerate(herbs, 1):
            herbs_table.rows[i].cells[0].text = str(i)
            herbs_table.rows[i].cells[1].text = herb.get('name', '')
            herbs_table.rows[i].cells[2].text = str(herb.get('amount', ''))
            herbs_table.rows[i].cells[3].text = herb.get('unit', 'g')

        doc.add_paragraph()

        efficacy_heading = doc.add_paragraph()
        efficacy_run = efficacy_heading.add_run("功效主治")
        efficacy_run.font.name = font_name_bold
        efficacy_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        efficacy_run.font.size = Pt(14)

        efficacy_para = doc.add_paragraph(efficacy)
        for run in efficacy_para.runs:
            run.font.name = font_name
            run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        usage_heading = doc.add_paragraph()
        usage_run = usage_heading.add_run("用法用量")
        usage_run.font.name = font_name_bold
        usage_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        usage_run.font.size = Pt(14)

        usage_para = doc.add_paragraph(usage)
        for run in usage_para.runs:
            run.font.name = font_name
            run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        precautions_heading = doc.add_paragraph()
        precautions_run = precautions_heading.add_run("注意事项")
        precautions_run.font.name = font_name_bold
        precautions_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        precautions_run.font.size = Pt(14)

        precautions_para = doc.add_paragraph(precautions)
        for run in precautions_para.runs:
            run.font.name = font_name
            run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        doc.add_paragraph()

        ref_heading = doc.add_paragraph()
        ref_run = ref_heading.add_run("参考文献")
        ref_run.font.name = font_name_bold
        ref_run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        ref_run.font.size = Pt(14)

        for i, ref in enumerate(references, 1):
            p = doc.add_paragraph(f"[{i}] {ref}")
            for run in p.runs:
                run.font.name = font_name
                run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)

        doc.save(output_path)
        return output_path


class ExperimentDataTemplate:
    def __init__(self):
        self.font_mgr = chinese_font_manager

    def generate_xlsx(
        self,
        output_path: str,
        title: str,
        sheets: list
    ) -> str:
        wb = Workbook()
        wb.remove(wb.active)

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

        for sheet_info in sheets:
            ws = wb.create_sheet(title=sheet_info.get('name', '数据'))
            current_row = 1

            if 'title' in sheet_info:
                ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=15)
                title_cell = ws.cell(row=current_row, column=1, value=sheet_info['title'])
                title_cell.font = Font(name='Microsoft YaHei', bold=True, size=16)
                title_cell.alignment = Alignment(horizontal='center', vertical='center')
                ws.row_dimensions[current_row].height = 30
                current_row += 2

            if 'headers' in sheet_info and sheet_info['headers']:
                for col_idx, header in enumerate(sheet_info['headers'], 1):
                    cell = ws.cell(row=current_row, column=col_idx, value=header)
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = header_alignment
                    cell.border = thin_border
                ws.row_dimensions[current_row].height = 22
                current_row += 1

            if 'data' in sheet_info:
                for row_data in sheet_info['data']:
                    for col_idx, value in enumerate(row_data, 1):
                        cell = ws.cell(row=current_row, column=col_idx, value=value)
                        cell.font = cell_font
                        cell.alignment = cell_alignment
                        cell.border = thin_border
                    current_row += 1

            for col_idx in range(1, len(sheet_info.get('headers', [])) + 1):
                ws.column_dimensions[get_column_letter(col_idx)].width = 15

        wb.save(output_path)
        return output_path


class FormulaAnalysisReportTemplate:
    def __init__(self):
        self.font_mgr = chinese_font_manager

    def _set_run_font(self, run, font_name, font_size, bold=False, color=None):
        run.font.name = font_name
        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
        run.font.size = Pt(font_size)
        run.font.bold = bold
        if color:
            run.font.color.rgb = RGBColor(*color)

    def _add_paragraph_with_format(self, doc, text, font_name, font_size, bold=False,
                                   alignment=WD_ALIGN_PARAGRAPH.JUSTIFY,
                                   space_before=6, space_after=6, first_line_indent=True):
        para = doc.add_paragraph()
        para.alignment = alignment
        para.paragraph_format.space_before = Pt(space_before)
        para.paragraph_format.space_after = Pt(space_after)
        para.paragraph_format.line_spacing = 1.5
        if first_line_indent:
            para.paragraph_format.first_line_indent = Pt(font_size * 2)
        run = para.add_run(text)
        self._set_run_font(run, font_name, font_size, bold)
        return para

    def _add_heading_paragraph(self, doc, text, font_name_bold, font_size, level=1):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        para.paragraph_format.space_before = Pt(12)
        para.paragraph_format.space_after = Pt(6)
        para.paragraph_format.line_spacing = 1.5
        run = para.add_run(text)
        run.font.name = font_name_bold
        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name_bold)
        run.font.size = Pt(font_size)
        run.font.bold = True
        return para

    def _set_cell_style(self, cell, text, font_name, font_size, bold=False,
                        alignment=WD_ALIGN_PARAGRAPH.CENTER, bg_color=None, font_color=None):
        cell.text = text
        for para in cell.paragraphs:
            para.alignment = alignment
            para.paragraph_format.line_spacing = 1.5
            for run in para.runs:
                run.font.name = font_name
                run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
                run.font.size = Pt(font_size)
                run.font.bold = bold
                if font_color:
                    run.font.color.rgb = RGBColor(*font_color)
        if bg_color:
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:fill'), bg_color)
            tcPr.append(shd)

    def _apply_table_header_style(self, table, headers, font_name, font_size):
        for col_idx, header_text in enumerate(headers):
            cell = table.rows[0].cells[col_idx]
            self._set_cell_style(cell, header_text, font_name, font_size, bold=True,
                               alignment=WD_ALIGN_PARAGRAPH.CENTER,
                               bg_color='4472C4', font_color=(255, 255, 255))

    def _apply_zebra_stripe(self, table, start_row, font_name, font_size, role_col_idx=None):
        for row_idx in range(start_row, len(table.rows)):
            bg_color = 'F2F2F2' if row_idx % 2 == 0 else 'FFFFFF'
            for cell in table.rows[row_idx].cells:
                tc = cell._tc
                tcPr = tc.get_or_add_tcPr()
                shd = OxmlElement('w:shd')
                shd.set(qn('w:val'), 'clear')
                shd.set(qn('w:color'), 'auto')
                shd.set(qn('w:fill'), bg_color)
                tcPr.append(shd)

    def _highlight_role_cell(self, cell, font_name, font_size):
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), 'FFFACD')
        tcPr.append(shd)
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.font.bold = True

    def _add_footer(self, doc, generated_at, font_name):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.space_before = Pt(24)
        footer_text = f"生成时间：{generated_at} | RMFOOD配方平台"
        run = para.add_run(footer_text)
        run.font.name = font_name
        run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)

    def generate_docx(
        self,
        output_path: str,
        title: str,
        formula_name: str,
        formula_info: dict,
        ingredients: list,
        peptides: list,
        scores: dict,
        safety_info: dict,
        usage_info: dict,
        generated_at: str,
    ) -> str:
        doc = Document()
        serif_font, _ = self.font_mgr.get_docx_font(serif=True)
        _, bold_font = self.font_mgr.get_docx_font(bold=True)

        title_para = doc.add_paragraph()
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_run = title_para.add_run(title)
        self._set_run_font(title_run, bold_font, 24, bold=True, color=(0, 51, 102))
        title_para.paragraph_format.space_after = Pt(24)

        doc.add_paragraph()

        self._add_heading_paragraph(doc, "一、配方基本信息", bold_font, 14)

        info_table = doc.add_table(rows=4, cols=2)
        info_table.style = 'Table Grid'
        info_data = [
            ("配方名称", formula_info.get("name", formula_name)),
            ("安全状态", formula_info.get("safety_status", "未知")),
            ("生成方式", formula_info.get("generation_method", "系统生成")),
            ("生成时间", formula_info.get("generated_at", generated_at)),
        ]
        for row_idx, (label, value) in enumerate(info_data):
            self._set_cell_style(info_table.rows[row_idx].cells[0], label, bold_font, 11, bold=True,
                               alignment=WD_ALIGN_PARAGRAPH.CENTER)
            self._set_cell_style(info_table.rows[row_idx].cells[1], value, serif_font, 11,
                               alignment=WD_ALIGN_PARAGRAPH.LEFT)

        doc.add_paragraph()

        self._add_heading_paragraph(doc, "二、质量评价", bold_font, 14)

        scores_data = [
            ("协同性评分", f"{scores.get('synergy', 0):.1f}"),
            ("口感评分", f"{scores.get('taste', 0):.1f}"),
            ("稳定性评分", f"{scores.get('stability', 0):.1f}"),
            ("综合评分", f"{scores.get('overall', 0):.1f}"),
        ]

        scores_table = doc.add_table(rows=2, cols=4)
        scores_table.style = 'Table Grid'
        for col_idx, (score_name, score_value) in enumerate(scores_data):
            self._set_cell_style(scores_table.rows[0].cells[col_idx], score_name, serif_font, 11,
                               alignment=WD_ALIGN_PARAGRAPH.CENTER, bg_color='4472C4',
                               font_color=(255, 255, 255))
            self._set_cell_style(scores_table.rows[1].cells[col_idx], score_value, serif_font, 14,
                               bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

        doc.add_paragraph()

        self._add_heading_paragraph(doc, "三、配方组成", bold_font, 14)

        ing_headers = ["角色", "原料名称", "用量", "功效", "性味归经"]
        ing_table = doc.add_table(rows=len(ingredients) + 1, cols=5)
        ing_table.style = 'Table Grid'
        self._apply_table_header_style(ing_table, ing_headers, serif_font, 11)

        for row_idx, ing in enumerate(ingredients, 1):
            role = ing.get("role", "")
            self._set_cell_style(ing_table.rows[row_idx].cells[0], role, serif_font, 10,
                               alignment=WD_ALIGN_PARAGRAPH.CENTER)
            self._set_cell_style(ing_table.rows[row_idx].cells[1], ing.get("name", ""), serif_font, 10,
                               alignment=WD_ALIGN_PARAGRAPH.LEFT)
            self._set_cell_style(ing_table.rows[row_idx].cells[2], str(ing.get("dosage", "")), serif_font, 10,
                               alignment=WD_ALIGN_PARAGRAPH.CENTER)
            self._set_cell_style(ing_table.rows[row_idx].cells[3], ing.get("effect", ""), serif_font, 10,
                               alignment=WD_ALIGN_PARAGRAPH.LEFT)
            self._set_cell_style(ing_table.rows[row_idx].cells[4], ing.get("nature", ""), serif_font, 10,
                               alignment=WD_ALIGN_PARAGRAPH.LEFT)

            if role in ("君", "臣", "佐", "使"):
                self._highlight_role_cell(ing_table.rows[row_idx].cells[0], serif_font, 10)

        self._apply_zebra_stripe(ing_table, 1, serif_font, 10)

        doc.add_paragraph()

        if peptides:
            self._add_heading_paragraph(doc, "四、食源性生物活性肽", bold_font, 14)

            pep_headers = ["肽序列", "来源", "活性"]
            pep_table = doc.add_table(rows=len(peptides) + 1, cols=3)
            pep_table.style = 'Table Grid'
            self._apply_table_header_style(pep_table, pep_headers, serif_font, 11)

            for row_idx, pep in enumerate(peptides, 1):
                self._set_cell_style(pep_table.rows[row_idx].cells[0], pep.get("sequence", ""), serif_font, 10,
                                   alignment=WD_ALIGN_PARAGRAPH.CENTER)
                self._set_cell_style(pep_table.rows[row_idx].cells[1], pep.get("source", ""), serif_font, 10,
                                   alignment=WD_ALIGN_PARAGRAPH.LEFT)
                self._set_cell_style(pep_table.rows[row_idx].cells[2], pep.get("activity", ""), serif_font, 10,
                                   alignment=WD_ALIGN_PARAGRAPH.LEFT)

            self._apply_zebra_stripe(pep_table, 1, serif_font, 10)

            doc.add_paragraph()

        self._add_heading_paragraph(doc, "五、安全性评估", bold_font, 14)

        safety_items = [
            f"过敏原信息：{safety_info.get('allergen_info', '无')}",
            f"禁忌人群：{safety_info.get('contraindications', '无')}",
            f"注意事项：{safety_info.get('precautions', '无')}",
        ]
        for item in safety_items:
            self._add_paragraph_with_format(doc, item, serif_font, 11)

        doc.add_paragraph()

        self._add_heading_paragraph(doc, "六、使用说明", bold_font, 14)

        usage_items = [
            f"适用人群：{usage_info.get('target_group', '通用')}",
            f"使用方法：{usage_info.get('usage_method', '详见包装')}",
            f"推荐剂量：{usage_info.get('recommended_dosage', '详见包装')}",
            f"储存条件：{usage_info.get('storage_conditions', '常温干燥')}",
        ]
        for item in usage_items:
            self._add_paragraph_with_format(doc, item, serif_font, 11)

        self._add_footer(doc, generated_at, serif_font)

        doc.save(output_path)
        return output_path


class DocumentTemplateService:
    def __init__(self):
        self.temp_dir = Path("./temp_files")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.converter = DocumentConverter()
        self.cm_report = ChineseMedicineReportTemplate()
        self.exp_data = ExperimentDataTemplate()
        self.formula_analysis = FormulaAnalysisReportTemplate()

    def markdown_to_docx(self, markdown_text: str, file_name: str = None) -> tuple:
        if file_name is None:
            file_name = f"{uuid.uuid4()}.docx"
        output_path = self.temp_dir / file_name
        self.converter.markdown_to_docx(markdown_text, str(output_path))
        return str(output_path), file_name

    def markdown_to_pdf(
        self,
        markdown_text: str,
        file_name: str = None,
        page_size: str = "A4"
    ) -> tuple:
        if file_name is None:
            file_name = f"{uuid.uuid4()}.pdf"
        output_path = self.temp_dir / file_name
        self.converter.markdown_to_pdf(markdown_text, str(output_path), page_size)
        return str(output_path), file_name

    def html_to_docx(self, html_content: str, file_name: str = None) -> tuple:
        if file_name is None:
            file_name = f"{uuid.uuid4()}.docx"
        output_path = self.temp_dir / file_name
        self.converter.html_to_docx(html_content, str(output_path))
        return str(output_path), file_name

    def html_to_pdf(
        self,
        html_content: str,
        file_name: str = None,
        page_size: str = "A4"
    ) -> tuple:
        if file_name is None:
            file_name = f"{uuid.uuid4()}.pdf"
        output_path = self.temp_dir / file_name
        self.converter.html_to_pdf(html_content, str(output_path), page_size)
        return str(output_path), file_name

    def generate_chinese_medicine_report(self, **kwargs) -> tuple:
        output_path = self.temp_dir / f"{uuid.uuid4()}.docx"
        self.cm_report.generate_docx(str(output_path), **kwargs)
        return str(output_path), output_path.name

    def generate_experiment_data(self, title: str, sheets: list) -> tuple:
        output_path = self.temp_dir / f"{uuid.uuid4()}.xlsx"
        self.exp_data.generate_xlsx(str(output_path), title, sheets)
        return str(output_path), output_path.name

    def generate_formula_analysis_report(self, **kwargs) -> tuple:
        output_path = self.temp_dir / f"{uuid.uuid4()}.docx"
        self.formula_analysis.generate_docx(str(output_path), **kwargs)
        return str(output_path), output_path.name

    def generate_explainability_report(
        self,
        formula_name: str,
        scores: dict,
        core_ingredients: list,
        synergies: list,
        antagonisms: list,
        compliance_notes: list,
        recommendations: list,
        summary: str,
    ) -> tuple:
        """
        生成配方可解释性报告（DOCX）

        Args:
            formula_name: 配方名称
            scores: 评分字典 {overall, efficacy, safety, cost}
            core_ingredients: 核心成分列表
            synergies: 协同效应列表
            antagonisms: 拮抗效应列表
            compliance_notes: 合规说明列表
            recommendations: 改进建议列表
            summary: 报告摘要
        """
        output_path = self.temp_dir / f"explainability_{formula_name}_{uuid.uuid4().hex[:8]}.docx"
        doc = Document()

        # 标题
        title = doc.add_heading("配方可解释性报告", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # 副标题
        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = sub.add_run(f"配方：{formula_name}")
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(100, 100, 100)

        # 生成时间
        time_para = doc.add_paragraph()
        time_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        time_para.add_run(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        doc.add_paragraph()

        # 综合评分
        doc.add_heading("一、综合评分", level=1)
        score_table = doc.add_table(rows=5, cols=2)
        score_table.style = 'Light Grid Accent 1'
        scores_data = [
            ("综合评分", f"{scores.get('overall', 0):.1f} / 100"),
            ("功效匹配", f"{scores.get('efficacy', 0):.1f} / 100"),
            ("安全评分", f"{scores.get('safety', 0):.1f} / 100"),
            ("成本评分", f"{scores.get('cost', 0):.1f} / 100"),
        ]
        for i, (label, value) in enumerate(scores_data):
            score_table.rows[i].cells[0].text = label
            score_table.rows[i].cells[1].text = value
        doc.add_paragraph()

        # 报告摘要
        doc.add_heading("二、报告摘要", level=1)
        doc.add_paragraph(summary)
        doc.add_paragraph()

        # 君臣佐使
        if core_ingredients:
            doc.add_heading("三、君臣佐使分析", level=1)
            table = doc.add_table(rows=len(core_ingredients) + 1, cols=4)
            table.style = 'Light Grid Accent 1'
            headers = ["成分", "角色", "作用机制", "证据"]
            for j, h in enumerate(headers):
                table.rows[0].cells[j].text = h
            for i, ing in enumerate(core_ingredients):
                table.rows[i + 1].cells[0].text = ing.get('name', '')
                table.rows[i + 1].cells[1].text = '君' if ing.get('role') == 'core' else '臣'
                table.rows[i + 1].cells[2].text = ing.get('mechanism', '')[:50]
                table.rows[i + 1].cells[3].text = ing.get('evidence', '')[:30]
            doc.add_paragraph()

        # 协同效应
        if synergies:
            doc.add_heading("四、协同效应", level=1)
            for s in synergies:
                p = doc.add_paragraph()
                p.add_run(f"✓ {s.get('a', '')} + {s.get('b', '')}").bold = True
                p.add_run(f"（强度 {s.get('strength', 0):.0%}）")
                p.add_run(f" — {s.get('desc', '')}")
            doc.add_paragraph()

        # 拮抗/禁忌
        if antagonisms:
            doc.add_heading("五、禁忌搭配", level=1)
            for a in antagonisms:
                p = doc.add_paragraph()
                p.add_run(f"✗ {a.get('a', '')} + {a.get('b', '')}").bold = True
                p.add_run(f"（强度 {a.get('strength', 0):.0%}）")
            doc.add_paragraph()

        # 合规说明
        if compliance_notes:
            doc.add_heading("六、合规性说明", level=1)
            for note in compliance_notes:
                p = doc.add_paragraph(note)
                if '✓' in note:
                    p.runs[0].font.color.rgb = RGBColor(0, 128, 0)
                elif '✗' in note:
                    p.runs[0].font.color.rgb = RGBColor(255, 0, 0)
                elif '⚠' in note:
                    p.runs[0].font.color.rgb = RGBColor(255, 165, 0)
            doc.add_paragraph()

        # 改进建议
        if recommendations:
            doc.add_heading("七、改进建议", level=1)
            for rec in recommendations:
                doc.add_paragraph(f"• {rec}")

        # 页脚
        doc.add_page_break()
        footer_para = doc.add_paragraph()
        footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        footer_para.add_run(f"RMFOOD 配方设计平台 — 可解释性报告 | {datetime.now().year}").font.size = Pt(9)
        footer_para.add_run("\n本报告由 AI 自动生成，仅供参考，请以实际实验数据为准。").font.size = Pt(9)

        doc.save(str(output_path))
        return str(output_path), output_path.name

    def generate_explainability_report_pdf(
        self,
        formula_name: str,
        scores: dict,
        core_ingredients: list,
        synergies: list,
        antagonisms: list,
        compliance_notes: list,
        recommendations: list,
        summary: str,
    ) -> tuple:
        """生成配方可解释性报告（PDF）"""
        output_path = self.temp_dir / f"explainability_{formula_name}_{uuid.uuid4().hex[:8]}.pdf"

        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import (
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        doc = SimpleDocTemplate(str(output_path), pagesize=A4)
        styles = getSampleStyleSheet()
        # 使用已注册的 Windows 中文字体（HeitiSC-Regular 是 macOS 专有字体，Windows 上 reportlab 无法映射）
        cn_font = chinese_font_manager.get_pdf_font()
        cn_font_bold = chinese_font_manager.get_pdf_font(bold=True)
        styles.add(ParagraphStyle(name='Chinese', fontName=cn_font, fontSize=12))
        styles.add(ParagraphStyle(name='TitleChinese', fontName=cn_font_bold, fontSize=20, alignment=1))
        styles.add(ParagraphStyle(name='HeadingChinese', fontName=cn_font_bold, fontSize=14, spaceAfter=10))

        story = []

        # 标题
        story.append(Paragraph("配方可解释性报告", styles['TitleChinese']))
        story.append(Paragraph(f"配方：{formula_name}", styles['Chinese']))
        story.append(Paragraph(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Chinese']))
        story.append(Spacer(1, 20))

        # 综合评分
        story.append(Paragraph("一、综合评分", styles['HeadingChinese']))
        score_data = [
            [Paragraph("评分项", styles['Chinese']), Paragraph("分数", styles['Chinese'])],
            [Paragraph("综合评分", styles['Chinese']), Paragraph(f"{scores.get('overall', 0):.1f} / 100", styles['Chinese'])],
            [Paragraph("功效匹配", styles['Chinese']), Paragraph(f"{scores.get('efficacy', 0):.1f} / 100", styles['Chinese'])],
            [Paragraph("安全评分", styles['Chinese']), Paragraph(f"{scores.get('safety', 0):.1f} / 100", styles['Chinese'])],
            [Paragraph("成本评分", styles['Chinese']), Paragraph(f"{scores.get('cost', 0):.1f} / 100", styles['Chinese'])],
        ]
        score_table = Table(score_data, colWidths=[200, 150])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), cn_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        story.append(score_table)
        story.append(Spacer(1, 20))

        # 摘要
        story.append(Paragraph("二、报告摘要", styles['HeadingChinese']))
        story.append(Paragraph(summary, styles['Chinese']))
        story.append(Spacer(1, 20))

        # 协同效应
        if synergies:
            story.append(Paragraph("三、协同效应", styles['HeadingChinese']))
            for s in synergies:
                story.append(Paragraph(f"✓ {s.get('a', '')} + {s.get('b', '')} （强度 {s.get('strength', 0):.0%}）— {s.get('desc', '')}", styles['Chinese']))
            story.append(Spacer(1, 10))

        # 合规说明
        if compliance_notes:
            story.append(Paragraph("四、合规性说明", styles['HeadingChinese']))
            for note in compliance_notes:
                story.append(Paragraph(note, styles['Chinese']))
            story.append(Spacer(1, 10))

        # 建议
        if recommendations:
            story.append(Paragraph("五、改进建议", styles['HeadingChinese']))
            for rec in recommendations:
                story.append(Paragraph(f"• {rec}", styles['Chinese']))

        # 页脚
        story.append(PageBreak())
        story.append(Paragraph(f"RMFOOD 配方设计平台 — 可解释性报告 | {datetime.now().year}", styles['Chinese']))
        story.append(Paragraph("本报告由 AI 自动生成，仅供参考，请以实际实验数据为准。", styles['Chinese']))

        doc.build(story)
        return str(output_path), output_path.name


document_template_service = DocumentTemplateService()
