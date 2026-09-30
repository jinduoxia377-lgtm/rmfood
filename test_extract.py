"""Test document extraction with real CoA text"""
import requests, json

coa = """检验报告
产品名称：黄芪多糖提取物
批号：HT2024001
规格：1kg/袋
检验日期：2024-05-20
检验项目：
1. 性状：淡黄色粉末
2. 鉴别： TLC对照，阳性
3. 含量测定：黄芪多糖≥95.0%（HPLC法）
4. 水分：≤5.0%（烘干失重法）
5. 灰分：≤5.0%
6. 重金属：铅≤2.0mg/kg，砷≤1.0mg/kg，汞≤0.5mg/kg
7. 微生物：细菌总数≤1000cfu/g，霉菌≤100cfu/g，酵母菌≤50cfu/g，大肠杆菌阴性，沙门氏菌阴性
结论：本品经检验，符合《中国药典》2020年版四部通则1185之规定，判定为合格。"""

r = requests.post('http://localhost:8000/api/v1/documents/extract/text',
                  json={'text': coa, 'document_type': 'coa'}, timeout=10)
d = r.json()
fields = d.get('data', {}).get('extracted_fields', {})
print(f"Extracted {len(fields)} fields:")
for k, v in fields.items():
    print(f"  {k}: {v['value']} (conf={v['confidence']})")
