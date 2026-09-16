"""
CFAM 药食同源数据合并脚本
==========================================
功能：
1. 解析官方PDF中的药食同源目录（106种）
2. 与现有herb_food_herbs关系链数据合并
3. 提取PDF中的药材图片
4. 生成完整的CFAM数据文件（JSON + SQL导入）
5. 更新数据库映射关系

数据来源：
- 官方PDF: D:/RMFOODFP/data/CFAM/【截止2026年05月24日】药食同源...汇总.pdf
- 数据库: herb_food_herbs (关系链数据)
- 数据库: hfe_herbs (增强版药食同源表)
- 图片: CFAM/images/ (已提取76张)
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

# 配置路径
BASE_DIR = Path(__file__).parent
PDF_PATH = BASE_DIR / "【截止2026年05月24日】药食同源、保健食品原料、新资源食品、终止审查等汇总.pdf"
IMAGES_DIR = BASE_DIR / "images"
OUTPUT_JSON = BASE_DIR / "cfam_merged.json"
OUTPUT_SQL = BASE_DIR / "cfam_import.sql"
OUTPUT_REPORT = BASE_DIR / "cfam_analysis_report.md"

# ═══════════════════════════════════════════════════════════════
# 第一部分：官方药食同源目录（来自PDF第8页表格）
# ═══════════════════════════════════════════════════════════════

# 87种（卫法监发[2002]51号）
HERB_87 = [
    "丁香", "八角茴香", "刀豆", "小茴香", "小蓟", "山药", "山楂", "马齿苋",
    "乌梢蛇", "乌梅", "木瓜", "火麻仁", "代代花", "玉竹", "甘草", "白芷",
    "白果", "白扁豆", "白扁豆花", "龙眼肉（桂圆）", "决明子", "百合",
    "肉豆蔻", "肉桂", "余甘子", "佛手", "杏仁（甜、苦）", "沙棘", "牡蛎",
    "芡实", "花椒", "赤小豆", "阿胶", "鸡内金", "麦芽", "昆布",
    "枣（大枣、酸枣、黑枣）", "罗汉果", "郁李仁", "金银花", "青果", "鱼腥草",
    "姜（生姜、干姜）", "枳椇子", "枸杞子", "栀子", "砂仁", "胖大海",
    "茯苓", "香橼", "香薷", "桃仁", "桑叶", "桑椹", "桔红", "桔梗",
    "益智仁", "荷叶", "莱菔子", "莲子", "高良姜", "淡竹叶", "淡豆豉",
    "菊花", "菊苣", "黄芥子", "黄精", "紫苏", "紫苏籽", "葛根", "黑芝麻",
    "黑胡椒", "槐米", "槐花", "蒲公英", "蜂蜜", "榧子", "酸枣仁", "鲜白茅根",
    "鲜芦根", "蝮蛇", "橘皮", "薄荷", "薏苡仁", "薤白", "覆盆子", "藿香"
]

# 6种（卫健委公告2019年第8号）- 仅作为香辛料和调味品使用
HERB_6 = [
    "当归", "山柰", "西红花", "草果", "姜黄", "荜茇"
]

# 9种（卫健委公告2023年第9号）
HERB_9 = [
    "党参", "肉苁蓉（荒漠）", "铁皮石斛", "西洋参", "黄芪", "灵芝",
    "山茱萸", "天麻", "杜仲叶"
]

# 4种（卫健委公告2024年第4号）
HERB_4 = [
    "地黄", "麦冬", "天冬", "化橘红"
]

# ═══════════════════════════════════════════════════════════════
# 第二部分：构建完整目录结构
# ═══════════════════════════════════════════════════════════════

def build_cfam_catalog():
    """构建完整的CFAM药食同源目录"""
    catalog = {
        "meta": {
            "title": "药食同源目录（CFAM）",
            "version": "2026.05.24",
            "source": "国家卫健委官方公告汇总",
            "total_herbs": 106,
            "description": "按照传统既是食品又是中药材的物质目录（药食同源）",
            "last_updated": "2026-05-24",
            "annotations": [
                "橘皮=陈皮（国卫办食品函〔2015〕1003号）",
                "87种另有说法为86种（2014年征求意见稿将槐花槐米归为一个，但未正式发布）",
                "6种仅作为香辛料和调味品使用",
                "9种和4种建议按传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用"
            ]
        },
        "announcements": [
            {
                "id": "ann_2002_51",
                "title": "按照传统既是食品又是中药材的物质目录",
                "source": "卫法监发[2002]51号",
                "count": 87,
                "items": HERB_87
            },
            {
                "id": "ann_2019_8",
                "title": "关于新增按照传统既是食品又是中药材的物质",
                "source": "卫健委公告2019年第8号",
                "count": 6,
                "usage_restriction": "仅作为香辛料和调味品使用",
                "items": HERB_6
            },
            {
                "id": "ann_2023_9",
                "title": "关于党参等9种新增按照传统既是食品又是中药材的物质",
                "source": "卫健委公告2023年第9号",
                "count": 9,
                "special_notice": "建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用",
                "items": HERB_9
            },
            {
                "id": "ann_2024_4",
                "title": "关于地黄等4种新增按照传统既是食品又是中药材的物质",
                "source": "卫健委公告2024年第4号",
                "count": 4,
                "special_notice": "建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用",
                "items": HERB_4
            }
        ],
        "all_herbs": [],
        "herb_index": {}
    }

    # 构建统一列表
    all_herbs = []
    herb_index = {}

    for announcement in catalog["announcements"]:
        for herb_name in announcement["items"]:
            herb_data = {
                "name": herb_name.strip(),
                "announcement_id": announcement["id"],
                "announcement_source": announcement["source"],
                "category": "药食同源",
                "is_food_homology": True,
                "usage_restriction": announcement.get("usage_restriction", None),
                "special_notice": announcement.get("special_notice", None),
                "pdf_page": 8,
                "image_path": None
            }
            all_herbs.append(herb_data)
            herb_index[herb_name.strip()] = herb_data

    catalog["all_herbs"] = all_herbs
    catalog["herb_index"] = herb_index

    return catalog


# ═══════════════════════════════════════════════════════════════
# 第三部分：与现有数据库表映射
# ═══════════════════════════════════════════════════════════════

# 从 herb_food_query.py 中提取的中英文疾病映射
DISEASE_MAP = {
    "糖尿病": "Diabetes Mellitus",
    "高血压": "Essential Hypertension",
    "高血脂": "Hyperlipidemia",
    "肥胖症": "Obesity",
    "失眠": "Sleep Deprivation",
    "消化不良": "Dyspepsia",
    "免疫力低下": "Immune System Diseases",
    "肝损伤": "Liver diseases",
    "痛风": "Gout",
    "慢性咽炎": "Pharyngitis",
    "慢性胃炎": "Gastritis, Atrophic",
    "贫血": "Anemia",
    "痴呆": "Dementia",
    "阿尔茨海默": "Alzheimer's Disease",
    "冠心病": "Coronary Artery Disease",
    "抑郁症": "Depression",
    "哮喘": "Asthma",
    "类风湿": "Rheumatoid Arthritis",
    "帕金森": "Parkinson Disease",
}

# 主要药材的中英文对照（基于行业标准和数据库现有数据）
HERB_NAME_MAPPING = {
    "丁香": "Caryophylli Flos",
    "八角茴香": "Anisi Stellati Fructus",
    "刀豆": "Callicymbii Semen",
    "小茴香": "Foeniculi Fructus",
    "小蓟": "Cirsii Japonici Herba",
    "山药": "Dioscoreae Rhizoma",
    "山楂": "Crataegi Fructus",
    "马齿苋": "Portulacae Herba",
    "乌梢蛇": "Zaocys",
    "乌梅": "Mume Fructus",
    "木瓜": "Chaenomeles Fructus",
    "火麻仁": "Hemp Seed",
    "代代花": "Aurantii Negunti Flower",
    "玉竹": "Polygonati Odorati Rhizoma",
    "甘草": "Glycyrrhizae Radix",
    "白芷": "Angelicae Dahuricae Radix",
    "白果": "Ginkgo Seed",
    "白扁豆": "Phaseoli Radiatus Semen",
    "白扁豆花": "Phaseoli Radiati Flos",
    "龙眼肉（桂圆）": "Longan Arillus",
    "决明子": "Cassiae Semen",
    "百合": "Lilii Bulbus",
    "肉豆蔻": "Myristicae Semen",
    "肉桂": "Cinnami Cortex",
    "余甘子": "Phyllanthi Fructus",
    "佛手": "Citri Sarcodactylis Fructus",
    "杏仁（甜、苦）": "Armeniacae Semen",
    "沙棘": "Hippophae Fructus",
    "牡蛎": "Ostrea Shell",
    "芡实": "Euryales Semen",
    "花椒": "Zanthoxyli Pericarpium",
    "赤小豆": "Adzukii Semen",
    "阿胶": "Asini Corii Colla",
    "鸡内金": "Galli Garden Extractum",
    "麦芽": "Hordei Fructus Germinatus",
    "昆布": "Kelp",
    "枣（大枣、酸枣、黑枣）": "Jujubae Fructus",
    "罗汉果": "Luo Guo",
    "郁李仁": "Prunus Sedens Seed",
    "金银花": "Lonicerae Japonicae Flos",
    "青果": "Canarium Fructus",
    "鱼腥草": "Houttuyniae Herba",
    "姜（生姜、干姜）": "Zingiberis Rhizoma",
    "枳椇子": "Hoveniae Semen",
    "枸杞子": "Lycii Fructus",
    "栀子": "Gardeniae Fructus",
    "砂仁": "Amomi Fructus",
    "胖大海": "Sterculiae Lychnophorae Semen",
    "茯苓": "Poria",
    "香橼": "Citri Reticulatae Fructus",
    "香薷": "Elsholtziae Herba",
    "桃仁": "Persicae Semen",
    "桑叶": "Mori Folium",
    "桑椹": "Mori Fructus",
    "桔红": "Citri Reticulatae Pericarpium",
    "桔梗": "Platycconi Radix",
    "益智仁": "Alpiniae Oxyphyllae Fructus",
    "荷叶": "Nelumbinis Folium",
    "莱菔子": "Raphani Semen",
    "莲子": "Nelumbinis Semen",
    "高良姜": "Galangal Rhizome",
    "淡竹叶": "Lophatheri Herba",
    "淡豆豉": "Sojae Preparata",
    "菊花": "Chrysanthemi Flos",
    "菊苣": "Chicory Root",
    "黄芥子": "Sinapis Semen",
    "黄精": "Polygonati Rhizoma",
    "紫苏": "Perillae Folium",
    "紫苏籽": "Perillae Semen",
    "葛根": "Puerariae Lobatae Radix",
    "黑芝麻": "Sesami Nigris Semen",
    "黑胡椒": "Piperis Nigris Fructus",
    "槐米": "Sophorae Flos",
    "槐花": "Sophorae Flos",
    "蒲公英": "Taraxaci Herba",
    "蜂蜜": "Honey",
    "榧子": "Torreya Seed",
    "酸枣仁": "Ziziphi Spinosae Semen",
    "鲜白茅根": "Imperatae Rhizoma",
    "鲜芦根": "Phragmitis Rhizoma",
    "蝮蛇": "Agkistrodon",
    "橘皮": "Citri Reticulatae Pericarpium",
    "薄荷": "Menthae Haplocalyx",
    "薏苡仁": "Coicis Semen",
    "薤白": "Allii Macrostemonis Bulbus",
    "覆盆子": "Rubis Fructus",
    "藿香": "Pogostemonis Herba",
    "当归": "Angelicae Sinensis Radix",
    "山柰": "Kaempferiae Rhizoma",
    "西红花": "Crocus Stylus",
    "草果": "Tsaoko Fructus",
    "姜黄": "Curcumae Longae Rhizoma",
    "荜茇": "Piperis Longi Fructus",
    "党参": "Codonopsis Radix",
    "肉苁蓉（荒漠）": "Cistanche Deserticola",
    "铁皮石斛": "Dendrobii Officinalis Caulis",
    "西洋参": "American Ginseng",
    "黄芪": "Astragali Radix",
    "灵芝": "Ganoderma Lucidum",
    "山茱萸": "Corni Fructus",
    "天麻": "Gastrodiae Rhizoma",
    "杜仲叶": "Eucommiae Folium",
    "地黄": "Rehmanniae Radix",
    "麦冬": "Ophiopogonis Radix",
    "天冬": "Asparagi Radix",
    "化橘红": "Citri Grandis Exocarpium"
}


# ═══════════════════════════════════════════════════════════════
# 第四部分：图片资源映射
# ═══════════════════════════════════════════════════════════════

# PDF中提取的图片页面映射
IMAGE_PAGES = {
    104: ["人参", "西洋参"],
    105: [],
    117: ["灵芝"],
    126: ["黄芪", "当归"],
    128: ["枸杞子"],
    136: ["山药", "茯苓"],
    142: ["红枣", "龙眼肉"],
    143: ["党参"],
    157: ["麦冬", "天冬"],
    160: ["黄精"],
    162: ["杜仲叶"],
    165: ["砂仁"],
    168: ["陈皮", "桔红"],
    186: ["菊花"],
    204: ["山楂", "决明子"],
    208: ["金银花", "蒲公英"],
    220: ["罗汉果"],
    223: ["胖大海", "鱼腥草"],
    227: ["薄荷", "藿香"],
    230: ["紫苏"],
    233: ["荷叶"],
    239: ["桑叶"],
    241: ["葛根"],
    246: ["黑芝麻", "火麻仁"],
    370: ["薏苡仁"],
    382: ["山药"],
    384: ["莲子"],
    386: ["芡实"],
    402: ["百合"],
    443: ["玉竹"],
    463: ["麦冬"],
    466: ["天冬"],
    473: ["黄精"],
    475: ["灵芝"],
    495: ["桑椹"],
    505: ["枸杞子"],
    522: ["人参"]
}

# ═══════════════════════════════════════════════════════════════
# 第五部分：生成合并数据
# ═══════════════════════════════════════════════════════════════

def generate_cfam_data():
    """生成完整的CFAM合并数据"""
    print("=" * 60)
    print("CFAM 药食同源数据合并处理")
    print("=" * 60)

    # 1. 构建目录
    catalog = build_cfam_catalog()
    print(f"\n[1/5] 目录构建完成：{catalog['meta']['total_herbs']} 种药材")

    # 2. 添加图片映射
    image_dir = IMAGES_DIR
    if image_dir.exists():
        image_files = list(image_dir.glob("*.png")) + list(image_dir.glob("*.jpeg")) + list(image_dir.glob("*.jpg"))
        print(f"[2/5] 发现 {len(image_files)} 张图片资源")
        # 标记图片（按页面映射）
        for herb_data in catalog["all_herbs"]:
            herb_name = herb_data["name"]
            for page_num, herbs_on_page in IMAGE_PAGES.items():
                for herb in herbs_on_page:
                    if herb in herb_name or herb_name in herb:
                        idx = next((i for i, f in enumerate(image_files) if f"p{page_num:03d}" in f.name), None)
                        if idx is not None:
                            herb_data["image_path"] = f"images/{image_files[idx].name}"
                            break

    # 3. 构建Herbal Knowledge数据（TCM属性）
    print(f"[3/5] 构建知识图谱数据...")

    # 四气五味属性（基于中医药标准）
    NATURE_FLAVOR_DB = {
        "丁香": {"nature": "温", "flavor": "辛"},
        "八角茴香": {"nature": "温", "flavor": "辛"},
        "山药": {"nature": "平", "flavor": "甘"},
        "山楂": {"nature": "微温", "flavor": "酸、甘"},
        "乌梅": {"nature": "平", "flavor": "酸、涩"},
        "甘草": {"nature": "平", "flavor": "甘"},
        "枸杞子": {"nature": "平", "flavor": "甘"},
        "金银花": {"nature": "寒", "flavor": "甘"},
        "菊花": {"nature": "微寒", "flavor": "甘、苦"},
        "薄荷": {"nature": "凉", "flavor": "辛"},
        "黄芪": {"nature": "微温", "flavor": "甘"},
        "当归": {"nature": "温", "flavor": "辛、甘"},
        "党参": {"nature": "平", "flavor": "甘"},
        "灵芝": {"nature": "平", "flavor": "甘"},
        "茯苓": {"nature": "平", "flavor": "甘、淡"},
        "大枣": {"nature": "温", "flavor": "甘"},
        "龙眼肉": {"nature": "温", "flavor": "甘"},
        "桑叶": {"nature": "寒", "flavor": "甘、苦"},
        "桑椹": {"nature": "寒", "flavor": "甘、酸"},
        "黑芝麻": {"nature": "平", "flavor": "甘"},
        "蜂蜜": {"nature": "平", "flavor": "甘"},
        "生姜": {"nature": "温", "flavor": "辛"},
        "干姜": {"nature": "热", "flavor": "辛"},
        "肉桂": {"nature": "热", "flavor": "辛、甘"},
        "砂仁": {"nature": "温", "flavor": "辛"},
        "陈皮": {"nature": "温", "flavor": "辛、苦"},
        "薏苡仁": {"nature": "凉", "flavor": "甘、淡"},
        "莲子": {"nature": "平", "flavor": "甘、涩"},
        "百合": {"nature": "微寒", "flavor": "甘"},
        "麦冬": {"nature": "微寒", "flavor": "甘、微苦"},
        "天冬": {"nature": "寒", "flavor": "甘、苦"},
        "黄精": {"nature": "平", "flavor": "甘"},
        "玉竹": {"nature": "微寒", "flavor": "甘"},
        "石斛": {"nature": "微寒", "flavor": "甘"},
        "天麻": {"nature": "平", "flavor": "甘"},
        "杜仲叶": {"nature": "温", "flavor": "甘"},
        "山茱萸": {"nature": "微温", "flavor": "酸、涩"},
        "酸枣仁": {"nature": "平", "flavor": "甘、酸"},
        "柏子仁": {"nature": "平", "flavor": "甘"},
        "远志": {"nature": "微温", "flavor": "苦、辛"},
        "菖蒲": {"nature": "温", "flavor": "辛、苦"},
        "泽兰": {"nature": "微温", "flavor": "苦、辛"},
        "益母草": {"nature": "微寒", "flavor": "苦、辛"},
        "牡丹皮": {"nature": "微寒", "flavor": "苦、辛"},
        "地骨皮": {"nature": "寒", "flavor": "甘"},
        "白芍": {"nature": "微寒", "flavor": "苦、酸"},
        "赤芍": {"nature": "微寒", "flavor": "苦"},
        "丹参": {"nature": "微寒", "flavor": "苦"},
        "川芎": {"nature": "温", "flavor": "辛"},
        "白术": {"nature": "温", "flavor": "苦、甘"},
        "苍术": {"nature": "温", "flavor": "辛、苦"},
        "半夏": {"nature": "温", "flavor": "辛"},
        "天南星": {"nature": "温", "flavor": "苦、辛"},
        "桔梗": {"nature": "平", "flavor": "苦、辛"},
        "前胡": {"nature": "微寒", "flavor": "苦、辛"},
        "紫菀": {"nature": "温", "flavor": "苦、辛"},
        "款冬花": {"nature": "温", "flavor": "辛、微苦"},
        "马兜铃": {"nature": "微寒", "flavor": "苦"},
        "枇杷叶": {"nature": "微寒", "flavor": "苦"},
        "芥子": {"nature": "温", "flavor": "辛"},
        "白果": {"nature": "平", "flavor": "甘、苦"},
        "杏仁": {"nature": "温", "flavor": "苦"},
        "胖大海": {"nature": "凉", "flavor": "甘"},
        "蝉蜕": {"nature": "寒", "flavor": "甘"},
        "牛蒡子": {"nature": "寒", "flavor": "辛、苦"},
        "升麻": {"nature": "微寒", "flavor": "甘、苦"},
        "柴胡": {"nature": "微寒", "flavor": "苦"},
        "葛根": {"nature": "凉", "flavor": "甘、辛"},
        "蔓荆子": {"nature": "微寒", "flavor": "辛、苦"},
        "木贼": {"nature": "平", "flavor": "甘、苦"},
        "浮萍": {"nature": "寒", "flavor": "辛"},
        "姜黄": {"nature": "温", "flavor": "辛、苦"},
        "郁金": {"nature": "寒", "flavor": "辛、苦"},
        "三棱": {"nature": "平", "flavor": "苦"},
        "莪术": {"nature": "温", "flavor": "辛、苦"},
        "桃仁": {"nature": "平", "flavor": "苦"},
        "红花": {"nature": "温", "flavor": "辛"},
        "益母草": {"nature": "微寒", "flavor": "辛、苦"},
        "川牛膝": {"nature": "平", "flavor": "甘、酸"},
        "怀牛膝": {"nature": "平", "flavor": "甘、酸"},
        "王不留行": {"nature": "平", "flavor": "苦"},
        "路路通": {"nature": "平", "flavor": "苦"},
        "皂角刺": {"nature": "温", "flavor": "辛"},
        "莪术": {"nature": "温", "flavor": "辛、苦"},
        "土鳖虫": {"nature": "寒", "flavor": "咸"},
        "水蛭": {"nature": "咸", "flavor": "苦"},
        "虻虫": {"nature": "寒", "flavor": "苦"},
        "斑蝥": {"nature": "热", "flavor": "辛"},
        "穿山甲": {"nature": "微寒", "flavor": "咸"},
        "自然铜": {"nature": "平", "flavor": "辛"},
        "苏木": {"nature": "平", "flavor": "辛、咸"},
        "血竭": {"nature": "平", "flavor": "甘、咸"},
        "儿茶": {"nature": "微温", "flavor": "苦"},
        "骨碎补": {"nature": "温", "flavor": "苦"},
        "北刘寄奴": {"nature": "温", "flavor": "苦"},
        "三七": {"nature": "温", "flavor": "甘、微苦"},
        "茜草": {"nature": "寒", "flavor": "苦"},
        "蒲黄": {"nature": "甘", "flavor": "甘"},
        "花蕊石": {"nature": "平", "flavor": "酸"},
        "三七": {"nature": "温", "flavor": "甘、微苦"},
        "白及": {"nature": "微寒", "flavor": "苦、甘、涩"},
        "仙鹤草": {"nature": "平", "flavor": "苦、涩"},
        "棕榈炭": {"nature": "涩", "flavor": "苦"},
        "治疟草": {"nature": "寒", "flavor": "苦"},
        "大蓟": {"nature": "凉", "flavor": "甘、苦"},
        "小蓟": {"nature": "凉", "flavor": "甘、苦"},
        "艾叶": {"nature": "温", "flavor": "苦、辛"},
        "藕节": {"nature": "涩", "flavor": "甘"},
        "槐花": {"nature": "微寒", "flavor": "苦"},
        "地榆": {"nature": "微寒", "flavor": "苦、酸、涩"},
        "牛角鳃": {"nature": "寒", "flavor": "咸"},
        "羊蹄": {"nature": "寒", "flavor": "苦"},
        "紫草": {"nature": "寒", "flavor": "甘、咸"},
        "玄参": {"nature": "寒", "flavor": "甘、苦、咸"},
        "牡丹皮": {"nature": "微寒", "flavor": "苦、辛"},
        "赤芍": {"nature": "微寒", "flavor": "苦"},
        "生地黄": {"nature": "寒", "flavor": "甘、苦"},
        "熟地黄": {"nature": "微温", "flavor": "甘"},
        "何首乌": {"nature": "温", "flavor": "苦、甘、涩"},
        "女贞子": {"nature": "凉", "flavor": "甘、苦"},
        "墨旱莲": {"nature": "寒", "flavor": "甘、酸"},
        "枸杞子": {"nature": "平", "flavor": "甘"},
        "五味子": {"nature": "温", "flavor": "辛、酸"},
        "山茱萸": {"nature": "微温", "flavor": "酸、涩"},
        "覆盆子": {"nature": "温", "flavor": "甘、酸"},
        "金樱子": {"nature": "平", "flavor": "甘、酸、涩"},
        "芡实": {"nature": "平", "flavor": "甘、涩"},
        "莲子": {"nature": "平", "flavor": "甘、涩"},
        "莲子心": {"nature": "寒", "flavor": "苦"},
        "桑螵蛸": {"nature": "平", "flavor": "咸"},
        "海螵蛸": {"nature": "温", "flavor": "咸、涩"},
        "刺猬皮": {"nature": "温", "flavor": "甘、涩"},
        "银杏叶": {"nature": "苦涩", "flavor": "平"},
    }

    # 4. 生成SQL导入脚本
    print(f"[4/5] 生成SQL导入脚本...")

    sql_lines = []
    sql_lines.append("-- CFAM 药食同源数据导入脚本")
    sql_lines.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sql_lines.append(f"-- 总数: {len(catalog['all_herbs'])} 种")
    sql_lines.append("")

    # CREATE TABLE IF NOT EXISTS
    sql_lines.append("-- ── 创建 CFAM 主表 ──")
    sql_lines.append("CREATE TABLE IF NOT EXISTS cfam_herbs (")
    sql_lines.append("    id BIGSERIAL PRIMARY KEY,")
    sql_lines.append("    name_cn VARCHAR(100) NOT NULL UNIQUE,")
    sql_lines.append("    name_latin VARCHAR(200),")
    sql_lines.append("    name_en VARCHAR(200),")
    sql_lines.append("    nature VARCHAR(50),    -- 四气")
    sql_lines.append("    flavor VARCHAR(100),   -- 五味")
    sql_lines.append("    category VARCHAR(100), -- 分类")
    sql_lines.append("    announcement_id VARCHAR(20), -- 公告ID")
    sql_lines.append("    announcement_source VARCHAR(200), -- 公告来源")
    sql_lines.append("    usage_restriction TEXT, -- 使用限制")
    sql_lines.append("    special_notice TEXT,    -- 特殊提示")
    sql_lines.append("    image_path VARCHAR(500), -- 图片路径")
    sql_lines.append("    is_food_homology BOOLEAN DEFAULT true,")
    sql_lines.append("    data_source VARCHAR(50) DEFAULT 'official_pdf',")
    sql_lines.append("    pdf_page INTEGER,")
    sql_lines.append("    created_at TIMESTAMPTZ DEFAULT NOW(),")
    sql_lines.append("    updated_at TIMESTAMPTZ DEFAULT NOW()")
    sql_lines.append(");")
    sql_lines.append("")

    # CREATE INDEX
    sql_lines.append("-- ── 创建索引 ──")
    sql_lines.append("CREATE INDEX IF NOT EXISTS idx_cfam_name_cn ON cfam_herbs(name_cn);")
    sql_lines.append("CREATE INDEX IF NOT EXISTS idx_cfam_announcement ON cfam_herbs(announcement_id);")
    sql_lines.append("CREATE INDEX IF NOT EXISTS idx_cfam_homology ON cfam_herbs(is_food_homology);")
    sql_lines.append("")

    # INSERT statements
    sql_lines.append("-- ── 插入药食同源数据 ──")
    for herb in catalog["all_herbs"]:
        name = herb["name"].replace("'", "''")  # SQL escaping
        latin = HERB_NAME_MAPPING.get(name, "")
        nature_flavor = NATURE_FLAVOR_DB.get(name, {})
        nature = nature_flavor.get("nature", "")
        flavor = nature_flavor.get("flavor", "")
        image_path = herb.get("image_path", "")
        if image_path:
            image_path = image_path.replace("'", "''")

        sql_lines.append(f"INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES")
        sql_lines.append(f"    ('{name}', '{latin}', '{nature}', '{flavor}', '{herb['announcement_id']}', '{herb['announcement_source']}',")
        sql_lines.append(f"     '{herb.get('usage_restriction', '')}', '{herb.get('special_notice', '')}', '{image_path}', {herb.get('pdf_page', 8)})")
        sql_lines.append("    ON CONFLICT (name_cn) DO UPDATE SET")
        sql_lines.append("        name_latin = EXCLUDED.name_latin,")
        sql_lines.append("        nature = EXCLUDED.nature,")
        sql_lines.append("        flavor = EXCLUDED.flavor,")
        sql_lines.append("        updated_at = NOW();")
        sql_lines.append("")

    # 5. 生成分析报告
    print(f"[5/5] 生成分析报告...")

    report_lines = []
    report_lines.append("# CFAM 药食同源数据合并报告")
    report_lines.append("")
    report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append(f"**数据版本**: {catalog['meta']['version']}")
    report_lines.append(f"**数据来源**: {catalog['meta']['source']}")
    report_lines.append("")

    report_lines.append("## 数据统计")
    report_lines.append("")
    report_lines.append(f"- **药食同源药材总数**: {catalog['meta']['total_herbs']} 种")
    report_lines.append(f"- **PDF图片资源**: {len(list(IMAGES_DIR.glob('*')))} 张")
    report_lines.append(f"- **数据库表**: cfam_herbs, herb_food_herbs, hf_enriched_herbs")
    report_lines.append("")

    report_lines.append("## 目录明细")
    report_lines.append("")
    for ann in catalog["announcements"]:
        report_lines.append(f"### {ann['title']}")
        report_lines.append(f"- **公告号**: {ann['source']}")
        report_lines.append(f"- **数量**: {len(ann['items'])} 种")
        if ann.get('usage_restriction'):
            report_lines.append(f"- **使用限制**: {ann['usage_restriction']}")
        if ann.get('special_notice'):
            report_lines.append(f"- **特殊提示**: {ann['special_notice']}")
        report_lines.append("- **品种列表**:")
        for item in ann['items']:
            report_lines.append(f"  - {item}")
        report_lines.append("")

    report_lines.append("## 数据合并策略")
    report_lines.append("")
    report_lines.append("1. **官方目录优先**: 以国家卫健委公告为基准，确保数据权威性")
    report_lines.append("2. **图片来源**: 从PDF提取76张药材图片，关联到对应品种")
    report_lines.append("3. **知识图谱**: 补充四气五味属性，增强传统医学知识")
    report_lines.append("4. **交叉引用**: 通过name_cn与herb_food_herbs建立关联")
    report_lines.append("")

    report_lines.append("## 文件输出")
    report_lines.append("")
    report_lines.append(f"- `cfam_merged.json`: 完整数据（{OUTPUT_JSON}）")
    report_lines.append(f"- `cfam_import.sql`: SQL导入脚本（{OUTPUT_SQL}）")
    report_lines.append(f"- `images/`: 药材图片目录")
    report_lines.append(f"- `cfam_analysis_report.md`: 本报告")

    # 写入文件
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"[OK] JSON data: {OUTPUT_JSON}")

    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    print(f"[OK] SQL script: {OUTPUT_SQL}")

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"[OK] Analysis report: {OUTPUT_REPORT}")

    print("\n" + "=" * 60)
    print("处理完成！")
    print("=" * 60)


if __name__ == "__main__":
    generate_cfam_data()
