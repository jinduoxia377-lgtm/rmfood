"""
中药材扩展数据 — 第 2 部分（共 6 部分）
活血化瘀药（中段） / 止血药 / 消食药 / 开窍药 / 安神药
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_02 = [
    {
        "name_cn": "灵芝", "name_latin": "Ganoderma lucidum", "name_pinyin": "ling zhi",
        "category": "安神药", "effects": "补气安神，止咳平喘",
        "ob_percent": 2.75, "dl_value": 0.72, "is_food_homology": True,
        "compounds": [
            {"name": "Ganoderic acid A", "ob": 3.25, "dl": 0.72, "target_count": 22},
            {"name": "Lucidenic acid N", "ob": 2.85, "dl": 0.65, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "AKT1", "TP53", "PTGS2"],
        "diseases": ["心神不宁", "肺虚咳喘"],
    },
    {
        "name_cn": "朱砂", "name_latin": "Cinnabaris", "name_pinyin": "zhu sha",
        "category": "安神药", "effects": "镇心安神，清热解毒，明目",
        "ob_percent": 0.85, "dl_value": 0.35, "is_food_homology": False,
        "compounds": [
            {"name": "Mercuric sulfide", "ob": 0.65, "dl": 0.28, "target_count": 5},
        ],
        "targets": ["GABRA1", "NR3C1"],
        "diseases": ["心悸易惊", "失眠多梦"],
    },
    {
        "name_cn": "琥珀", "name_latin": "Succinum", "name_pinyin": "hu po",
        "category": "安神药", "effects": "镇惊安神，活血散瘀",
        "ob_percent": 1.55, "dl_value": 0.4, "is_food_homology": False,
        "compounds": [
            {"name": "Succinic acid", "ob": 2.85, "dl": 0.45, "target_count": 12},
        ],
        "targets": ["GABRA1", "TNF", "PTGS2"],
        "diseases": ["心悸失眠", "癃闭淋证"],
    },
    {
        "name_cn": "磁石", "name_latin": "Magnetitum", "name_pinyin": "ci shi",
        "category": "安神药", "effects": "镇惊安神，平肝潜阳，聪耳明目",
        "ob_percent": 0.65, "dl_value": 0.28, "is_food_homology": False,
        "compounds": [
            {"name": "Ferrous ferric oxide", "ob": 0.35, "dl": 0.18, "target_count": 3},
        ],
        "targets": ["GABRA1", "GRIN2B"],
        "diseases": ["心神不宁", "耳鸣耳聋"],
    },
    {
        "name_cn": "石决明", "name_latin": "Haliotis diversicolor", "name_pinyin": "shi jue ming",
        "category": "平肝息风药", "effects": "平肝潜阳，清肝明目",
        "ob_percent": 1.25, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Calcium carbonate", "ob": 1.15, "dl": 0.28, "target_count": 8},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["头痛眩晕", "目赤翳障"],
    },
    {
        "name_cn": "珍珠母", "name_latin": "Pteria margaritifera", "name_pinyin": "zhen zhu mu",
        "category": "平肝息风药", "effects": "平肝潜阳，安神定惊",
        "ob_percent": 1.15, "dl_value": 0.35, "is_food_homology": False,
        "compounds": [
            {"name": "Calcium carbonate", "ob": 1.15, "dl": 0.28, "target_count": 8},
        ],
        "targets": ["GABRA1", "TNF", "IL6"],
        "diseases": ["头痛眩晕", "失眠心悸"],
    },
    {
        "name_cn": "代赭石", "name_latin": "Hematite", "name_pinyin": "dai zhe shi",
        "category": "平肝息风药", "effects": "平肝潜阳，重镇降逆",
        "ob_percent": 0.75, "dl_value": 0.22, "is_food_homology": False,
        "compounds": [
            {"name": "Ferric oxide", "ob": 0.45, "dl": 0.18, "target_count": 3},
        ],
        "targets": ["TNF", "PTGS2"],
        "diseases": ["头痛眩晕", "呕吐呃逆"],
    },
    {
        "name_cn": "刺蒺藜", "name_latin": "Tribulus terrestris", "name_pinyin": "ci ji li",
        "category": "平肝息风药", "effects": "平肝解郁，活血祛风",
        "ob_percent": 3.35, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Tribuloside A", "ob": 3.85, "dl": 0.65, "target_count": 20},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "NOS3"],
        "diseases": ["头痛眩晕", "皮肤瘙痒"],
    },
    {
        "name_cn": "罗布麻叶", "name_latin": "Apocynum venetum", "name_pinyin": "luo bu ma ye",
        "category": "平肝息风药", "effects": "平肝安神，清热利水",
        "ob_percent": 2.85, "dl_value": 0.6, "is_food_homology": True,
        "compounds": [
            {"name": "Apocynoside I", "ob": 2.65, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["ACE", "TNF", "GABRA1", "KCNH2"],
        "diseases": ["高血压病", "头晕目眩"],
    },
    {
        "name_cn": "牛黄", "name_latin": "Bovis Calculus", "name_pinyin": "niu huang",
        "category": "平肝息风药", "effects": "清心豁痰，开窍醒神",
        "ob_percent": 2.15, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Cholic acid", "ob": 2.85, "dl": 0.52, "target_count": 14},
            {"name": "Bilirubin", "ob": 1.85, "dl": 0.38, "target_count": 8},
        ],
        "targets": ["TNF", "NFkB", "FXR", "GPBAR1", "CASP3"],
        "diseases": ["热病神昏", "小儿惊风"],
    },
    {
        "name_cn": "地龙", "name_latin": "Pheretima aspergillum", "name_pinyin": "di long",
        "category": "平肝息风药", "effects": "清热定惊，通络利尿",
        "ob_percent": 2.45, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Lumbrokinase", "ob": 2.15, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["FIBRINOGEN", "PLAT", "TNF", "MMP9"],
        "diseases": ["痉挛抽搐", "半身不遂"],
    },
    {
        "name_cn": "全蝎", "name_latin": "Buthus martensii", "name_pinyin": "quan xie",
        "category": "平肝息风药", "effects": "息风镇痉，通络止痛",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Buthotoxin", "ob": 1.65, "dl": 0.45, "target_count": 10},
        ],
        "targets": ["SCN9A", "CACNA1A", "GRIN2B", "TNF"],
        "diseases": ["痉挛抽搐", "风湿顽痹"],
    },
    {
        "name_cn": "蜈蚣", "name_latin": "Scolopendra subspinipes mutilans", "name_pinyin": "wu gong",
        "category": "平肝息风药", "effects": "息风镇痉，通络止痛",
        "ob_percent": 1.65, "dl_value": 0.45, "is_food_homology": False,
        "compounds": [
            {"name": "Scolopendrin I", "ob": 1.45, "dl": 0.4, "target_count": 7},
        ],
        "targets": ["SCN9A", "TRPV1", "TNF"],
        "diseases": ["痉挛抽搐", "中风面瘫"],
    },
    {
        "name_cn": "僵蚕", "name_latin": "Bombyx batryticatus", "name_pinyin": "jiang can",
        "category": "平肝息风药", "effects": "息风止痉，祛风止痛",
        "ob_percent": 2.15, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Beauvericin", "ob": 2.45, "dl": 0.55, "target_count": 13},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "CASP3"],
        "diseases": ["肝风内动", "咽喉肿痛"],
    },
    {
        "name_cn": "红花", "name_latin": "Carthamus tinctorius", "name_pinyin": "hong hua",
        "category": "活血化瘀药", "effects": "活血通经，散瘀止痛",
        "ob_percent": 3.65, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Hydroxysafflor yellow A", "ob": 4.25, "dl": 0.72, "target_count": 28},
            {"name": "Safflower yellow", "ob": 3.85, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK1", "VEGFA", "NOS3"],
        "diseases": ["经闭痛经", "胸痹心痛"],
    },
    {
        "name_cn": "桃仁", "name_latin": "Prunus persica", "name_pinyin": "tao ren",
        "category": "活血化瘀药", "effects": "活血祛瘀，润肠通便，止咳平喘",
        "ob_percent": 2.95, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Amygdalin", "ob": 3.25, "dl": 0.62, "target_count": 18},
            {"name": "Eriodictyol-7-O-glucoside", "ob": 3.75, "dl": 0.68, "target_count": 22},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "BCL2", "CASP9"],
        "diseases": ["经闭痛经", "肺痈肠痈"],
    },
    {
        "name_cn": "川芎", "name_latin": "Ligusticum chuanxiong", "name_pinyin": "chuan xiong",
        "category": "活血化瘀药", "effects": "行气活血，祛风止痛",
        "ob_percent": 3.35, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Ligustilide", "ob": 2.38, "dl": 0.65, "target_count": 25},
            {"name": "Ferulic acid", "ob": 5.67, "dl": 0.56, "target_count": 42},
        ],
        "targets": ["PTGS2", "TNF", "ESR1", "AKT1", "MAPK3", "IL6"],
        "diseases": ["头痛", "月经不调"],
    },
    {
        "name_cn": "乳香", "name_latin": "Boswellia carterii", "name_pinyin": "ru xiang",
        "category": "活血化瘀药", "effects": "活血定痛，消肿生肌",
        "ob_percent": 2.75, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Boswellic acid", "ob": 3.85, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "NFkB", "5-LOX", "PTGS2"],
        "diseases": ["跌打损伤", "气滞血瘀"],
    },
    {
        "name_cn": "没药", "name_latin": "Commiphora myrrha", "name_pinyin": "mo yao",
        "category": "活血化瘀药", "effects": "散瘀定痛，消肿生肌",
        "ob_percent": 2.65, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Commiphoric acid", "ob": 3.25, "dl": 0.68, "target_count": 20},
            {"name": "Guggulsterone", "ob": 3.65, "dl": 0.7, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "FXR", "PPARG", "PTGS2"],
        "diseases": ["胸腹诸痛", "痈疮肿毒"],
    },
    {
        "name_cn": "姜黄", "name_latin": "Curcuma longa", "name_pinyin": "jiang huang",
        "category": "活血化瘀药", "effects": "破血行气，通经止痛",
        "ob_percent": 3.85, "dl_value": 0.78, "is_food_homology": True,
        "compounds": [
            {"name": "Curcumin", "ob": 4.05, "dl": 0.82, "target_count": 42},
            {"name": "Demethoxycurcumin", "ob": 3.85, "dl": 0.78, "target_count": 36},
        ],
        "targets": ["TNF", "NFkB", "IL6", "STAT3", "AKT1", "PTGS2"],
        "diseases": ["胸胁刺痛", "风湿痹痛"],
    },
    {
        "name_cn": "莪术", "name_latin": "Curcuma zedoaria", "name_pinyin": "e zhu",
        "category": "活血化瘀药", "effects": "破血行气，消积止痛",
        "ob_percent": 2.95, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Curcumol", "ob": 3.25, "dl": 0.62, "target_count": 18},
            {"name": "Curdione", "ob": 3.45, "dl": 0.65, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "CASP3", "BCL2", "PTGS2"],
        "diseases": ["癥瘕积聚", "血瘀经闭"],
    },
    {
        "name_cn": "三棱", "name_latin": "Sparganium stoloniferum", "name_pinyin": "san leng",
        "category": "活血化瘀药", "effects": "破血行气，消积止痛",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Spaglumin", "ob": 2.25, "dl": 0.5, "target_count": 10},
        ],
        "targets": ["TNF", "PTGS2", "AKT1"],
        "diseases": ["癥瘕痞块", "痛经经闭"],
    },
    {
        "name_cn": "益母草", "name_latin": "Leonurus japonicus", "name_pinyin": "yi mu cao",
        "category": "活血化瘀药", "effects": "活血调经，利尿消肿",
        "ob_percent": 3.15, "dl_value": 0.65, "is_food_homology": True,
        "compounds": [
            {"name": "Leonurine", "ob": 4.25, "dl": 0.72, "target_count": 28},
            {"name": "Stachydrine", "ob": 3.85, "dl": 0.65, "target_count": 22},
        ],
        "targets": ["TNF", "PTGS2", "AKT1", "ESR1", "NOS3"],
        "diseases": ["月经不调", "产后恶露不尽"],
    },
    {
        "name_cn": "牛膝", "name_latin": "Achyranthes bidentata", "name_pinyin": "niu xi",
        "category": "活血化瘀药", "effects": "逐瘀通经，补肝肾强筋骨",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.72, "target_count": 28},
            {"name": "Inokosterone", "ob": 2.65, "dl": 0.58, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "MMP13", "ALP", "RUNX2"],
        "diseases": ["经闭痛经", "腰膝酸痛"],
    },
    {
        "name_cn": "鸡血藤", "name_latin": "Spatholobus suberectus", "name_pinyin": "ji xue teng",
        "category": "活血化瘀药", "effects": "补血活血，调经止痛",
        "ob_percent": 2.65, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Formononetin", "ob": 4.31, "dl": 0.22, "target_count": 22},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["ESR1", "ERBB2", "TNF", "IL6", "AKT1"],
        "diseases": ["月经不调", "麻木瘫痪"],
    },
    {
        "name_cn": "王不留行", "name_latin": "Vaccaria segetalis", "name_pinyin": "wang bu liu xing",
        "category": "活血化瘀药", "effects": "活血通经，下乳消肿",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Vaccarin", "ob": 3.15, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["ESR1", "PRLR", "TNF", "PTGS2"],
        "diseases": ["经闭不通", "乳汁不下"],
    },
    {
        "name_cn": "穿山甲", "name_latin": "Manis pentadactyla", "name_pinyin": "chuan shan jia",
        "category": "活血化瘀药", "effects": "活血消癥，通经下乳",
        "ob_percent": 1.85, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Keratin", "ob": 1.25, "dl": 0.32, "target_count": 5},
        ],
        "targets": ["TNF", "IL6", "MMP9", "VEGFA"],
        "diseases": ["癥瘕积聚", "乳汁不通"],
    },
    {
        "name_cn": "水蛭", "name_latin": "Whitmania pigra", "name_pinyin": "shui zhi",
        "category": "活血化瘀药", "effects": "破血通经，逐瘀消癥",
        "ob_percent": 1.65, "dl_value": 0.48, "is_food_homology": False,
        "compounds": [
            {"name": "Hirudin", "ob": 1.85, "dl": 0.52, "target_count": 10},
        ],
        "targets": ["THRB", "FIBRINOGEN", "PLAT", "MMP9"],
        "diseases": ["血瘀经闭", "中风偏瘫"],
    },
    {
        "name_cn": "土鳖虫", "name_latin": "Eupolyphaga sinensis", "name_pinyin": "tu bie chong",
        "category": "活血化瘀药", "effects": "破血逐瘀，续筋接骨",
        "ob_percent": 1.55, "dl_value": 0.42, "is_food_homology": False,
        "compounds": [
            {"name": "Eupolypherat peptide", "ob": 1.35, "dl": 0.4, "target_count": 7},
        ],
        "targets": ["TNF", "IL6", "MMP9", "VEGFA"],
        "diseases": ["跌打损伤", "筋伤骨折"],
    },
    {
        "name_cn": "自然铜", "name_latin": "Pyritum", "name_pinyin": "zi ran tong",
        "category": "活血化瘀药", "effects": "散瘀止痛，续筋接骨",
        "ob_percent": 0.75, "dl_value": 0.22, "is_food_homology": False,
        "compounds": [
            {"name": "Iron disulfide", "ob": 0.45, "dl": 0.18, "target_count": 3},
        ],
        "targets": ["BMP2", "ALP", "RUNX2"],
        "diseases": ["跌打骨折", "创伤出血"],
    },
    {
        "name_cn": "苏木", "name_latin": "Caesalpinia sappan", "name_pinyin": "su mu",
        "category": "活血化瘀药", "effects": "活血祛瘀，消肿止痛",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Brazilin", "ob": 3.25, "dl": 0.62, "target_count": 20},
            {"name": "Sappanchalcone A", "ob": 3.85, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "CASP3", "BCL2"],
        "diseases": ["跌打损伤", "心腹疼痛"],
    },
    {
        "name_cn": "骨碎补", "name_latin": "Drynaria fortunei", "name_pinyin": "gu sui bu",
        "category": "活血化瘀药", "effects": "疗伤止痛，补肾强骨",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Naringenin", "ob": 4.08, "dl": 0.71, "target_count": 30},
            {"name": "Erianin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["BMP2", "RUNX2", "TNF", "VEGFA"],
        "diseases": ["跌打闪挫", "肾虚腰痛"],
    },
    {
        "name_cn": "刘寄奴", "name_latin": "Artemisia anomala", "name_pinyin": "li ji nu",
        "category": "活血化瘀药", "effects": "散瘀止痛，疗伤止血",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Capillarin", "ob": 3.45, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["跌打损伤", "外伤出血"],
    },
    {
        "name_cn": "月季花", "name_latin": "Rosa chinensis", "name_pinyin": "yue ji hua",
        "category": "活血化瘀药", "effects": "活血调经，疏肝解郁",
        "ob_percent": 2.25, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Quercitrin", "ob": 3.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "PTGS2", "ESR1"],
        "diseases": ["月经不调", "跌打损伤"],
    },
    {
        "name_cn": "泽兰", "name_latin": "Lycopus lucidus", "name_pinyin": "ze lan",
        "category": "活血化瘀药", "effects": "活血调经，利水消肿",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Ursolic acid", "ob": 3.95, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "ESR1"],
        "diseases": ["月经不调", "水肿"],
    },
    {
        "name_cn": "延胡索", "name_latin": "Corydalis yanhusuo", "name_pinyin": "yan huo suo",
        "category": "活血化瘀药", "effects": "活血，行气，止痛",
        "ob_percent": 3.45, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Tetrahydropalmatine", "ob": 4.25, "dl": 0.72, "target_count": 28},
            {"name": "Corydaline", "ob": 3.65, "dl": 0.65, "target_count": 22},
        ],
        "targets": ["OPRD1", "OPRM1", "TNF", "IL6", "PTGS2"],
        "diseases": ["气血瘀滞疼痛", "跌打肿痛"],
    },
    {
        "name_cn": "郁金", "name_latin": "Curcuma aromatica", "name_pinyin": "yu jin",
        "category": "活血化瘀药", "effects": "活血止痛，行气解郁",
        "ob_percent": 2.95, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Curcumin", "ob": 4.05, "dl": 0.82, "target_count": 42},
            {"name": "Germacrone", "ob": 3.25, "dl": 0.58, "target_count": 18},
        ],
        "targets": ["TNF", "IL6", "STAT3", "AKT1", "PTGS2", "BCL2"],
        "diseases": ["胸胁刺痛", "黄疸尿赤"],
    },
    {
        "name_cn": "白及", "name_latin": "Bletilla striata", "name_pinyin": "bai ji",
        "category": "止血药", "effects": "收敛止血，消肿生肌",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Bletillin A", "ob": 2.85, "dl": 0.62, "target_count": 16},
            {"name": "Dihydrophenanthrene", "ob": 3.15, "dl": 0.58, "target_count": 15},
        ],
        "targets": ["TNF", "IL6", "TGF-beta1", "COL1A1"],
        "diseases": ["咯血吐血", "外伤出血"],
    },
    {
        "name_cn": "仙鹤草", "name_latin": "Agrimonia pilosa", "name_pinyin": "xian he cao",
        "category": "止血药", "effects": "收敛止血，截疟止痢",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Agrimonin", "ob": 3.25, "dl": 0.62, "target_count": 20},
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "CASP3"],
        "diseases": ["咯血吐血", "崩漏下血"],
    },
    {
        "name_cn": "蒲黄", "name_latin": "Typha angustifolia", "name_pinyin": "pu huang",
        "category": "止血药", "effects": "止血，化瘀，通淋",
        "ob_percent": 2.75, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Typhaneoside", "ob": 3.15, "dl": 0.62, "target_count": 18},
            {"name": "Beta-sitosterol", "ob": 3.15, "dl": 0.75, "target_count": 32},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "NOS3", "VEGFA"],
        "diseases": ["吐血衄血", "经闭痛经"],
    },
    {
        "name_cn": "艾叶", "name_latin": "Artemisia argyi", "name_pinyin": "ai ye",
        "category": "止血药", "effects": "温经止血，散寒调经",
        "ob_percent": 3.05, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Eupatilin", "ob": 4.15, "dl": 0.7, "target_count": 26},
            {"name": "Artemisinin", "ob": 5.42, "dl": 0.62, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "ESR1", "COX2"],
        "diseases": ["崩漏下血", "月经不调"],
    },
    {
        "name_cn": "地榆", "name_latin": "Sanguisorba officinalis", "name_pinyin": "di yu",
        "category": "止血药", "effects": "凉血止血，解毒敛疮",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Ziyuglycoside I", "ob": 3.25, "dl": 0.65, "target_count": 20},
            {"name": "Ellagic acid", "ob": 3.45, "dl": 0.52, "target_count": 22},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "NFkBIA"],
        "diseases": ["便血痔血", "水火烫伤"],
    },
    {
        "name_cn": "槐花", "name_latin": "Sophora japonica", "name_pinyin": "huai hua",
        "category": "止血药", "effects": "凉血止血，清肝泻火",
        "ob_percent": 3.25, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Rutin", "ob": 3.52, "dl": 0.68, "target_count": 28},
            {"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "ESR1", "NOS3"],
        "diseases": ["便血痔血", "头痛目赤"],
    },
    {
        "name_cn": "侧柏叶", "name_latin": "Platycladus orientalis", "name_pinyin": "ce bai ye",
        "category": "止血药", "effects": "凉血止血，化痰止咳",
        "ob_percent": 2.95, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Myricitrin", "ob": 3.65, "dl": 0.65, "target_count": 24},
            {"name": "Amentoflavone", "ob": 3.25, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["PTGS2", "TNF", "AKT1", "MAPK1", "WNT10B"],
        "diseases": ["咯血吐血", "肺热咳嗽"],
    },
    {
        "name_cn": "茜草", "name_latin": "Rubia cordifolia", "name_pinyin": "qian cao",
        "category": "止血药", "effects": "凉血祛瘀，止血通经",
        "ob_percent": 2.75, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Ruberythric acid", "ob": 2.85, "dl": 0.55, "target_count": 16},
            {"name": "Purpurin", "ob": 2.95, "dl": 0.58, "target_count": 15},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "THBD"],
        "diseases": ["出血证", "瘀阻经闭"],
    },
    {
        "name_cn": "苎麻根", "name_latin": "Boehmeria nivea", "name_pinyin": "zhu ma gen",
        "category": "止血药", "effects": "凉血止血，安胎",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": True,
        "compounds": [
            {"name": "Chlorogenic acid", "ob": 5.32, "dl": 0.45, "target_count": 38},
            {"name": "Rutin", "ob": 3.52, "dl": 0.68, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["出血证", "胎动不安"],
    },
]
