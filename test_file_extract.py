"""Test file upload document extraction"""
import requests, io

BASE = "http://localhost:8000/api/v1"

# File upload with short txt
files = {'file': ('coa.txt', io.BytesIO('批号：T2024-001\n产品名称：黄芪提取物\n含量：95.2%\n水分：4.2%\n结论：合格'.encode('utf-8')), 'text/plain')}
data = {'document_type': 'coa'}
r = requests.post(f"{BASE}/documents/extract", files=files, data=data, timeout=15)
d = r.json()
fields = d.get("data", {}).get("extracted_fields", {})
print("file upload extract:", r.status_code, "| status:", d.get("status"), "| fields:", len(fields))
for k, v in fields.items():
    conf = v["confidence"]
    print(f"  {k} = {v['value']} (conf={conf})")
