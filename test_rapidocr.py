"""Check rapidocr import + direct ocr test in backend venv."""
import io
import traceback

print("=== rapidocr_onnxruntime import ===")
try:
    from rapidocr_onnxruntime import RapidOCR
    print("RapidOCR import: OK")
except Exception as e:
    print("RapidOCR import FAILED:", repr(e))
    traceback.print_exc()
    raise SystemExit(0)

from PIL import Image
import numpy as np

img = Image.new("RGB", (300, 100), color="white")
from PIL import ImageDraw
d = ImageDraw.Draw(img)
d.text((10, 10), "hello", fill="black")
buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)

arr = np.array(Image.open(buf))
print("=== running RapidOCR ===")
engine, _ = RapidOCR()
result, elapse = engine(arr)
print("result:", result)
