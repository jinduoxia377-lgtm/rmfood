"""
中药材扩展数据 — 第 1 部分（共 6 部分）
泻下药 / 利水渗湿药 / 清热燥湿药 / 温里药 / 清热泻火药 / 平肝息风药 / 活血化瘀药（前半）
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_01 = [
    {
        "name_cn": "芒硝", "name_latin": "Mirabilite", "name_pinyin": "mang xiao",
        "category": "泻下药", "effects": "泻下攻积，润燥软坚，清火消肿",
        "ob_percent": 2.15, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Sodium sulfate", "ob": 1.85, "dl": 0.38, "target_count": 8},
            {"name": "Magnesium sulfate", "ob": 2.32, "dl": 0.42, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NOS2"],
        "diseases": ["实热积滞", "大便燥结", "痈疮肿痛"],
    },
    {
        "name_cn": "番泻叶", "name_latin": "Cassia angustifolia", "name_pinyin": "fan xie ye",
        "category": "泻下药", "effects": "泻热行滞，通便，利水",
        "ob_percent": 3.82, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Sennoside A", "ob": 4.15, "dl": 0.62, "target_count": 18},
            {"name": "Sennoside B", "ob": 3.95, "dl": 0.6, "target_count": 16},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK1"],
        "diseases": ["便秘腹痛", "热结便秘"],
    },
    {
        "name_cn": "火麻仁", "name_latin": "Cannabis sativa", "name_pinyin": "huo ma ren",
        "category": "泻下药", "effects": "润肠通便",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Cannabidiol", "ob": 3.45, "dl": 0.58, "target_count": 24},
            {"name": "Linoleic acid", "ob": 3.92, "dl": 0.38, "target_count": 16},
        ],
        "targets": ["TNF", "PTGS2", "AKT1"],
        "diseases": ["肠燥便秘", "消渴"],
    },
    {
        "name_cn": "郁李仁", "name_latin": "Prunus japonica", "name_pinyin": "yu li ren",
        "category": "泻下药", "effects": "润肠通便，下气利水消肿",
        "ob_percent": 2.08, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Amygdalin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["PTGS2", "AKT1", "TNF"],
        "diseases": ["津枯便秘", "水肿"],
    },
    {
        "name_cn": "甘遂", "name_latin": "Euphorbia kansui", "name_pinyin": "gan sui",
        "category": "泻下药", "effects": "泻水逐饮，消肿散结",
        "ob_percent": 1.85, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Kansuinine A", "ob": 2.45, "dl": 0.58, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "AKT1", "TP53"],
        "diseases": ["水肿胀满", "胸胁停饮"],
    },
    {
        "name_cn": "大戟", "name_latin": "Euphorbia pekinensis", "name_pinyin": "da ji",
        "category": "泻下药", "effects": "泻水逐饮，消肿散结",
        "ob_percent": 1.68, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Euphorbin A", "ob": 2.12, "dl": 0.52, "target_count": 11},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["水肿胀满", "痈肿疮毒"],
    },
    {
        "name_cn": "芫花", "name_latin": "Daphne genkwa", "name_pinyin": "yuan hua",
        "category": "泻下药", "effects": "泻水逐饮，祛痰止咳",
        "ob_percent": 2.25, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Genkwanin", "ob": 3.85, "dl": 0.65, "target_count": 18},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "BCL2"],
        "diseases": ["胸胁停饮", "咳嗽痰喘"],
    },
    {
        "name_cn": "商陆", "name_latin": "Phytolacca acinosa", "name_pinyin": "shang lu",
        "category": "泻下药", "effects": "逐水消肿，通利二便，解毒散结",
        "ob_percent": 1.92, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Phytolaccoside B", "ob": 1.75, "dl": 0.42, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "AKT1"],
        "diseases": ["水肿胀满", "瘰疬疮肿"],
    },
    {
        "name_cn": "牵牛子", "name_latin": "Ipomoea nil", "name_pinyin": "qian niu zi",
        "category": "泻下药", "effects": "泻水通便，消痰涤饮",
        "ob_percent": 2.45, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Pharbitin A", "ob": 2.15, "dl": 0.48, "target_count": 11},
        ],
        "targets": ["TNF", "PTGS2", "AKT1"],
        "diseases": ["水肿胀满", "肠道寄生虫"],
    },
    {
        "name_cn": "巴豆", "name_latin": "Croton tiglium", "name_pinyin": "ba dou",
        "category": "泻下药", "effects": "峻下冷积，逐水退肿",
        "ob_percent": 1.55, "dl_value": 0.42, "is_food_homology": False,
        "compounds": [
            {"name": "Croton oil", "ob": 1.85, "dl": 0.38, "target_count": 8},
        ],
        "targets": ["PKC", "TNF", "NFkB"],
        "diseases": ["寒积便秘", "喉痹痰阻"],
    },
    {
        "name_cn": "芦荟", "name_latin": "Aloe vera", "name_pinyin": "lu hui",
        "category": "泻下药", "effects": "泻下通便，清肝泻火",
        "ob_percent": 3.15, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Aloin A", "ob": 3.85, "dl": 0.58, "target_count": 16},
            {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "ESR1"],
        "diseases": ["热结便秘", "疳积虫积"],
    },
    {
        "name_cn": "独活", "name_latin": "Angelica pubescens", "name_pinyin": "du huo",
        "category": "祛风湿药", "effects": "祛风湿，止痛，解表",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Osthole", "ob": 4.52, "dl": 0.73, "target_count": 30},
            {"name": "Xanthotoxin", "ob": 3.85, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "AKT1", "MAPK1"],
        "diseases": ["风寒湿痹", "腰膝疼痛"],
    },
    {
        "name_cn": "威灵仙", "name_latin": "Clematis chinensis", "name_pinyin": "wei ling xian",
        "category": "祛风湿药", "effects": "祛风湿，通经络，止痛",
        "ob_percent": 2.65, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Hederagenin", "ob": 3.65, "dl": 0.75, "target_count": 26},
            {"name": "Clematoside S", "ob": 1.85, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "MAPK3"],
        "diseases": ["风湿痹痛", "肢体麻木"],
    },
    {
        "name_cn": "秦艽", "name_latin": "Gentiana macrophylla", "name_pinyin": "qin jiao",
        "category": "祛风湿药", "effects": "祛风湿，清湿热，舒筋络",
        "ob_percent": 2.95, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Gentiopicroside", "ob": 3.15, "dl": 0.55, "target_count": 18},
            {"name": "Gentianine", "ob": 4.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["风湿痹痛", "骨蒸潮热"],
    },
    {
        "name_cn": "防己", "name_latin": "Stephania tetrandra", "name_pinyin": "fang ji",
        "category": "祛风湿药", "effects": "祛风止痛，利水消肿",
        "ob_percent": 3.25, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Tetrandrine", "ob": 3.85, "dl": 0.72, "target_count": 28},
            {"name": "Fangchinoline", "ob": 3.65, "dl": 0.7, "target_count": 25},
        ],
        "targets": ["TNF", "IL6", "AKT1", "CACNA1S"],
        "diseases": ["风湿痹痛", "水肿脚气"],
    },
    {
        "name_cn": "桑枝", "name_latin": "Morus alba", "name_pinyin": "sang zhi",
        "category": "祛风湿药", "effects": "祛风湿，利关节",
        "ob_percent": 1.85, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Morin", "ob": 4.15, "dl": 0.72, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["肩臂关节酸痛", "水肿脚气"],
    },
    {
        "name_cn": "豨莶草", "name_latin": "Siegesbeckia orientalis", "name_pinyin": "xi xian cao",
        "category": "祛风湿药", "effects": "祛风湿，利关节，解毒",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Darutoside", "ob": 3.15, "dl": 0.62, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NFkBIA"],
        "diseases": ["风湿痹痛", "疮疡肿毒"],
    },
    {
        "name_cn": "臭梧桐", "name_latin": "Clerodendrum trichotomum", "name_pinyin": "chou wu tong",
        "category": "祛风湿药", "effects": "祛风湿，通络止痛，降血压",
        "ob_percent": 2.15, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Clerodendrin I", "ob": 2.85, "dl": 0.58, "target_count": 14},
        ],
        "targets": ["ACE", "TNF", "IL6", "PTGS2"],
        "diseases": ["风湿痹痛", "高血压病"],
    },
    {
        "name_cn": "海桐皮", "name_latin": "Pittosporum tobira", "name_pinyin": "hai tong pi",
        "category": "祛风湿药", "effects": "祛风湿，通络止痛，杀虫止痒",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Pittosporoside A", "ob": 2.65, "dl": 0.55, "target_count": 13},
        ],
        "targets": ["TNF", "IL6", "TRPV1", "PTGS2"],
        "diseases": ["腰膝疼痛", "疥癣湿疹"],
    },
    {
        "name_cn": "络石藤", "name_latin": "Trachelospermum jasminoides", "name_pinyin": "luo shi teng",
        "category": "祛风湿药", "effects": "祛风通络，凉血消肿",
        "ob_percent": 2.75, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Trachelogenin", "ob": 3.45, "dl": 0.72, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "BCL2"],
        "diseases": ["风湿热痹", "喉痹痈肿"],
    },
    {
        "name_cn": "雷公藤", "name_latin": "Tripterygium wilfordii", "name_pinyin": "lei gong teng",
        "category": "祛风湿药", "effects": "祛风除湿，活血通络",
        "ob_percent": 2.55, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Triptolide", "ob": 3.85, "dl": 0.78, "target_count": 32},
            {"name": "Celastrol", "ob": 4.25, "dl": 0.82, "target_count": 35},
        ],
        "targets": ["TNF", "IL6", "NFkB", "CASP3", "BCL2"],
        "diseases": ["类风湿关节炎", "红斑狼疮"],
    },
    {
        "name_cn": "老鹳草", "name_latin": "Geranium wilfordii", "name_pinyin": "lao guan cao",
        "category": "祛风湿药", "effects": "祛风湿，通经络，清热解毒",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Geraniin", "ob": 2.85, "dl": 0.58, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["风湿痹痛", "泄泻痢疾"],
    },
    {
        "name_cn": "伸筋草", "name_latin": "Lycopodium japonicum", "name_pinyin": "shen jin cao",
        "category": "祛风湿药", "effects": "祛风除湿，舒筋活络",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Lycopodine", "ob": 2.65, "dl": 0.62, "target_count": 16},
        ],
        "targets": ["ACHR", "TNF", "IL6"],
        "diseases": ["关节酸痛", "跌打损伤"],
    },
    {
        "name_cn": "木瓜", "name_latin": "Chaenomeles sinensis", "name_pinyin": "mu gua",
        "category": "祛风湿药", "effects": "舒筋活络，和胃化湿",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.72, "target_count": 28},
            {"name": "Amygdalin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "MMP9"],
        "diseases": ["风湿痹痛", "吐泻转筋"],
    },
    {
        "name_cn": "五加皮", "name_latin": "Acanthopanax gracilistylus", "name_pinyin": "wu jia pi",
        "category": "祛风湿药", "effects": "祛风除湿，补益肝肾",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Eleutheroside E", "ob": 2.95, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "AKT1", "MAPK1"],
        "diseases": ["风湿痹痛", "腰膝酸软"],
    },
    {
        "name_cn": "桑寄生", "name_latin": "Taxillus chinensis", "name_pinyin": "sang ji sheng",
        "category": "祛风湿药", "effects": "祛风湿，补肝肾，强筋骨",
        "ob_percent": 2.45, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["TNF", "IL6", "AKT1", "VEGFA", "PTGS2"],
        "diseases": ["风湿痹痛", "胎动不安"],
    },
    {
        "name_cn": "狗脊", "name_latin": "Cibotium barometz", "name_pinyin": "gou ji",
        "category": "祛风湿药", "effects": "祛风湿，补肝肾，强腰膝",
        "ob_percent": 1.95, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Cibotiumbaroside A", "ob": 1.85, "dl": 0.48, "target_count": 10},
        ],
        "targets": ["TNF", "ALP", "BMP2"],
        "diseases": ["风湿痹痛", "腰膝酸软"],
    },
    {
        "name_cn": "千年健", "name_latin": "Homalomena occulta", "name_pinyin": "qian nian jian",
        "category": "祛风湿药", "effects": "祛风湿，壮筋骨",
        "ob_percent": 2.15, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Linalool", "ob": 3.25, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "COX2", "TRPA1"],
        "diseases": ["风寒湿痹", "拘挛麻木"],
    },
    {
        "name_cn": "苍术", "name_latin": "Atractylodes lancea", "name_pinyin": "cang zhu",
        "category": "化湿药", "effects": "燥湿健脾，祛风散寒，明目",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Atractyldin", "ob": 3.65, "dl": 0.68, "target_count": 20},
            {"name": "Atractylon", "ob": 2.87, "dl": 0.58, "target_count": 11},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MAPK1"],
        "diseases": ["湿阻中焦", "脘腹胀满"],
    },
    {
        "name_cn": "佩兰", "name_latin": "Eupatorium fortunei", "name_pinyin": "pei lan",
        "category": "化湿药", "effects": "芳香化湿，醒脾开胃，发表解暑",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Eupatoriopicrin", "ob": 3.15, "dl": 0.58, "target_count": 15},
            {"name": "P-cymene", "ob": 2.85, "dl": 0.48, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["湿浊中阻", "口甜口腻"],
    },
    {
        "name_cn": "草果", "name_latin": "Amomum tsao-ko", "name_pinyin": "cao guo",
        "category": "化湿药", "effects": "燥湿温中，截疟除痰",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Tsao-ko ketone", "ob": 2.85, "dl": 0.55, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["寒湿内阻", "疟疾寒热"],
    },
    {
        "name_cn": "厚朴", "name_latin": "Magnolia officinalis", "name_pinyin": "hou po",
        "category": "化湿药", "effects": "燥湿消痰，下气除满",
        "ob_percent": 3.25, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Honokiol", "ob": 4.85, "dl": 0.8, "target_count": 35},
            {"name": "Magnolol", "ob": 4.65, "dl": 0.78, "target_count": 33},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "CASP3", "BCL2"],
        "diseases": ["湿滞伤中", "咳嗽痰喘"],
    },
    {
        "name_cn": "香薷", "name_latin": "Mosla chinensis", "name_pinyin": "xiang ru",
        "category": "化湿药", "effects": "发汗解表，化湿和中",
        "ob_percent": 3.15, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Eugenol", "ob": 3.65, "dl": 0.55, "target_count": 14},
            {"name": "Thymol", "ob": 3.25, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["暑湿感冒", "腹痛吐泻"],
    },
    {
        "name_cn": "吴茱萸", "name_latin": "Evodia rutaecarpa", "name_pinyin": "wu zhu yu",
        "category": "温里药", "effects": "散寒止痛，降逆止呕，助阳止泻",
        "ob_percent": 3.25, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Evodiamine", "ob": 3.85, "dl": 0.72, "target_count": 26},
            {"name": "Rutaecarpine", "ob": 4.15, "dl": 0.75, "target_count": 28},
        ],
        "targets": ["TRPV1", "TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["厥阴头痛", "寒疝腹痛"],
    },
    {
        "name_cn": "小茴香", "name_latin": "Foeniculum vulgare", "name_pinyin": "xiao hui xiang",
        "category": "温里药", "effects": "散寒止痛，理气和胃",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Anethole", "ob": 3.25, "dl": 0.52, "target_count": 12},
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["TNF", "PTGS2", "ESR1", "GABAA"],
        "diseases": ["寒疝腹痛", "痛经少腹冷痛"],
    },
    {
        "name_cn": "丁香", "name_latin": "Syzygium aromaticum", "name_pinyin": "ding xiang",
        "category": "温里药", "effects": "温中降逆，补肾助阳",
        "ob_percent": 3.45, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Eugenol", "ob": 3.65, "dl": 0.55, "target_count": 14},
            {"name": "Gallic acid", "ob": 3.85, "dl": 0.48, "target_count": 18},
        ],
        "targets": ["PTGS2", "TNF", "TRPM8", "TRPA1"],
        "diseases": ["脾胃虚寒", "肾虚阳痿"],
    },
    {
        "name_cn": "高良姜", "name_latin": "Alpinia officinarum", "name_pinyin": "gao liang jiang",
        "category": "温里药", "effects": "温中止呕，散寒止痛",
        "ob_percent": 2.95, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Galangin", "ob": 4.25, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "TRPV1"],
        "diseases": ["脘腹冷痛", "胃寒呕吐"],
    },
    {
        "name_cn": "花椒", "name_latin": "Zanthoxylum bungeanum", "name_pinyin": "hua jiao",
        "category": "温里药", "effects": "温中止痛，杀虫止痒",
        "ob_percent": 2.75, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Hydroxy-alpha-sanshool", "ob": 3.15, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TRPA1", "TRPV1", "TNF", "IL6"],
        "diseases": ["脘腹冷痛", "虫积腹痛"],
    },
    {
        "name_cn": "荜茇", "name_latin": "Piper longum", "name_pinyin": "bi bo",
        "category": "温里药", "effects": "温中散寒，下气止痛",
        "ob_percent": 2.65, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Piperlonguminine", "ob": 3.25, "dl": 0.62, "target_count": 18},
            {"name": "Piperine", "ob": 3.85, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["TRPV1", "TNF", "PTGS2", "CYP3A4"],
        "diseases": ["胃寒腹痛", "龋齿疼痛"],
    },
    {
        "name_cn": "荜澄茄", "name_latin": "Piper cubeba", "name_pinyin": "bi cheng qie",
        "category": "温里药", "effects": "温中散寒，行气止痛",
        "ob_percent": 2.45, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Cubebin", "ob": 3.15, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TRPV1", "TNF", "IL6"],
        "diseases": ["胃寒呕吐", "寒疝腹痛"],
    },
    {
        "name_cn": "胡椒", "name_latin": "Piper nigrum", "name_pinyin": "hu jiao",
        "category": "温里药", "effects": "温中散寒，下气消痰",
        "ob_percent": 2.85, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Piperine", "ob": 3.85, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["CYP3A4", "TNF", "PPARG", "PTGS2"],
        "diseases": ["胃寒呕吐", "食欲不振"],
    },
    {
        "name_cn": "八角茴香", "name_latin": "Illicium verum", "name_pinyin": "ba jiao hui xiang",
        "category": "温里药", "effects": "温阳散寒，理气止痛",
        "ob_percent": 2.75, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Anethole", "ob": 3.25, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "PTGS2", "GABRA1"],
        "diseases": ["寒疝腹痛", "呕吐泄泻"],
    },
    {
        "name_cn": "远志", "name_latin": "Polygala tenuifolia", "name_pinyin": "yuan zhi",
        "category": "安神药", "effects": "安神益智，交通心肾，祛痰",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Onjisaponin B", "ob": 2.85, "dl": 0.68, "target_count": 20},
            {"name": "Tenuifolin", "ob": 3.15, "dl": 0.65, "target_count": 18},
        ],
        "targets": ["ACHe", "MAOA", "GABRA1", "SLC6A2"],
        "diseases": ["失眠多梦", "健忘恍惚"],
    },
    {
        "name_cn": "合欢皮", "name_latin": "Albizia julibrissin", "name_pinyin": "he huan pi",
        "category": "安神药", "effects": "解郁安神，活血消肿",
        "ob_percent": 2.55, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Julibroside J1", "ob": 1.85, "dl": 0.55, "target_count": 12},
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF", "PTGS2"],
        "diseases": ["心神不安", "忧郁失眠"],
    },
    {
        "name_cn": "合欢花", "name_latin": "Albizia julibrissin", "name_pinyin": "he huan hua",
        "category": "安神药", "effects": "解郁安神，理气开胃",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Quercitrin", "ob": 3.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["GABRA1", "5-HT2A", "MAOA"],
        "diseases": ["心烦失眠", "抑郁不乐"],
    },
    {
        "name_cn": "首乌藤", "name_latin": "Polygonum multiflorum var. cilinerne", "name_pinyin": "shou wu teng",
        "category": "安神药", "effects": "养血安神，祛风通络",
        "ob_percent": 2.45, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
        ],
        "targets": ["GABRA1", "5-HT3", "TNF", "AKT1"],
        "diseases": ["失眠多梦", "血虚身痛"],
    },
]
