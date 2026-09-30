"""Diagnose why _run_ocr fails to find a working engine."""
import traceback
print("=== cnocr ===")
try:
    from cnocr import CnOcr
    print("CnOcr import: OK")
except Exception as e:
    print("CnOcr import FAILED:", repr(e))
    traceback.print_exc()

print("\n=== easyocr ===")
try:
    import easyocr
    print("easyocr import: OK")
except Exception as e:
    print("easyocr import FAILED:", repr(e))

print("\n=== paddleocr ===")
try:
    from paddleocr import PaddleOCR
    print("PaddleOCR import: OK")
except Exception as e:
    print("PaddleOCR import FAILED:", repr(e))
