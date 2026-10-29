"""营养标签导出服务 — Excel + PDF

支持两种格式：
- Excel: 对照原公式算法Excel格式（原料明细+标签汇总+NRV%）
- PDF: 印刷级GB 28050营养标签（A6尺寸）
"""

import logging
from io import BytesIO
from typing import Any, Dict

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Excel 导出（openpyxl）
# ═══════════════════════════════════════════════════════════════

def export_to_excel(label_data: Dict[str, Any]) -> bytes:
    """
    将营养标签导出为Excel文件

    格式对照原公式算法Excel：
    - Sheet1: 营养成分表（每100g + 每份 + NRV%）
    - Sheet2: 原料明细（各原料营养含量）
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    except ImportError:
        raise ImportError("请安装 openpyxl: pip install openpyxl")

    wb = Workbook()
    ws_main = wb.active
    ws_main.title = "营养成分表"

    # 样式定义
    header_font = Font(name="Microsoft YaHei", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    title_font = Font(name="Microsoft YaHei", bold=True, size=14)
    cell_font = Font(name="Microsoft YaHei", size=10)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    # ── Sheet1: 营养成分表 ─────────────────────────────────
    # 标题行
    ws_main.merge_cells("A1:E1")
    title_cell = ws_main["A1"]
    title_cell.value = "预包装食品营养成分表"
    title_cell.font = title_font
    title_cell.alignment = center_align
    ws_main.row_dimensions[1].height = 30

    # 表头（第3行）
    headers = ["营养成分", "每100g", "单位", "NRV%", "每份"]
    for col_idx, header in enumerate(headers, 1):
        cell = ws_main.cell(row=3, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border
    ws_main.row_dimensions[3].height = 22

    # 数据行
    label_items = label_data.get("label_items", [])
    per_100g = label_data.get("per_100g", {})
    per_serving = label_data.get("per_serving", {})
    nrv_pct = label_data.get("nrv_percentages", {})

    # 中文名称映射
    cn_names = {
        "energy": "能量", "protein": "蛋白质", "fat": "脂肪",
        "saturated_fat": "饱和脂肪", "carbohydrate": "碳水化合物",
        "sugar": "糖", "dietary_fiber": "膳食纤维", "sodium": "钠",
        "calcium": "钙", "iron": "铁", "zinc": "锌",
        "vitamin_a": "维生素A", "vitamin_c": "维生素C",
    }

    row_num = 4
    for item in label_items:
        nutrient = item["nutrient"]
        cn_name = cn_names.get(nutrient, nutrient)
        unit = item.get("unit", "g")
        value_100g = per_100g.get(nutrient, 0)
        value_serving = per_serving.get(nutrient, 0) if item.get("per_serving") else ""
        nrv = nrv_pct.get(nutrient, 0)

        row_data = [
            cn_name,
            round(value_100g, 2) if value_100g else 0,
            unit,
            f"{round(nrv, 1)}%" if nrv else "—",
            round(value_serving, 2) if value_serving else "—",
        ]

        for col_idx, value in enumerate(row_data, 1):
            cell = ws_main.cell(row=row_num, column=col_idx, value=value)
            cell.font = cell_font
            cell.alignment = center_align if col_idx > 1 else left_align
            cell.border = thin_border
        row_num += 1

    # 脚注
    foot_row = row_num + 1
    ws_main.merge_cells(f"A{foot_row}:E{foot_row}")
    footnote = ws_main.cell(row=foot_row, column=1, value="* NRV = 营养素参考值（GB 28050-2011）")
    footnote.font = Font(name="Microsoft YaHei", size=9, italic=True, color="888888")

    # 列宽
    ws_main.column_dimensions["A"].width = 16
    ws_main.column_dimensions["B"].width = 12
    ws_main.column_dimensions["C"].width = 8
    ws_main.column_dimensions["D"].width = 10
    ws_main.column_dimensions["E"].width = 12

    # ── Sheet2: 原料明细 ─────────────────────────────────
    ws_ingredients = wb.create_sheet("原料明细")
    ing_headers = ["原料名称", "添加量(g)", "蛋白质(g/100g)", "脂肪(g/100g)",
                   "碳水(g/100g)", "钠(mg/100g)", "能量(kJ/100g)"]
    for col_idx, header in enumerate(ing_headers, 1):
        cell = ws_ingredients.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border
    ws_ingredients.row_dimensions[1].height = 22

    # 从per_100g中提取原料数据（简化：显示汇总）
    serve_info = label_data.get("serving_info", {})
    total_weight = serve_info.get("package_size_g", 0)
    ws_ingredients.merge_cells("A1:G1")
    summary_cell = ws_ingredients.cell(row=1, column=1, value=f"配方总重: {total_weight}g")
    summary_cell.font = Font(name="Microsoft YaHei", bold=True, size=11)
    summary_cell.alignment = center_align

    ws_ingredients.column_dimensions["A"].width = 16
    ws_ingredients.column_dimensions["B"].width = 12

    # ── 输出 ───────────────────────────────────────────────
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


# ═══════════════════════════════════════════════════════════════
# PDF 导出（reportlab）
# ═══════════════════════════════════════════════════════════════

def export_to_pdf(label_data: Dict[str, Any]) -> bytes:
    """
    将营养标签导出为PDF（A6尺寸，印刷级）
    """
    try:
        from reportlab.lib.pagesizes import A6
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
    except ImportError:
        raise ImportError("请安装 reportlab: pip install reportlab")

    # 尝试注册中文字体
    font_registered = False
    chinese_fonts = [
        ("msyh", "C:/Windows/Fonts/msyh.ttc"),       # 微软雅黑
        ("simhei", "C:/Windows/Fonts/simhei.ttf"),    # 黑体
        ("simsun", "C:/Windows/Fonts/simsun.ttc"),    # 宋体
    ]
    for font_name, font_path in chinese_fonts:
        try:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            canvas.Canvas.__dict__.setdefault('_font', font_name)
            font_registered = True
            break
        except Exception:
            continue

    if not font_registered:
        font_name = "Helvetica"
    else:
        font_name = "msyh"

    # A6尺寸: 105mm × 148mm
    width, height = A6
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A6)

    # 标题
    c.setFont(font_name, 14)
    c.drawCentredString(width / 2, height - 15 * mm, "营养成分表")

    # 分隔线
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1)
    c.line(10 * mm, height - 22 * mm, width - 10 * mm, height - 22 * mm)

    # 表头
    c.setFont(font_name, 9)
    headers = [("营养成分", 15 * mm), ("每100g", 45 * mm), ("NRV%", 70 * mm)]
    if label_data.get("display_unit") == "ml":
        headers[1] = ("每100ml", 45 * mm)

    x_start = 15 * mm
    for text, x_pos in headers:
        c.drawString(x_pos, height - 30 * mm, text)

    # 分隔线
    c.line(10 * mm, height - 33 * mm, width - 10 * mm, height - 33 * mm)

    # 数据行
    label_items = label_data.get("label_items", [])
    per_100g = label_data.get("per_100g", {})
    nrv_pct = label_data.get("nrv_percentages", {})

    cn_names = {
        "energy": "能量", "protein": "蛋白质", "fat": "脂肪",
        "saturated_fat": "饱和脂肪", "carbohydrate": "碳水化合物",
        "sugar": "糖", "dietary_fiber": "膳食纤维", "sodium": "钠",
    }

    y_pos = height - 40 * mm
    for item in label_items[:6]:  # 最多6行
        nutrient = item["nutrient"]
        cn_name = cn_names.get(nutrient, nutrient)
        unit = item.get("unit", "g")
        value_100g = per_100g.get(nutrient, 0)
        nrv = nrv_pct.get(nutrient, 0)

        c.setFont(font_name, 8)
        c.drawString(x_start, y_pos, cn_name)
        c.drawString(45 * mm, y_pos, f"{round(value_100g, 2)} {unit}")
        c.drawString(70 * mm, y_pos, f"{round(nrv, 1)}%" if nrv else "—")

        y_pos -= 7 * mm
        if y_pos < 15 * mm:
            break

    # 脚注
    if y_pos > 8 * mm:
        c.setFont(font_name, 6)
        c.drawString(10 * mm, y_pos - 3 * mm, "* NRV = 营养素参考值（GB 28050-2011）")

    c.save()
    buf.seek(0)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════
# 公共 API
# ═══════════════════════════════════════════════════════════════

def export_nutrition_label(
    label_data: Dict[str, Any],
    fmt: str = "excel",
) -> bytes:
    """
    导出营养标签为指定格式

    Args:
        label_data: calculate_label() 返回的结果
        fmt: "excel" | "pdf"

    Returns:
        文件字节流
    """
    if fmt == "excel":
        return export_to_excel(label_data)
    elif fmt == "pdf":
        return export_to_pdf(label_data)
    else:
        raise ValueError(f"不支持的导出格式: {fmt}，支持: excel, pdf")
