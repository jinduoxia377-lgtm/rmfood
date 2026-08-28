"""
COA Word/PDF 文档生成器
支持基于模板生成 Word 和 PDF 格式的出厂检验报告
"""
import logging
import io
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from docx import Document
    from docx.shared import Pt, Inches, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


class COAWordGenerator:
    """基于 python-docx 的 COA Word 文档生成器"""

    def __init__(self):
        if not HAS_DOCX:
            raise ImportError("需要安装 python-docx: pip install python-docx")

    def generate(self, coa_data: dict) -> bytes:
        """生成 COA Word 文档"""
        doc = Document()

        # 设置页面为 A4
        section = doc.sections[0]
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

        # ── 公司标题 ──
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(coa_data.get('company_name_cn', '莱茵（厦门）分子生物科技有限公司'))
        run.bold = True
        run.font.size = Pt(18)
        run.font.color.rgb = RGBColor(0x1A, 0x56, 0xDB)

        p2 = doc.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run2 = p2.add_run(coa_data.get('company_name_en', 'RHEIN (XIAMEN) MOLEKUL BIOTECH INC'))
        run2.font.size = Pt(9)
        run2.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        doc.add_paragraph()  # 空行

        # ── 标题 ──
        title = doc.add_paragraph()
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_t = title.add_run('成品检测报告')
        run_t.bold = True
        run_t.font.size = Pt(16)

        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_s = sub.add_run('CERTIFICATE OF ANALYSIS')
        run_s.font.size = Pt(10)
        run_s.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

        doc.add_paragraph()

        # ── 基础信息表格 ──
        info_data = [
            ['产品名称', coa_data.get('product_name_cn', ''), 'Product Name', coa_data.get('product_name_en', '')],
            ['产品类型', coa_data.get('product_type', ''), 'Product Type', coa_data.get('product_type', '')],
            ['型号', coa_data.get('product_code', ''), 'Code', coa_data.get('product_code', '')],
            ['规格', coa_data.get('spec', ''), 'Spec', coa_data.get('spec', '')],
            ['生产日期', coa_data.get('mfg_date', ''), 'Mfg. Date', coa_data.get('mfg_date', '')],
            ['生产批号', coa_data.get('batch_no', ''), 'Batch No.', coa_data.get('batch_no', '')],
        ]
        self._add_table(doc, info_data, col_widths=[Inches(1.0), Inches(1.8), Inches(1.0), Inches(1.8)])

        doc.add_paragraph()

        # ── 检验依据 ──
        basis = coa_data.get('inspection_basis', '')
        if basis:
            p_basis = doc.add_paragraph()
            p_basis.add_run('检测、判定依据: ').bold = True
            p_basis.add_run(basis)

        doc.add_paragraph()

        # ── 检验结果表格 ──
        items = coa_data.get('test_items', [])
        if items:
            header = ['类别', '检测项目', '标准/限值', '检测结果', '单位', '判定']
            rows = [header]
            for item in items:
                rows.append([
                    item.get('category', ''),
                    item.get('item_name', ''),
                    item.get('standard', ''),
                    item.get('result', ''),
                    item.get('unit', ''),
                    item.get('judgment', ''),
                ])
            self._add_table(doc, rows, col_widths=[Inches(0.9), Inches(1.3), Inches(1.8), Inches(1.3), Inches(0.5), Inches(0.8)])

        doc.add_paragraph()

        # ── 结论 ──
        conclusion = coa_data.get('test_conclusion', '合格')
        conclusion_para = doc.add_paragraph()
        conclusion_para.add_run('检验结论: ').bold = True
        run_c = conclusion_para.add_run(conclusion)
        run_c.bold = True
        if conclusion == '合格':
            run_c.font.color.rgb = RGBColor(0x16, 0xA3, 0x4A)
        else:
            run_c.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)

        # ── 签名区 ──
        doc.add_paragraph()
        signed_data = [
            ['检测人', coa_data.get('tested_by', ''), '日期', coa_data.get('mfg_date', '')],
            ['校对人', coa_data.get('checked_by', ''), '日期', coa_data.get('mfg_date', '')],
            ['批准人', coa_data.get('approved_by', ''), '日期', coa_data.get('mfg_date', '')],
        ]
        self._add_table(doc, signed_data, col_widths=[Inches(0.9), Inches(1.5), Inches(0.8), Inches(1.6)])

        # 保存
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def _add_table(doc, data: list, col_widths=None):
        """添加表格到文档"""
        table = doc.add_table(rows=len(data), cols=len(data[0]))
        table.style = 'Table Grid'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        for i, row_data in enumerate(data):
            row = table.rows[i]
            for j, cell_text in enumerate(row_data):
                cell = row.cells[j]
                cell.text = str(cell_text)
                if i == 0:  # 表头
                    for para in cell.paragraphs:
                        for run in para.runs:
                            run.bold = True
                            run.font.size = Pt(9)
                else:
                    for para in cell.paragraphs:
                        for run in para.runs:
                            run.font.size = Pt(9)

        if col_widths:
            for i, width in enumerate(col_widths):
                for row in table.rows:
                    if i < len(row.cells):
                        row.cells[i].width = width


