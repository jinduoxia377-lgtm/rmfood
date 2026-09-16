"""
诊断14张未匹配图片的对应药材
"""
import json

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

# 目标图片名
targets = [
    '代代花', '八角', '生姜', '干姜', '杏仁', '大枣', '桔红',
    '槐米', '陈皮', '益智', '紫苏子', '广藿香', '芦根', '芥子', '胡椒'
]

print("=== 查找可能匹配的药材 ===")
for t in targets:
    matches = [h for h in herbs if t in h['name_cn']]
    if matches:
        for m in matches:
            print(f"  [{t}] -> {m['name_cn']} (code:{m['rmchm_code']}, pinyin:{m.get('name_pinyin','')})")
    else:
        # 检查别名
        found_alias = False
        for h in herbs:
            alias = h.get('alias', '')
            if alias and t in alias:
                print(f"  [{t}] -> 在别名中: {h['name_cn']} (alias:{alias[:50]})")
                found_alias = True
                break
        if not found_alias:
            print(f"  [{t}] -> 无直接匹配")

print()
print("=== 所有可能相关的药材 ===")
keywords = ['代代', '八角', '杏', '枣', '桔红', '槐米', '橘皮', '益智', '紫苏', '藿香', '芦根', '芥子', '胡椒']
for kw in keywords:
    matches = [h for h in herbs if kw in h['name_cn']]
    if matches:
        names = [m['name_cn'] for m in matches]
        print(f"  '{kw}': {names}")
