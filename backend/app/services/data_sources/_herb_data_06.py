"""
中药材扩展数据 — 第 6 部分（共 6 部分）
活血化瘀药（末段） / 消食药（后半） / 理气药 / 收涩药 / 清热凉血药 / 补阳药 / 补血药（后半）
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_06 = [
    {
        "name_cn": "广金钱草", "name_latin": "Desmodium styracifolium", "name_pinyin": "guang jin qian cao",
        "category": "利水渗湿药", "effects": "利湿退黄",
        "ob_percent": 2.65, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Desmodium saponin I", "ob": 2.85, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["结石淋痛", "黄疸"],
    },
    {
        "name_cn": "虎杖", "name_latin": "Reynoutria japonica", "name_pinyin": "hu zhang",
        "category": "利水渗湿药", "effects": "利湿退黄，清热解毒",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Polydatin", "ob": 2.85, "dl": 0.58, "target_count": 16},
            {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "VEGFA"],
        "diseases": ["湿热黄疸", "淋浊带下"],
    },
    {
        "name_cn": "地耳草", "name_latin": "Hypericum japonicum", "name_pinyin": "di er cao",
        "category": "利水渗湿药", "effects": "利湿退黄，清热解毒",
        "ob_percent": 2.45, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["湿热黄疸", "痈肿疮毒"],
    },
    {
        "name_cn": "溪黄草", "name_latin": "Abdella racemosa", "name_pinyin": "xi huang cao",
        "category": "利水渗湿药", "effects": "利湿退黄，清热解毒",
        "ob_percent": 2.35, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Abderruin", "ob": 2.85, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["湿热黄疸", "痈肿疮毒"],
    },
    {
        "name_cn": "明党参", "name_latin": "Changium smyrnioides", "name_pinyin": "ming dang shen",
        "category": "补阴药", "effects": "润肺化痰，养阴和胃",
        "ob_percent": 1.92, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Radix changii polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 15},
        ],
        "targets": ["TNF", "IL6", "AKT1"],
        "diseases": ["肺阴虚咳嗽", "呕吐反胃"],
    },
    {
        "name_cn": "墨旱莲", "name_latin": "Eclipta prostrata", "name_pinyin": "mo han lian",
        "category": "补阴药", "effects": "滋补肝肾，凉血止血",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Ecliptasaponin A", "ob": 2.85, "dl": 0.58, "target_count": 16},
            {"name": "Eclipine", "ob": 3.15, "dl": 0.55, "target_count": 17},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "BCL2"],
        "diseases": ["肝肾阴虚头晕", "月经量多"],
    },
    {
        "name_cn": "补骨脂", "name_latin": "Psoralea corylifolia", "name_pinyin": "bu gu zhi",
        "category": "补阳药", "effects": "补肾壮阳，固精缩尿",
        "ob_percent": 2.85, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Psoralen", "ob": 4.25, "dl": 0.72, "target_count": 30},
            {"name": "Isopsoralen", "ob": 3.95, "dl": 0.68, "target_count": 26},
        ],
        "targets": ["ERBB2", "TNF", "IL6", "SIRT1"],
        "diseases": ["肾虚阳痿遗精", "五更泄泻"],
    },
    {
        "name_cn": "菟丝子", "name_latin": "Cuscuta chinensis", "name_pinyin": "tu si zi",
        "category": "补阳药", "effects": "补肾益精，养肝明目",
        "ob_percent": 2.75, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Aurantio-obtusin", "ob": 3.45, "dl": 0.65, "target_count": 15},
            {"name": "Cuscutin", "ob": 2.85, "dl": 0.58, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "ERBB2", "AKT1"],
        "diseases": ["肝肾不足", "视物昏花"],
    },
    {
        "name_cn": "沙苑子", "name_latin": "Astragalus complanatus", "name_pinyin": "sha yuan zi",
        "category": "补阳药", "effects": "补肾固精，养肝明目",
        "ob_percent": 2.55, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Complanatoside A", "ob": 3.25, "dl": 0.6, "target_count": 18},
            {"name": "Astragaloside IV", "ob": 2.03, "dl": 0.68, "target_count": 25},
        ],
        "targets": ["TNF", "IL6", "ERBB2", "AKT1"],
        "diseases": ["肾虚腰痛", "遗精早泄"],
    },
    {
        "name_cn": "韭菜子", "name_latin": "Allium tuberosum", "name_pinyin": "jiu cai zi",
        "category": "补阳药", "effects": "温补肝肾，固精",
        "ob_percent": 2.45, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Allium tuberosum R2-type", "ob": 2.85, "dl": 0.52, "target_count": 14},
            {"name": "Beta-sitosterol", "ob": 3.15, "dl": 0.75, "target_count": 32},
        ],
        "targets": ["ERBB2", "TNF", "IL6", "SIRT1"],
        "diseases": ["肾阳虚衰", "遗精滑泄"],
    },
    {
        "name_cn": "银杏叶", "name_latin": "Ginkgo biloba", "name_pinyin": "yin xing ye",
        "category": "活血化瘀药", "effects": "活血化瘀通络",
        "ob_percent": 3.25, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Ginkgolide A", "ob": 3.85, "dl": 0.72, "target_count": 24},
            {"name": "Ginkgolide B", "ob": 3.65, "dl": 0.7, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NOS3"],
        "diseases": ["胸痹心痛", "中风半身不遂"],
    },
    {
        "name_cn": "银杏果", "name_latin": "Ginkgo biloba", "name_pinyin": "yin xing guo",
        "category": "止咳平喘药", "effects": "敛肺平喘，收涩止带缩尿",
        "ob_percent": 2.15, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Ginkgolide B", "ob": 3.65, "dl": 0.7, "target_count": 22},
            {"name": "Bilobalide", "ob": 3.05, "dl": 0.7, "target_count": 22},
        ],
        "targets": ["PAF", "TNF", "IL6", "PTGS2"],
        "diseases": ["痰多喘咳", "带下白浊"],
    },
    {
        "name_cn": "附子", "name_latin": "Aconiti Radix Lateralis", "name_pinyin": "fu zi",
        "category": "温里药", "effects": "回阳救逆，补火助阳，散寒止痛",
        "ob_percent": 1.82, "dl_value": 0.32, "is_food_homology": False,
        "compounds": [
            {"name": "Mesaconitine", "ob": 2.12, "dl": 0.38, "target_count": 18},
            {"name": "Hypaconitine", "ob": 2.05, "dl": 0.35, "target_count": 16},
            {"name": "Benzoylaconine", "ob": 3.45, "dl": 0.72, "target_count": 12},
            {"name": "Fuziline", "ob": 2.88, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["CACNA1S", "SCN5A", "KCNH2", "TRPV1", "ADRA1A"],
        "diseases": ["亡阳厥逆", "肾阳不足", "寒湿痹痛", "心衰水肿"],
    },
    {
        "name_cn": "桔梗", "name_latin": "Platycodon grandiflorum", "name_pinyin": "jie geng",
        "category": "化痰止咳平喘药", "effects": "宣肺利咽，祛痰排脓",
        "ob_percent": 3.75, "dl_value": 0.7, "is_food_homology": True,
        "compounds": [
            {"name": "Platycodin D", "ob": 4.55, "dl": 0.76, "target_count": 32},
            {"name": "Platycodin A", "ob": 4.12, "dl": 0.7, "target_count": 26},
            {"name": "Deapioplatycoside E", "ob": 3.35, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["MUC5AC", "SCGB1A1", "TNF", "IL4", "IL13", "STAT6"],
        "diseases": ["咳嗽痰多", "胸闷不畅", "咽痛失音", "肺痈吐脓"],
    },
    {
        "name_cn": "杏仁", "name_latin": "Prunus armeniaca", "name_pinyin": "xing ren",
        "category": "止咳平喘药", "effects": "降气止咳平喘，润肠通便",
        "ob_percent": 3.55, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Amygdalin", "ob": 4.25, "dl": 0.74, "target_count": 30},
            {"name": "Prunasin", "ob": 3.65, "dl": 0.64, "target_count": 22},
        ],
        "targets": ["TRPV1", "CHRNA3", "CHRNA5", "MUC5AC", "SCNN1B"],
        "diseases": ["咳嗽气喘", "胸满痰多", "肠燥便秘"],
    },
    {
        "name_cn": "薤白", "name_latin": "Allium macrostemon", "name_pinyin": "xie bai",
        "category": "理气药", "effects": "通阳散结，行气导滞",
        "ob_percent": 2.65, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Allium macrostemon A", "ob": 2.95, "dl": 0.54, "target_count": 14},
            {"name": "Macrostemonoside A", "ob": 2.75, "dl": 0.5, "target_count": 12},
        ],
        "targets": ["NOS3", "CACNA1C", "KCNH2", "AGTR1", "ACE"],
        "diseases": ["胸痹心痛", "脘腹痞满", "泻痢后重"],
    },
    {
        "name_cn": "天麻", "name_latin": "Gastrodia elata", "name_pinyin": "tian ma",
        "category": "平肝息风药", "effects": "息风止痉，平抑肝阳，祛风通络",
        "ob_percent": 3.85, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Gastrodin", "ob": 5.65, "dl": 0.84, "target_count": 44},
            {"name": "p-Hydroxybenzyl alcohol", "ob": 4.85, "dl": 0.76, "target_count": 36},
            {"name": "Parishin B", "ob": 3.95, "dl": 0.68, "target_count": 26},
            {"name": "Gastrodigenin", "ob": 4.35, "dl": 0.74, "target_count": 32},
        ],
        "targets": ["GRIN2B", "GABAA", "GABBR1", "CACNA1A", "KCND3", "SCN1A"],
        "diseases": ["肝风内动", "惊痫抽搐", "眩晕头痛", "肢体麻木"],
    },
    {
        "name_cn": "钩藤", "name_latin": "Uncaria rhynchophylla", "name_pinyin": "gou teng",
        "category": "平肝息风药", "effects": "息风定惊，清热平肝",
        "ob_percent": 3.65, "dl_value": 0.7, "is_food_homology": False,
        "compounds": [
            {"name": "Rhynchophylline", "ob": 4.85, "dl": 0.76, "target_count": 36},
            {"name": "Isorhynchophylline", "ob": 4.65, "dl": 0.74, "target_count": 34},
            {"name": "Corynoxeine", "ob": 4.25, "dl": 0.7, "target_count": 28},
        ],
        "targets": ["CACNA1A", "CACNA1B", "KCNN3", "HTR1A", "GABAA", "ADRA1A"],
        "diseases": ["头痛眩晕", "肝阳上亢", "惊痫抽搐", "高血压"],
    },
    {
        "name_cn": "续断", "name_latin": "Dipsacus asperoides", "name_pinyin": "xu duan",
        "category": "补阳药", "effects": "补肝肾，强筋骨，续折伤，止崩漏",
        "ob_percent": 3.15, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Asperosaponin VI", "ob": 4.35, "dl": 0.72, "target_count": 30},
            {"name": "Loganic acid", "ob": 3.55, "dl": 0.64, "target_count": 22},
        ],
        "targets": ["BMP2", "RUNX2", "COL1A1", "MMP9", "VEGFA", "TGFB1"],
        "diseases": ["腰痛脚弱", "跌打损伤", "筋骨折伤", "崩漏经多"],
    },
    {
        "name_cn": "淫羊藿", "name_latin": "Epimedium brevicornum", "name_pinyin": "yin yang huo",
        "category": "补阳药", "effects": "补肾阳，强筋骨，祛风湿",
        "ob_percent": 4.25, "dl_value": 0.76, "is_food_homology": False,
        "compounds": [
            {"name": "Icariin", "ob": 5.85, "dl": 0.86, "target_count": 48},
            {"name": "Icariside II", "ob": 5.15, "dl": 0.8, "target_count": 40},
            {"name": "Baohuoside I", "ob": 4.85, "dl": 0.76, "target_count": 36},
        ],
        "targets": ["AR", "ESR1", "NOS3", "AKT1", "PIK3CG", "BMP2", "RUNX2"],
        "diseases": ["肾阳虚衰", "阳痿遗精", "筋骨痿软", "风寒湿痹"],
    },
]
