"""
条码/QR 标签生成服务

对标 FormLab 的 Code128 + QR 标签生成：
- Code128 条码（内部 ID 编码，适用于库存管理）
- QR 码（Deep Link 到应用，扫码直达详情）
- 人类可读信息层（名称 + UID + 上下文）

输出格式：PNG 图片字节流（可直接下载或打印）
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional

logger = logging.getLogger(__name__)


# ── 标签尺寸配置 ──
LABEL_SIZES = {
    "small":   {"width": 200, "height": 100, "qr_size": 40},
    "medium":  {"width": 400, "height": 200, "qr_size": 80},
    "large":   {"width": 600, "height": 300, "qr_size": 120},
}


@dataclass
class LabelConfig:
    entity_type: str           # "batch" | "sample" | "ingredient" | "equipment"
    entity_id: int
    entity_name: str
    label_size: str = "medium"
    format: Literal["code128", "qr", "both"] = "both"
    deep_link_base: str = "https://rmfood.app/entity"


class LabelGenerator:
    """
    条码/QR 标签生成器

    流程：
    1. 组装标签配置
    2. 生成 Code128 条码（可选）
    3. 生成 QR 码（可选）
    4. 合成 PNG 标签图像
    """

    def __init__(self, deep_link_base: str = "https://rmfood.app/entity"):
        self._deep_link_base = deep_link_base
        self._barcode_module = None
        self._qrcode_module = None
        self._pil = None
        self._import_error: Optional[str] = None

    def _ensure_deps(self):
        """延迟导入第三方库"""
        if self._import_error:
            raise ImportError(self._import_error)
        try:
            import barcode
            from barcode.writer import ImageWriter
            import qrcode
            from PIL import Image, ImageDraw, ImageFont

            self._barcode_module = barcode
            self._writer = ImageWriter()
            self._qrcode_module = qrcode
            self._pil = Image
            self._ImageDraw = ImageDraw
            self._ImageFont = ImageFont
        except ImportError as e:
            self._import_error = f"Missing dependency: {e}"
            raise

    async def generate_label(
        self,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        label_size: str = "medium",
        format: str = "both",
    ) -> bytes:
        """
        生成标签图片（PNG 字节流）

        Args:
            entity_type: "batch" | "sample" | "ingredient" | "equipment"
            entity_id: 实体 ID
            entity_name: 实体名称
            label_size: "small" | "medium" | "large"
            format: "code128" | "qr" | "both"

        Returns:
            PNG 图片字节流
        """
        self._ensure_deps()

        config = LabelConfig(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            label_size=label_size,
            format=format,
            deep_link_base=self._deep_link_base,
        )
        size_cfg = LABEL_SIZES.get(label_size, LABEL_SIZES["medium"])

        # 创建画布
        img = self._pil.new("RGB", (size_cfg["width"], size_cfg["height"]), color=(255, 255, 255))
        draw = self._ImageDraw.Draw(img)

        y_offset = 10
        line_h = 8

        # 标题
        draw.text((10, y_offset), f"[{entity_type.upper()}] #{entity_id}", fill=(0, 0, 0))
        y_offset += line_h + 12

        # 名称
        draw.text((10, y_offset), entity_name[:30], fill=(50, 50, 50))
        y_offset += line_h + 10

        # Deep link 文本
        deep_link = f"{self._deep_link_base}/{entity_type}/{entity_id}"
        draw.text((10, y_offset), deep_link[:40], fill=(120, 120, 120))
        y_offset += line_h + 15

        # Code128 条码
        if format in ("code128", "both"):
            try:
                code128 = self._barcode_module.get(
                    "code128",
                    str(entity_id),
                    writer=self._writer,
                )
                code_buf = io.BytesIO()
                code128.write(code_buf)
                code_bytes = code_buf.getvalue()

                # 将条码插入右侧区域
                code_img = self._pil.open(io.BytesIO(code_bytes))
                # 缩放适配
                code_w = int(size_cfg["width"] * 0.45)
                code_h = size_cfg["height"] - y_offset - 10
                code_img = code_img.resize((code_w, code_h))
                img.paste(code_img, (size_cfg["width"] - code_w - 10, y_offset))
            except Exception as e:
                logger.warning(f"Code128 generation failed: {e}")

        # QR 码
        if format in ("qr", "both"):
            try:
                qr = self._qrcode_module.make(deep_link)
                qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
                qr_sz = size_cfg["qr_size"]
                qr_img = qr_img.resize((qr_sz, qr_sz))
                # 放在左侧或中央
                qr_x = (size_cfg["width"] - qr_sz) // 2 if format == "both" else 10
                qr_y = (size_cfg["height"] - qr_sz) // 2 if format == "both" else y_offset
                img.paste(qr_img, (qr_x, qr_y))
            except Exception as e:
                logger.warning(f"QR generation failed: {e}")

        # 保存为 PNG
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()

    async def generate_label_svg(
        self,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        label_size: str = "medium",
        format: str = "both",
    ) -> str:
        """
        生成 SVG 标签（适合矢量打印）

        QR 码使用真实矩阵数据渲染为矢量 rect，可正常扫描。

        Returns:
            SVG 字符串
        """
        size_cfg = LABEL_SIZES.get(label_size, LABEL_SIZES["medium"])
        w, h = size_cfg["width"], size_cfg["height"]
        deep_link = f"{self._deep_link_base}/{entity_type}/{entity_id}"

        svg_parts = [
            f'<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
            f'  <rect width="{w}" height="{h}" fill="white" stroke="#ddd" stroke-width="1"/>',
            f'  <text x="10" y="20" font-family="monospace" font-size="14" fill="#000">[{entity_type.upper()}] #{entity_id}</text>',
            f'  <text x="10" y="40" font-family="sans-serif" font-size="12" fill="#333">{entity_name[:30]}</text>',
            f'  <text x="10" y="58" font-family="monospace" font-size="9" fill="#888">{deep_link[:50]}</text>',
        ]

        if format in ("code128", "both"):
            # 用 barcode 库生成 Code128 SVG
            try:
                import barcode
                from barcode.writer import SVGWriter
                code128 = barcode.get("code128", str(entity_id), writer=SVGWriter())
                svg_buf = io.BytesIO()
                code128.write(svg_buf)
                svg_content = svg_buf.getvalue().decode("utf-8")
                # 提取 <svg> 内容并嵌入
                import re
                match = re.search(r'<svg[^>]*>(.*?)</svg>', svg_content, re.DOTALL)
                if match:
                    svg_parts.append(f'  <!-- Code128 Barcode -->')
                    svg_parts.append(f'  <g transform="translate({w - 180}, 65) scale(0.5)">'
                                     f'{match.group(1)}</g>')
            except Exception as e:
                logger.warning(f"Code128 SVG failed: {e}")
                svg_parts.append(f'  <text x="{w-150}" y="80" font-size="10" fill="#999">CODE128</text>')

        if format in ("qr", "both"):
            svg_parts.extend(self._render_qr_svg(deep_link, w))

        svg_parts.append("</svg>")
        return "\n".join(svg_parts)

    def _render_qr_svg(self, data: str, label_width: int) -> list:
        """
        将 QR 码矩阵渲染为 SVG rect 元素。
        使用 qrcode 库生成的真实矩阵数据，输出可扫描的矢量 QR 码。
        """
        import qrcode

        qr = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)

        matrix = qr.get_matrix()
        modules = len(matrix)

        # 尺寸：根据标签宽度自适应，最大 100px，最小 40px
        qr_px = min(100, max(40, label_width // 4))
        x0 = (label_width - qr_px) // 2
        y0 = 90
        cell = qr_px / modules

        parts = [f'  <!-- QR Code (vector): {data[:40]} -->']
        # 背景白底
        parts.append(
            f'  <rect x="{x0}" y="{y0}" width="{qr_px}" height="{qr_px}" fill="white"/>'
        )
        for r_idx, row in enumerate(matrix):
            for c_idx, is_dark in enumerate(row):
                if not is_dark:
                    continue
                rx = x0 + c_idx * cell
                ry = y0 + r_idx * cell
                parts.append(
                    f'  <rect x="{rx:.2f}" y="{ry:.2f}" '
                    f'width="{cell + 0.3:.2f}" height="{cell + 0.3:.2f}" fill="#000"/>'
                )
        return parts


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[LabelGenerator] = None


def get_label_generator(deep_link_base: str = "https://rmfood.app/entity") -> LabelGenerator:
    global _instance
    if _instance is None:
        _instance = LabelGenerator(deep_link_base=deep_link_base)
    return _instance
