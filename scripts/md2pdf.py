#!/usr/bin/env python3
"""Generate PDF from markdown using fpdf2 with CJK font support"""

import os
import re

# Find CJK font
FONT_PATH = None
for fp in [
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf", 
    "C:/Windows/Fonts/simsun.ttc",
    "C:/Windows/Fonts/msyhbd.ttc",
]:
    if os.path.exists(fp):
        FONT_PATH = fp
        break

if not FONT_PATH:
    print("ERROR: No CJK font found!")
    exit(1)

print(f"Using font: {FONT_PATH}")

from fpdf import FPDF

class PDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font('CJK', '', FONT_PATH, uni=True)
        self.set_auto_page_break(auto=True, margin=20)
    
    def header(self):
        self.set_font('CJK', '', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, 'RMFOOD 配方生成模块 — 院士级审查报告与专业升级方案', 0, 0, 'R')
        self.ln(10)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('CJK', '', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'第 {self.page_no()} 页', 0, 0, 'C')

pdf = PDF()
pdf.alias_nb_pages()

# Read markdown
md_path = r"D:\RMFOOD配方平台\配方生成模块审查与升级方案.md"
with open(md_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

in_code = False
code_lines = []
in_table = False
table_rows = []

def flush_table(pdf, rows):
    if not rows:
        return
    # Calculate column count
    max_cols = max(len(r) for r in rows)
    col_width = (pdf.w - 2 * pdf.l_margin) / max_cols
    
    for i, row in enumerate(rows):
        # Clean cells
        cells = [c.strip() for c in row]
        is_header = all(re.match(r'^[-:]+$', c.replace(' ', '')) for c in cells if c)
        
        if is_header:
            continue  # Skip separator rows
        
        for j, cell in enumerate(cells):
            if i == 0:
                pdf.set_font('CJK', '', 8)
                pdf.set_fill_color(22, 33, 62)
                pdf.set_text_color(255, 255, 255)
            else:
                pdf.set_font('CJK', '', 8)
                pdf.set_text_color(30, 30, 30)
                if i % 2 == 0:
                    pdf.set_fill_color(247, 248, 252)
                else:
                    pdf.set_fill_color(255, 255, 255)
            
            pdf.cell(col_width, 6, cell, border=1, fill=True, align='L')
        
        pdf.ln(6)
    
    pdf.ln(4)
    rows.clear()

for line in lines:
    raw = line.rstrip('\n')
    stripped = raw.strip()
    
    # Code blocks
    if stripped.startswith('```'):
        if in_code:
            # End code block
            pdf.set_font('CJK', '', 7.5)
            pdf.set_text_color(200, 200, 200)
            pdf.set_fill_color(30, 30, 30)
            for cl in code_lines:
                pdf.multi_cell(0, 4.5, cl, fill=True)
            pdf.ln(3)
            code_lines = []
            in_code = False
        else:
            in_code = True
            in_table = False
            flush_table(pdf, table_rows)
        continue
    
    if in_code:
        code_lines.append(stripped)
        continue
    
    # Table detection
    if stripped.startswith('|') and stripped.endswith('|'):
        # Parse table row
        cells = [c.strip() for c in stripped.strip('|').split('|')]
        table_rows.append(cells)
        in_table = True
        continue
    else:
        if in_table:
            flush_table(pdf, table_rows)
            in_table = False
    
    # Empty line
    if not stripped:
        pdf.ln(3)
        continue
    
    # Horizontal rule
    if re.match(r'^-{3,}$', stripped):
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(5)
        continue
    
    # Headings
    if stripped.startswith('#'):
        level = len(re.match(r'^#+', stripped).group())
        text = stripped.lstrip('#').strip()
        text = text.replace('🏆', '[STAR]').replace('🔴', '[RED]').replace('✅', '[OK]').replace('❌', '[X]').replace('⚠️', '[WARN]').replace('🟡', '[YELLOW]').replace('💡', '[TIP]').replace('📋', '[LIST]').replace('🧬', '[DNA]').replace('🥗', '[FOOD]').replace('💪', '[STRONG]').replace('🌾', '[GRAIN]').replace('🔥', '[FIRE]').replace('🦴', '[BONE]')
        
        if level == 1:
            pdf.add_page()
            pdf.set_font('CJK', '', 16)
            pdf.set_text_color(26, 26, 46)
            pdf.cell(0, 10, text, 0, 1, 'C')
            pdf.set_draw_color(22, 33, 62)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(6)
        elif level == 2:
            pdf.ln(2)
            pdf.set_font('CJK', '', 13)
            pdf.set_text_color(22, 33, 62)
            pdf.cell(0, 8, text, 0, 1)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(3)
        elif level == 3:
            pdf.ln(2)
            pdf.set_font('CJK', '', 11)
            pdf.set_text_color(15, 52, 96)
            pdf.cell(0, 7, text, 0, 1)
            pdf.ln(1)
        elif level >= 4:
            pdf.set_font('CJK', '', 10)
            pdf.set_text_color(50, 50, 50)
            pdf.cell(0, 6, text, 0, 1)
        continue
    
    # Blockquote
    if stripped.startswith('> '):
        text = stripped[2:]
        pdf.set_font('CJK', '', 9)
        pdf.set_text_color(60, 60, 60)
        pdf.set_fill_color(240, 244, 248)
        pdf.set_draw_color(22, 33, 62)
        x = pdf.get_x()
        pdf.rect(x, pdf.get_y(), 3, 5, 'F')
        pdf.set_x(x + 5)
        pdf.multi_cell(0, 5.5, text)
        pdf.ln(2)
        continue
    
    # List items
    if re.match(r'^[-*+]\s', stripped) or re.match(r'^\d+\.\s', stripped):
        text = re.sub(r'^[-*+]\s|^\d+\.\s', '', stripped)
        # Clean markdown formatting
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        
        pdf.set_font('CJK', '', 9.5)
        pdf.set_text_color(40, 40, 40)
        x = pdf.get_x()
        pdf.set_x(x + 5)
        pdf.cell(4, 5.5, chr(8226), 0, 0)  # bullet
        pdf.multi_cell(0, 5.5, text)
        continue
    
    # Normal paragraph
    text = stripped
    # Clean markdown formatting
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    # Clean emoji
    text = re.sub(r'[🏆🔴✅❌⚠️🟡💡📋🧬🥗💪🌾🔥🦴⭐]', '', text)
    
    pdf.set_font('CJK', '', 9.5)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 5.5, text)
    pdf.ln(1)

# Flush remaining table
if in_table:
    flush_table(pdf, table_rows)

# Output
pdf_path = r"D:\RMFOOD配方平台\配方生成模块审查与升级方案.pdf"
pdf.output(pdf_path)
size_kb = os.path.getsize(pdf_path) / 1024
print(f"PDF saved: {pdf_path}")
print(f"File size: {size_kb:.1f} KB")
print("Done!")
