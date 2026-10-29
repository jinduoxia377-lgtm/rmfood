import logging

logger = logging.getLogger(__name__)
"""Merge MMID enriched data into the existing herb database.

此脚本用于一次性数据预处理，将 enriched_mmid_herbs.json 与扩展药材数据合并。
不再参与运行时数据流，保留仅为数据考古目的。
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASEDIR = os.path.dirname(os.path.abspath(__file__))

# 1. Load MMID enriched data
enriched_path = os.path.join(BASEDIR, "enriched_mmid_herbs.json")
if not os.path.exists(enriched_path):
    logger.info(f"错误: 找不到 {enriched_path}，请先运行 enrich_mmid_details.py")
    sys.exit(1)

with open(enriched_path, "r", encoding="utf-8") as f:
    enriched_data = json.load(f)

enriched_herbs = enriched_data.get("herbs", [])
logger.info(f"Loaded {len(enriched_herbs)} enriched MMID herbs")

# 2. Load expanded herb names for dedup
expanded_names = set()
for i in range(1, 7):
    fpath = os.path.join(BASEDIR, f"_herb_data_{i:02d}.py")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            matches = re.findall(r'"name_cn":\s*"(.+?)"', content)
            expanded_names.update(matches)

logger.info(f"Loaded {len(expanded_names)} expanded herb names")

# 3. Traditional -> Simplified mapping
TRAD_TO_SIMP = {
    "礬": "矾", "蕗": "蔄", "薑": "姜", "麵": "面", "裡": "里",
    "後": "后", "餘": "余", "幹": "干", "乾": "干", "臺": "台",
    "峯": "峰", "穀": "谷", "衞": "卫", "業": "业", "體": "体",
    "緣": "缘", "禮": "礼", "髮": "发", "臟": "脏", "寫": "写",
    "門": "门", "開": "开", "關": "关", "聽": "听", "麼": "么",
    "爾": "尔", "時": "时", "復": "复", "過": "过", "說": "说",
    "讓": "让", "這": "这", "無": "无", "爲": "为", "於": "于",
    "東": "东", "書": "书", "數": "数", "飯": "饭", "頭": "头",
    "鬥": "斗", "見": "见", "醫": "医", "幾": "几", "僅": "仅",
    "難": "难", "點": "点", "國": "国", "學": "学", "愛": "爱",
    "義": "义", "風": "风", "飛": "飞", "寶": "宝", "擔": "担",
    "導": "导", "動": "动", "斷": "断", "惡": "恶", "豐": "丰",
    "劃": "划", "懷": "怀", "護": "护", "獲": "获", "機": "机",
    "極": "极", "實": "实", "雙": "双", "順": "顺", "應": "应",
    "擁": "拥", "優": "优", "遊": "游", "譽": "誉", "預": "预",
    "遠": "远", "願": "愿", "雲": "云", "雜": "杂", "張": "张",
    "準": "准", "轉": "转", "莊": "庄", "裝": "装", "總": "总",
    "縱": "纵", "鐘": "钟", "種": "种", "軸": "轴", "註": "注",
    "駐": "驻", "壯": "壮", "狀": "状", "鄉": "乡", "響": "响",
    "險": "险", "顯": "显", "蕭": "萧", "條": "条", "鄰": "邻",
    "靈": "灵", "亂": "乱", "盧": "卢", "魯": "鲁", "陸": "陆",
    "慮": "虑", "鹽": "盐", "嚴": "严", "顏": "颜", "驗": "验",
    "藝": "艺", "億": "亿", "陰": "阴", "隱": "隐", "營": "营",
    "藥": "药", "躍": "跃", "韻": "韵", "責": "责", "擇": "择",
    "戰": "战", "長": "长", "腸": "肠", "帳": "帐", "趙": "赵",
    "鄭": "郑", "證": "证", "執": "执", "鍾": "钟", "衆": "众",
    "參": "参", "係": "系", "夠": "够", "颱": "台",
    "鬱": "郁", "濫": "滥", "驀": "蓦", "嚮": "向", "徵": "征",
    "髒": "脏",
}


def trad_to_simp(text: str) -> str:
    result = text
    for trad, simp in TRAD_TO_SIMP.items():
        result = result.replace(trad, simp)
    return result


def extract_herbs_from_py_file(filepath: str) -> list[dict]:
    """Extract herb dicts from _herb_data_XX.py files."""
    herbs = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    name_matches = re.findall(r'"name_cn":\s*"(.+?)"', content)
    latin_matches = re.findall(r'"name_latin":\s*"(.+?)"', content)
    pinyin_matches = re.findall(r'"name_pinyin":\s*"(.+?)"', content)
    category_matches = re.findall(r'"category":\s*"(.+?)"', content)
    effects_matches = re.findall(r'"effects":\s*"(.+?)"', content)
    ob_matches = re.findall(r'"ob_percent":\s*([\d.]+)', content)
    dl_matches = re.findall(r'"dl_value":\s*([\d.]+)', content)
    food_matches = re.findall(r'"is_food_homology":\s*(True|False)', content)

    count = min(len(name_matches), len(latin_matches), len(pinyin_matches),
                len(category_matches), len(effects_matches), len(ob_matches),
                len(dl_matches), len(food_matches))

    for i in range(count):
        herb = {
            "name_cn": name_matches[i],
            "name_latin": latin_matches[i],
            "name_pinyin": pinyin_matches[i],
            "category": category_matches[i],
            "effects": effects_matches[i],
            "ob_percent": float(ob_matches[i]),
            "dl_value": float(dl_matches[i]),
            "is_food_homology": food_matches[i] == "True",
            "compounds": [],
            "targets": [],
            "diseases": [],
        }
        herbs.append(herb)
    return herbs


# 4. Build merged database
merged_herbs = []
merged_names = set()
merged_pids = set()

# Add expanded herbs first (they have rich pharmacological data)
for i in range(1, 7):
    fpath = os.path.join(BASEDIR, f"_herb_data_{i:02d}.py")
    if os.path.exists(fpath):
        herbs = extract_herbs_from_py_file(fpath)
        for herb in herbs:
            name = herb.get("name_cn", "")
            if name and name not in merged_names:
                merged_herbs.append(herb)
                merged_names.add(name)

logger.info(f"Added {len(merged_herbs)} expanded herbs")

# Add MMID-enriched herbs (only if not already in merged)
for herb in enriched_herbs:
    name = herb["name_cn"]
    pid = herb["pid"]

    # Check if already in merged (direct or Simplified)
    if name in merged_names:
        continue
    simp_name = trad_to_simp(name)
    if simp_name in merged_names:
        continue

    # Build a standard herb record from MMID enriched data
    standard_herb = {
        "name_cn": name,
        "name_latin": herb.get("name_latin", ""),
        "name_pinyin": herb.get("name_pinyin", ""),
        "category": herb.get("category", ""),
        "effects": herb.get("efficacy_raw", herb.get("efficacy", "")),
        "ob_percent": None,
        "dl_value": None,
        "is_food_homology": False,
        "compounds": [],
        "targets": [],
        "diseases": [],
        # MMID-specific fields
        "pid": pid,
        "name_eng": herb.get("name_eng", ""),
        "botanical_type": herb.get("botanical_type", herb.get("category", "")),
        "nature": herb.get("nature"),
        "flavor": herb.get("flavor", []),
        "toxicity": herb.get("toxicity"),
        "nature_flavor_raw": herb.get("nature_flavor_raw", ""),
        "efficacy_raw": herb.get("efficacy", ""),
        "origin": herb.get("origin", ""),
        "processing": herb.get("processing", ""),
        "botanical_source": herb.get("botanical_source", ""),
        "characteristics": herb.get("characteristics", ""),
        "quality": herb.get("quality", ""),
        "notes": herb.get("notes", ""),
        "meridians": herb.get("meridians", []),
    }

    merged_herbs.append(standard_herb)
    merged_names.add(name)
    merged_pids.add(pid)

logger.info(f"After adding MMID herbs: {len(merged_herbs)} total")

# 5. Save merged database
output_path = os.path.join(BASEDIR, "merged_herb_database_v2.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(merged_herbs, f, ensure_ascii=False, indent=2)

logger.info(f"\nSaved to: {output_path}")

# 6. Stats
nature_counts = {}
flavor_counts = {}
toxicity_counts = {}
has_efficacy = 0
has_origin = 0
has_processing = 0
has_meridians = 0
has_source = 0
for h in merged_herbs:
    if h.get("nature"):
        nature_counts[h["nature"]] = nature_counts.get(h["nature"], 0) + 1
    for f in h.get("flavor", []):
        flavor_counts[f] = flavor_counts.get(f, 0) + 1
    if h.get("toxicity"):
        toxicity_counts[h["toxicity"]] = toxicity_counts.get(h["toxicity"], 0) + 1
    if h.get("efficacy_raw"):
        has_efficacy += 1
    if h.get("origin"):
        has_origin += 1
    if h.get("processing"):
        has_processing += 1
    if h.get("meridians"):
        has_meridians += 1
    if h.get("botanical_source"):
        has_source += 1

logger.info("\nEnrichment stats (MMID-only herbs):")
logger.info(f"  四氣: {nature_counts}")
logger.info(f"  功效原文: {has_efficacy}")
logger.info(f"  產地: {has_origin}")
logger.info(f"  炮製: {has_processing}")
logger.info(f"  歸經: {has_meridians}")
logger.info(f"  植物來源: {has_source}")

logger.info("\n五味分佈 (Top 10):")
for k, v in sorted(flavor_counts.items(), key=lambda x: -x[1])[:10]:
    logger.info(f"  {k}: {v}")

if toxicity_counts:
    logger.info("\n毒性分佈:")
    for k, v in sorted(toxicity_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {k}: {v}")
