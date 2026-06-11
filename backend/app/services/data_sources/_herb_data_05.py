"""
中药材扩展数据 — 第 5 部分（共 6 部分）
清热解毒药（续） / 解表药 / 利水渗湿药（后半） / 止咳平喘药 / 温里药（后半） / 活血化瘀药（后半）
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_05 = [
    {
        "name_cn": "生地黄", "name_latin": "Rehmannia glutinosa", "name_pinyin": "sheng di huang",
        "category": "清热凉血药", "effects": "清热凉血，养阴生津",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Catalpol", "ob": 2.85, "dl": 0.62, "target_count": 20},
            {"name": "Acteoside", "ob": 3.15, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "ESR1", "AKT1", "TGF-beta1"],
        "diseases": ["热入营血", "阴虚发热"],
    },
    {
        "name_cn": "玄参", "name_latin": "Scrophularia ningpoensis", "name_pinyin": "xuan shen",
        "category": "清热凉血药", "effects": "清热凉血，滋阴降火",
        "ob_percent": 2.75, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Harpagoside C", "ob": 3.15, "dl": 0.58, "target_count": 18},
            {"name": "Angoroside C", "ob": 2.85, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MAPK14"],
        "diseases": ["热入营血", "咽喉肿痛"],
    },
    {
        "name_cn": "牡丹皮", "name_latin": "Paeonia suffruticosa", "name_pinyin": "mu dan pi",
        "category": "清热凉血药", "effects": "清热凉血，活血化瘀",
        "ob_percent": 3.15, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Paeoniflorin", "ob": 4.25, "dl": 0.72, "target_count": 28},
            {"name": "Paeonol", "ob": 3.35, "dl": 0.58, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "COX2", "NOS3"],
        "diseases": ["血热吐衄", "经闭痛经"],
    },
    {
        "name_cn": "赤芍", "name_latin": "Paeonia lactiflora var. rubra", "name_pinyin": "chi shao",
        "category": "清热凉血药", "effects": "清热凉血，散瘀止痛",
        "ob_percent": 3.25, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Paeoniflorin", "ob": 4.25, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "OPRM1"],
        "diseases": ["热入营血", "经闭痛经"],
    },
    {
        "name_cn": "紫草", "name_latin": "Lithospermum erythrorhizon", "name_pinyin": "zi cao",
        "category": "清热凉血药", "effects": "活血透疹，解毒疗疮",
        "ob_percent": 2.65, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Shikonin", "ob": 3.25, "dl": 0.58, "target_count": 18},
            {"name": "Acetylshikonin", "ob": 2.95, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "CASP3"],
        "diseases": ["斑疹不透", "水火烫伤"],
    },
    {
        "name_cn": "水牛角", "name_latin": "Bubalus bubalis", "name_pinyin": "shui niu jiao",
        "category": "清热凉血药", "effects": "清热凉血，解毒定惊",
        "ob_percent": 1.45, "dl_value": 0.35, "is_food_homology": False,
        "compounds": [
            {"name": "Amino acid complex", "ob": 2.35, "dl": 0.38, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "THBD"],
        "diseases": ["温病高热", "发斑神昏"],
    },
    {
        "name_cn": "银柴胡", "name_latin": "Stellaria dichotoma", "name_pinyin": "yin chai hu",
        "category": "清虚热药", "effects": "退虚热，清疳热",
        "ob_percent": 2.25, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Stellaroid A", "ob": 2.85, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["骨蒸潮热", "小儿疳热"],
    },
    {
        "name_cn": "胡黄连", "name_latin": "Picrorhiza kurroa", "name_pinyin": "hu huang lian",
        "category": "清虚热药", "effects": "退虚热，除疳热，清湿热",
        "ob_percent": 2.35, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Ferulic acid", "ob": 5.67, "dl": 0.56, "target_count": 42},
            {"name": "Vanillin", "ob": 3.45, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "SIRT1"],
        "diseases": ["骨蒸潮热", "小儿疳热"],
    },
    {
        "name_cn": "密蒙花", "name_latin": "Buddleja officinalis", "name_pinyin": "mi meng hua",
        "category": "清热明目药", "effects": "清热养肝，明目退翳",
        "ob_percent": 2.45, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Acacetin", "ob": 3.25, "dl": 0.62, "target_count": 16},
            {"name": "Linarin", "ob": 2.85, "dl": 0.55, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["目赤涩痛", "多泪羞明"],
    },
    {
        "name_cn": "青箱子", "name_latin": "Celosia argentea", "name_pinyin": "qing xiang zi",
        "category": "清热明目药", "effects": "清热泻火，明目退翳",
        "ob_percent": 2.35, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["目赤肿痛", "目生云翳"],
    },
    {
        "name_cn": "荷叶", "name_latin": "Nelumbo nucifera", "name_pinyin": "he ye",
        "category": "清热解暑药", "effects": "消暑升阳，健脾升阳",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Nuciferine", "ob": 3.15, "dl": 0.55, "target_count": 16},
            {"name": "Rutin", "ob": 3.52, "dl": 0.68, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "PPARG"],
        "diseases": ["暑热烦渴", "脾虚泄泻"],
    },
    {
        "name_cn": "熟地黄", "name_latin": "Rehmannia glutinosa praeparata", "name_pinyin": "shu di huang",
        "category": "补血药", "effects": "补血滋阴，益精填髓",
        "ob_percent": 2.65, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Catalpol", "ob": 2.85, "dl": 0.62, "target_count": 20},
            {"name": "Acteoside", "ob": 3.15, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "ESR1", "AKT1"],
        "diseases": ["血虚萎黄", "月经不调"],
    },
    {
        "name_cn": "白芍", "name_latin": "Paeonia lactiflora", "name_pinyin": "bai shao",
        "category": "补血药", "effects": "养血调经，敛阴止汗",
        "ob_percent": 3.15, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Paeoniflorin", "ob": 4.25, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "ESR1"],
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
        "name_cn": "浮萍", "name_latin": "Lemna minor", "name_pinyin": "fu ping",
        "category": "解表药", "effects": "发汗解表，透疹止痒",
        "ob_percent": 2.35, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Luteolin-7-glucuronide", "ob": 3.25, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["风热感冒", "麻疹不透"],
    },
    {
        "name_cn": "胡荽", "name_latin": "Coriandrum sativum", "name_pinyin": "hu sui",
        "category": "解表药", "effects": "发表透疹，健胃消食",
        "ob_percent": 2.65, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Linalool", "ob": 3.25, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["麻疹不透", "饮食不振"],
    },
    {
        "name_cn": "月季花", "name_latin": "Rosa chinensis", "name_pinyin": "yue ji hua",
        "category": "活血化瘀药", "effects": "活血调经，疏肝解郁",
        "ob_percent": 2.25, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Quercitrin", "ob": 3.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "PTGS2", "ESR1"],
        "diseases": ["月经不齐", "跌打损伤"],
    },
    {
        "name_cn": "泽兰", "name_latin": "Lycopus lucidus", "name_pinyin": "ze lan",
        "category": "活血化瘀药", "effects": "活血调经，利水消肿",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Ursolic acid", "ob": 3.95, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["月经不调", "水肿"],
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
        "name_cn": "枇杷叶", "name_latin": "Eriobotrya japonica", "name_pinyin": "pi pa ye",
        "category": "止咳平喘药", "effects": "清肺止咳，降逆止呕",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Ursolic acid", "ob": 3.95, "dl": 0.75, "target_count": 30},
            {"name": "Rosmarinic acid", "ob": 3.45, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "MUC5AC"],
        "diseases": ["肺热咳嗽", "胃热呕吐"],
    },
    {
        "name_cn": "桑白皮", "name_latin": "Morus alba", "name_pinyin": "sang bai pi",
        "category": "止咳平喘药", "effects": "泻肺平喘，利水消肿",
        "ob_percent": 2.35, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Morusin", "ob": 2.85, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AQP1"],
        "diseases": ["肺热喘咳", "水肿胀满"],
    },
    {
        "name_cn": "葶苈子", "name_latin": "Descurainia sophia", "name_pinyin": "ting li zi",
        "category": "止咳平喘药", "effects": "泻肺平喘，行水消肿",
        "ob_percent": 2.25, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Descuramin", "ob": 2.85, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["痰涎壅盛", "水肿胀满"],
    },
    {
        "name_cn": "白果", "name_latin": "Ginkgo biloba", "name_pinyin": "bai guo",
        "category": "止咳平喘药", "effects": "敛肺化痰平喘，止带缩尿",
        "ob_percent": 2.15, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Ginkgolide B", "ob": 3.25, "dl": 0.72, "target_count": 24},
            {"name": "Bilobalide", "ob": 3.05, "dl": 0.7, "target_count": 22},
        ],
        "targets": ["PAF", "TNF", "IL6", "PTGS2"],
        "diseases": ["痰多喘咳", "带下白浊"],
    },
    {
        "name_cn": "罗汉果", "name_latin": "Siraitia grosvenorii", "name_pinyin": "luo han guo",
        "category": "止咳平喘药", "effects": "清热润肺，利咽开音",
        "ob_percent": 2.65, "dl_value": 0.55, "is_food_homology": True,
        "compounds": [
            {"name": "Mogroside V", "ob": 2.85, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["肺热咳嗽", "失音"],
    },
    {
        "name_cn": "佛手", "name_latin": "Citrus medica var. sarcodactylis", "name_pinyin": "fo shou",
        "category": "理气药", "effects": "疏肝理气，和胃止痛",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Limonene", "ob": 3.15, "dl": 0.48, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "TRPV1"],
        "diseases": ["肝郁气滞", "胃痛胸闷"],
    },
    {
        "name_cn": "香橼", "name_latin": "Citrus medica", "name_pinyin": "xiang yuan",
        "category": "理气药", "effects": "疏肝理气，宽中化痰",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Limonene", "ob": 3.15, "dl": 0.48, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "TRPV1"],
        "diseases": ["肝郁气滞", "痰饮胸闷"],
    },
    {
        "name_cn": "玫瑰花", "name_latin": "Rosa rugosa", "name_pinyin": "mei gui hua",
        "category": "理气药", "effects": "行气解郁，和血止痛",
        "ob_percent": 2.25, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Quercetin-3-O-glucoside", "ob": 3.25, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["TNF", "PTGS2", "MAOA"],
        "diseases": ["肝胃不和", "月经不调"],
    },
    {
        "name_cn": "绿萼梅", "name_latin": "Prunus mume", "name_pinyin": "lv e mei",
        "category": "理气药", "effects": "疏肝理气，和中化痰",
        "ob_percent": 2.15, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Amygdalin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "PTGS2", "MAOA"],
        "diseases": ["肝郁痰滞", "咽部异物感"],
    },
    {
        "name_cn": "甘松", "name_latin": "Nardostachys jatamansi", "name_pinyin": "gan song",
        "category": "理气药", "effects": "理气止痛，醒脾健胃",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Jatamansone", "ob": 3.15, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "GABRA1"],
        "diseases": ["气滞胸闷", "脘腹胀痛"],
    },
    {
        "name_cn": "九香虫", "name_latin": "Aspongopus chinensis", "name_pinyin": "jiu xiang chong",
        "category": "理气药", "effects": "理气止痛，温中助阳",
        "ob_percent": 2.15, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Cantharidin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "PTGS2", "TRPV1"],
        "diseases": ["气滞血瘀疼痛", "胸痹心痛"],
    },
    {
        "name_cn": "神曲", "name_latin": "Massa fermentata", "name_pinyin": "shen qu",
        "category": "消食药", "effects": "消食和胃",
        "ob_percent": 2.35, "dl_value": 0.5, "is_food_homology": True,
        "compounds": [
            {"name": "Amylase enzyme", "ob": 2.15, "dl": 0.4, "target_count": 8},
        ],
        "targets": ["AMY2A", "PEPSIN", "TNF"],
        "diseases": ["饮食积滞"],
    },
    {
        "name_cn": "麦芽", "name_latin": "Hordeum vulgare", "name_pinyin": "mai ya",
        "category": "消食药", "effects": "行气消食，健脾开胃",
        "ob_percent": 2.25, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Amylase enzyme", "ob": 2.15, "dl": 0.4, "target_count": 8},
        ],
        "targets": ["AMY2A", "PEPSIN", "TNF"],
        "diseases": ["米面薯芋积滞"],
    },
    {
        "name_cn": "谷芽", "name_latin": "Setaria italica", "name_pinyin": "gu ya",
        "category": "消食药", "effects": "消食和中，健脾开胃",
        "ob_percent": 2.15, "dl_value": 0.45, "is_food_homology": True,
        "compounds": [
            {"name": "Starch-digesting enzyme", "ob": 1.85, "dl": 0.38, "target_count": 6},
        ],
        "targets": ["AMY2A", "PEPSIN", "TNF"],
        "diseases": ["米面积滞"],
    },
    {
        "name_cn": "稻芽", "name_latin": "Oryza sativa", "name_pinyin": "dao ya",
        "category": "消食药", "effects": "消食和中，健脾开胃",
        "ob_percent": 2.05, "dl_value": 0.42, "is_food_homology": True,
        "compounds": [
            {"name": "Starch-digesting enzyme", "ob": 1.85, "dl": 0.38, "target_count": 6},
        ],
        "targets": ["AMY2A", "PEPSIN", "TNF"],
        "diseases": ["米面积滞"],
    },
    {
        "name_cn": "玉米须", "name_latin": "Zea mays", "name_pinyin": "yu mi xu",
        "category": "利水渗湿药", "effects": "利水消肿",
        "ob_percent": 1.25, "dl_value": 0.32, "is_food_homology": True,
        "compounds": [
            {"name": "Polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 8},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["水肿小便不利"],
    },
    {
        "name_cn": "葫芦", "name_latin": "Lagenaria siceraria", "name_pinyin": "hu lu",
        "category": "利水渗湿药", "effects": "利水消肿",
        "ob_percent": 1.55, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Triterpene saponin", "ob": 2.15, "dl": 0.48, "target_count": 10},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["水肿腹胀"],
    },
    {
        "name_cn": "香加皮", "name_latin": "Periploca sepium", "name_pinyin": "xiang jia pi",
        "category": "利水渗湿药", "effects": "利水消肿，祛风湿",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Periplocin", "ob": 2.65, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "SCN5A"],
        "diseases": ["下肢水肿", "风湿痹痛"],
    },
    {
        "name_cn": "地肤子", "name_latin": "Kochia scoparia", "name_pinyin": "di fu zi",
        "category": "利水渗湿药", "effects": "利尿通淋，止痒",
        "ob_percent": 1.85, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Momordin Ic", "ob": 3.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "TRPV1"],
        "diseases": ["淋证水肿", "皮肤瘙痒"],
    },
    {
        "name_cn": "海金沙", "name_latin": "Lygodium japonicum", "name_pinyin": "hai jin sha",
        "category": "利水渗湿药", "effects": "利水通淋，止痛",
        "ob_percent": 1.95, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Demethylcornovbrin", "ob": 2.85, "dl": 0.52, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "TRPV1"],
        "diseases": ["热淋涩痛", "砂石淋证"],
    },
    {
        "name_cn": "石韦", "name_latin": "Pyrrosia lingua", "name_pinyin": "shi wei",
        "category": "利水渗湿药", "effects": "利尿通淋，清肺止咳",
        "ob_percent": 2.15, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Ecdysterone", "ob": 3.15, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["热淋血淋", "肺热咳嗽"],
    },
    {
        "name_cn": "冬葵子", "name_latin": "Malva verticillata", "name_pinyin": "dong kui zi",
        "category": "利水渗湿药", "effects": "利水通淋，下乳",
        "ob_percent": 1.65, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 8},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["水肿淋证", "乳汁不通"],
    },
    {
        "name_cn": "灯心草", "name_latin": "Juncus effusus", "name_pinyin": "deng xin cao",
        "category": "利水渗湿药", "effects": "利水通淋，清心降火",
        "ob_percent": 1.15, "dl_value": 0.28, "is_food_homology": False,
        "compounds": [
            {"name": "Juncusol", "ob": 2.35, "dl": 0.45, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "GABRA1"],
        "diseases": ["热淋", "心烦不眠"],
    },
    {
        "name_cn": "茵陈", "name_latin": "Artemisia capillaris", "name_pinyin": "yin chen",
        "category": "利水渗湿药", "effects": "利湿退黄，解毒疗疮",
        "ob_percent": 3.15, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Capillarisin", "ob": 3.85, "dl": 0.65, "target_count": 24},
            {"name": "Scoparone", "ob": 3.15, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "FXR"],
        "diseases": ["黄疸尿少", "湿疹瘙痒"],
    },
    {
        "name_cn": "金钱草", "name_latin": "Desmodium styracifolium", "name_pinyin": "jin qian cao",
        "category": "利水渗湿药", "effects": "利湿退黄，利尿通淋",
        "ob_percent": 2.75, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Desmodium saponin IX", "ob": 2.85, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["结石淋痛", "湿热黄疸"],
    },
]
