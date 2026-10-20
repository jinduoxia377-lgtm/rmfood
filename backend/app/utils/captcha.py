"""人机验证码图片生成（Pillow，自托管，无外部依赖）

生成带噪点/干扰线的 4 字符 PNG 图片，返回字节流，由调用方转 base64。
"""
from __future__ import annotations

import io
import os
import random

from PIL import Image, ImageDraw, ImageFont


def _load_font(size: int):
    """按平台加载一个 TTF 字体；找不到则用 PIL 默认字体。"""
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/consolab.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def generate_captcha_image(code: str, width: int = 130, height: int = 46) -> bytes:
    """
    根据 4 字符 code 生成 PNG 验证码图片。

    Args:
        code: 4 位大写字母/数字（不含易混淆字符）
        width/height: 图片尺寸

    Returns:
        PNG 图片字节流
    """
    bg_r = random.randint(235, 252)
    bg_g = random.randint(235, 252)
    bg_b = random.randint(235, 252)
    img = Image.new("RGB", (width, height), (bg_r, bg_g, bg_b))
    draw = ImageDraw.Draw(img)

    # 干扰线
    for _ in range(6):
        draw.line(
            [
                (random.randint(0, width), random.randint(0, height)),
                (random.randint(0, width), random.randint(0, height)),
            ],
            fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)),
            width=random.randint(1, 2),
        )

    # 噪点
    for _ in range(60):
        draw.point(
            (random.randint(0, width), random.randint(0, height)),
            fill=(random.randint(60, 180), random.randint(60, 180), random.randint(60, 180)),
        )

    font = _load_font(26)
    char_x = 14
    for ch in code:
        color = (random.randint(10, 100), random.randint(10, 100), random.randint(10, 100))
        y = random.randint(8, 16)
        draw.text((char_x, y), ch, font=font, fill=color)
        char_x += 27

    # 边框
    draw.rectangle([0, 0, width - 1, height - 1], outline=(150, 150, 150), width=1)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()