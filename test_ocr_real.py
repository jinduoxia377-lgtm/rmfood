"""Test OCR endpoint with a real image (PIL-generated ingredient label)."""
import io
import sys
import requests

BASE = "http://localhost:8000/api/v1"

from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (800, 300), color="white")
draw = ImageDraw.Draw(img)

font = None
for path in ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"]:
    try:
        font = ImageFont.truetype(path, 28)
        break
    except Exception:
        continue
if font is None:
    font = ImageFont.load_default()

lines = [
    "配料表",
    "配料：黄芪5g，枸杞3g，山药10g，",
    "柠檬酸0.5g，E150（焦糖色）0.1g，",
    "E330（柠檬酸）2g",
]
y = 30
for line in lines:
    draw.text((40, y), line, fill="black", font=font)
    y += 50

buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)

files = {"file": ("label.png", buf, "image/png")}
r = requests.post(f"{BASE}/ingredients/ocr", files=files, timeout=300)
d = r.json()
print("OCR status:", r.status_code)
print("success:", d.get("success"))
print("message:", (d.get("message") or "")[:200])
if d.get("text"):
    print("text:", d["text"])
    print("ingredients:", [i["name"] for i in (d.get("ingredients") or [])])
