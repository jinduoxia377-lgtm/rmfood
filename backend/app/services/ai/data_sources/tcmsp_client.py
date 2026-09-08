"""TCMSP 药材基础库 — 内置 fallback 数据"""

TCMSP_HERB_DATABASE = [
    {"name_cn": "黄芪", "name_latin": "Astragali Radix", "category": "补气药", "pinyin": "huang qi", "is_food_homology": True, "ob_percent": 30.41, "dl_value": 0.18, "effects": "补气升阳，固表止汗，利水消肿", "compounds": [{"name": "Astragaloside IV", "ob": 36.46, "dl": 0.55}, {"name": "Calycosin", "ob": 30.41, "dl": 0.18}], "targets": ["TNF", "IL6", "VEGFA"], "diseases": ["气虚乏力", "自汗", "水肿"]},
    {"name_cn": "当归", "name_latin": "Angelicae Sinensis Radix", "category": "补血药", "pinyin": "dang gui", "is_food_homology": True, "ob_percent": 27.96, "dl_value": 0.12, "effects": "补血活血，调经止痛，润肠通便", "compounds": [{"name": "Ligustilide", "ob": 56.58, "dl": 0.25}, {"name": "Butylphthalide", "ob": 44.97, "dl": 0.21}], "targets": ["ESR1", "EDN1"], "diseases": ["血虚萎黄", "月经不调", "便秘"]},
    {"name_cn": "枸杞子", "name_latin": "Lycii Fructus", "category": "补阴药", "pinyin": "gou qi zi", "is_food_homology": True, "ob_percent": 37.44, "dl_value": 0.55, "effects": "滋补肝肾，益精明目", "compounds": [{"name": "Zeaxanthin", "ob": 85.19, "dl": 0.55}, {"name": "Beta-sitosterol", "ob": 56.04, "dl": 0.57}], "targets": ["AAAS", "AKR1B1"], "diseases": ["肝肾阴虚", "目昏不明"]},
    {"name_cn": "茯苓", "name_latin": "Poria", "category": "利水渗湿药", "pinyin": "fu ling", "is_food_homology": True, "ob_percent": None, "dl_value": None, "effects": "利水渗湿，健脾宁心", "compounds": [{"name": "Pachymic acid", "ob": None, "dl": None}], "targets": [], "diseases": ["水肿尿少", "脾虚食少"]},
    {"name_cn": "山药", "name_latin": "Dioscoreae Rhizoma", "category": "补气药", "pinyin": "shan yao", "is_food_homology": True, "ob_percent": None, "dl_value": None, "effects": "补脾养胃，生津益肺，补肾涩精", "compounds": [], "targets": [], "diseases": ["脾虚食少", "肺虚咳嗽"]},
    {"name_cn": "甘草", "name_latin": "Glycyrrhizae Radix", "category": "补气药", "pinyin": "gan cao", "is_food_homology": True, "ob_percent": 18.37, "dl_value": 0.33, "effects": "补脾益气，清热解毒，祛痰止咳", "compounds": [{"name": "Glycyrrhizin", "ob": 7.69, "dl": 0.33}], "targets": ["NR3C1"], "diseases": ["脾胃虚弱", "咳嗽痰多"]},
    {"name_cn": "红枣", "name_latin": "Jujubae Fructus", "category": "补气药", "pinyin": "hong zao", "is_food_homology": True, "ob_percent": None, "dl_value": None, "effects": "补中益气，养血安神", "compounds": [], "targets": [], "diseases": ["脾虚食少", "乏力便溏"]},
    {"name_cn": "党参", "name_latin": "Codonopsis Radix", "category": "补气药", "pinyin": "dang shen", "is_food_homology": True, "ob_percent": 26.02, "dl_value": 0.36, "effects": "健脾益肺，养血生津", "compounds": [{"name": "Codonopsin", "ob": 18.47, "dl": 0.36}], "targets": [], "diseases": ["脾肺气虚", "气血两虚"]},
    {"name_cn": "白术", "name_latin": "Atractylodis Macrocephalae Rhizoma", "category": "补气药", "pinyin": "bai zhu", "is_food_homology": True, "ob_percent": 25.00, "dl_value": 0.17, "effects": "健脾益气，燥湿利水，止汗安胎", "compounds": [{"name": "Atractylodean", "ob": None, "dl": None}], "targets": [], "diseases": ["脾虚食少", "腹胀泄泻"]},
    {"name_cn": "薏苡仁", "name_latin": "Coicis Semen", "category": "利水渗湿药", "pinyin": "yi yi ren", "is_food_homology": True, "ob_percent": None, "dl_value": None, "effects": "利水渗湿，健脾止泻，除痹，排脓", "compounds": [], "targets": [], "diseases": ["水肿", "脾虚泄泻"]},
    {"name_cn": "菊花", "name_latin": "Chrysanthemi Flos", "category": "发散风热药", "pinyin": "ju hua", "is_food_homology": True, "ob_percent": 23.68, "dl_value": 0.17, "effects": "散风清热，平肝明目，清热解毒", "compounds": [{"name": "Luteolin", "ob": 45.12, "dl": 0.23}], "targets": [], "diseases": ["风热感冒", "目赤肿痛"]},
    {"name_cn": "桑叶", "name_latin": "Mori Folium", "category": "发散风热药", "pinyin": "sang ye", "is_food_homology": True, "ob_percent": 33.33, "dl_value": 0.19, "effects": "疏散风热，清肺润燥，清肝明目", "compounds": [], "targets": [], "diseases": ["风热咳嗽", "目赤昏花"]},
    {"name_cn": "玫瑰茄", "name_latin": "Hibisci Sabdariffae Flos", "category": "药食同源", "pinyin": "mei gui qie", "is_food_homology": True, "ob_percent": None, "dl_value": None, "effects": "清热解暑，敛疮止血", "compounds": [], "targets": [], "diseases": ["暑热烦渴"]},
    {"name_cn": "山楂", "name_latin": "Crataegi Fructus", "category": "消食药", "pinyin": "shan zha", "is_food_homology": True, "ob_percent": 47.06, "dl_value": 0.24, "effects": "消食健胃，行气散瘀", "compounds": [{"name": "Citric acid", "ob": 78.00, "dl": 0.37}], "targets": [], "diseases": ["肉食积滞", "高脂血症"]},
    {"name_cn": "陈皮", "name_latin": "Citri Reticulatae Pericarpium", "category": "理气药", "pinyin": "chen pi", "is_food_homology": True, "ob_percent": 87.14, "dl_value": 0.24, "effects": "理气健脾，燥湿化痰", "compounds": [{"name": "Naringin", "ob": 53.33, "dl": 0.31}], "targets": [], "diseases": ["脘腹胀满", "咳嗽痰多"]},
]

FOOD_HOMOLOGY_CATALOG = sorted([
    "黄芪", "当归", "枸杞子", "茯苓", "山药", "甘草", "红枣", "党参",
    "白术", "薏苡仁", "菊花", "桑叶", "玫瑰茄", "山楂", "陈皮",
    "莲子", "百合", "薏米", "桂圆", "黑芝麻", "核桃仁", "松子",
    "银耳", "莲子心", "桑葚", "乌梅", "枳椇子", "栀子", "淡竹叶",
])
