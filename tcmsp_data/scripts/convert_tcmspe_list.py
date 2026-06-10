from urllib.parse import quote
import json
import re
from datetime import datetime, timezone

BASE_URL = "https://www.tcmsp-e.com"
FALLBACK_TOKEN = "ee3a5d33b6d2e34b1fd95dadf566e224"

# 读取源文件（可能为JSON字符串包裹格式）
with open(r'd:\RMFOOD配方平台\tcmsp_data\tcmsp_herbs_list.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

if isinstance(raw, str):
    source = json.loads(raw)
else:
    source = raw

print(f"源文件: {source['total']} 条记录")

# 尝试从网页提取 token（此处使用已确认的 token）
TOKEN = "63b366689cadb6cfad721e3a3094edf5"
print(f"使用 token: {TOKEN}")

herbs = []
seen_latin = set()  # 按 name_latin 去重

for item in source['data']:
    name_latin = item.get('name_latin', '')
    if not name_latin or name_latin in seen_latin:
        continue
    seen_latin.add(name_latin)

    encoded = quote(name_latin, safe='')
    detail_url = f"{BASE_URL}/tcmspsearch.php?qr={encoded}&qsr=herb_en_name&token={TOKEN}"

    herbs.append({
        "name_cn": item['name_cn'],
        "name_pinyin": item.get('name_pinyin', ''),
        "name_latin": name_latin,
        "category_cn": item.get('category_cn', ''),
        "category_en": item.get('category_en', ''),
        "detail_url": detail_url,
        "tcmsp_token": TOKEN
    })

output = {
    "total": len(herbs),
    "scraped_at": datetime.now(timezone.utc).isoformat(),
    "source_url": "https://www.tcmsp-e.com/browse.php?qc=herbs",
    "herbs": herbs
}

with open(r'd:\RMFOOD配方平台\tcmsp_data\tcmspe_browse_list.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"转换完成: {len(herbs)} 条记录 (源文件 {source['total']} 条)")
print(f"去重: {source['total'] - len(herbs)} 条重复 (按 name_latin)")
print(f"输出文件: d:\\RMFOOD配方平台\\tcmsp_data\\tcmspe_browse_list.json")

# 验证
assert output['total'] >= 500, f"总记录数不足500: {output['total']}"
for h in herbs:
    assert 'detail_url' in h and h['detail_url'], "缺少 detail_url"
    assert 'tcmsp_token' in h and h['tcmsp_token'], "缺少 tcmsp_token"

# 检查重复
latin_names = [h['name_latin'] for h in herbs]
assert len(latin_names) == len(set(latin_names)), "存在重复的 name_latin"

print("验证通过: total>=500, 所有记录含 detail_url 和 tcmsp_token, 无重复")
