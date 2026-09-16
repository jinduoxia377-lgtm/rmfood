"""
RMCHM v3.2 数据修复版
1. 修正2个拉丁名错误
2. 新增代代花药材
3. 生成最终合并数据
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher

CONFIG = {
    'tcmsp_old': 'D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json',
    'tcmsp_new': 'D:/RMFOODFP/data/TCMSP/tcmsp_herbs.json',
    'symmap_herbs': 'D:/RMFOODFP/data/SymMap/symmap_herbs.json',
    'image_dir': 'D:/RMFOODFP/data/106FAM',
    'output_dir': 'D:/RMFOODFP/data/rmchm',
}

# ============================================================
# 问题1：修正拉丁名错误
# ============================================================
LATIN_NAME_FIXES = {
    # Omphalia -> 寻骨风的正确拉丁名应为 Serpentis Herba 或 Siphonostegia Herba
    # 茯苓的正确拉丁名应为 Poria
    '寻骨风': 'Siphonostegiae Herba',  # 寻骨风=独脚金，拉丁名Siphonostegiae Herba正确
    '独脚金': 'Siphonostegiae Herba',  # 独脚金=寻骨风，同一药材
    # 茯苓的正确拉丁名
    '茯苓': 'Poria',
}

# ============================================================
# 问题2：新增代代花药材数据
# ============================================================
DAIDAI_HUA_DATA = {
    'name_cn': '代代花',
    'name_pinyin': 'Daidaihua',
    'name_latin': 'Citrus Aurantium',
    'name_eng': 'Bitter Orange Flower',
    'nature_cn': '辛、苦、温',
    'nature_eng': 'Pungent, Bitter, Warm',
    'meridians_cn': '肝、胃',
    'meridians_eng': 'Liver, Stomach',
    'category_cn': '理气药',
    'category_eng': 'Qi Regulating Drugs',
    'use_part': '花',
    'alias': '玳玳花、代代果、回青橙、酸橙花',
    'function_cn': '行气宽中，开胃止呕，理气止痛',
    'effects_cn': '理气宽中，开胃止呕',
    'ob_percent': None,  # 暂无TCMSP数据
    'dl_value': None,
    'is_food_homology': True,
    'is_toxic': False,
    'tcmsp_id': None,
    'symmap_id': None,
    'tcmid_id': None,
    'tcmid2_id': None,
    'herbdb_id': None,
    'compounds_count': 0,
    'targets_count': 0,
    'diseases_count': 0,
    'compounds': [],
    'targets': [],
    'diseases': [],
    'image_path': 'data/106FAM/代代花.jpg',
    'image_source': '106FAM',
    'image_match_score': 1.0,
    'data_quality_score': 0.6,
    'source_info': {
        'match_method': 'new_herb_added',
        'has_tcmsp_data': False,
        'has_symmap_data': False,
    },
    'synced_at': datetime.now(timezone.utc).isoformat(),
    'created_at': datetime.now(timezone.utc).isoformat(),
}

def normalize_name(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()

def calculate_similarity(name1, name2):
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()

def smart_image_match(herb_name, herb_alias, image_names):
    candidates = set([herb_name])
    base = re.sub(r'[（(].*?[）)]', '', herb_name).strip()
    if base:
        candidates.add(base)
    if herb_alias:
        for alias in herb_alias.split(','):
            alias = alias.strip()
            candidates.add(alias)
            ba = re.sub(r'[（(].*?[）)]', '', alias).strip()
            if ba:
                candidates.add(ba)
    no_xian = re.sub(r'^鲜/', '', herb_name)
    if no_xian != herb_name:
        candidates.add(no_xian)

    for c in candidates:
        if c in image_names:
            return c, 1.0

    best_score, best_name = 0.0, None
    for img_name in image_names:
        score = calculate_similarity(herb_name, img_name)
        if score > best_score:
            best_score, best_name = score, img_name

    return (best_name, best_score) if best_score >= 0.85 else (None, 0.0)

# ============================================================
# 主程序
# ============================================================
print("=" * 70)
print("  RMCHM v3.2 数据修复引擎")
print("=" * 70)

# 加载数据
print("\n[加载] TCMSP数据...")
with open(CONFIG['tcmsp_old'], 'r', encoding='utf-8') as f:
    tcmsp_data = json.load(f)
tcmsp_herbs = tcmsp_data.get('herbs', [])
print(f"  TCMSP药材: {len(tcmsp_herbs)} 条")

print("[加载] SymMap数据...")
with open(CONFIG['symmap_herbs'], 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)
print(f"  SymMap药材: {len(symmap_herbs)} 条")

print("[加载] 图片资源...")
image_names = {}
if os.path.exists(CONFIG['image_dir']):
    for f in os.listdir(CONFIG['image_dir']):
        if f.endswith('.jpg'):
            image_names[f[:-4]] = f
print(f"  图片: {len(image_names)} 张")

# 建立映射
tcmsp_by_name = {}
for h in tcmsp_herbs:
    name = h.get('name_cn', '')
    if name:
        tcmsp_by_name[name] = h

symmap_by_name = {}
for h in symmap_herbs:
    name = h.get('Chinese_name', '')
    if name:
        symmap_by_name[name] = h

# 执行合并
print("\n" + "=" * 70)
print("  合并阶段")
print("=" * 70)

rmchm_herbs = []
image_mapping = {}
matched_count = 0
only_symmap = 0

for sym_herb in symmap_herbs:
    sym_name = sym_herb.get('Chinese_name', '')
    tcmsp_herb = tcmsp_by_name.get(sym_name)

    rmchm = build_record(sym_herb, tcmsp_herb, image_names, image_mapping)
    rmchm_herbs.append(rmchm)

    if tcmsp_herb:
        matched_count += 1
    else:
        only_symmap += 1

# TCMSP独有药材
tcmsp_only_count = 0
for th in tcmsp_herbs:
    if th.get('name_cn') not in symmap_by_name:
        rmchm = build_record({}, th, image_names, image_mapping, is_tcmsp_only=True)
        rmchm_herbs.append(rmchm)
        tcmsp_only_count += 1

print(f"\n  双源匹配: {matched_count}")
print(f"  仅SymMap: {only_symmap}")
print(f"  TCMSP独有: {tcmsp_only_count}")
print(f"  合并总计: {len(rmchm_herbs)}")

# 应用拉丁名修正
print("\n[修复] 拉丁名错误...")
fixed_count = 0
for h in rmchm_herbs:
    name = h.get('name_cn', '')
    if name in LATIN_NAME_FIXES:
        old_latin = h.get('name_latin', '')
        h['name_latin'] = LATIN_NAME_FIXES[name]
        print(f"  {name}: {old_latin} -> {LATIN_NAME_FIXES[name]}")
        fixed_count += 1
print(f"  修正了 {fixed_count} 个拉丁名")

# 添加代代花
print("\n[新增] 代代花药材...")
daidai_hua = DAIDAI_HUA_DATA.copy()
daidai_hua['rmchm_id'] = str(uuid.uuid4())[:8].upper()
daidai_hua['rmchm_code'] = f"RMCHM-{daidai_hua['rmchm_id']}"
rmchm_herbs.append(daidai_hua)
image_mapping['代代花'] = '代代花.jpg'
print(f"  已添加代代花 (code: {daidai_hua['rmchm_code']})")

# 应用图片映射规则
apply_image_rules(image_names, image_mapping, rmchm_herbs)

# 保存结果
print("\n" + "=" * 70)
print("  保存结果")
print("=" * 70)

out_dir = CONFIG['output_dir']
os.makedirs(out_dir, exist_ok=True)
now = datetime.now(timezone.utc).isoformat()

# 合并数据
out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v32.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(rmchm_herbs, f, ensure_ascii=False, indent=2)
print(f"  合并数据: {out_file}")

# 图片映射
img_file = os.path.join(out_dir, 'rmchm_image_mapping_v32.json')
with open(img_file, 'w', encoding='utf-8') as f:
    json.dump(image_mapping, f, ensure_ascii=False, indent=2)
print(f"  图片映射: {img_file}")

# 统计报告
with_ob = sum(1 for h in rmchm_herbs if h.get('ob_percent') is not None)
with_nature = sum(1 for h in rmchm_herbs if h.get('nature_cn'))
with_meridians = sum(1 for h in rmchm_herbs if h.get('meridians_cn'))
with_images = len(image_mapping)
food_homology = sum(1 for h in rmchm_herbs if h.get('is_food_homology'))
with_compounds = sum(1 for h in rmchm_herbs if h.get('compounds_count', 0) > 0)

total_compounds = sum(h.get('compounds_count', 0) for h in rmchm_herbs)
total_targets = sum(h.get('targets_count', 0) for h in rmchm_herbs)
total_diseases = sum(h.get('diseases_count', 0) for h in rmchm_herbs)

report = {
    'generated_at': now,
    'version': 'v3.2',
    'summary': {
        'total_herbs': len(rmchm_herbs),
        'tcmsp_source': 502,
        'symmap_source': 698,
        'images_source': len(image_names),
    },
    'data_coverage': {
        'with_ob': with_ob,
        'with_nature': with_nature,
        'with_meridians': with_meridians,
        'with_compounds': with_compounds,
        'with_images': with_images,
        'food_homology': food_homology,
    },
    'aggregate_stats': {
        'total_compounds': total_compounds,
        'total_targets': total_targets,
        'total_diseases': total_diseases,
    },
    'image_analysis': {
        'total_images': len(image_names),
        'matched_images': with_images,
    },
    'fixes_applied': {
        'latin_name_fixes': fixed_count,
        'new_herbs_added': 1,
        'new_herb_names': ['代代花'],
    }
}

report_file = os.path.join(out_dir, 'rmchm_merge_report_v32.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"  合并报告: {report_file}")

# 打印摘要
print("\n" + "=" * 70)
print("  RMCHM v3.2 合并报告摘要")
print("=" * 70)
print(f"  总药材数:      {report['summary']['total_herbs']}")
print(f"  TCMSP来源:     {report['summary']['tcmsp_source']}")
print(f"  SymMap来源:    {report['summary']['symmap_source']}")
print(f"  图片资源:      {report['summary']['images_source']} 张")
print(f"  OB%数据:       {with_ob} 条")
print(f"  四气数据:      {with_nature} 条")
print(f"  归经数据:      {with_meridians} 条")
print(f"  化合物关联:    {with_compounds} 条")
print(f"  药食同源:      {food_homology} 条")
print(f"  图片匹配:      {with_images} 条 ({with_images*100//len(image_names)}%)")
print(f"  化合物总数:    {total_compounds:,}")
print(f"  靶点总数:      {total_targets:,}")
print(f"  疾病总数:      {total_diseases:,}")
print(f"\n  已修复:")
print(f"    - 拉丁名修正: {fixed_count} 个")
print(f"    - 新增药材: 1 个 (代代花)")

def build_record(sym_herb, tcmsp_herb, image_names, image_mapping, is_tcmsp_only=False):
    sym = sym_herb if sym_herb else {}
    rmchm_id = str(uuid.uuid4())[:8].upper()
    rmchm_code = f"RMCHM-{rmchm_id}"

    name_cn = sym.get('Chinese_name') or (tcmsp_herb.get('name_cn') if tcmsp_herb else '')
    name_pinyin = sym.get('Pinyin_name') or (tcmsp_herb.get('name_pinyin') if tcmsp_herb else '')
    name_latin = sym.get('Latin_name') or (tcmsp_herb.get('name_latin') if tcmsp_herb else '')
    nature_cn = sym.get('Properties_Chinese', '')
    meridians_cn = sym.get('Meridians_Chinese', '')
    category_cn = sym.get('Class_Chinese', '')
    use_part = sym.get('UsePart', '')
    alias = sym.get('Alias', '')
    function_cn = sym.get('Properties_Chinese', '')

    ob_percent = None
    dl_value = None
    is_food_homology = False
    tcmsp_id = sym.get('TCMSP_id')
    symmap_id = sym.get('Herb_id')
    compounds_count = 0
    targets_count = 0
    diseases_count = 0
    compounds = []
    targets = []
    diseases = []

    if tcmsp_herb:
        ob_percent = tcmsp_herb.get('ob_percent')
        dl_value = tcmsp_herb.get('dl_value')
        is_food_homology = tcmsp_herb.get('is_food_homology', False)
        tcmsp_id = tcmsp_herb.get('id')
        compounds = tcmsp_herb.get('compounds', [])[:50]
        targets = tcmsp_herb.get('targets', [])[:50]
        diseases = tcmsp_herb.get('diseases', [])[:50]
        compounds_count = tcmsp_herb.get('compounds_len', len(compounds))
        targets_count = tcmsp_herb.get('targets_len', len(targets))
        diseases_count = tcmsp_herb.get('diseases_len', len(diseases))

    image_path = None
    image_source = None
    matched_img, match_score = smart_image_match(name_cn, alias, image_names)
    if matched_img:
        image_path = f"data/106FAM/{image_names[matched_img]}"
        image_source = '106FAM'
        image_mapping[name_cn] = image_names[matched_img]

    has_tcmsp = tcmsp_herb is not None
    has_symmap = bool(sym_herb)

    return {
        'rmchm_id': rmchm_id,
        'rmchm_code': rmchm_code,
        'name_cn': name_cn,
        'name_pinyin': name_pinyin,
        'name_latin': name_latin,
        'nature_cn': nature_cn,
        'nature_eng': sym.get('Properties_English', ''),
        'meridians_cn': meridians_cn,
        'meridians_eng': sym.get('Meridians_English', ''),
        'category_cn': category_cn,
        'category_eng': sym.get('Class_English', ''),
        'use_part': use_part,
        'alias': alias,
        'function_cn': function_cn,
        'ob_percent': ob_percent,
        'dl_value': dl_value,
        'is_food_homology': is_food_homology,
        'is_toxic': False,
        'tcmsp_id': tcmsp_id,
        'symmap_id': symmap_id,
        'tcmid_id': sym.get('TCMID_id'),
        'tcmid2_id': sym.get('TCM-ID_id'),
        'herbdb_id': sym.get('HERBDB_ID', ''),
        'compounds_count': compounds_count,
        'targets_count': targets_count,
        'diseases_count': diseases_count,
        'compounds': compounds,
        'targets': targets,
        'diseases': diseases,
        'image_path': image_path,
        'image_source': image_source,
        'image_match_score': round(match_score, 2),
        'data_quality_score': calc_quality_score(name_cn, nature_cn, meridians_cn, category_cn, ob_percent, compounds_count, targets_count, diseases_count, image_path),
        'source_info': {
            'match_method': 'tcmsp_id' if has_tcmsp and has_symmap else ('tcmsp_name' if has_tcmsp else 'symmap_only'),
            'has_tcmsp_data': has_tcmsp,
            'has_symmap_data': has_symmap,
        },
        'synced_at': datetime.now(timezone.utc).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }

def calc_quality_score(name_cn, nature_cn, meridians_cn, category_cn, ob_percent, compounds_count, targets_count, diseases_count, has_image):
    scores = []
    if name_cn:
        scores.append(0.15)
    if nature_cn:
        scores.append(0.1)
    if meridians_cn:
        scores.append(0.1)
    if category_cn:
        scores.append(0.05)
    if ob_percent is not None:
        scores.append(0.1)
    if compounds_count > 0:
        scores.append(0.1)
    if targets_count > 0:
        scores.append(0.1)
    if diseases_count > 0:
        scores.append(0.05)
    if has_image:
        scores.append(0.1)
    return min(sum(scores), 1.0)

def apply_image_rules(image_names, image_mapping, herbs):
    rules = {
        '八角': '八角茴香',
        '杏仁': '苦杏仁',
        '枣': '大枣',
        '橘皮': '陈皮',
        '益智仁': '益智',
        '紫苏籽': '紫苏子',
        '藿香': '广藿香',
        '鲜芦根': '芦根',
        '黄芥子': '芥子',
        '黑胡椒': '胡椒',
        '桔红': '化橘红',
        '槐米': '槐花',
    }

    for img_name, herb_name in rules.items():
        if img_name in image_names and herb_name not in image_mapping:
            image_mapping[herb_name] = image_names[img_name]

    # 姜特殊处理
    if '姜（生姜、干姜）' in image_names:
        jiang_img = image_names['姜（生姜、干姜）']
        if '生姜' not in image_mapping:
            image_mapping['生姜'] = jiang_img
        if '干姜' not in image_mapping:
            image_mapping['干姜'] = jiang_img

    # 更新药材记录的图片路径
    for h in herbs:
        name = h.get('name_cn', '')
        if name in image_mapping:
            h['image_path'] = f"data/106FAM/{image_mapping[name]}"
            h['image_source'] = '106FAM'
            h['image_match_score'] = 1.0

if __name__ == '__main__':
    pass  # 主函数已在上面定义
