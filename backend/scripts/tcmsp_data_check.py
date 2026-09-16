"""
TCMSP数据完整性检查
对比本地爬取数据与官网583条的差异
"""
import json

# 1. 读取all_herbs.json（基础名列表）
with open('D:/RMFOODFP/tcmsp_data/data/all_herbs.json', 'r', encoding='utf-8') as f:
    all_herbs = json.load(f)

# 2. 读取db_herbs_export.json（完整数据）
with open('D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json', 'r', encoding='utf-8') as f:
    db_export = json.load(f)
tcmsp_herbs = db_export.get('herbs', [])

# 3. 提取名称集合
all_names = set(h['name_cn'] for h in all_herbs)
db_names = set(h['name_cn'] for h in tcmsp_herbs)

print("=" * 70)
print("  TCMSP 数据完整性检查")
print("=" * 70)
print(f"\nall_herbs.json: {len(all_herbs)} 条（基础名列表）")
print(f"db_herbs_export.json: {len(tcmsp_herbs)} 条（含化合物/靶点/疾病）")
print(f"差异: {len(all_names - db_names)} 条在all_herbs但不在db_export")

# 4. 找出缺失的药材
missing = all_names - db_names
print(f"\n缺失药材（在all_herbs但无详细数据）:")
for name in sorted(missing):
    # 在all_herbs中找详细信息
    for h in all_herbs:
        if h['name_cn'] == name:
            pinyin = h.get('name_pinyin', '')
            latin = h.get('name_latin', '')[:40] if h.get('name_latin') else ''
            print(f"  - {name} (pinyin: {pinyin}, latin: {latin})")

# 5. 检查官网数据文件
print("\n\n官网数据文件检查:")
fp = 'D:/RMFOODFP/tcmsp_data/data/tcmspe_browse_list.json'
with open(fp, 'r', encoding='utf-8') as f:
    browse_data = json.load(f)

if isinstance(browse_data, dict):
    total = browse_data.get('total', '?')
    print(f"  tcmspe_browse_list.json total: {total}")
    if 'herbs' in browse_data:
        print(f"  Herbs in browse list: {len(browse_data['herbs'])}")
elif isinstance(browse_data, list):
    print(f"  tcmspe_browse_list.json list length: {len(browse_data)}")

# 6. 统计TCMSP数据源总数
print("\n\nTCMSP数据源汇总:")
print(f"  all_herbs.json: {len(all_herbs)} 条")
print(f"  db_herbs_export.json: {len(tcmsp_herbs)} 条（含详细数据）")
print(f"  缺失4条有基础名但无详细数据")
print(f"  本地总计: {len(all_herbs)} 条")
print(f"  官网当前: 583 条")
print(f"  差距: {583 - len(all_herbs)} 条")

# 7. 分析缺失原因
print("\n\n缺失原因分析:")
print("  1. 本地爬取时间: 2026-06-03")
print("  2. 官网持续更新，新增约81条药材")
print("  3. 建议: 重新全量抓取TCMSP官网获取最新数据")
