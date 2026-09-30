"""Verify /labels/preview and honest /ingredients/ocr behavior."""
import io
import requests

BASE = "http://localhost:8000/api/v1"

# 1. /labels/preview
r = requests.get(
    f"{BASE}/labels/preview",
    params={"entity_type": "batch", "entity_id": 42, "entity_name": "BATCH-2024-042", "label_size": "medium", "format": "both"},
    timeout=10,
)
d = r.json()
print("1. /labels/preview:", r.status_code, "| data_url len:", len(d["data"]["data_url"]), "| width:", d["data"]["width_px"])

# 2. /ingredients/ocr now returns honest failure (no fake data)
files = {"file": ("test.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100), "image/png")}
r = requests.post(f"{BASE}/ingredients/ocr", files=files, timeout=10)
d = r.json()
print("2. /ingredients/ocr:", r.status_code, "| success:", d["success"], "| msg:", (d.get("message") or "")[:60])

# 3. Confirm generate still works
r = requests.post(
    f"{BASE}/labels/generate",
    json={"entity_type": "batch", "entity_id": 42, "entity_name": "B", "label_size": "medium", "format": "both", "output_format": "png"},
    timeout=10,
)
print("3. /labels/generate:", r.status_code, "| bytes:", len(r.content))
