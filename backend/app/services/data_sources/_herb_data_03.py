"""
中药材扩展数据 — 第 3 部分（共 6 部分）
安神药（续） / 补气药 / 化湿药 / 化痰药 / 补血药 / 补阴药 / 祛风湿药（前半）
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_03 = [
    {
        "name_cn": "棕榈炭", "name_latin": "Trachycarpus fortunei", "name_pinyin": "zong lü tan",
        "category": "止血药", "effects": "收敛止血",
        "ob_percent": 1.25, "dl_value": 0.28, "is_food_homology": False,
        "compounds": [
            {"name": "Tannic acid", "ob": 2.85, "dl": 0.48, "target_count": 16},
        ],
        "targets": ["TNF", "PTGS2"],
        "diseases": ["吐血衄血", "崩漏下血"],
    },
    {
        "name_cn": "藕节", "name_latin": "Nelumbo nucifera", "name_pinyin": "ou jie",
        "category": "止血药", "effects": "收敛止血，化瘀",
        "ob_percent": 1.85, "dl_value": 0.42, "is_food_homology": True,
        "compounds": [
            {"name": "Tyrosine", "ob": 2.65, "dl": 0.48, "target_count": 12},
            {"name": "Proanthocyanidin", "ob": 2.85, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "PTGS2", "FIBRINOGEN"],
        "diseases": ["吐血衄血", "崩漏"],
    },
    {
        "name_cn": "麝香", "name_latin": "Moschus", "name_pinyin": "she xiang",
        "category": "开窍药", "effects": "开窍醒神，活血通经",
        "ob_percent": 1.85, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Muscone", "ob": 3.25, "dl": 0.65, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NOS3", "GABRA1"],
        "diseases": ["热病神昏", "疮疡肿毒"],
    },
    {
        "name_cn": "冰片", "name_latin": "Borneolum Syntheticum", "name_pinyin": "bing pian",
        "category": "开窍药", "effects": "开窍醒神，清热止痛",
        "ob_percent": 4.25, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Borneol", "ob": 5.15, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["GABRA1", "NMDAR", "TRPM8", "TNF"],
        "diseases": ["热病神昏", "口舌生疮"],
    },
    {
        "name_cn": "石菖蒲", "name_latin": "Acorus tatarinowii", "name_pinyin": "shi chang pu",
        "category": "开窍药", "effects": "开窍豁痰，醒神益智",
        "ob_percent": 2.95, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Beta-asarone", "ob": 3.45, "dl": 0.62, "target_count": 20},
            {"name": "Linalool", "ob": 3.25, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["GABRA1", "ACHR", "BDNF", "MAOA"],
        "diseases": ["神志昏乱", "健忘失眠"],
    },
    {
        "name_cn": "苏合香", "name_latin": "Styrax tonkinensis", "name_pinyin": "su he xiang",
        "category": "开窍药", "effects": "开窍醒神，辟秽止痛",
        "ob_percent": 2.25, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Cinnamic acid", "ob": 3.85, "dl": 0.58, "target_count": 22},
        ],
        "targets": ["GABRA1", "TRPV1", "TNF"],
        "diseases": ["中风昏迷", "心腹疼痛"],
    },
    {
        "name_cn": "安息香", "name_latin": "Benzoinum", "name_pinyin": "an xi xiang",
        "category": "开窍药", "effects": "开窍醒神，行气活血",
        "ob_percent": 2.15, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Benzoic acid", "ob": 3.05, "dl": 0.5, "target_count": 14},
            {"name": "Vanillin", "ob": 3.45, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["GABRA1", "TRPA1", "TNF"],
        "diseases": ["中风昏迷", "产后血晕"],
    },
    {
        "name_cn": "樟脑", "name_latin": "Camphora", "name_pinyin": "zhang nao",
        "category": "开窍药", "effects": "除湿杀虫，温散止痛",
        "ob_percent": 3.65, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Camphor", "ob": 4.85, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["TRPM8", "TRPV1", "GABRA1"],
        "diseases": ["痧胀腹痛", "牙痛"],
    },
    {
        "name_cn": "槟榔", "name_latin": "Areca catechu", "name_pinyin": "bing lang",
        "category": "驱虫药", "effects": "杀虫消积，行气利水",
        "ob_percent": 2.95, "dl_value": 0.6, "is_food_homology": True,
        "compounds": [
            {"name": "Arecoline", "ob": 3.65, "dl": 0.62, "target_count": 20},
            {"name": "Arecaidine", "ob": 3.25, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["ACHR", "MAOA", "TNF", "IL6"],
        "diseases": ["绦虫病", "食积气滞"],
    },
    {
        "name_cn": "南瓜子", "name_latin": "Cucurbita moschata", "name_pinyin": "nan gua zi",
        "category": "驱虫药", "effects": "杀虫",
        "ob_percent": 2.75, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Cucurbitin", "ob": 3.15, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "PTGS2"],
        "diseases": ["绦虫病", "蛔虫病"],
    },
    {
        "name_cn": "鹤草芽", "name_latin": "Agrimonia pilosa var. japonica", "name_pinyin": "he cao ya",
        "category": "驱虫药", "effects": "杀虫",
        "ob_percent": 2.15, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Agrimophol", "ob": 2.95, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["绦虫病"],
    },
    {
        "name_cn": "雷丸", "name_latin": "Omphalia lapidescens", "name_pinyin": "lei wan",
        "category": "驱虫药", "effects": "杀虫消积",
        "ob_percent": 1.85, "dl_value": 0.42, "is_food_homology": False,
        "compounds": [
            {"name": "Omphalin", "ob": 2.25, "dl": 0.48, "target_count": 11},
        ],
        "targets": ["CTSB", "CTSL", "MMP9"],
        "diseases": ["绦虫病", "钩虫病"],
    },
    {
        "name_cn": "贯众", "name_latin": "Dryopteris crassirhizoma", "name_pinyin": "guan zhong",
        "category": "驱虫药", "effects": "清热解毒，止血，杀虫",
        "ob_percent": 2.45, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Filmaron", "ob": 2.85, "dl": 0.52, "target_count": 14},
            {"name": "Kaempferol", "ob": 4.25, "dl": 0.72, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["绦虫病", "热毒疮疡"],
    },
    {
        "name_cn": "芜荑", "name_latin": "Ulmus macrocarpa", "name_pinyin": "wu yi",
        "category": "驱虫药", "effects": "杀虫消积",
        "ob_percent": 1.75, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Gallic acid", "ob": 3.85, "dl": 0.48, "target_count": 18},
        ],
        "targets": ["TNF", "PTGS2"],
        "diseases": ["蛔虫病", "疥癣瘙痒"],
    },
    {
        "name_cn": "硫磺", "name_latin": "Sulfur", "name_pinyin": "liu huang",
        "category": "外用药", "effects": "外用解毒杀虫疗疮；内服补火助阳",
        "ob_percent": 1.25, "dl_value": 0.32, "is_food_homology": False,
        "compounds": [
            {"name": "Sulfur powder", "ob": 0.85, "dl": 0.25, "target_count": 4},
        ],
        "targets": ["CYP3A4", "TNF"],
        "diseases": ["疥癣湿疹", "虚寒便秘"],
    },
    {
        "name_cn": "雄黄", "name_latin": "Realgar", "name_pinyin": "xiong huang",
        "category": "外用药", "effects": "解毒杀虫，燥湿祛痰",
        "ob_percent": 0.95, "dl_value": 0.28, "is_food_homology": False,
        "compounds": [
            {"name": "Arsenic disulfide", "ob": 0.65, "dl": 0.22, "target_count": 3},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["痈疽疔疮", "蛇虫咬伤"],
    },
    {
        "name_cn": "蟾酥", "name_latin": "Bufonis Venenum", "name_pinyin": "chan su",
        "category": "外用药", "effects": "解毒止痛，开窍醒神",
        "ob_percent": 2.15, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Bufalin", "ob": 3.85, "dl": 0.72, "target_count": 28},
            {"name": "Cinobufagin", "ob": 3.65, "dl": 0.7, "target_count": 26},
        ],
        "targets": ["TP53", "BCL2", "AKT1", "VEGFA", "SRC", "EGFR"],
        "diseases": ["痈疽疔疮", "咽喉肿痛"],
    },
    {
        "name_cn": "马钱子", "name_latin": "Strychnos nux-vomica", "name_pinyin": "ma qian zi",
        "category": "外用药", "effects": "通络止痛，散结消肿",
        "ob_percent": 1.95, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Strychnine", "ob": 2.55, "dl": 0.62, "target_count": 18},
            {"name": "Brucine", "ob": 2.35, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["GLRA1", "CHRNB1", "TNF", "IL6"],
        "diseases": ["跌打损伤", "风湿痹痛"],
    },
    {
        "name_cn": "蛇床子", "name_latin": "Cnidium monnieri", "name_pinyin": "she chuang zi",
        "category": "外用药", "effects": "燥湿祛风，杀虫止痒",
        "ob_percent": 3.15, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Osthole", "ob": 4.52, "dl": 0.73, "target_count": 30},
            {"name": "Imperatorin", "ob": 4.12, "dl": 0.65, "target_count": 22},
        ],
        "targets": ["ESR1", "ERBB2", "TNF", "IL6", "PTGS2"],
        "diseases": ["阴痒湿疮", "肾虚阳痿"],
    },
    {
        "name_cn": "土荆皮", "name_latin": "Pseudolarix amabilis", "name_pinyin": "tu jing pi",
        "category": "外用药", "effects": "杀虫止痒",
        "ob_percent": 2.25, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Pseudolaric acid B", "ob": 3.25, "dl": 0.65, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "MMP9"],
        "diseases": ["体癣手足癣", "神经性皮炎"],
    },
    {
        "name_cn": "炉甘石", "name_latin": "Calamina", "name_pinyin": "lu gan shi",
        "category": "外用药", "effects": "解毒明目退翳，收湿止痒",
        "ob_percent": 0.75, "dl_value": 0.22, "is_food_homology": False,
        "compounds": [
            {"name": "Zinc carbonate", "ob": 0.55, "dl": 0.2, "target_count": 3},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["目赤翳障", "皮肤湿疮"],
    },
    {
        "name_cn": "儿茶", "name_latin": "Catechu", "name_pinyin": "er cha",
        "category": "外用药", "effects": "活血止痛，止血生肌",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Catechin", "ob": 4.05, "dl": 0.72, "target_count": 30},
            {"name": "Epicatechin", "ob": 3.85, "dl": 0.7, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "COL1A1", "TGF-beta1"],
        "diseases": ["跌打伤痛", "肺热咳嗽"],
    },
    {
        "name_cn": "红参", "name_latin": "Panax ginseng rubra", "name_pinyin": "hong shen",
        "category": "补气药", "effects": "大补元气，复脉固脱",
        "ob_percent": 3.85, "dl_value": 0.82, "is_food_homology": True,
        "compounds": [
            {"name": "Ginsenoside Rg3", "ob": 2.95, "dl": 0.78, "target_count": 26},
            {"name": "Ginsenoside Rg1", "ob": 2.63, "dl": 0.8, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "TP53", "AKT1", "ESR1", "MAPK3"],
        "diseases": ["体虚欲脱", "肢冷脉微"],
    },
    {
        "name_cn": "刺五加", "name_latin": "Acanthopanax senticosus", "name_pinyin": "ci wu jia",
        "category": "补气药", "effects": "健脾补肾，安神",
        "ob_percent": 2.75, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Eleutheroside E", "ob": 2.95, "dl": 0.58, "target_count": 18},
            {"name": "Isofraxidin", "ob": 4.15, "dl": 0.62, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "AKT1", "MAPK1", "GABRA1"],
        "diseases": ["脾肾阳虚", "体虚乏力"],
    },
    {
        "name_cn": "绞股蓝", "name_latin": "Gynostemma pentaphyllum", "name_pinyin": "jiao gu lan",
        "category": "补气药", "effects": "益气健脾，化痰止咳",
        "ob_percent": 3.05, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Gypenoside XLIX", "ob": 2.45, "dl": 0.58, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "AKT1", "PTGS2"],
        "diseases": ["脾虚体倦", "高脂血症"],
    },
    {
        "name_cn": "太子参", "name_latin": "Pseudostellaria heterophylla", "name_pinyin": "tai zi shen",
        "category": "补气药", "effects": "益气健脾，生津润肺",
        "ob_percent": 1.85, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Heterophyllin B", "ob": 2.15, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "AKT1"],
        "diseases": ["脾虚体倦", "病后虚弱"],
    },
    {
        "name_cn": "红景天", "name_latin": "Rhodiola rosea", "name_pinyin": "hong jing tian",
        "category": "补气药", "effects": "益气活血，通脉平喘",
        "ob_percent": 2.95, "dl_value": 0.68, "is_food_homology": True,
        "compounds": [
            {"name": "Salidroside", "ob": 3.85, "dl": 0.7, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "AKT1", "HIF1A", "NOS3", "BCL2"],
        "diseases": ["气虚血瘀", "倦怠气喘"],
    },
    {
        "name_cn": "饴糖", "name_latin": "Maltose", "name_pinyin": "yi tang",
        "category": "补气药", "effects": "补中益气，缓急止痛",
        "ob_percent": 1.25, "dl_value": 0.32, "is_food_homology": True,
        "compounds": [
            {"name": "Maltose", "ob": 1.05, "dl": 0.22, "target_count": 5},
        ],
        "targets": ["TNF", "TRPM8"],
        "diseases": ["脾胃虚寒", "肺燥咳嗽"],
    },
    {
        "name_cn": "熟地黄", "name_latin": "Rehmannia glutinosa praeparata", "name_pinyin": "shu di huang",
        "category": "补血药", "effects": "补血滋阴，益精填髓",
        "ob_percent": 2.65, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Catalpol", "ob": 2.85, "dl": 0.62, "target_count": 20},
            {"name": "Acteoside", "ob": 3.15, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "ESR1", "AKT1", "BMP2"],
        "diseases": ["血虚萎黄", "月经不调"],
    },
    {
        "name_cn": "白芍", "name_latin": "Paeonia lactiflora", "name_pinyin": "bai shao",
        "category": "补血药", "effects": "养血调经，敛阴止汗",
        "ob_percent": 3.15, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Paeoniflorin", "ob": 4.25, "dl": 0.72, "target_count": 28},
            {"name": "Albiflorin", "ob": 3.85, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "ESR1", "OPRM1"],
        "diseases": ["血虚萎黄", "自汗盗汗"],
    },
    {
        "name_cn": "阿胶", "name_latin": "Equus Asinus Colla", "name_pinyin": "e jiao",
        "category": "补血药", "effects": "补血滋阴，润燥止血",
        "ob_percent": 1.85, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Collagen peptide", "ob": 2.15, "dl": 0.42, "target_count": 12},
        ],
        "targets": ["COL1A1", "TNF", "IL6", "VEGFA"],
        "diseases": ["血虚萎黄", "眩晕心悸"],
    },
    {
        "name_cn": "何首乌", "name_latin": "Polygonum multiflorum", "name_pinyin": "he shou wu",
        "category": "补血药", "effects": "制用：补益精血；生用：解毒截疟",
        "ob_percent": 2.55, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
            {"name": "Stilbene glucoside", "ob": 1.85, "dl": 0.45, "target_count": 12},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "TP53", "SIRT1"],
        "diseases": ["精血亏虚", "须发早白"],
    },
    {
        "name_cn": "石斛", "name_latin": "Dendrobium nobile", "name_pinyin": "shi hu",
        "category": "补阴药", "effects": "益胃生津，滋阴清热",
        "ob_percent": 2.35, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Dendrobine", "ob": 3.15, "dl": 0.62, "target_count": 18},
            {"name": "Polysaccharide", "ob": 0.38, "dl": 0.28, "target_count": 15},
        ],
        "targets": ["TNF", "IL6", "AKT1", "MAPK3", "NFkBIA"],
        "diseases": ["热病伤津口干烦渴", "胃阴不足"],
    },
    {
        "name_cn": "女贞子", "name_latin": "Ligustrum lucidum", "name_pinyin": "nv zhen zi",
        "category": "补阴药", "effects": "滋补肝肾，明目乌发",
        "ob_percent": 2.65, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.72, "target_count": 28},
            {"name": "Salidroside", "ob": 3.85, "dl": 0.7, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "AKT1", "SIRT1", "FOXO3"],
        "diseases": ["肝肾阴虚", "眩晕耳鸣"],
    },
    {
        "name_cn": "龟甲", "name_latin": "Testudinis Carapax et Plastrum", "name_pinyin": "gui jia",
        "category": "补阴药", "effects": "滋阴潜阳，益肾强骨",
        "ob_percent": 1.35, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Calcium phosphate", "ob": 0.85, "dl": 0.25, "target_count": 5},
        ],
        "targets": ["BMP2", "RUNX2", "TNF", "ALP"],
        "diseases": ["阴虚阳亢", "肾虚骨蒸"],
    },
    {
        "name_cn": "仙茅", "name_latin": "Curculigo orchioides", "name_pinyin": "xian mao",
        "category": "补阳药", "effects": "补肾阳，强筋骨，祛寒湿",
        "ob_percent": 2.35, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Curculigoside", "ob": 3.15, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["ESR1", "ERBB2", "TNF", "IL6", "AKT1"],
        "diseases": ["肾阳不足", "腰膝冷痛"],
    },
    {
        "name_cn": "巴戟天", "name_latin": "Morinda officinalis", "name_pinyin": "ba ji tian",
        "category": "补阳药", "effects": "补肾阳，强筋骨，祛风湿",
        "ob_percent": 2.55, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Morindaside A", "ob": 2.85, "dl": 0.58, "target_count": 16},
            {"name": "Monotropein", "ob": 2.65, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "ESR1", "BMP2"],
        "diseases": ["阳痿遗精", "风湿痹痛"],
    },
    {
        "name_cn": "海马", "name_latin": "Hippocampus", "name_pinyin": "hai ma",
        "category": "补阳药", "effects": "补肾壮阳，调气活血",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Cholesterol", "ob": 2.85, "dl": 0.72, "target_count": 30},
        ],
        "targets": ["GnRH", "LHR", "TNF"],
        "diseases": ["肾虚阳痿", "遗尿"],
    },
    {
        "name_cn": "蛤蚧", "name_latin": "Gecko gecko", "name_pinyin": "ge jie",
        "category": "补阳药", "effects": "补肺益肾，纳气定喘",
        "ob_percent": 1.75, "dl_value": 0.42, "is_food_homology": False,
        "compounds": [
            {"name": "Gecko protein", "ob": 1.45, "dl": 0.35, "target_count": 6},
        ],
        "targets": ["TNF", "IL6"],
        "diseases": ["肺虚咳嗽", "肾虚作喘"],
    },
    {
        "name_cn": "莱菔子", "name_latin": "Raphanus sativus", "name_pinyin": "lai fu zi",
        "category": "消食药", "effects": "消食除胀，降气化痰",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Sulforaphene", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["饮食停滞", "大便秘结"],
    },
    {
        "name_cn": "鸡内金", "name_latin": "Gallus gallus domesticus", "name_pinyin": "ji nei jin",
        "category": "消食药", "effects": "健胃消食，涩精止遗",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Pepsin-like enzyme", "ob": 1.65, "dl": 0.4, "target_count": 8},
        ],
        "targets": ["PEPSIN", "AMY2A", "TNF"],
        "diseases": ["饮食积滞", "小儿疳积"],
    },
    {
        "name_cn": "木香", "name_latin": "Aucklandia lappa", "name_pinyin": "mu xiang",
        "category": "理气药", "effects": "行气止痛，健脾消食",
        "ob_percent": 2.95, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Costunolide", "ob": 3.65, "dl": 0.68, "target_count": 24},
            {"name": "Dehydrocostus lactone", "ob": 3.85, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "NFkB", "PTGS2", "AKT1"],
        "diseases": ["脾胃气滞", "泻痢后重"],
    },
    {
        "name_cn": "香附", "name_latin": "Cyperus rotundus", "name_pinyin": "xiang fu",
        "category": "理气药", "effects": "疏肝解郁，理气宽中",
        "ob_percent": 3.05, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Alpha-cyperone", "ob": 4.25, "dl": 0.7, "target_count": 26},
        ],
        "targets": ["OPRD1", "TNF", "PTGS2", "ESR1", "AKT1"],
        "diseases": ["肝郁气滞", "月经不调"],
    },
    {
        "name_cn": "乌药", "name_latin": "Lindera aggregata", "name_pinyin": "wu yao",
        "category": "理气药", "effects": "行气止痛，温肾散寒",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Linderalactone", "ob": 3.15, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "TRPV1"],
        "diseases": ["寒凝气滞", "胸腹胀痛"],
    },
    {
        "name_cn": "枳实", "name_latin": "Citrus aurantium", "name_pinyin": "zhi shi",
        "category": "理气药", "effects": "破气消积，化痰散痞",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Synephrine", "ob": 3.65, "dl": 0.58, "target_count": 18},
            {"name": "Naringenin", "ob": 4.08, "dl": 0.71, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MAPK1"],
        "diseases": ["食积停滞", "泻痢后重"],
    },
    {
        "name_cn": "山茱萸", "name_latin": "Cornus officinalis", "name_pinyin": "shan zhu yu",
        "category": "收涩药", "effects": "补益肝肾，收敛固涩",
        "ob_percent": 2.75, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Morroniside", "ob": 2.95, "dl": 0.6, "target_count": 18},
            {"name": "Loganin", "ob": 2.85, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "AKT1", "BCL2", "CASP3", "NFkBIA"],
        "diseases": ["腰膝酸痛", "遗精滑精"],
    },
]
