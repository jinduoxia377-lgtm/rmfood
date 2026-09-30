import requests, io

BASE = "http://localhost:8000/api/v1"
coa = (
    "检验报告\n"
    "产品名称：黄芪多糖提取物\n"
    "批号：HT2024001\n"
    "含量测定：黄芪多糖≥95.0%（HPLC法）\n"
    "水分：≤5.0%\n"
    "重金属：铅≤2.0mg/kg，砷≤1.0mg/kg\n"
    "微生物：细菌总数≤1000cfu/g\n"
    "大肠杆菌：阴性\n"
    "沙门氏菌：阴性\n"
    "结论：本品经检验，判定为合格。"
)
files = {"file": ("coa.txt", io.BytesIO(coa.encode("utf-8")), "text/plain")}
r = requests.post(f"{BASE}/documents/extract", files=files, data={"document_type": "coa"}, timeout=15)
f = r.json()["data"]["extracted_fields"]
print("assay =", f.get("assay", {}).get("value"))
print("total fields:", len(f))
for k, v in f.items():
    print(f"  {k} = {v['value'][:30]} (conf={v['confidence']})")