class COAPDFGenerator:
    """基于 reportlab 的 COA PDF 文档生成器"""

    def __init__(self):
        if not HAS_REPORTLAB:
            raise ImportError("需要安装 reportlab: pip install reportlab")

    def generate(self, coa_data: dict) -> bytes:
        """生成 COA PDF 文档"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=20*mm,
            bottomMargin=20*mm,
            leftMargin=15*mm,
            rightMargin=15*mm,
        )

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            'ChineseTitle',
            fontName='Helvetica-Bold',
            fontSize=16,
            alignment=1,  # center
            spaceAfter=6,
        ))
        styles.add(ParagraphStyle(
            'ChineseBody',
            fontName='Helvetica',
            fontSize=10,
            spaceAfter=4,
        ))
        styles.add(ParagraphStyle(
            'ChineseLabel',
            fontName='Helvetica-Bold',
            fontSize=9,
            spaceAfter=2,
        ))

        story = []

        # 公司标题
        story.append(Paragraph(
            coa_data.get('company_name_cn', '莱茵（厦门）分子生物科技有限公司'),
            styles['ChineseTitle']
        ))
        story.append(Paragraph(
            coa_data.get('company_name_en', 'RHEIN (XIAMEN) MOLEKUL BIOTECH INC'),
            styles['ChineseBody']
        ))
        story.append(Spacer(1, 10))

        # 标题
        story.append(Paragraph('成品检测报告', styles['ChineseTitle']))
        story.append(Paragraph('CERTIFICATE OF ANALYSIS', styles['ChineseBody']))
        story.append(Spacer(1, 10))

        # 基础信息
        info_data = [
            ['产品名称', coa_data.get('product_name_cn', ''), 'Product Name', coa_data.get('product_name_en', '')],
            ['产品类型', coa_data.get('product_type', ''), 'Product Type', coa_data.get('product_type', '')],
            ['型号', coa_data.get('product_code', ''), 'Code', coa_data.get('product_code', '')],
            ['规格', coa_data.get('spec', ''), 'Spec', coa_data.get('spec', '')],
            ['生产日期', coa_data.get('mfg_date', ''), 'Mfg. Date', coa_data.get('mfg_date', '')],
            ['生产批号', coa_data.get('batch_no', ''), 'Batch No.', coa_data.get('batch_no', '')],
        ]
        info_table = Table(info_data, colWidths=[40*mm, 70*mm, 40*mm, 70*mm])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), (0.9, 0.9, 0.9)),
            ('BACKGROUND', (2, 0), (2, -1), (0.9, 0.9, 0.9)),
            ('GRID', (0, 0), (-1, -1), 0.5, (0.7, 0.7, 0.7)),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 10))

        # 检验依据
        basis = coa_data.get('inspection_basis', '')
        if basis:
            story.append(Paragraph(f'<b>检测、判定依据:</b> {basis}', styles['ChineseBody']))
            story.append(Spacer(1, 10))

        # 检验结果
        items = coa_data.get('test_items', [])
        if items:
            result_header = ['类别', '检测项目', '标准/限值', '检测结果', '单位', '判定']
            result_rows = [result_header]
            for item in items:
                result_rows.append([
                    item.get('category', ''),
                    item.get('item_name', ''),
                    item.get('standard', ''),
                    item.get('result', ''),
                    item.get('unit', ''),
                    item.get('judgment', ''),
                ])

            result_table = Table(result_rows, colWidths=[25*mm, 35*mm, 55*mm, 35*mm, 20*mm, 25*mm])
            result_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), (0.2, 0.4, 0.7)),
                ('TEXTCOLOR', (0, 0), (-1, 0), RGBColor(1, 1, 1)),
                ('GRID', (0, 0), (-1, -1), 0.5, (0.7, 0.7, 0.7)),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [(0.97, 0.97, 0.97), (1, 1, 1)]),
            ]))
            story.append(result_table)
            story.append(Spacer(1, 10))

        # 结论
        conclusion = coa_data.get('test_conclusion', '合格')
        story.append(Paragraph(f'<b>检验结论:</b> {conclusion}', styles['ChineseBody']))
        story.append(Spacer(1, 10))

        # 签名区
        signed_data = [
            ['检测人', coa_data.get('tested_by', ''), '日期', coa_data.get('mfg_date', '')],
            ['校对人', coa_data.get('checked_by', ''), '日期', coa_data.get('mfg_date', '')],
            ['批准人', coa_data.get('approved_by', ''), '日期', coa_data.get('mfg_date', '')],
        ]
        sign_table = Table(signed_data, colWidths=[25*mm, 50*mm, 25*mm, 50*mm])
        sign_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), (0.9, 0.9, 0.9)),
            ('BACKGROUND', (2, 0), (2, -1), (0.9, 0.9, 0.9)),
            ('GRID', (0, 0), (-1, -1), 0.5, (0.7, 0.7, 0.7)),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
        ]))
        story.append(sign_table)

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


# ─── 工厂函数 ─────────────────────────────────────────────────

def generate_coa_word(coa_data: dict) -> bytes:
    """生成 COA Word 文档"""
    return COAWordGenerator().generate(coa_data)


def generate_coa_pdf(coa_data: dict) -> bytes:
    """生成 COA PDF 文档"""
    return COAPDFGenerator().generate(coa_data)
