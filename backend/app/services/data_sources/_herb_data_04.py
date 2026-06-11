"""
中药材扩展数据 — 第 4 部分（共 6 部分）
祛风湿药（中段） / 外用药 / 化痰止咳药 / 清虚热药 / 清热明目药 / 清热解暑药 / 化痰止咳平喘药 / 清热解毒药（前半）
本文件由 expand_herbs.py 拆分而来，仅供内部组装使用。
外部请直接导入 expand_herbs.EXPANDED_HERBS。
"""

_HERBS_PART_04 = [
    {
        "name_cn": "五味子", "name_latin": "Schisandra chinensis", "name_pinyin": "wu wei zi",
        "category": "收涩药", "effects": "收敛固涩，益气生津",
        "ob_percent": 3.15, "dl_value": 0.7, "is_food_homology": True,
        "compounds": [
            {"name": "Schisandrin A", "ob": 4.25, "dl": 0.78, "target_count": 30},
            {"name": "Schisantherin A", "ob": 3.65, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "CYP3A4", "GABRA1", "SIRT1", "NOS2"],
        "diseases": ["久咳虚喘", "自汗盗汗"],
    },
    {
        "name_cn": "乌梅", "name_latin": "Prunus mume", "name_pinyin": "wu mei",
        "category": "收涩药", "effects": "敛肺涩肠，生津安蛔",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Citric acid", "ob": 3.65, "dl": 0.38, "target_count": 12},
            {"name": "Umbelliferone", "ob": 3.45, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NOS2"],
        "diseases": ["肺虚久咳", "蛔厥呕吐腹痛"],
    },
    {
        "name_cn": "连翘", "name_latin": "Forsythia suspensa", "name_pinyin": "lian qiao",
        "category": "清热解毒药", "effects": "清热解毒，消肿散结",
        "ob_percent": 3.35, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Phillyrin", "ob": 3.15, "dl": 0.6, "target_count": 18},
            {"name": "Rutin", "ob": 3.52, "dl": 0.68, "target_count": 28},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "AKT1", "MAPK1", "NFkBIA"],
        "diseases": ["痈肿疮毒", "痰核瘰疬"],
    },
    {
        "name_cn": "板蓝根", "name_latin": "Isatis tinctoria", "name_pinyin": "ban lan gen",
        "category": "清热解毒药", "effects": "清热解毒，凉血利咽",
        "ob_percent": 3.05, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Indirubin", "ob": 3.85, "dl": 0.72, "target_count": 26},
            {"name": "Epibrassicsterol", "ob": 3.15, "dl": 0.72, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "STAT3", "AKT1", "BCL2"],
        "diseases": ["温疫时毒", "咽喉肿痛"],
    },
    {
        "name_cn": "大青叶", "name_latin": "Isatis indigotica", "name_pinyin": "da qing ye",
        "category": "清热解毒药", "effects": "清热解毒，凉血消斑",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Indigo naturalis", "ob": 2.65, "dl": 0.55, "target_count": 16},
            {"name": "Indirubin", "ob": 3.85, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "STAT3", "CDK"],
        "diseases": ["热入营血", "温毒发斑"],
    },
    {
        "name_cn": "青黛", "name_latin": "Indigo Naturalis", "name_pinyin": "qing dai",
        "category": "清热解毒药", "effects": "清热解毒，凉血消斑",
        "ob_percent": 2.55, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Indirubin", "ob": 3.85, "dl": 0.72, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "STAT3", "CDK5"],
        "diseases": ["热毒发斑", "肝火犯肺咳血"],
    },
    {
        "name_cn": "穿心莲", "name_latin": "Andrographis paniculata", "name_pinyin": "chuan xin lian",
        "category": "清热解毒药", "effects": "清热解毒，凉血消肿",
        "ob_percent": 3.45, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Andrographolide", "ob": 4.85, "dl": 0.78, "target_count": 32},
            {"name": "Neoandrographolide", "ob": 4.25, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["TNF", "NFkB", "IL6", "STAT3", "AKT1", "BCL2", "CASP3"],
        "diseases": ["外感风热", "咽喉肿痛"],
    },
    {
        "name_cn": "重楼", "name_latin": "Paris polyphylla", "name_pinyin": "chong lou",
        "category": "清热解毒药", "effects": "清热解毒，消肿止痛",
        "ob_percent": 2.85, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Polyphyllin I", "ob": 3.25, "dl": 0.72, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "CASP3", "BCL2", "VEGFA", "AKT1"],
        "diseases": ["痈肿疮毒", "咽喉肿痛"],
    },
    {
        "name_cn": "麻黄", "name_latin": "Ephedra sinica", "name_pinyin": "ma huang",
        "category": "解表药", "effects": "发汗散寒，宣肺平喘",
        "ob_percent": 3.65, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Ephedrine", "ob": 4.25, "dl": 0.62, "target_count": 22},
            {"name": "Pseudoephedrine", "ob": 3.95, "dl": 0.58, "target_count": 20},
        ],
        "targets": ["ADRA1B", "ADRA2A", "ADRB2", "TNF", "IL6"],
        "diseases": ["风寒感冒", "胸闷喘咳"],
    },
    {
        "name_cn": "桂枝", "name_latin": "Cinnamomum cassia", "name_pinyin": "gui zhi",
        "category": "解表药", "effects": "发汗解肌，温通经脉",
        "ob_percent": 3.35, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Cinnamic aldehyde", "ob": 4.15, "dl": 0.68, "target_count": 26},
        ],
        "targets": ["TNF", "TRPV1", "PTGS2", "NFkBIA"],
        "diseases": ["风寒感冒", "关节痹痛"],
    },
    {
        "name_cn": "荆芥", "name_latin": "Schizonepeta tenuifolia", "name_pinyin": "jing jie",
        "category": "解表药", "effects": "解表散风，透疹消疮",
        "ob_percent": 3.65, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Pulegone", "ob": 4.25, "dl": 0.55, "target_count": 14},
            {"name": "Luteolin", "ob": 4.25, "dl": 0.75, "target_count": 30},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "MAPK3"],
        "diseases": ["感冒头痛", "麻疹不透"],
    },
    {
        "name_cn": "防风", "name_latin": "Saposhnikovia divaricata", "name_pinyin": "fang feng",
        "category": "解表药", "effects": "祛风解表，胜湿止痛",
        "ob_percent": 3.25, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Prim-O-glucosylcimifugin", "ob": 3.85, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "NFkBIA", "PTGS2"],
        "diseases": ["感冒头痛", "破伤风"],
    },
    {
        "name_cn": "羌活", "name_latin": "Notopterygium incisum", "name_pinyin": "qiang huo",
        "category": "解表药", "effects": "解表散寒，祛风除湿",
        "ob_percent": 3.35, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Notopterol", "ob": 3.75, "dl": 0.65, "target_count": 22},
        ],
        "targets": ["PTGS2", "TNF", "TRPV1", "COX2"],
        "diseases": ["风寒感冒头痛", "肩背酸痛"],
    },
    {
        "name_cn": "白芷", "name_latin": "Angelica dahurica", "name_pinyin": "bai zhi",
        "category": "解表药", "effects": "解表散寒，祛风止痛",
        "ob_percent": 3.45, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Imperatorin", "ob": 4.32, "dl": 0.68, "target_count": 26},
            {"name": "Byakangelicol", "ob": 3.65, "dl": 0.6, "target_count": 18},
        ],
        "targets": ["PTGS2", "TNF", "IL6", "ESR1", "TRPV1"],
        "diseases": ["风寒感冒", "头痛鼻塞"],
    },
    {
        "name_cn": "细辛", "name_latin": "Asarum heterotropoides", "name_pinyin": "xi xin",
        "category": "解表药", "effects": "祛风散寒，通窍止痛",
        "ob_percent": 3.15, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Asarinin", "ob": 3.95, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["TRPA1", "TRPV1", "TNF", "PTGS2"],
        "diseases": ["风寒感冒", "头痛牙痛"],
    },
    {
        "name_cn": "苍耳子", "name_latin": "Xanthium strumarium", "name_pinyin": "cang er zi",
        "category": "解表药", "effects": "散风除湿，通窍止痛",
        "ob_percent": 2.85, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Xanthinin", "ob": 3.15, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1"],
        "diseases": ["风寒头痛", "鼻渊流涕"],
    },
    {
        "name_cn": "辛夷", "name_latin": "Magnolia liliflora", "name_pinyin": "xin yi",
        "category": "解表药", "effects": "散风寒，通鼻窍",
        "ob_percent": 2.95, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Magnolin", "ob": 4.25, "dl": 0.7, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "TRPA1", "PTGS2"],
        "diseases": ["风寒头痛", "鼻塞流涕"],
    },
    {
        "name_cn": "葱白", "name_latin": "Allium fistulosum", "name_pinyin": "cong bai",
        "category": "解表药", "effects": "发汗解表，散寒通阳",
        "ob_percent": 2.15, "dl_value": 0.42, "is_food_homology": True,
        "compounds": [
            {"name": "Allicin", "ob": 2.85, "dl": 0.48, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "NOS2"],
        "diseases": ["风寒感冒", "阴寒腹痛"],
    },
    {
        "name_cn": "柴胡", "name_latin": "Bupleurum chinense", "name_pinyin": "chai hu",
        "category": "解表药", "effects": "疏散退热，疏肝解郁",
        "ob_percent": 3.55, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Saikosaponin A", "ob": 3.25, "dl": 0.72, "target_count": 26},
            {"name": "Saikosaponin D", "ob": 3.05, "dl": 0.68, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "STAT3", "AKT1", "BCL2", "CASP3"],
        "diseases": ["感冒发热", "肝郁气滞"],
    },
    {
        "name_cn": "葛根", "name_latin": "Pueraria lobata", "name_pinyin": "ge gen",
        "category": "解表药", "effects": "解肌退热，生津止渴",
        "ob_percent": 3.25, "dl_value": 0.62, "is_food_homology": True,
        "compounds": [
            {"name": "Puerarin", "ob": 4.15, "dl": 0.72, "target_count": 30},
            {"name": "Daidzein", "ob": 4.05, "dl": 0.78, "target_count": 34},
        ],
        "targets": ["ESR1", "TNF", "IL6", "AKT1", "PTGS2"],
        "diseases": ["外感发热", "项背强痛"],
    },
    {
        "name_cn": "升麻", "name_latin": "Cimicifuga heracleifolia", "name_pinyin": "sheng ma",
        "category": "解表药", "effects": "发表透疹，清热解毒",
        "ob_percent": 2.85, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Cimicifugoside H-2", "ob": 2.95, "dl": 0.6, "target_count": 17},
        ],
        "targets": ["TNF", "IL6", "ESR1", "PTGS2"],
        "diseases": ["风热头痛", "麻疹不透"],
    },
    {
        "name_cn": "泽泻", "name_latin": "Alisma orientale", "name_pinyin": "ze xie",
        "category": "利水渗湿药", "effects": "利水渗湿，泄热化浊降脂",
        "ob_percent": 2.55, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Alisol A 24-acetate", "ob": 3.15, "dl": 0.7, "target_count": 24},
            {"name": "Alisol B", "ob": 2.85, "dl": 0.68, "target_count": 22},
        ],
        "targets": ["HMGCR", "PPARA", "TNF", "IL6", "AKT1"],
        "diseases": ["水肿胀满", "小便不利"],
    },
    {
        "name_cn": "猪苓", "name_latin": "Polyporus umbellatus", "name_pinyin": "zhu ling",
        "category": "利水渗湿药", "effects": "利水渗湿",
        "ob_percent": 2.15, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Polyporenic acid C", "ob": 3.05, "dl": 0.72, "target_count": 24},
        ],
        "targets": ["TNF", "IL6", "AKT1", "VEGFA"],
        "diseases": ["水肿", "小便不利"],
    },
    {
        "name_cn": "冬瓜皮", "name_latin": "Benincasa hispida", "name_pinyin": "dong gua pi",
        "category": "利水渗湿药", "effects": "利尿消肿",
        "ob_percent": 1.45, "dl_value": 0.38, "is_food_homology": True,
        "compounds": [
            {"name": "Cucurbitacin B", "ob": 2.85, "dl": 0.62, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "AQP2"],
        "diseases": ["水肿胀满", "小便不利"],
    },
    {
        "name_cn": "半夏", "name_latin": "Pinellia ternata", "name_pinyin": "ban xia",
        "category": "化痰药", "effects": "燥湿化痰，降逆止呕",
        "ob_percent": 2.75, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Ephedrine", "ob": 3.25, "dl": 0.62, "target_count": 20},
            {"name": "Beta-sitosterol", "ob": 3.15, "dl": 0.75, "target_count": 32},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MUC5AC"],
        "diseases": ["痰多咳嗽", "胸脘痞闷"],
    },
    {
        "name_cn": "天南星", "name_latin": "Arisaema erubescens", "name_pinyin": "tian nan xing",
        "category": "化痰药", "effects": "燥湿化痰，祛风解痉",
        "ob_percent": 2.35, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Saponin A", "ob": 2.45, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "GRIN2B", "SCN1A"],
        "diseases": ["顽痰咳嗽", "中风痰壅"],
    },
    {
        "name_cn": "浙贝母", "name_latin": "Fritillaria thunbergii", "name_pinyin": "zhe bei mu",
        "category": "化痰药", "effects": "清热化痰，散结消痈",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Peiminine", "ob": 2.75, "dl": 0.58, "target_count": 14},
            {"name": "Verticine", "ob": 2.55, "dl": 0.55, "target_count": 13},
        ],
        "targets": ["MUC5AC", "TNF", "IL6", "CASP3"],
        "diseases": ["痰热咳嗽", "瘰疬痰核"],
    },
    {
        "name_cn": "川贝母", "name_latin": "Fritillaria cirrhosa", "name_pinyin": "chuan bei mu",
        "category": "化痰药", "effects": "清热润肺，化痰止咳",
        "ob_percent": 2.65, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Imperialine", "ob": 2.85, "dl": 0.62, "target_count": 16},
        ],
        "targets": ["MUC5AC", "TNF", "IL6", "AKT1"],
        "diseases": ["肺热燥咳", "干咳少痰"],
    },
    {
        "name_cn": "瓜蒌", "name_latin": "Trichosanthes kirilowii", "name_pinyin": "gua lou",
        "category": "化痰药", "effects": "清热涤痰，宽胸散结",
        "ob_percent": 2.75, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Trichosanthin", "ob": 2.25, "dl": 0.52, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "MMP9"],
        "diseases": ["肺热咳嗽", "胸痹心痛"],
    },
    {
        "name_cn": "苦杏仁", "name_latin": "Prunus armeniaca", "name_pinyin": "ku xing ren",
        "category": "止咳平喘药", "effects": "降气止咳平喘，润肠通便",
        "ob_percent": 2.85, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Amygdalin", "ob": 3.25, "dl": 0.62, "target_count": 18},
        ],
        "targets": ["MUC5AC", "TNF", "CASP9", "BCL2"],
        "diseases": ["咳嗽气喘", "肠燥便秘"],
    },
    {
        "name_cn": "紫苏子", "name_latin": "Perilla frutescens", "name_pinyin": "zi su zi",
        "category": "止咳平喘药", "effects": "降气化痰，止咳平喘",
        "ob_percent": 2.65, "dl_value": 0.58, "is_food_homology": True,
        "compounds": [
            {"name": "Perillaldehyde", "ob": 3.25, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "MUC5AC"],
        "diseases": ["痰壅气逆", "咳嗽气喘"],
    },
    {
        "name_cn": "百部", "name_latin": "Stemona japonica", "name_pinyin": "bai bu",
        "category": "止咳平喘药", "effects": "润肺下气止咳",
        "ob_percent": 2.45, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Stemonine", "ob": 2.85, "dl": 0.58, "target_count": 15},
        ],
        "targets": ["MUC5AC", "ACHR", "TNF"],
        "diseases": ["新久咳嗽", "肺痨咳嗽"],
    },
    {
        "name_cn": "紫菀", "name_latin": "Aster tataricus", "name_pinyin": "zi wan",
        "category": "止咳平喘药", "effects": "润肺下气，消痰止咳",
        "ob_percent": 2.35, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Shionone", "ob": 3.05, "dl": 0.55, "target_count": 14},
        ],
        "targets": ["MUC5AC", "TNF", "IL6"],
        "diseases": ["痰多喘咳", "新久咳嗽"],
    },
    {
        "name_cn": "款冬花", "name_latin": "Tussilago farfara", "name_pinyin": "kuan dong hua",
        "category": "止咳平喘药", "effects": "润肺下气，止咳化痰",
        "ob_percent": 2.25, "dl_value": 0.5, "is_food_homology": False,
        "compounds": [
            {"name": "Tussilagone", "ob": 3.25, "dl": 0.58, "target_count": 14},
        ],
        "targets": ["MUC5AC", "TNF", "IL6"],
        "diseases": ["多种咳嗽", "痰多喘促"],
    },
    {
        "name_cn": "石膏", "name_latin": "Gypsum fibrosum", "name_pinyin": "shi gao",
        "category": "清热泻火药", "effects": "清热泻火，除烦止渴",
        "ob_percent": 2.85, "dl_value": 0.42, "is_food_homology": False,
        "compounds": [
            {"name": "Calcium sulfate", "ob": 1.15, "dl": 0.28, "target_count": 5},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["高热烦渴", "肺热喘咳"],
    },
    {
        "name_cn": "知母", "name_latin": "Anemarrhena asphodeloides", "name_pinyin": "zhi mu",
        "category": "清热泻火药", "effects": "清热泻火，滋阴润燥",
        "ob_percent": 3.05, "dl_value": 0.58, "is_food_homology": False,
        "compounds": [
            {"name": "Timosaponin A-III", "ob": 2.95, "dl": 0.62, "target_count": 18},
            {"name": "Timosaponin B-II", "ob": 2.75, "dl": 0.58, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "MAPK14"],
        "diseases": ["热病烦渴", "骨蒸潮热"],
    },
    {
        "name_cn": "芦根", "name_latin": "Phragmites communis", "name_pinyin": "lu gen",
        "category": "清热泻火药", "effects": "清热生津，除烦止呕",
        "ob_percent": 2.35, "dl_value": 0.48, "is_food_homology": True,
        "compounds": [
            {"name": "Tricin", "ob": 3.25, "dl": 0.62, "target_count": 20},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["热病烦渴", "胃热呕吐"],
    },
    {
        "name_cn": "天花粉", "name_latin": "Trichosanthes kirilowii", "name_pinyin": "tian hua fen",
        "category": "清热泻火药", "effects": "清热泻火，生津止渴",
        "ob_percent": 2.45, "dl_value": 0.52, "is_food_homology": False,
        "compounds": [
            {"name": "Trichosanthin", "ob": 2.25, "dl": 0.52, "target_count": 14},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["热病口渴", "消渴"],
    },
    {
        "name_cn": "淡竹叶", "name_latin": "Lophatherum gracile", "name_pinyin": "dan zhu ye",
        "category": "清热泻火药", "effects": "清热泻火，除烦利尿",
        "ob_percent": 2.15, "dl_value": 0.38, "is_food_homology": False,
        "compounds": [
            {"name": "Flavone glycoside", "ob": 2.85, "dl": 0.52, "target_count": 12},
        ],
        "targets": ["TNF", "IL6", "PTGS2"],
        "diseases": ["热病心烦", "口舌生疮"],
    },
    {
        "name_cn": "栀子", "name_latin": "Gardenia jasminoides", "name_pinyin": "zhi zi",
        "category": "清热泻火药", "effects": "泻火除烦，清热利湿，凉血解毒",
        "ob_percent": 3.25, "dl_value": 0.6, "is_food_homology": False,
        "compounds": [
            {"name": "Geniposide", "ob": 4.25, "dl": 0.68, "target_count": 28},
            {"name": "Gardenin", "ob": 3.65, "dl": 0.55, "target_count": 16},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "NOS2", "HSP90AA1"],
        "diseases": ["热病心烦", "黄疸尿赤"],
    },
    {
        "name_cn": "夏枯草", "name_latin": "Prunella vulgaris", "name_pinyin": "xia ku cao",
        "category": "清热泻火药", "effects": "清肝明目，散结消肿",
        "ob_percent": 2.85, "dl_value": 0.55, "is_food_homology": False,
        "compounds": [
            {"name": "Rosmarinic acid", "ob": 3.45, "dl": 0.58, "target_count": 18},
            {"name": "Oleanolic acid", "ob": 3.85, "dl": 0.72, "target_count": 28},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "BCL2"],
        "diseases": ["目珠夜痛", "瘰疬瘿瘤"],
    },
    {
        "name_cn": "黄连", "name_latin": "Coptis chinensis", "name_pinyin": "huang lian",
        "category": "清热燥湿药", "effects": "清热燥湿，泻火解毒",
        "ob_percent": 3.75, "dl_value": 0.72, "is_food_homology": False,
        "compounds": [
            {"name": "Berberine", "ob": 4.85, "dl": 0.72, "target_count": 34},
            {"name": "Coptisine", "ob": 4.25, "dl": 0.68, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "NFkB", "PTGS2", "STAT3", "MAPK14"],
        "diseases": ["湿热痞满", "呕吐吞酸"],
    },
    {
        "name_cn": "黄芩", "name_latin": "Scutellaria baicalensis", "name_pinyin": "huang qin",
        "category": "清热燥湿药", "effects": "清热燥湿，泻火解毒",
        "ob_percent": 3.45, "dl_value": 0.7, "is_food_homology": False,
        "compounds": [
            {"name": "Baicalein", "ob": 4.35, "dl": 0.72, "target_count": 32},
            {"name": "Wogonin", "ob": 4.15, "dl": 0.78, "target_count": 36},
        ],
        "targets": ["TNF", "NFkB", "IL6", "PTGS2", "COX2"],
        "diseases": ["湿温暑湿", "胸膈痞闷"],
    },
    {
        "name_cn": "黄柏", "name_latin": "Phellodendron amurense", "name_pinyin": "huang bai",
        "category": "清热燥湿药", "effects": "清热燥湿，泻火除蒸",
        "ob_percent": 3.25, "dl_value": 0.68, "is_food_homology": False,
        "compounds": [
            {"name": "Berberine", "ob": 4.85, "dl": 0.72, "target_count": 34},
            {"name": "Palmatine", "ob": 3.95, "dl": 0.66, "target_count": 26},
        ],
        "targets": ["TNF", "IL6", "NFkB", "ESR1", "PTGS2"],
        "diseases": ["湿热泻痢", "黄疸尿赤"],
    },
    {
        "name_cn": "龙胆", "name_latin": "Gentiana scabra", "name_pinyin": "long dan",
        "category": "清热燥湿药", "effects": "清热燥湿，泻肝胆火",
        "ob_percent": 3.35, "dl_value": 0.65, "is_food_homology": False,
        "compounds": [
            {"name": "Gentiopicrin", "ob": 3.15, "dl": 0.55, "target_count": 18},
            {"name": "Swertiamarin", "ob": 3.45, "dl": 0.58, "target_count": 17},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "AKT1", "HSP90AA1"],
        "diseases": ["肝胆实火", "胁痛口苦"],
    },
    {
        "name_cn": "苦参", "name_latin": "Sophora flavescens", "name_pinyin": "ku shen",
        "category": "清热燥湿药", "effects": "清热燥湿，杀虫利尿",
        "ob_percent": 3.15, "dl_value": 0.62, "is_food_homology": False,
        "compounds": [
            {"name": "Matrine", "ob": 4.25, "dl": 0.76, "target_count": 32},
            {"name": "Oxymatrine", "ob": 3.85, "dl": 0.74, "target_count": 30},
        ],
        "targets": ["TNF", "IL6", "PTGS2", "VEGFA", "CASP3"],
        "diseases": ["湿热痢疾", "皮肤瘙痒"],
    },
]
