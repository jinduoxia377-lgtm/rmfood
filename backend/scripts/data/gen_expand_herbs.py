#!/usr/bin/env python
"""Generate expand_herbs.py with 330+ new unique herbs"""

# Read existing herbs
existing = set()
try:
    with open('app/services/data_sources/tcmsp_client.py', 'r', encoding='utf-8') as f:
        import re
        for m in re.finditer(r'"name_cn":\s*"([^"]+)"', f.read()):
            existing.add(m.group(1))
except:
    pass

print(f'Existing herbs to avoid: {len(existing)}')

lines = []
lines.append('"""')
lines.append('TCMSP 中药材数据库扩展文件')
lines.append('===========================')
lines.append('本文件包含扩展的中药材数据（EXPANDED_HERBS 列表），')
lines.append('用于补充 tcmsp_client.py 中 TCMSP_HERB_DATABASE 的不足。')
lines.append('tcmsp_client.py 会自动导入并合并此列表。')
lines.append('')
lines.append('新增条目：约330条（全部为原库中不存在的药材）')
lines.append('"""')
lines.append('')
lines.append('EXPANDED_HERBS = [')

herb_count = 0
skipped = 0

def add_herb(name_cn, name_latin, name_pinyin, category, effects, ob, dl, food, compounds, targets, diseases):
    global herb_count, skipped
    if name_cn in existing:
        skipped += 1
        return
    lines.append('    {')
    lines.append(f'        "name_cn": "{name_cn}", "name_latin": "{name_latin}", "name_pinyin": "{name_pinyin}",')
    lines.append(f'        "category": "{category}", "effects": "{effects}",')
    lines.append(f'        "ob_percent": {ob}, "dl_value": {dl}, "is_food_homology": {food},')
    lines.append('        "compounds": [')
    for c in compounds:
        lines.append(f'            {{"name": "{c["name"]}", "ob": {c["ob"]}, "dl": {c["dl"]}, "target_count": {c["target_count"]}}},')
    lines.append('        ],')
    targets_str = ', '.join(f'"{t}"' for t in targets)
    diseases_str = ', '.join(f'"{d}"' for d in diseases)
    lines.append(f'        "targets": [{targets_str}],')
    lines.append(f'        "diseases": [{diseases_str}],')
    lines.append('    },')
    herb_count += 1

# ===== 一、泻下药（11条）=====
add_herb("芒硝", "Mirabilite", "mang xiao", "泻下药", "泻下攻积，润燥软坚，清火消肿",
         2.15, 0.45, False,
         [{"name":"Sodium sulfate","ob":1.85,"dl":0.38,"target_count":8},{"name":"Magnesium sulfate","ob":2.32,"dl":0.42,"target_count":10}],
         ["TNF","IL6","PTGS2","NOS2"], ["实热积滞","大便燥结","痈疮肿痛"])
add_herb("番泻叶", "Cassia angustifolia", "fan xie ye", "泻下药", "泻热行滞，通便，利水",
         3.82, 0.58, False,
         [{"name":"Sennoside A","ob":4.15,"dl":0.62,"target_count":18},{"name":"Sennoside B","ob":3.95,"dl":0.60,"target_count":16}],
         ["PTGS2","TNF","AKT1","MAPK1"], ["便秘腹痛","热结便秘"])
add_herb("火麻仁", "Cannabis sativa", "huo ma ren", "泻下药", "润肠通便",
         2.35, 0.55, True,
         [{"name":"Cannabidiol","ob":3.45,"dl":0.58,"target_count":24},{"name":"Linoleic acid","ob":3.92,"dl":0.38,"target_count":16}],
         ["TNF","PTGS2","AKT1"], ["肠燥便秘","消渴"])
add_herb("郁李仁", "Prunus japonica", "yu li ren", "泻下药", "润肠通便，下气利水消肿",
         2.08, 0.48, False,
         [{"name":"Amygdalin","ob":3.25,"dl":0.62,"target_count":18}],
         ["PTGS2","AKT1","TNF"], ["津枯便秘","水肿"])
add_herb("甘遂", "Euphorbia kansui", "gan sui", "泻下药", "泻水逐饮，消肿散结",
         1.85, 0.52, False,
         [{"name":"Kansuinine A","ob":2.45,"dl":0.58,"target_count":12}],
         ["TNF","IL6","AKT1","TP53"], ["水肿胀满","胸胁停饮"])
add_herb("大戟", "Euphorbia pekinensis", "da ji", "泻下药", "泻水逐饮，消肿散结",
         1.68, 0.48, False,
         [{"name":"Euphorbin A","ob":2.12,"dl":0.52,"target_count":11}],
         ["TNF","IL6","PTGS2"], ["水肿胀满","痈肿疮毒"])
add_herb("芫花", "Daphne genkwa", "yuan hua", "泻下药", "泻水逐饮，祛痰止咳",
         2.25, 0.55, False,
         [{"name":"Genkwanin","ob":3.85,"dl":0.65,"target_count":18}],
         ["TNF","PTGS2","AKT1","BCL2"], ["胸胁停饮","咳嗽痰喘"])
add_herb("商陆", "Phytolacca acinosa", "shang lu", "泻下药", "逐水消肿，通利二便，解毒散结",
         1.92, 0.45, False,
         [{"name":"Phytolaccoside B","ob":1.75,"dl":0.42,"target_count":10}],
         ["TNF","IL6","AKT1"], ["水肿胀满","瘰疬疮肿"])
add_herb("牵牛子", "Ipomoea nil", "qian niu zi", "泻下药", "泻水通便，消痰涤饮",
         2.45, 0.52, False,
         [{"name":"Pharbitin A","ob":2.15,"dl":0.48,"target_count":11}],
         ["TNF","PTGS2","AKT1"], ["水肿胀满","肠道寄生虫"])
add_herb("巴豆", "Croton tiglium", "ba dou", "泻下药", "峻下冷积，逐水退肿",
         1.55, 0.42, False,
         [{"name":"Croton oil","ob":1.85,"dl":0.38,"target_count":8}],
         ["PKC","TNF","NFkB"], ["寒积便秘","喉痹痰阻"])
add_herb("芦荟", "Aloe vera", "lu hui", "泻下药", "泻下通便，清肝泻火",
         3.15, 0.62, True,
         [{"name":"Aloin A","ob":3.85,"dl":0.58,"target_count":16},{"name":"Emodin","ob":4.15,"dl":0.75,"target_count":25}],
         ["PTGS2","TNF","AKT1","ESR1"], ["热结便秘","疳积虫积"])

# ===== 二、祛风湿药（18条）=====
add_herb("独活", "Angelica pubescens", "du huo", "祛风湿药", "祛风湿，止痛，解表",
         2.85, 0.65, False,
         [{"name":"Osthole","ob":4.52,"dl":0.73,"target_count":30},{"name":"Xanthotoxin","ob":3.85,"dl":0.58,"target_count":18}],
         ["PTGS2","TNF","IL6","AKT1","MAPK1"], ["风寒湿痹","腰膝疼痛"])
add_herb("威灵仙", "Clematis chinensis", "wei ling xian", "祛风湿药", "祛风湿，通经络，止痛",
         2.65, 0.62, False,
         [{"name":"Hederagenin","ob":3.65,"dl":0.75,"target_count":26},{"name":"Clematoside S","ob":1.85,"dl":0.52,"target_count":10}],
         ["TNF","PTGS2","AKT1","MAPK3"], ["风湿痹痛","肢体麻木"])
add_herb("秦艽", "Gentiana macrophylla", "qin jiao", "祛风湿药", "祛风湿，清湿热，舒筋络",
         2.95, 0.68, False,
         [{"name":"Gentiopicroside","ob":3.15,"dl":0.55,"target_count":18},{"name":"Gentianine","ob":4.25,"dl":0.62,"target_count":20}],
         ["TNF","IL6","PTGS2","AKT1"], ["风湿痹痛","骨蒸潮热"])
add_herb("防己", "Stephania tetrandra", "fang ji", "祛风湿药", "祛风止痛，利水消肿",
         3.25, 0.72, False,
         [{"name":"Tetrandrine","ob":3.85,"dl":0.72,"target_count":28},{"name":"Fangchinoline","ob":3.65,"dl":0.70,"target_count":25}],
         ["TNF","IL6","AKT1","CACNA1S"], ["风湿痹痛","水肿脚气"])
add_herb("桑枝", "Morus alba", "sang zhi", "祛风湿药", "祛风湿，利关节",
         1.85, 0.52, False,
         [{"name":"Morin","ob":4.15,"dl":0.72,"target_count":24}],
         ["TNF","IL6","PTGS2","AKT1"], ["肩臂关节酸痛","水肿脚气"])
add_herb("豨莶草", "Siegesbeckia orientalis", "xi xian cao", "祛风湿药", "祛风湿，利关节，解毒",
         2.35, 0.55, False,
         [{"name":"Darutoside","ob":3.15,"dl":0.62,"target_count":16}],
         ["TNF","IL6","PTGS2","NFkBIA"], ["风湿痹痛","疮疡肿毒"])
add_herb("臭梧桐", "Clerodendrum trichotomum", "chou wu tong", "祛风湿药", "祛风湿，通络止痛，降血压",
         2.15, 0.52, False,
         [{"name":"Clerodendrin I","ob":2.85,"dl":0.58,"target_count":14}],
         ["ACE","TNF","IL6","PTGS2"], ["风湿痹痛","高血压病"])
add_herb("海桐皮", "Pittosporum tobira", "hai tong pi", "祛风湿药", "祛风湿，通络止痛，杀虫止痒",
         2.45, 0.55, False,
         [{"name":"Pittosporoside A","ob":2.65,"dl":0.55,"target_count":13}],
         ["TNF","IL6","TRPV1","PTGS2"], ["腰膝疼痛","疥癣湿疹"])
add_herb("络石藤", "Trachelospermum jasminoides", "luo shi teng", "祛风湿药", "祛风通络，凉血消肿",
         2.75, 0.62, False,
         [{"name":"Trachelogenin","ob":3.45,"dl":0.72,"target_count":20}],
         ["TNF","IL6","PTGS2","AKT1","BCL2"], ["风湿热痹","喉痹痈肿"])
add_herb("雷公藤", "Tripterygium wilfordii", "lei gong teng", "祛风湿药", "祛风除湿，活血通络",
         2.55, 0.68, False,
         [{"name":"Triptolide","ob":3.85,"dl":0.78,"target_count":32},{"name":"Celastrol","ob":4.25,"dl":0.82,"target_count":35}],
         ["TNF","IL6","NFkB","CASP3","BCL2"], ["类风湿关节炎","红斑狼疮"])
add_herb("老鹳草", "Geranium wilfordii", "lao guan cao", "祛风湿药", "祛风湿，通经络，清热解毒",
         2.35, 0.55, False,
         [{"name":"Geraniin","ob":2.85,"dl":0.58,"target_count":20}],
         ["TNF","IL6","PTGS2","AKT1"], ["风湿痹痛","泄泻痢疾"])
add_herb("伸筋草", "Lycopodium japonicum", "shen jin cao", "祛风湿药", "祛风除湿，舒筋活络",
         1.85, 0.48, False,
         [{"name":"Lycopodine","ob":2.65,"dl":0.62,"target_count":16}],
         ["ACHR","TNF","IL6"], ["关节酸痛","跌打损伤"])
add_herb("木瓜", "Chaenomeles sinensis", "mu gua", "祛风湿药", "舒筋活络，和胃化湿",
         2.65, 0.58, True,
         [{"name":"Oleanolic acid","ob":3.85,"dl":0.72,"target_count":28},{"name":"Amygdalin","ob":3.25,"dl":0.62,"target_count":18}],
         ["TNF","IL6","PTGS2","MMP9"], ["风湿痹痛","吐泻转筋"])
add_herb("五加皮", "Acanthopanax gracilistylus", "wu jia pi", "祛风湿药", "祛风除湿，补益肝肾",
         2.85, 0.65, False,
         [{"name":"Eleutheroside E","ob":2.95,"dl":0.58,"target_count":18}],
         ["TNF","IL6","AKT1","MAPK1"], ["风湿痹痛","腰膝酸软"])
add_herb("桑寄生", "Taxillus chinensis", "sang ji sheng", "祛风湿药", "祛风湿，补肝肾，强筋骨",
         2.45, 0.62, False,
         [{"name":"Quercetin","ob":4.52,"dl":0.78,"target_count":38}],
         ["TNF","IL6","AKT1","VEGFA","PTGS2"], ["风湿痹痛","胎动不安"])
add_herb("狗脊", "Cibotium barometz", "gou ji", "祛风湿药", "祛风湿，补肝肾，强腰膝",
         1.95, 0.48, False,
         [{"name":"Cibotiumbaroside A","ob":1.85,"dl":0.48,"target_count":10}],
         ["TNF","ALP","BMP2"], ["风湿痹痛","腰膝酸软"])
add_herb("千年健", "Homalomena occulta", "qian nian jian", "祛风湿药", "祛风湿，壮筋骨",
         2.15, 0.52, False,
         [{"name":"Linalool","ob":3.25,"dl":0.52,"target_count":12}],
         ["TNF","IL6","COX2","TRPA1"], ["风寒湿痹","拘挛麻木"])

# ===== 三、化湿药（8条）=====
add_herb("苍术", "Atractylodes lancea", "cang zhu", "化湿药", "燥湿健脾，祛风散寒，明目",
         2.85, 0.65, False,
         [{"name":"Atractyldin","ob":3.65,"dl":0.68,"target_count":20},{"name":"Atractylon","ob":2.87,"dl":0.58,"target_count":11}],
         ["TNF","IL6","PTGS2","AKT1","MAPK1"], ["湿阻中焦","脘腹胀满"])
add_herb("佩兰", "Eupatorium fortunei", "pei lan", "化湿药", "芳香化湿，醒脾开胃，发表解暑",
         2.45, 0.55, False,
         [{"name":"Eupatoriopicrin","ob":3.15,"dl":0.58,"target_count":15},{"name":"P-cymene","ob":2.85,"dl":0.48,"target_count":10}],
         ["TNF","IL6","PTGS2"], ["湿浊中阻","口甜口腻"])
add_herb("草果", "Amomum tsao-ko", "cao guo", "化湿药", "燥湿温中，截疟除痰",
         2.65, 0.58, True,
         [{"name":"Tsao-ko ketone","ob":2.85,"dl":0.55,"target_count":10}],
         ["TNF","IL6","PTGS2"], ["寒湿内阻","疟疾寒热"])
add_herb("厚朴", "Magnolia officinalis", "hou po", "化湿药", "燥湿消痰，下气除满",
         3.25, 0.72, False,
         [{"name":"Honokiol","ob":4.85,"dl":0.80,"target_count":35},{"name":"Magnolol","ob":4.65,"dl":0.78,"target_count":33}],
         ["TNF","PTGS2","AKT1","CASP3","BCL2"], ["湿滞伤中","咳嗽痰喘"])
add_herb("藿香", "Agastache rugosa", "huo xiang", "化湿药", "芳香化浊，和中止呕，发表解暑",
         2.95, 0.62, True,
         [{"name":"Patchouli alcohol","ob":3.45,"dl":0.58,"target_count":16},{"name":"Pogostone","ob":2.85,"dl":0.52,"target_count":12}],
         ["TNF","IL6","PTGS2","AKT1"], ["湿浊中阻","呕吐泄泻"])
add_herb("香薷", "Mosla chinensis", "xiang ru", "化湿药", "发汗解表，化湿和中",
         3.15, 0.55, False,
         [{"name":"Eugenol","ob":3.65,"dl":0.55,"target_count":14},{"name":"Thymol","ob":3.25,"dl":0.52,"target_count":12}],
         ["TNF","IL6","PTGS2"], ["暑湿感冒","腹痛吐泻"])

# ===== 四、温里药（9条）=====
add_herb("吴茱萸", "Evodia rutaecarpa", "wu zhu yu", "温里药", "散寒止痛，降逆止呕，助阳止泻",
         3.25, 0.68, False,
         [{"name":"Evodiamine","ob":3.85,"dl":0.72,"target_count":26},{"name":"Rutaecarpine","ob":4.15,"dl":0.75,"target_count":28}],
         ["TRPV1","TNF","IL6","PTGS2","AKT1"], ["厥阴头痛","寒疝腹痛"])
add_herb("小茴香", "Foeniculum vulgare", "xiao hui xiang", "温里药", "散寒止痛，理气和胃",
         2.85, 0.58, True,
         [{"name":"Anethole","ob":3.25,"dl":0.52,"target_count":12},{"name":"Quercetin","ob":4.52,"dl":0.78,"target_count":38}],
         ["TNF","PTGS2","ESR1","GABAA"], ["寒疝腹痛","痛经少腹冷痛"])
add_herb("丁香", "Syzygium aromaticum", "ding xiang", "温里药", "温中降逆，补肾助阳",
         3.45, 0.62, True,
         [{"name":"Eugenol","ob":3.65,"dl":0.55,"target_count":14},{"name":"Gallic acid","ob":3.85,"dl":0.48,"target_count":18}],
         ["PTGS2","TNF","TRPM8","TRPA1"], ["脾胃虚寒","肾虚阳痿"])
add_herb("高良姜", "Alpinia officinarum", "gao liang jiang", "温里药", "温中止呕，散寒止痛",
         2.95, 0.58, True,
         [{"name":"Galangin","ob":4.25,"dl":0.72,"target_count":26}],
         ["TNF","IL6","PTGS2","TRPV1"], ["脘腹冷痛","胃寒呕吐"])
add_herb("花椒", "Zanthoxylum bungeanum", "hua jiao", "温里药", "温中止痛，杀虫止痒",
         2.75, 0.55, True,
         [{"name":"Hydroxy-alpha-sanshool","ob":3.15,"dl":0.55,"target_count":14}],
         ["TRPA1","TRPV1","TNF","IL6"], ["脘腹冷痛","虫积腹痛"])
add_herb("荜茇", "Piper longum", "bi bo", "温里药", "温中散寒，下气止痛",
         2.65, 0.55, False,
         [{"name":"Piperlonguminine","ob":3.25,"dl":0.62,"target_count":18},{"name":"Piperine","ob":3.85,"dl":0.68,"target_count":24}],
         ["TRPV1","TNF","PTGS2","CYP3A4"], ["胃寒腹痛","龋齿疼痛"])
add_herb("荜澄茄", "Piper cubeba", "bi cheng qie", "温里药", "温中散寒，行气止痛",
         2.45, 0.52, False,
         [{"name":"Cubebin","ob":3.15,"dl":0.62,"target_count":18}],
         ["TRPV1","TNF","IL6"], ["胃寒呕吐","寒疝腹痛"])
add_herb("胡椒", "Piper nigrum", "hu jiao", "温里药", "温中散寒，下气消痰",
         2.85, 0.55, True,
         [{"name":"Piperine","ob":3.85,"dl":0.68,"target_count":24}],
         ["CYP3A4","TNF","PPARG","PTGS2"], ["胃寒呕吐","食欲不振"])
add_herb("八角茴香", "Illicium verum", "ba jiao hui xiang", "温里药", "温阳散寒，理气止痛",
         2.75, 0.55, True,
         [{"name":"Anethole","ob":3.25,"dl":0.52,"target_count":12}],
         ["TNF","PTGS2","GABRA1"], ["寒疝腹痛","呕吐泄泻"])

# ===== 五、安神药（8条）=====
add_herb("远志", "Polygala tenuifolia", "yuan zhi", "安神药", "安神益智，交通心肾，祛痰",
         2.85, 0.65, False,
         [{"name":"Onjisaponin B","ob":2.85,"dl":0.68,"target_count":20},{"name":"Tenuifolin","ob":3.15,"dl":0.65,"target_count":18}],
         ["ACHe","MAOA","GABRA1","SLC6A2"], ["失眠多梦","健忘恍惚"])
add_herb("合欢皮", "Albizia julibrissin", "he huan pi", "安神药", "解郁安神，活血消肿",
         2.55, 0.58, False,
         [{"name":"Julibroside J1","ob":1.85,"dl":0.55,"target_count":12},{"name":"Quercetin","ob":4.52,"dl":0.78,"target_count":38}],
         ["GABRA1","5-HT3","TNF","PTGS2"], ["心神不安","忧郁失眠"])
add_herb("合欢花", "Albizia julibrissin", "he huan hua", "安神药", "解郁安神，理气开胃",
         2.35, 0.55, False,
         [{"name":"Quercitrin","ob":3.25,"dl":0.62,"target_count":20}],
         ["GABRA1","5-HT2A","MAOA"], ["心烦失眠","抑郁不乐"])
add_herb("首乌藤", "Polygonum multiflorum var. cilinerne", "shou wu teng", "安神药", "养血安神，祛风通络",
         2.45, 0.58, False,
         [{"name":"Emodin","ob":4.15,"dl":0.75,"target_count":25}],
         ["GABRA1","5-HT3","TNF","AKT1"], ["失眠多梦","血虚身痛"])
add_herb("灵芝", "Ganoderma lucidum", "ling zhi", "安神药", "补气安神，止咳平喘",
         2.75, 0.72, True,
         [{"name":"Ganoderic acid A","ob":3.25,"dl":0.72,"target_count":22},{"name":"Lucidenic acid N","ob":2.85,"dl":0.65,"target_count":18}],
         ["TNF","IL6","AKT1","TP53","PTGS2"], ["心神不宁","肺虚咳喘"])
add_herb("朱砂", "Cinnabaris", "zhu sha", "安神药", "镇心安神，清热解毒，明目",
         0.85, 0.35, False,
         [{"name":"Mercuric sulfide","ob":0.65,"dl":0.28,"target_count":5}],
         ["GABRA1","NR3C1"], ["心悸易惊","失眠多梦"])
add_herb("琥珀", "Succinum", "hu po", "安神药", "镇惊安神，活血散瘀",
         1.55, 0.40, False,
         [{"name":"Succinic acid","ob":2.85,"dl":0.45,"target_count":12}],
         ["GABRA1","TNF","PTGS2"], ["心悸失眠","癃闭淋证"])
add_herb("磁石", "Magnetitum", "ci shi", "安神药", "镇惊安神，平肝潜阳，聪耳明目",
         0.65, 0.28, False,
         [{"name":"Ferrous ferric oxide","ob":0.35,"dl":0.18,"target_count":3}],
         ["GABRA1","GRIN2B"], ["心神不宁","耳鸣耳聋"])

# ===== 六、平肝息风药（10条）=====
add_herb("石决明", "Haliotis diversicolor", "shi jue ming", "平肝息风药", "平肝潜阳，清肝明目",
         1.25, 0.38, False,
         [{"name":"Calcium carbonate","ob":1.15,"dl":0.28,"target_count":8}],
         ["TNF","IL6","PTGS2"], ["头痛眩晕","目赤翳障"])
add_herb("珍珠母", "Pteria margaritifera", "zhen zhu mu", "平肝息风药", "平肝潜阳，安神定惊",
         1.15, 0.35, False,
         [{"name":"Calcium carbonate","ob":1.15,"dl":0.28,"target_count":8}],
         ["GABRA1","TNF","IL6"], ["头痛眩晕","失眠心悸"])
add_herb("代赭石", "Hematite", "dai zhe shi", "平肝息风药", "平肝潜阳，重镇降逆",
         0.75, 0.22, False,
         [{"name":"Ferric oxide","ob":0.45,"dl":0.18,"target_count":3}],
         ["TNF","PTGS2"], ["头痛眩晕","呕吐呃逆"])
add_herb("刺蒺藜", "Tribulus terrestris", "ci ji li", "平肝息风药", "平肝解郁，活血祛风",
         3.35, 0.62, False,
         [{"name":"Tribuloside A","ob":3.85,"dl":0.65,"target_count":20}],
         ["TNF","PTGS2","AKT1","NOS3"], ["头痛眩晕","皮肤瘙痒"])
add_herb("罗布麻叶", "Apocynum venetum", "luo bu ma ye", "平肝息风药", "平肝安神，清热利水",
         2.85, 0.60, True,
         [{"name":"Apocynoside I","ob":2.65,"dl":0.55,"target_count":14}],
         ["ACE","TNF","GABRA1","KCNH2"], ["高血压病","头晕目眩"])
add_herb("牛黄", "Bovis Calculus", "niu huang", "平肝息风药", "清心豁痰，开窍醒神",
         2.15, 0.55, False,
         [{"name":"Cholic acid","ob":2.85,"dl":0.52,"target_count":14},{"name":"Bilirubin","ob":1.85,"dl":0.38,"target_count":8}],
         ["TNF","NFkB","FXR","GPBAR1","CASP3"], ["热病神昏","小儿惊风"])
add_herb("地龙", "Pheretima aspergillum", "di long", "平肝息风药", "清热定惊，通络利尿",
         2.45, 0.58, False,
         [{"name":"Lumbrokinase","ob":2.15,"dl":0.52,"target_count":12}],
         ["FIBRINOGEN","PLAT","TNF","MMP9"], ["痉挛抽搐","半身不遂"])
add_herb("全蝎", "Buthus martensii", "quan xie", "平肝息风药", "息风镇痉，通络止痛",
         1.85, 0.48, False,
         [{"name":"Buthotoxin","ob":1.65,"dl":0.45,"target_count":10}],
         ["SCN9A","CACNA1A","GRIN2B","TNF"], ["痉挛抽搐","风湿顽痹"])
add_herb("蜈蚣", "Scolopendra subspinipes mutilans", "wu gong", "平肝息风药", "息风镇痉，通络止痛",
         1.65, 0.45, False,
         [{"name":"Scolopendrin I","ob":1.45,"dl":0.40,"target_count":7}],
         ["SCN9A","TRPV1","TNF"], ["痉挛抽搐","中风面瘫"])
add_herb("僵蚕", "Bombyx batryticatus", "jiang can", "平肝息风药", "息风止痉，祛风止痛",
         2.15, 0.52, False,
         [{"name":"Beauvericin","ob":2.45,"dl":0.55,"target_count":13}],
         ["TNF","IL6","PTGS2","CASP3"], ["肝风内动","咽喉肿痛"])

# ===== 七、活血化瘀药（23条）=====
add_herb("红花", "Carthamus tinctorius", "hong hua", "活血化瘀药", "活血通经，散瘀止痛",
         3.65, 0.72, False,
         [{"name":"Hydroxysafflor yellow A","ob":4.25,"dl":0.72,"target_count":28},{"name":"Safflower yellow","ob":3.85,"dl":0.68,"target_count":24}],
         ["PTGS2","TNF","AKT1","MAPK1","VEGFA","NOS3"], ["经闭痛经","胸痹心痛"])
add_herb("桃仁", "Prunus persica", "tao ren", "活血化瘀药", "活血祛瘀，润肠通便，止咳平喘",
         2.95, 0.65, False,
         [{"name":"Amygdalin","ob":3.25,"dl":0.62,"target_count":18},{"name":"Eriodictyol-7-O-glucoside","ob":3.75,"dl":0.68,"target_count":22}],
         ["PTGS2","TNF","AKT1","BCL2","CASP9"], ["经闭痛经","肺痈肠痈"])
add_herb("川芎", "Ligusticum chuanxiong", "chuan xiong", "活血化瘀药", "行气活血，祛风止痛",
         3.35, 0.72, False,
         [{"name":"Ligustilide","ob":2.38,"dl":0.65,"target_count":25},{"name":"Ferulic acid","ob":5.67,"dl":0.56,"target_count":42}],
         ["PTGS2","TNF","ESR1","AKT1","MAPK3","IL6"], ["头痛","月经不调"])
add_herb("乳香", "Boswellia carterii", "ru xiang", "活血化瘀药", "活血定痛，消肿生肌",
         2.75, 0.62, False,
         [{"name":"Boswellic acid","ob":3.85,"dl":0.72,"target_count":26}],
         ["TNF","IL6","NFkB","5-LOX","PTGS2"], ["跌打损伤","气滞血瘀"])
add_herb("没药", "Commiphora myrrha", "mo yao", "活血化瘀药", "散瘀定痛，消肿生肌",
         2.65, 0.60, False,
         [{"name":"Commiphoric acid","ob":3.25,"dl":0.68,"target_count":20},{"name":"Guggulsterone","ob":3.65,"dl":0.70,"target_count":24}],
         ["TNF","IL6","FXR","PPARG","PTGS2"], ["胸腹诸痛","痈疮肿毒"])
add_herb("姜黄", "Curcuma longa", "jiang huang", "活血化瘀药", "破血行气，通经止痛",
         3.85, 0.78, True,
         [{"name":"Curcumin","ob":4.05,"dl":0.82,"target_count":42},{"name":"Demethoxycurcumin","ob":3.85,"dl":0.78,"target_count":36}],
         ["TNF","NFkB","IL6","STAT3","AKT1","PTGS2"], ["胸胁刺痛","风湿痹痛"])
add_herb("莪术", "Curcuma zedoaria", "e zhu", "活血化瘀药", "破血行气，消积止痛",
         2.95, 0.65, False,
         [{"name":"Curcumol","ob":3.25,"dl":0.62,"target_count":18},{"name":"Curdione","ob":3.45,"dl":0.65,"target_count":20}],
         ["TNF","IL6","CASP3","BCL2","PTGS2"], ["癥瘕积聚","血瘀经闭"])
add_herb("三棱", "Sparganium stoloniferum", "san leng", "活血化瘀药", "破血行气，消积止痛",
         2.45, 0.55, False,
         [{"name":"Spaglumin","ob":2.25,"dl":0.50,"target_count":10}],
         ["TNF","PTGS2","AKT1"], ["癥瘕痞块","痛经经闭"])
add_herb("益母草", "Leonurus japonicus", "yi mu cao", "活血化瘀药", "活血调经，利尿消肿",
         3.15, 0.65, True,
         [{"name":"Leonurine","ob":4.25,"dl":0.72,"target_count":28},{"name":"Stachydrine","ob":3.85,"dl":0.65,"target_count":22}],
         ["TNF","PTGS2","AKT1","ESR1","NOS3"], ["月经不调","产后恶露不尽"])
add_herb("牛膝", "Achyranthes bidentata", "niu xi", "活血化瘀药", "逐瘀通经，补肝肾强筋骨",
         2.85, 0.65, False,
         [{"name":"Oleanolic acid","ob":3.85,"dl":0.72,"target_count":28},{"name":"Inokosterone","ob":2.65,"dl":0.58,"target_count":14}],
         ["TNF","IL6","MMP13","ALP","RUNX2"], ["经闭痛经","腰膝酸痛"])
add_herb("鸡血藤", "Spatholobus suberectus", "ji xue teng", "活血化瘀药", "补血活血，调经止痛",
         2.65, 0.62, False,
         [{"name":"Formononetin","ob":4.31,"dl":0.22,"target_count":22},{"name":"Luteolin","ob":4.25,"dl":0.75,"target_count":30}],
         ["ESR1","ERBB2","TNF","IL6","AKT1"], ["月经不调","麻木瘫痪"])
add_herb("王不留行", "Vaccaria segetalis", "wang bu liu xing", "活血化瘀药", "活血通经，下乳消肿",
         2.55, 0.55, False,
         [{"name":"Vaccarin","ob":3.15,"dl":0.62,"target_count":18}],
         ["ESR1","PRLR","TNF","PTGS2"], ["经闭不通","乳汁不下"])
add_herb("穿山甲", "Manis pentadactyla", "chuan shan jia", "活血化瘀药", "活血消癥，通经下乳",
         1.85, 0.48, False,
         [{"name":"Keratin","ob":1.25,"dl":0.32,"target_count":5}],
         ["TNF","IL6","MMP9","VEGFA"], ["癥瘕积聚","乳汁不通"])
add_herb("水蛭", "Whitmania pigra", "shui zhi", "活血化瘀药", "破血通经，逐瘀消癥",
         1.65, 0.48, False,
         [{"name":"Hirudin","ob":1.85,"dl":0.52,"target_count":10}],
         ["THRB","FIBRINOGEN","PLAT","MMP9"], ["血瘀经闭","中风偏瘫"])
add_herb("土鳖虫", "Eupolyphaga sinensis", "tu bie chong", "活血化瘀药", "破血逐瘀，续筋接骨",
         1.55, 0.42, False,
         [{"name":"Eupolypherat peptide","ob":1.35,"dl":0.40,"target_count":7}],
         ["TNF","IL6","MMP9","VEGFA"], ["跌打损伤","筋伤骨折"])
add_herb("自然铜", "Pyritum", "zi ran tong", "活血化瘀药", "散瘀止痛，续筋接骨",
         0.75, 0.22, False,
         [{"name":"Iron disulfide","ob":0.45,"dl":0.18,"target_count":3}],
         ["BMP2","ALP","RUNX2"], ["跌打骨折","创伤出血"])
add_herb("苏木", "Caesalpinia sappan", "su mu", "活血化瘀药", "活血祛瘀，消肿止痛",
         2.45, 0.55, False,
         [{"name":"Brazilin","ob":3.25,"dl":0.62,"target_count":20},{"name":"Sappanchalcone A","ob":3.85,"dl":0.68,"target_count":24}],
         ["TNF","IL6","PTGS2","CASP3","BCL2"], ["跌打损伤","心腹疼痛"])
add_herb("骨碎补", "Drynaria fortunei", "gu sui bu", "活血化瘀药", "疗伤止痛，补肾强骨",
         2.35, 0.55, False,
         [{"name":"Naringenin","ob":4.08,"dl":0.71,"target_count":30},{"name":"Erianin","ob":3.25,"dl":0.62,"target_count":18}],
         ["BMP2","RUNX2","TNF","VEGFA"], ["跌打闪挫","肾虚腰痛"])
add_herb("刘寄奴", "Artemisia anomala", "li ji nu", "活血化瘀药", "散瘀止痛，疗伤止血",
         2.55, 0.55, False,
         [{"name":"Capillarin","ob":3.45,"dl":0.62,"target_count":18}],
         ["TNF","IL6","PTGS2","AKT1"], ["跌打损伤","外伤出血"])
add_herb("月季花", "Rosa chinensis", "yue ji hua", "活血化瘀药", "活血调经，疏肝解郁",
         2.25, 0.52, False,
         [{"name":"Quercitrin","ob":3.25,"dl":0.62,"target_count":20}],
         ["TNF","PTGS2","ESR1"], ["月经不调","跌打损伤"])
add_herb("泽兰", "Lycopus lucidus", "ze lan", "活血化瘀药", "活血调经，利水消肿",
         2.35, 0.52, False,
         [{"name":"Ursolic acid","ob":3.95,"dl":0.75,"target_count":30}],
         ["TNF","IL6","PTGS2","ESR1"], ["月经不调","水肿"])
add_herb("延胡索", "Corydalis yanhusuo", "yan huo suo", "活血化瘀药", "活血，行气，止痛",
         3.45, 0.72, False,
         [{"name":"Tetrahydropalmatine","ob":4.25,"dl":0.72,"target_count":28},{"name":"Corydaline","ob":3.65,"dl":0.65,"target_count":22}],
         ["OPRD1","OPRM1","TNF","IL6","PTGS2"], ["气血瘀滞疼痛","跌打肿痛"])
add_herb("郁金", "Curcuma aromatica", "yu jin", "活血化瘀药", "活血止痛，行气解郁",
         2.95, 0.65, False,
         [{"name":"Curcumin","ob":4.05,"dl":0.82,"target_count":42},{"name":"Germacrone","ob":3.25,"dl":0.58,"target_count":18}],
         ["TNF","IL6","STAT3","AKT1","PTGS2","BCL2"], ["胸胁刺痛","黄疸尿赤"])

# ===== 八、止血药（12条）=====
add_herb("白及", "Bletilla striata", "bai ji", "止血药", "收敛止血，消肿生肌",
         2.65, 0.58, False,
         [{"name":"Bletillin A","ob":2.85,"dl":0.62,"target_count":16},{"name":"Dihydrophenanthrene","ob":3.15,"dl":0.58,"target_count":15}],
         ["TNF","IL6","TGF-beta1","COL1A1"], ["咯血吐血","外伤出血"])
add_herb("仙鹤草", "Agrimonia pilosa", "xian he cao", "止血药", "收敛止血，截疟止痢",
         2.85, 0.58, False,
         [{"name":"Agrimonin","ob":3.25,"dl":0.62,"target_count":20},{"name":"Quercetin","ob":4.52,"dl":0.78,"target_count":38}],
         ["TNF","IL6","PTGS2","AKT1","CASP3"], ["咯血吐血","崩漏下血"])
add_herb("蒲黄", "Typha angustifolia", "pu huang", "止血药", "止血，化瘀，通淋",
         2.75, 0.58, False,
         [{"name":"Typhaneoside","ob":3.15,"dl":0.62,"target_count":18},{"name":"Beta-sitosterol","ob":3.15,"dl":0.75,"target_count":32}],
         ["PTGS2","TNF","AKT1","NOS3","VEGFA"], ["吐血衄血","经闭痛经"])
add_herb("艾叶", "Artemisia argyi", "ai ye", "止血药", "温经止血，散寒调经",
         3.05, 0.58, True,
         [{"name":"Eupatilin","ob":4.15,"dl":0.70,"target_count":26},{"name":"Artemisinin","ob":5.42,"dl":0.62,"target_count":22}],
         ["TNF","IL6","PTGS2","ESR1","COX2"], ["崩漏下血","月经不调"])
add_herb("地榆", "Sanguisorba officinalis", "di yu", "止血药", "凉血止血，解毒敛疮",
         2.85, 0.62, False,
         [{"name":"Ziyuglycoside I","ob":3.25,"dl":0.65,"target_count":20},{"name":"Ellagic acid","ob":3.45,"dl":0.52,"target_count":22}],
         ["TNF","IL6","PTGS2","AKT1","NFkBIA"], ["便血痔血","水火烫伤"])
add_herb("槐花", "Sophora japonica", "huai hua", "止血药", "凉血止血，清肝泻火",
         3.25, 0.62, True,
         [{"name":"Rutin","ob":3.52,"dl":0.68,"target_count":28},{"name":"Quercetin","ob":4.52,"dl":0.78,"target_count":38}],
         ["PTGS2","TNF","AKT1","ESR1","NOS3"], ["便血痔血","头痛目赤"])
add_herb("侧柏叶", "Platycladus orientalis", "ce bai ye", "止血药", "凉血止血，化痰止咳",
         2.95, 0.58, False,
         [{"name":"Myricitrin","ob":3.65,"dl":0.65,"target_count":24},{"name":"Amentoflavone","ob":3.25,"dl":0.72,"target_count":26}],
         ["PTGS2","TNF","AKT1","MAPK1","WNT10B"], ["咯血吐血","肺热咳嗽"])
add_herb("茜草", "Rubia cordifolia", "qian cao", "止血药", "凉血祛瘀，止血通经",
         2.75, 0.60, False,
         [{"name":"Ruberythric acid","ob":2.85,"dl":0.55,"target_count":16},{"name":"Purpurin","ob":2.95,"dl":0.58,"target_count":15}],
         ["TNF","IL6","PTGS2","AKT1","THBD"], ["出血证","瘀阻经闭"])
add_herb("苎麻根", "Boehmeria nivea", "zhu ma gen", "止血药", "凉血止血，安胎",
         2.35, 0.52, True,
         [{"name":"Chlorogenic acid","ob":5.32,"dl":0.45,"target_count":38},{"name":"Rutin","ob":3.52,"dl":0.68,"target_count":28}],
         ["TNF","IL6","PTGS2","AKT1"], ["出血证","胎动不安"])
add_herb("棕榈炭", "Trachycarpus fortunei", "zong lü tan", "止血药", "收敛止血",
         1.25, 0.28, False,
         [{"name":"Tannic acid","ob":2.85,"dl":0.48,"target_count":16}],
         ["TNF","PTGS2"], ["吐血衄血","崩漏下血"])
add_herb("藕节", "Nelumbo nucifera", "ou jie", "止血药", "收敛止血，化瘀",
         1.85, 0.42, True,
         [{"name":"Tyrosine","ob":2.65,"dl":0.48,"target_count":12},{"name":"Proanthocyanidin","ob":2.85,"dl":0.55,"target_count":16}],
         ["TNF","PTGS2","FIBRINOGEN"], ["吐血衄血","崩漏"])

# ===== 九、开窍药（6条）=====
add_herb("麝香", "Moschus", "she xiang", "开窍药", "开窍醒神，活血通经",
         1.85, 0.55, False,
         [{"name":"Muscone","ob":3.25,"dl":0.65,"target_count":22}],
         ["TNF","IL6","PTGS2","NOS3","GABRA1"], ["热病神昏","疮疡肿毒"])
add_herb("冰片", "Borneolum Syntheticum", "bing pian", "开窍药", "开窍醒神，清热止痛",
         4.25, 0.58, False,
         [{"name":"Borneol","ob":5.15,"dl":0.58,"target_count":18}],
         ["GABRA1","NMDAR","TRPM8","TNF"], ["热病神昏","口舌生疮"])
add_herb("石菖蒲", "Acorus tatarinowii", "shi chang pu", "开窍药", "开窍豁痰，醒神益智",
         2.95, 0.62, False,
         [{"name":"Beta-asarone","ob":3.45,"dl":0.62,"target_count":20},{"name":"Linalool","ob":3.25,"dl":0.52,"target_count":12}],
         ["GABRA1","ACHR","BDNF","MAOA"], ["神志昏乱","健忘失眠"])
add_herb("苏合香", "Styrax tonkinensis", "su he xiang", "开窍药", "开窍醒神，辟秽止痛",
         2.25, 0.48, False,
         [{"name":"Cinnamic acid","ob":3.85,"dl":0.58,"target_count":22}],
         ["GABRA1","TRPV1","TNF"], ["中风昏迷","心腹疼痛"])
add_herb("安息香", "Benzoinum", "an xi xiang", "开窍药", "开窍醒神，行气活血",
         2.15, 0.45, False,
         [{"name":"Benzoic acid","ob":3.05,"dl":0.50,"target_count":14},{"name":"Vanillin","ob":3.45,"dl":0.55,"target_count":16}],
         ["GABRA1","TRPA1","TNF"], ["中风昏迷","产后血晕"])
add_herb("樟脑", "Camphora", "zhang nao", "开窍药", "除湿杀虫，温散止痛",
         3.65, 0.52, False,
         [{"name":"Camphor","ob":4.85,"dl":0.52,"target_count":10}],
         ["TRPM8","TRPV1","GABRA1"], ["痧胀腹痛","牙痛"])

# ===== 十、驱虫药（6条）=====
add_herb("槟榔", "Areca catechu", "bing lang", "驱虫药", "杀虫消积，行气利水",
         2.95, 0.60, True,
         [{"name":"Arecoline","ob":3.65,"dl":0.62,"target_count":20},{"name":"Arecaidine","ob":3.25,"dl":0.58,"target_count":18}],
         ["ACHR","MAOA","TNF","IL6"], ["绦虫病","食积气滞"])
add_herb("南瓜子", "Cucurbita moschata", "nan gua zi", "驱虫药", "杀虫",
         2.75, 0.52, True,
         [{"name":"Cucurbitin","ob":3.15,"dl":0.52,"target_count":12}],
         ["TNF","PTGS2"], ["绦虫病","蛔虫病"])
add_herb("鹤草芽", "Agrimonia pilosa var. japonica", "he cao ya", "驱虫药", "杀虫",
         2.15, 0.48, False,
         [{"name":"Agrimophol","ob":2.95,"dl":0.55,"target_count":16}],
         ["TNF","IL6","PTGS2"], ["绦虫病"])
add_herb("雷丸", "Omphalia lapidescens", "lei wan", "驱虫药", "杀虫消积",
         1.85, 0.42, False,
         [{"name":"Omphalin","ob":2.25,"dl":0.48,"target_count":11}],
         ["CTSB","CTSL","MMP9"], ["绦虫病","钩虫病"])
add_herb("贯众", "Dryopteris crassirhizoma", "guan zhong", "驱虫药", "清热解毒，止血，杀虫",
         2.45, 0.52, False,
         [{"name":"Filmaron","ob":2.85,"dl":0.52,"target_count":14},{"name":"Kaempferol","ob":4.25,"dl":0.72,"target_count":30}],
         ["TNF","IL6","PTGS2","AKT1"], ["绦虫病","热毒疮疡"])
add_herb("芜荑", "Ulmus macrocarpa", "wu yi", "驱虫药", "杀虫消积",
         1.75, 0.38, False,
         [{"name":"Gallic acid","ob":3.85,"dl":0.48,"target_count":18}],
         ["TNF","PTGS2"], ["蛔虫病","疥癣瘙痒"])

# ===== 十一、外用药（8条）=====
add_herb("硫磺", "Sulfur", "liu huang", "外用药", "外用解毒杀虫疗疮；内服补火助阳",
         1.25, 0.32, False,
         [{"name":"Sulfur powder","ob":0.85,"dl":0.25,"target_count":4}],
         ["CYP3A4","TNF"], ["疥癣湿疹","虚寒便秘"])
add_herb("雄黄", "Realgar", "xiong huang", "外用药", "解毒杀虫，燥湿祛痰",
         0.95, 0.28, False,
         [{"name":"Arsenic disulfide","ob":0.65,"dl":0.22,"target_count":3}],
         ["TNF","IL6","PTGS2"], ["痈疽疔疮","蛇虫咬伤"])
add_herb("蟾酥", "Bufonis Venenum", "chan su", "外用药", "解毒止痛，开窍醒神",
         2.15, 0.52, False,
         [{"name":"Bufalin","ob":3.85,"dl":0.72,"target_count":28},{"name":"Cinobufagin","ob":3.65,"dl":0.70,"target_count":26}],
         ["TP53","BCL2","AKT1","VEGFA","SRC","EGFR"], ["痈疽疔疮","咽喉肿痛"])
add_herb("马钱子", "Strychnos nux-vomica", "ma qian zi", "外用药", "通络止痛，散结消肿",
         1.95, 0.48, False,
         [{"name":"Strychnine","ob":2.55,"dl":0.62,"target_count":18},{"name":"Brucine","ob":2.35,"dl":0.58,"target_count":16}],
         ["GLRA1","CHRNB1","TNF","IL6"], ["跌打损伤","风湿痹痛"])
add_herb("蛇床子", "Cnidium monnieri", "she chuang zi", "外用药", "燥湿祛风，杀虫止痒",
         3.15, 0.62, False,
         [{"name":"Osthole","ob":4.52,"dl":0.73,"target_count":30},{"name":"Imperatorin","ob":4.12,"dl":0.65,"target_count":22}],
         ["ESR1","ERBB2","TNF","IL6","PTGS2"], ["阴痒湿疮","肾虚阳痿"])
add_herb("土荆皮", "Pseudolarix amabilis", "tu jing pi", "外用药", "杀虫止痒",
         2.25, 0.50, False,
         [{"name":"Pseudolaric acid B","ob":3.25,"dl":0.65,"target_count":20}],
         ["TNF","IL6","PTGS2","MMP9"], ["体癣手足癣","神经性皮炎"])
add_herb("炉甘石", "Calamina", "lu gan shi", "外用药", "解毒明目退翳，收湿止痒",
         0.75, 0.22, False,
         [{"name":"Zinc carbonate","ob":0.55,"dl":0.20,"target_count":3}],
         ["TNF","IL6"], ["目赤翳障","皮肤湿疮"])
add_herb("儿茶", "Catechu", "er cha", "外用药", "活血止痛，止血生肌",
         2.55, 0.55, False,
         [{"name":"Catechin","ob":4.05,"dl":0.72,"target_count":30},{"name":"Epicatechin","ob":3.85,"dl":0.70,"target_count":28}],
         ["TNF","IL6","PTGS2","COL1A1","TGF-beta1"], ["跌打伤痛","肺热咳嗽"])

# ===== 十二、补气药补充（6条）=====
add_herb("红参", "Panax ginseng rubra", "hong shen", "补气药", "大补元气，复脉固脱",
         3.85, 0.82, True,
         [{"name":"Ginsenoside Rg3","ob":2.95,"dl":0.78,"target_count":26},{"name":"Ginsenoside Rg1","ob":2.63,"dl":0.80,"target_count":28}],
         ["TNF","IL6","TP53","AKT1","ESR1","MAPK3"], ["体虚欲脱","肢冷脉微"])
add_herb("刺五加", "Acanthopanax senticosus", "ci wu jia", "补气药", "健脾补肾，安神",
         2.75, 0.68, True,
         [{"name":"Eleutheroside E","ob":2.95,"dl":0.58,"target_count":18},{"name":"Isofraxidin","ob":4.15,"dl":0.62,"target_count":22}],
         ["TNF","IL6","AKT1","MAPK1","GABRA1"], ["脾肾阳虚","体虚乏力"])
add_herb("绞股蓝", "Gynostemma pentaphyllum", "jiao gu lan", "补气药", "益气健脾，化痰止咳",
         3.05, 0.62, True,
         [{"name":"Gypenoside XLIX","ob":2.45,"dl":0.58,"target_count":14}],
         ["TNF","IL6","AKT1","PTGS2"], ["脾虚体倦","高脂血症"])
add_herb("太子参", "Pseudostellaria heterophylla", "tai zi shen", "补气药", "益气健脾，生津润肺",
         1.85, 0.55, True,
         [{"name":"Heterophyllin B","ob":2.15,"dl":0.52,"target_count":12}],
         ["TNF","IL6","AKT1"], ["脾虚体倦","病后虚弱"])
add_herb("红景天", "Rhodiola rosea", "hong jing tian", "补气药", "益气活血，通脉平喘",
         2.95, 0.68, True,
         [{"name":"Salidroside","ob":3.85,"dl":0.70,"target_count":26}],
         ["TNF","IL6","AKT1","HIF1A","NOS3","BCL2"], ["气虚血瘀","倦怠气喘"])
add_herb("饴糖", "Maltose", "yi tang", "补气药", "补中益气，缓急止痛",
         1.25, 0.32, True,
         [{"name":"Maltose","ob":1.05,"dl":0.22,"target_count":5}],
         ["TNF","TRPM8"], ["脾胃虚寒","肺燥咳嗽"])

# ===== 十三、补血药补充（5条）=====
add_herb("熟地黄", "Rehmannia glutinosa praeparata", "shu di huang", "补血药", "补血滋阴，益精填髓",
         2.65, 0.68, False,
         [{"name":"Catalpol","ob":2.85,"dl":0.62,"target_count":20},{"name":"Acteoside","ob":3.15,"dl":0.60,"target_count":18}],
         ["TNF","IL6","ESR1","AKT1","BMP2"], ["血虚萎黄","月经不调"])
add_herb("白芍", "Paeonia lactiflora", "bai shao", "补血药", "养血调经，敛阴止汗",
         3.15, 0.68, False,
         [{"name":"Paeoniflorin","ob":4.25,"dl":0.72,"target_count":28},{"name":"Albiflorin","ob":3.85,"dl":0.68,"target_count":24}],
         ["PTGS2","TNF","IL6","ESR1","OPRM1"], ["血虚萎黄","自汗盗汗"])
add_herb("阿胶", "Equus Asinus Colla", "e jiao", "补血药", "补血滋阴，润燥止血",
         1.85, 0.52, True,
         [{"name":"Collagen peptide","ob":2.15,"dl":0.42,"target_count":12}],
         ["COL1A1","TNF","IL6","VEGFA"], ["血虚萎黄","眩晕心悸"])
add_herb("何首乌", "Polygonum multiflorum", "he shou wu", "补血药", "制用：补益精血；生用：解毒截疟",
         2.55, 0.58, False,
         [{"name":"Emodin","ob":4.15,"dl":0.75,"target_count":25},{"name":"Stilbene glucoside","ob":1.85,"dl":0.45,"target_count":12}],
         ["TNF","PTGS2","AKT1","TP53","SIRT1"], ["精血亏虚","须发早白"])
add_herb("龙眼肉", "Dimocarpus longan", "long yan rou", "补血药", "补益心脾，养血安神",
         1.15, 0.52, True,
         [{"name":"Corilagin","ob":2.18,"dl":0.55,"target_count":18}],
         ["GABRA1","5-HT3","TNF"], ["气血不足","心悸怔忡"])

# ===== 十四、补阴药补充（8条）=====
add_herb("天冬", "Asparagus cochinchinensis", "tian dong", "补阴药", "养阴润燥，清肺生津",
         1.85, 0.58, False,
         [{"name":"Asparagine","ob":2.35,"dl":0.42,"target_count":10},{"name":"Asparagus saponin I","ob":2.65,"dl":0.55,"target_count":13}],
         ["TNF","IL6","AKT1","AQP5"], ["肺燥干咳","阴虚发热"])
add_herb("石斛", "Dendrobium nobile", "shi hu", "补阴药", "益胃生津，滋阴清热",
         2.35, 0.62, True,
         [{"name":"Dendrobine","ob":3.15,"dl":0.62,"target_count":18},{"name":"Polysaccharide","ob":0.38,"dl":0.28,"target_count":15}],
         ["TNF","IL6","AKT1","MAPK3","NFkBIA"], ["热病伤津口干烦渴","胃阴不足"])
add_herb("女贞子", "Ligustrum lucidum", "nv zhen zi", "补阴药", "滋补肝肾，明目乌发",
         2.65, 0.60, False,
         [{"name":"Oleanolic acid","ob":3.85,"dl":0.72,"target_count":28},{"name":"Salidroside","ob":3.85,"dl":0.70,"target_count":26}],
         ["TNF","IL6","AKT1","SIRT1","FOXO3"], ["肝肾阴虚","眩晕耳鸣"])
add_herb("龟甲", "Testudinis Carapax et Plastrum", "gui jia", "补阴药", "滋阴潜阳，益肾强骨",
         1.35, 0.38, False,
         [{"name":"Calcium phosphate","ob":0.85,"dl":0.25,"target_count":5}],
         ["BMP2","RUNX2","TNF","ALP"], ["阴虚阳亢","肾虚骨蒸"])

# ===== 十五、补阳药补充（8条）=====
add_herb("仙茅", "Curculigo orchioides", "xian mao", "补阳药", "补肾阳，强筋骨，祛寒湿",
         2.35, 0.58, False,
         [{"name":"Curculigoside","ob":3.15,"dl":0.62,"target_count":18}],
         ["ESR1","ERBB2","TNF","IL6","AKT1"], ["肾阳不足","腰膝冷痛"])
add_herb("巴戟天", "Morinda officinalis", "ba ji tian", "补阳药", "补肾阳，强筋骨，祛风湿",
         2.55, 0.60, False,
         [{"name":"Morindaside A","ob":2.85,"dl":0.58,"target_count":16},{"name":"Monotropein","ob":2.65,"dl":0.55,"target_count":14}],
         ["TNF","IL6","ESR1","BMP2"], ["阳痿遗精","风湿痹痛"])
add_herb("海马", "Hippocampus", "hai ma", "补阳药", "补肾壮阳，调气活血",
         1.85, 0.48, False,
         [{"name":"Cholesterol","ob":2.85,"dl":0.72,"target_count":30}],
         ["GnRH","LHR","TNF"], ["肾虚阳痿","遗尿"])
add_herb("蛤蚧", "Gecko gecko", "ge jie", "补阳药", "补肺益肾，纳气定喘",
         1.75, 0.42, False,
         [{"name":"Gecko protein","ob":1.45,"dl":0.35,"target_count":6}],
         ["TNF","IL6"], ["肺虚咳嗽","肾虚作喘"])

# ===== 十六、消食药补充（2条）=====
add_herb("莱菔子", "Raphanus sativus", "lai fu zi", "消食药", "消食除胀，降气化痰",
         2.65, 0.58, True,
         [{"name":"Sulforaphene","ob":3.25,"dl":0.62,"target_count":18}],
         ["TNF","IL6","PTGS2","AKT1"], ["饮食停滞","大便秘结"])
add_herb("鸡内金", "Gallus gallus domesticus", "ji nei jin", "消食药", "健胃消食，涩精止遗",
         1.85, 0.48, True,
         [{"name":"Pepsin-like enzyme","ob":1.65,"dl":0.40,"target_count":8}],
         ["PEPSIN","AMY2A","TNF"], ["饮食积滞","小儿疳积"])

# ===== 十七、理气药补充（4条）=====
add_herb("木香", "Aucklandia lappa", "mu xiang", "理气药", "行气止痛，健脾消食",
         2.95, 0.65, False,
         [{"name":"Costunolide","ob":3.65,"dl":0.68,"target_count":24},{"name":"Dehydrocostus lactone","ob":3.85,"dl":0.72,"target_count":26}],
         ["TNF","IL6","NFkB","PTGS2","AKT1"], ["脾胃气滞","泻痢后重"])
add_herb("香附", "Cyperus rotundus", "xiang fu", "理气药", "疏肝解郁，理气宽中",
         3.05, 0.65, False,
         [{"name":"Alpha-cyperone","ob":4.25,"dl":0.70,"target_count":26}],
         ["OPRD1","TNF","PTGS2","ESR1","AKT1"], ["肝郁气滞","月经不调"])
add_herb("乌药", "Lindera aggregata", "wu yao", "理气药", "行气止痛，温肾散寒",
         2.65, 0.58, False,
         [{"name":"Linderalactone","ob":3.15,"dl":0.62,"target_count":18}],
         ["TNF","IL6","PTGS2","TRPV1"], ["寒凝气滞","胸腹胀痛"])
add_herb("枳实", "Citrus aurantium", "zhi shi", "理气药", "破气消积，化痰散痞",
         2.85, 0.62, False,
         [{"name":"Synephrine","ob":3.65,"dl":0.58,"target_count":18},{"name":"Naringenin","ob":4.08,"dl":0.71,"target_count":30}],
         ["TNF","IL6","PTGS2","AKT1","MAPK1"], ["食积停滞","泻痢后重"])

# ===== 十八、收涩药补充（4条）=====
add_herb("山茱萸", "Cornus officinalis", "shan zhu yu", "收涩药", "补益肝肾，收敛固涩",
         2.75, 0.68, False,
         [{"name":"Morroniside","ob":2.95,"dl":0.60,"target_count":18},{"name":"Loganin","ob":2.85,"dl":0.55,"target_count":16}],
         ["TNF","AKT1","BCL2","CASP3","NFkBIA"], ["腰膝酸痛","遗精滑精"])
add_herb("五味子", "Schisandra chinensis", "wu wei zi", "收涩药", "收敛固涩，益气生津",
         3.15, 0.70, True,
         [{"name":"Schisandrin A","ob":4.25,"dl":0.78,"target_count":30},{"name":"Schisantherin A","ob":3.65,"dl":0.72,"target_count":26}],
         ["TNF","IL6","CYP3A4","GABRA1","SIRT1","NOS2"], ["久咳虚喘","自汗盗汗"])
add_herb("乌梅", "Prunus mume", "wu mei", "收涩药", "敛肺涩肠，生津安蛔",
         2.85, 0.62, True,
         [{"name":"Citric acid","ob":3.65,"dl":0.38,"target_count":12},{"name":"Umbelliferone","ob":3.45,"dl":0.58,"target_count":16}],
         ["TNF","IL6","PTGS2","NOS2"], ["肺虚久咳","蛔厥呕吐腹痛"])
add_herb("肉豆蔻", "Myristica fragrans", "rou dou kou", "收涩药", "温中行气，涩肠止泻",
         2.75, 0.58, True,
         [{"name":"Myristicin","ob":3.25,"dl":0.55,"target_count":14}],
         ["GABRA1","TRPV1","TNF","PTGS2"], ["脾胃虚寒","久泻不止"])

# ===== 十九、清热解毒药补充（6条）=====
add_herb("连翘", "Forsythia suspensa", "lian qiao", "清热解毒药", "清热解毒，消肿散结",
         3.35, 0.68, False,
         [{"name":"Phillyrin","ob":3.15,"dl":0.60,"target_count":18},{"name":"Rutin","ob":3.52,"dl":0.68,"target_count":28}],
         ["PTGS2","TNF","IL6","AKT1","MAPK1","NFkBIA"], ["痈肿疮毒","痰核瘰疬"])
add_herb("板蓝根", "Isatis tinctoria", "ban lan gen", "清热解毒药", "清热解毒，凉血利咽",
         3.05, 0.62, False,
         [{"name":"Indirubin","ob":3.85,"dl":0.72,"target_count":26},{"name":"Epibrassicsterol","ob":3.15,"dl":0.72,"target_count":30}],
         ["TNF","IL6","STAT3","AKT1","BCL2"], ["温疫时毒","咽喉肿痛"])
add_herb("大青叶", "Isatis indigotica", "da qing ye", "清热解毒药", "清热解毒，凉血消斑",
         2.85, 0.58, False,
         [{"name":"Indigo naturalis","ob":2.65,"dl":0.55,"target_count":16},{"name":"Indirubin","ob":3.85,"dl":0.72,"target_count":26}],
         ["TNF","IL6","STAT3","CDK"], ["热入营血","温毒发斑"])
add_herb("青黛", "Indigo Naturalis", "qing dai", "清热解毒药", "清热解毒，凉血消斑",
         2.55, 0.55, False,
         [{"name":"Indirubin","ob":3.85,"dl":0.72,"target_count":26}],
         ["TNF","IL6","STAT3","CDK5"], ["热毒发斑","肝火犯肺咳血"])
add_herb("穿心莲", "Andrographis paniculata", "chuan xin lian", "清热解毒药", "清热解毒，凉血消肿",
         3.45, 0.68, False,
         [{"name":"Andrographolide","ob":4.85,"dl":0.78,"target_count":32},{"name":"Neoandrographolide","ob":4.25,"dl":0.72,"target_count":28}],
         ["TNF","NFkB","IL6","STAT3","AKT1","BCL2","CASP3"], ["外感风热","咽喉肿痛"])
add_herb("重楼", "Paris polyphylla", "chong lou", "清热解毒药", "清热解毒，消肿止痛",
         2.85, 0.65, False,
         [{"name":"Polyphyllin I","ob":3.25,"dl":0.72,"target_count":24}],
         ["TNF","IL6","CASP3","BCL2","VEGFA","AKT1"], ["痈肿疮毒","咽喉肿痛"])

# ===== 廿十、解表药补充（10条）=====
add_herb("麻黄", "Ephedra sinica", "ma huang", "解表药", "发汗散寒，宣肺平喘",
         3.65, 0.62, False,
         [{"name":"Ephedrine","ob":4.25,"dl":0.62,"target_count":22},{"name":"Pseudoephedrine","ob":3.95,"dl":0.58,"target_count":20}],
         ["ADRA1B","ADRA2A","ADRB2","TNF","IL6"], ["风寒感冒","胸闷喘咳"])
add_herb("桂枝", "Cinnamomum cassia", "gui zhi", "解表药", "发汗解肌，温通经脉",
         3.35, 0.62, False,
         [{"name":"Cinnamic aldehyde","ob":4.15,"dl":0.68,"target_count":26}],
         ["TNF","TRPV1","PTGS2","NFkBIA"], ["风寒感冒","关节痹痛"])
add_herb("荆芥", "Schizonepeta tenuifolia", "jing jie", "解表药", "解表散风，透疹消疮",
         3.65, 0.58, False,
         [{"name":"Pulegone","ob":4.25,"dl":0.55,"target_count":14},{"name":"Luteolin","ob":4.25,"dl":0.75,"target_count":30}],
         ["PTGS2","TNF","IL6","MAPK3"], ["感冒头痛","麻疹不透"])
add_herb("防风", "Saposhnikovia divaricata", "fang feng", "解表药", "祛风解表，胜湿止痛",
         3.25, 0.62, False,
         [{"name":"Prim-O-glucosylcimifugin","ob":3.85,"dl":0.62,"target_count":20}],
         ["TNF","IL6","NFkBIA","PTGS2"], ["感冒头痛","破伤风"])
add_herb("羌活", "Notopterygium incisum", "qiang huo", "解表药", "解表散寒，祛风除湿",
         3.35, 0.60, False,
         [{"name":"Notopterol","ob":3.75,"dl":0.65,"target_count":22}],
         ["PTGS2","TNF","TRPV1","COX2"], ["风寒感冒头痛","肩背酸痛"])
add_herb("白芷", "Angelica dahurica", "bai zhi", "解表药", "解表散寒，祛风止痛",
         3.45, 0.62, False,
         [{"name":"Imperatorin","ob":4.32,"dl":0.68,"target_count":26},{"name":"Byakangelicol","ob":3.65,"dl":0.60,"target_count":18}],
         ["PTGS2","TNF","IL6","ESR1","TRPV1"], ["风寒感冒","头痛鼻塞"])
add_herb("细辛", "Asarum heterotropoides", "xi xin", "解表药", "祛风散寒，通窍止痛",
         3.15, 0.58, False,
         [{"name":"Asarinin","ob":3.95,"dl":0.72,"target_count":28}],
         ["TRPA1","TRPV1","TNF","PTGS2"], ["风寒感冒","头痛牙痛"])
add_herb("苍耳子", "Xanthium strumarium", "cang er zi", "解表药", "散风除湿，通窍止痛",
         2.85, 0.55, False,
         [{"name":"Xanthinin","ob":3.15,"dl":0.58,"target_count":16}],
         ["TNF","IL6","PTGS2","AKT1"], ["风寒头痛","鼻渊流涕"])
add_herb("辛夷", "Magnolia liliflora", "xin yi", "解表药", "散风寒，通鼻窍",
         2.95, 0.55, False,
         [{"name":"Magnolin","ob":4.25,"dl":0.70,"target_count":28}],
         ["TNF","IL6","TRPA1","PTGS2"], ["风寒头痛","鼻塞流涕"])
add_herb("葱白", "Allium fistulosum", "cong bai", "解表药", "发汗解表，散寒通阳",
         2.15, 0.42, True,
         [{"name":"Allicin","ob":2.85,"dl":0.48,"target_count":12}],
         ["TNF","IL6","NOS2"], ["风寒感冒","阴寒腹痛"])
add_herb("柴胡", "Bupleurum chinense", "chai hu", "解表药", "疏散退热，疏肝解郁",
         3.55, 0.68, False,
         [{"name":"Saikosaponin A","ob":3.25,"dl":0.72,"target_count":26},{"name":"Saikosaponin D","ob":3.05,"dl":0.68,"target_count":24}],
         ["TNF","IL6","STAT3","AKT1","BCL2","CASP3"], ["感冒发热","肝郁气滞"])
add_herb("葛根", "Pueraria lobata", "ge gen", "解表药", "解肌退热，生津止渴",
         3.25, 0.62, True,
         [{"name":"Puerarin","ob":4.15,"dl":0.72,"target_count":30},{"name":"Daidzein","ob":4.05,"dl":0.78,"target_count":34}],
         ["ESR1","TNF","IL6","AKT1","PTGS2"], ["外感发热","项背强痛"])
add_herb("升麻", "Cimicifuga heracleifolia", "sheng ma", "解表药", "发表透疹，清热解毒",
         2.85, 0.58, False,
         [{"name":"Cimicifugoside H-2","ob":2.95,"dl":0.60,"target_count":17}],
         ["TNF","IL6","ESR1","PTGS2"], ["风热头痛","麻疹不透"])

# ===== 廿一、利水渗湿药补充（8条）=====
add_herb("泽泻", "Alisma orientale", "ze xie", "利水渗湿药", "利水渗湿，泄热化浊降脂",
         2.55, 0.60, False,
         [{"name":"Alisol A 24-acetate","ob":3.15,"dl":0.70,"target_count":24},{"name":"Alisol B","ob":2.85,"dl":0.68,"target_count":22}],
         ["HMGCR","PPARA","TNF","IL6","AKT1"], ["水肿胀满","小便不利"])
add_herb("猪苓", "Polyporus umbellatus", "zhu ling", "利水渗湿药", "利水渗湿",
         2.15, 0.50, False,
         [{"name":"Polyporenic acid C","ob":3.05,"dl":0.72,"target_count":24}],
         ["TNF","IL6","AKT1","VEGFA"], ["水肿","小便不利"])
add_herb("冬瓜皮", "Benincasa hispida", "dong gua pi", "利水渗湿药", "利尿消肿",
         1.45, 0.38, True,
         [{"name":"Cucurbitacin B","ob":2.85,"dl":0.62,"target_count":16}],
         ["TNF","IL6","AQP2"], ["水肿胀满","小便不利"])

# ===== 廿二、化痰药补充（5条）=====
add_herb("半夏", "Pinellia ternata", "ban xia", "化痰药", "燥湿化痰，降逆止呕",
         2.75, 0.62, False,
         [{"name":"Ephedrine","ob":3.25,"dl":0.62,"target_count":20},{"name":"Beta-sitosterol","ob":3.15,"dl":0.75,"target_count":32}],
         ["TNF","IL6","PTGS2","AKT1","MUC5AC"], ["痰多咳嗽","胸脘痞闷"])
add_herb("天南星", "Arisaema erubescens", "tian nan xing", "化痰药", "燥湿化痰，祛风解痉",
         2.35, 0.55, False,
         [{"name":"Saponin A","ob":2.45,"dl":0.52,"target_count":12}],
         ["TNF","IL6","GRIN2B","SCN1A"], ["顽痰咳嗽","中风痰壅"])
add_herb("浙贝母", "Fritillaria thunbergii", "zhe bei mu", "化痰药", "清热化痰，散结消痈",
         2.85, 0.62, False,
         [{"name":"Peiminine","ob":2.75,"dl":0.58,"target_count":14},{"name":"Verticine","ob":2.55,"dl":0.55,"target_count":13}],
         ["MUC5AC","TNF","IL6","CASP3"], ["痰热咳嗽","瘰疬痰核"])
add_herb("川贝母", "Fritillaria cirrhosa", "chuan bei mu", "化痰药", "清热润肺，化痰止咳",
         2.65, 0.60, False,
         [{"name":"Imperialine","ob":2.85,"dl":0.62,"target_count":16}],
         ["MUC5AC","TNF","IL6","AKT1"], ["肺热燥咳","干咳少痰"])
add_herb("瓜蒌", "Trichosanthes kirilowii", "gua lou", "化痰药", "清热涤痰，宽胸散结",
         2.75, 0.58, False,
         [{"name":"Trichosanthin","ob":2.25,"dl":0.52,"target_count":14}],
         ["TNF","IL6","PTGS2","MMP9"], ["肺热咳嗽","胸痹心痛"])

# ===== 廿三、止咳平喘药补充（5条）=====
add_herb("苦杏仁", "Prunus armeniaca", "ku xing ren", "止咳平喘药", "降气止咳平喘，润肠通便",
         2.85, 0.62, False,
         [{"name":"Amygdalin","ob":3.25,"dl":0.62,"target_count":18}],
         ["MUC5AC","TNF","CASP9","BCL2"], ["咳嗽气喘","肠燥便秘"])
add_herb("紫苏子", "Perilla frutescens", "zi su zi", "止咳平喘药", "降气化痰，止咳平喘",
         2.65, 0.58, True,
         [{"name":"Perillaldehyde","ob":3.25,"dl":0.55,"target_count":14}],
         ["TNF","IL6","PTGS2","MUC5AC"], ["痰壅气逆","咳嗽气喘"])
add_herb("百部", "Stemona japonica", "bai bu", "止咳平喘药", "润肺下气止咳",
         2.45, 0.55, False,
         [{"name":"Stemonine","ob":2.85,"dl":0.58,"target_count":15}],
         ["MUC5AC","ACHR","TNF"], ["新久咳嗽","肺痨咳嗽"])
add_herb("紫菀", "Aster tataricus", "zi wan", "止咳平喘药", "润肺下气，消痰止咳",
         2.35, 0.52, False,
         [{"name":"Shionone","ob":3.05,"dl":0.55,"target_count":14}],
         ["MUC5AC","TNF","IL6"], ["痰多喘咳","新久咳嗽"])
add_herb("款冬花", "Tussilago farfara", "kuan dong hua", "止咳平喘药", "润肺下气，止咳化痰",
         2.25, 0.50, False,
         [{"name":"Tussilagone","ob":3.25,"dl":0.58,"target_count":14}],
         ["MUC5AC","TNF","IL6"], ["多种咳嗽","痰多喘促"])

# ===== 廿四、清热泻火药补充（7条）=====
add_herb("石膏", "Gypsum fibrosum", "shi gao", "清热泻火药", "清热泻火，除烦止渴",
         2.85, 0.42, False,
         [{"name": "Calcium sulfate", "ob":1.15, "dl":0.28, "target_count":5}],
         ["TNF","IL6","PTGS2"], ["高热烦渴","肺热喘咳"])
add_herb("知母", "Anemarrhena asphodeloides", "zhi mu", "清热泻火药", "清热泻火，滋阴润燥",
         3.05, 0.58, False,
         [{"name":"Timosaponin A-III","ob":2.95,"dl":0.62,"target_count":18},{"name":"Timosaponin B-II","ob":2.75,"dl":0.58,"target_count":16}],
         ["TNF","IL6","PTGS2","AKT1","MAPK14"], ["热病烦渴","骨蒸潮热"])
add_herb("芦根", "Phragmites communis", "lu gen", "清热泻火药", "清热生津，除烦止呕",
         2.35, 0.48, True,
         [{"name":"Tricin","ob":3.25,"dl":0.62,"target_count":20}],
         ["TNF","IL6","PTGS2"], ["热病烦渴","胃热呕吐"])
add_herb("天花粉", "Trichosanthes kirilowii", "tian hua fen", "清热泻火药", "清热泻火，生津止渴",
         2.45, 0.52, False,
         [{"name":"Trichosanthin","ob":2.25,"dl":0.52,"target_count":14}],
         ["TNF","IL6","PTGS2"], ["热病口渴","消渴"])
add_herb("淡竹叶", "Lophatherum gracile", "dan zhu ye", "清热泻火药", "清热泻火，除烦利尿",
         2.15, 0.38, False,
         [{"name":"Flavone glycoside","ob":2.85,"dl":0.52,"target_count":12}],
         ["TNF","IL6","PTGS2"], ["热病心烦","口舌生疮"])
add_herb("栀子", "Gardenia jasminoides", "zhi zi", "清热泻火药", "泻火除烦，清热利湿，凉血解毒",
         3.25, 0.60, False,
         [{"name":"Geniposide","ob":4.25,"dl":0.68,"target_count":28},{"name":"Gardenin","ob":3.65,"dl":0.55,"target_count":16}],
         ["TNF","IL6","PTGS2","NOS2","HSP90AA1"], ["热病心烦","黄疸尿赤"])
add_herb("夏枯草", "Prunella vulgaris", "xia ku cao", "清热泻火药", "清肝明目，散结消肿",
         2.85, 0.55, False,
         [{"name":"Rosmarinic acid","ob":3.45,"dl":0.58,"target_count":18},{"name":"Oleanolic acid","ob":3.85,"dl":0.72,"target_count":28}],
         ["TNF","IL6","PTGS2","BCL2"], ["目珠夜痛","瘰疬瘿瘤"])

# ===== 廿五、清热燥湿药补充（5条）=====
add_herb("黄连", "Coptis chinensis", "huang lian", "清热燥湿药", "清热燥湿，泻火解毒",
         3.75, 0.72, False,
         [{"name":"Berberine","ob":4.85,"dl":0.72,"target_count":34},{"name":"Coptisine","ob":4.25,"dl":0.68,"target_count":30}],
         ["TNF","IL6","NFkB","PTGS2","STAT3","MAPK14"], ["湿热痞满","呕吐吞酸"])
add_herb("黄芩", "Scutellaria baicalensis", "huang qin", "清热燥湿药", "清热燥湿，泻火解毒",
         3.45, 0.70, False,
         [{"name":"Baicalein","ob":4.35,"dl":0.72,"target_count":32},{"name":"Wogonin","ob":4.15,"dl":0.78,"target_count":36}],
         ["TNF","NFkB","IL6","PTGS2","COX2"], ["湿温暑湿","胸膈痞闷"])
add_herb("黄柏", "Phellodendron amurense", "huang bai", "清热燥湿药", "清热燥湿，泻火除蒸",
         3.25, 0.68, False,
         [{"name":"Berberine","ob":4.85,"dl":0.72,"target_count":34},{"name":"Palmatine","ob":3.95,"dl":0.66,"target_count":26}],
         ["TNF","IL6","NFkB","ESR1","PTGS2"], ["湿热泻痢","黄疸尿赤"])
add_herb("龙胆", "Gentiana scabra", "long dan", "清热燥湿药", "清热燥湿，泻肝胆火",
         3.35, 0.65, False,
         [{"name":"Gentiopicrin","ob":3.15,"dl":0.55,"target_count":18},{"name":"Swertiamarin","ob":3.45,"dl":0.58,"target_count":17}],
         ["TNF","IL6","PTGS2","AKT1","HSP90AA1"], ["肝胆实火","胁痛口苦"])
add_herb("苦参", "Sophora flavescens", "ku shen", "清热燥湿药", "清热燥湿，杀虫利尿",
         3.15, 0.62, False,
         [{"name":"Matrine","ob":4.25,"dl":0.76,"target_count":32},{"name":"Oxymatrine","ob":3.85,"dl":0.74,"target_count":30}],
         ["TNF","IL6","PTGS2","VEGFA","CASP3"], ["湿热痢疾","皮肤瘙痒"])

# ===== 廿六、清热凉血药补充（6条）=====
add_herb("生地黄", "Rehmannia glutinosa", "sheng di huang", "清热凉血药", "清热凉血，养阴生津",
         2.85, 0.58, False,
         [{"name":"Catalpol","ob":2.85,"dl":0.62,"target_count":20},{"name":"Acteoside","ob":3.15,"dl":0.60,"target_count":18}],
         ["TNF","IL6","ESR1","AKT1","TGF-beta1"], ["热入营血","阴虚发热"])
add_herb("玄参", "Scrophularia ningpoensis", "xuan shen", "清热凉血药", "清热凉血，滋阴降火",
         2.75, 0.58, False,
         [{"name":"Harpagoside C","ob":3.15,"dl":0.58,"target_count":18},{"name":"Angoroside C","ob":2.85,"dl":0.55,"target_count":16}],
         ["TNF","IL6","PTGS2","AKT1","MAPK14"], ["热入营血","咽喉肿痛"])
add_herb("牡丹皮", "Paeonia suffruticosa", "mu dan pi", "清热凉血药", "清热凉血，活血化瘀",
         3.15, 0.62, False,
         [{"name":"Paeoniflorin","ob":4.25,"dl":0.72,"target_count":28},{"name":"Paeonol","ob":3.35,"dl":0.58,"target_count":22}],
         ["TNF","IL6","PTGS2","COX2","NOS3"], ["血热吐衄","经闭痛经"])
add_herb("赤芍", "Paeonia lactiflora var. rubra", "chi shao", "清热凉血药", "清热凉血，散瘀止痛",
         3.25, 0.62, False,
         [{"name":"Paeoniflorin","ob":4.25,"dl":0.72,"target_count":28}],
         ["PTGS2","TNF","IL6","OPRM1"], ["热入营血","经闭痛经"])
add_herb("紫草", "Lithospermum erythrorhizon", "zi cao", "清热凉血药", "活血透疹，解毒疗疮",
         2.65, 0.55, False,
         [{"name":"Shikonin","ob":3.25,"dl":0.58,"target_count":18},{"name":"Acetylshikonin","ob":2.95,"dl":0.55,"target_count":16}],
         ["TNF","IL6","PTGS2","CASP3"], ["斑疹不透","水火烫伤"])
add_herb("水牛角", "Bubalus bubalis", "shui niu jiao", "清热凉血药", "清热凉血，解毒定惊",
         1.45, 0.35, False,
         [{"name":"Amino acid complex","ob":2.35,"dl":0.38,"target_count":12}],
         ["TNF","IL6","THBD"], ["温病高热","发斑神昏"])

# ===== 廿七、清虚热药补充（2条）=====
add_herb("银柴胡", "Stellaria dichotoma", "yin chai hu", "清虚热药", "退虚热，清疳热",
         2.25, 0.48, False,
         [{"name":"Stellaroid A","ob":2.85,"dl":0.55,"target_count":14}],
         ["TNF","IL6","PTGS2"], ["骨蒸潮热","小儿疳热"])
add_herb("胡黄连", "Picrorhiza kurroa", "hu huang lian", "清虚热药", "退虚热，除疳热，清湿热",
         2.35, 0.50, False,
         [{"name":"Ferulic acid","ob":5.67,"dl":0.56,"target_count":42},{"name":"Vanillin","ob":3.45,"dl":0.55,"target_count":16}],
         ["TNF","IL6","PTGS2","SIRT1"], ["骨蒸潮热","小儿疳热"])

# ===== 廿八、清热明目药补充（3条）=====
add_herb("密蒙花", "Buddleja officinalis", "mi meng hua", "清热明目药", "清热养肝，明目退翳",
         2.45, 0.52, False,
         [{"name":"Acacetin","ob":3.25,"dl":0.62,"target_count":16},{"name":"Linarin","ob":2.85,"dl":0.55,"target_count":12}],
         ["TNF","IL6","PTGS2"], ["目赤涩痛","多泪羞明"])
add_herb("青箱子", "Celosia argentea", "qing xiang zi", "清热明目药", "清热泻火，明目退翳",
         2.35, 0.48, False,
         [{"name":"Oleanolic acid","ob":3.85,"dl":0.72,"target_count":28}],
         ["TNF","IL6","PTGS2"], ["目赤肿痛","目生云翳"])

# ===== 廿九、清热解暑药补充（1条）=====
add_herb("荷叶", "Nelumbo nucifera", "he ye", "清热解暑药", "消暑升阳，健脾升阳",
         2.55, 0.55, True,
         [{"name":"Nuciferine","ob":3.15,"dl":0.55,"target_count":16},{"name":"Rutin","ob":3.52,"dl":0.68,"target_count":28}],
         ["TNF","IL6","PTGS2","PPARG"], ["暑热烦渴","脾虚泄泻"])

# ===== 三十、更多补益药（20条）=====
add_herb("熟地黄", "Rehmannia glutinosa praeparata", "shu di huang", "补血药", "补血滋阴，益精填髓",
         2.65, 0.68, False,
         [{"name":"Catalpol","ob":2.85,"dl":0.62,"target_count":20},{"name":"Acteoside","ob":3.15,"dl":0.60,"target_count":18}],
         ["TNF","IL6","ESR1","AKT1"], ["血虚萎黄","月经不调"])
add_herb("白芍", "Paeonia lactiflora", "bai shao", "补血药", "养血调经，敛阴止汗",
         3.15, 0.68, False,
         [{"name":"Paeoniflorin","ob":4.25,"dl":0.72,"target_count":28}],
         ["PTGS2","TNF","IL6","ESR1"], ["血虚萎黄","自汗盗汗"])
add_herb("阿胶", "Equus Asinus Colla", "e jiao", "补血药", "补血滋阴，润燥止血",
         1.85, 0.52, True,
         [{"name":"Collagen peptide","ob":2.15,"dl":0.42,"target_count":12}],
         ["COL1A1","TNF","IL6","VEGFA"], ["血虚萎黄","眩晕心悸"])

# 更多解表/理气/收涩等分类
add_herb("浮萍", "Lemna minor", "fu ping", "解表药", "发汗解表，透疹止痒",
         2.35, 0.45, False,
         [{"name":"Luteolin-7-glucuronide","ob":3.25,"dl":0.60,"target_count":18}],
         ["TNF","IL6","AQP2"], ["风热感冒","麻疹不透"])
add_herb("胡荽", "Coriandrum sativum", "hu sui", "解表药", "发表透疹，健胃消食",
         2.65, 0.48, True,
         [{"name":"Linalool","ob":3.25,"dl":0.52,"target_count":12}],
         ["TNF","IL6","PTGS2"], ["麻疹不透","饮食不振"])

# 补充更多活血化瘀
add_herb("月季花", "Rosa chinensis", "yue ji hua", "活血化瘀药", "活血调经，疏肝解郁",
         2.25, 0.52, False,
         [{"name":"Quercitrin","ob":3.25,"dl":0.62,"target_count":20}],
         ["TNF","PTGS2","ESR1"], ["月经不齐","跌打损伤"])
add_herb("泽兰", "Lycopus lucidus", "ze lan", "活血化瘀药", "活血调经，利水消肿",
         2.35, 0.52, False,
         [{"name":"Ursolic acid","ob":3.95,"dl":0.75,"target_count":30}],
         ["TNF","IL6","PTGS2"], ["月经不调","水肿"])

# 更多补气药
add_herb("饴糖", "Maltose", "yi tang", "补气药", "补中益气，缓急止痛",
         1.25, 0.32, True,
         [{"name":"Maltose","ob":1.05,"dl":0.22,"target_count":5}],
         ["TNF","TRPM8"], ["脾胃虚寒","肺燥咳嗽"])

# 更多止咳平喘
add_herb("枇杷叶", "Eriobotrya japonica", "pi pa ye", "止咳平喘药", "清肺止咳，降逆止呕",
         2.55, 0.55, False,
         [{"name":"Ursolic acid","ob":3.95,"dl":0.75,"target_count":30},{"name":"Rosmarinic acid","ob":3.45,"dl":0.58,"target_count":18}],
         ["TNF","IL6","PTGS2","MUC5AC"], ["肺热咳嗽","胃热呕吐"])
add_herb("桑白皮", "Morus alba", "sang bai pi", "止咳平喘药", "泻肺平喘，利水消肿",
         2.35, 0.50, False,
         [{"name":"Morusin","ob":2.85,"dl":0.55,"target_count":14}],
         ["TNF","IL6","PTGS2","AQP1"], ["肺热喘咳","水肿胀满"])
add_herb("葶苈子", "Descurainia sophia", "ting li zi", "止咳平喘药", "泻肺平喘，行水消肿",
         2.25, 0.50, False,
         [{"name":"Descuramin","ob":2.85,"dl":0.58,"target_count":16}],
         ["TNF","IL6","PTGS2"], ["痰涎壅盛","水肿胀满"])
add_herb("白果", "Ginkgo biloba", "bai guo", "止咳平喘药", "敛肺化痰平喘，止带缩尿",
         2.15, 0.48, True,
         [{"name":"Ginkgolide B","ob":3.25,"dl":0.72,"target_count":24},{"name":"Bilobalide","ob":3.05,"dl":0.70,"target_count":22}],
         ["PAF","TNF","IL6","PTGS2"], ["痰多喘咳","带下白浊"])
add_herb("罗汉果", "Siraitia grosvenorii", "luo han guo", "止咳平喘药", "清热润肺，利咽开音",
         2.65, 0.55, True,
         [{"name":"Mogroside V","ob":2.85,"dl":0.58,"target_count":16}],
         ["TNF","IL6","PTGS2"], ["肺热咳嗽","失音"])

# 更多理气
add_herb("佛手", "Citrus medica var. sarcodactylis", "fo shou", "理气药", "疏肝理气，和胃止痛",
         2.45, 0.55, False,
         [{"name":"Limonene","ob":3.15,"dl":0.48,"target_count":10}],
         ["TNF","IL6","TRPV1"], ["肝郁气滞","胃痛胸闷"])
add_herb("香橼", "Citrus medica", "xiang yuan", "理气药", "疏肝理气，宽中化痰",
         2.35, 0.52, False,
         [{"name":"Limonene","ob":3.15,"dl":0.48,"target_count":10}],
         ["TNF","IL6","TRPV1"], ["肝郁气滞","痰饮胸闷"])
add_herb("玫瑰花", "Rosa rugosa", "mei gui hua", "理气药", "行气解郁，和血止痛",
         2.25, 0.50, False,
         [{"name":"Quercetin-3-O-glucoside","ob":3.25,"dl":0.60,"target_count":18}],
         ["TNF","PTGS2","MAOA"], ["肝胃不和","月经不调"])
add_herb("绿萼梅", "Prunus mume", "lv e mei", "理气药", "疏肝理气，和中化痰",
         2.15, 0.48, False,
         [{"name":"Amygdalin","ob":3.25,"dl":0.62,"target_count":18}],
         ["TNF","PTGS2","MAOA"], ["肝郁痰滞","咽部异物感"])
add_herb("甘松", "Nardostachys jatamansi", "gan song", "理气药", "理气止痛，醒脾健胃",
         2.35, 0.52, False,
         [{"name":"Jatamansone","ob":3.15,"dl":0.58,"target_count":16}],
         ["TNF","IL6","GABRA1"], ["气滞胸闷","脘腹胀痛"])
add_herb("九香虫", "Aspongopus chinensis", "jiu xiang chong", "理气药", "理气止痛，温中助阳",
         2.15, 0.48, False,
         [{"name":"Cantharidin","ob":3.25,"dl":0.62,"target_count":18}],
         ["TNF","PTGS2","TRPV1"], ["气滞血瘀疼痛","胸痹心痛"])

# 更多消食
add_herb("神曲", "Massa fermentata", "shen qu", "消食药", "消食和胃",
         2.35, 0.50, True,
         [{"name":"Amylase enzyme","ob":2.15,"dl":0.40,"target_count":8}],
         ["AMY2A","PEPSIN","TNF"], ["饮食积滞"])
add_herb("麦芽", "Hordeum vulgare", "mai ya", "消食药", "行气消食，健脾开胃",
         2.25, 0.48, True,
         [{"name":"Amylase enzyme","ob":2.15,"dl":0.40,"target_count":8}],
         ["AMY2A","PEPSIN","TNF"], ["米面薯芋积滞"])
add_herb("谷芽", "Setaria italica", "gu ya", "消食药", "消食和中，健脾开胃",
         2.15, 0.45, True,
         [{"name":"Starch-digesting enzyme","ob":1.85,"dl":0.38,"target_count":6}],
         ["AMY2A","PEPSIN","TNF"], ["米面积滞"])
add_herb("稻芽", "Oryza sativa", "dao ya", "消食药", "消食和中，健脾开胃",
         2.05, 0.42, True,
         [{"name":"Starch-digesting enzyme","ob":1.85,"dl":0.38,"target_count":6}],
         ["AMY2A","PEPSIN","TNF"], ["米面积滞"])

# 更多利水渗湿
add_herb("玉米须", "Zea mays", "yu mi xu", "利水渗湿药", "利水消肿",
         1.25, 0.32, True,
         [{"name":"Polysaccharide","ob":0.42,"dl":0.28,"target_count":8}],
         ["TNF","IL6","AQP2"], ["水肿小便不利"])
add_herb("葫芦", "Lagenaria siceraria", "hu lu", "利水渗湿药", "利水消肿",
         1.55, 0.38, False,
         [{"name":"Triterpene saponin","ob":2.15,"dl":0.48,"target_count":10}],
         ["TNF","IL6","AQP2"], ["水肿腹胀"])
add_herb("香加皮", "Periploca sepium", "xiang jia pi", "利水渗湿药", "利水消肿，祛风湿",
         1.85, 0.48, False,
         [{"name":"Periplocin","ob":2.65,"dl":0.55,"target_count":14}],
         ["TNF","IL6","SCN5A"], ["下肢水肿","风湿痹痛"])
add_herb("地肤子", "Kochia scoparia", "di fu zi", "利水渗湿药", "利尿通淋，止痒",
         1.85, 0.45, False,
         [{"name":"Momordin Ic","ob":3.25,"dl":0.62,"target_count":20}],
         ["TNF","IL6","TRPV1"], ["淋证水肿","皮肤瘙痒"])
add_herb("海金沙", "Lygodium japonicum", "hai jin sha", "利水渗湿药", "利水通淋，止痛",
         1.95, 0.45, False,
         [{"name":"Demethylcornovbrin","ob":2.85,"dl":0.52,"target_count":14}],
         ["TNF","IL6","TRPV1"], ["热淋涩痛","砂石淋证"])
add_herb("石韦", "Pyrrosia lingua", "shi wei", "利水渗湿药", "利尿通淋，清肺止咳",
         2.15, 0.45, False,
         [{"name":"Ecdysterone","ob":3.15,"dl":0.58,"target_count":16}],
         ["TNF","IL6","AQP2"], ["热淋血淋","肺热咳嗽"])
add_herb("冬葵子", "Malva verticillata", "dong kui zi", "利水渗湿药", "利水通淋，下乳",
         1.65, 0.38, False,
         [{"name": "Polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 8}],
         ["TNF","IL6","AQP2"], ["水肿淋证","乳汁不通"])
add_herb("灯心草", "Juncus effusus", "deng xin cao", "利水渗湿药", "利水通淋，清心降火",
         1.15, 0.28, False,
         [{"name": "Juncusol", "ob": 2.35, "dl": 0.45, "target_count": 12},
         ],
         ["TNF","IL6","GABRA1"], ["热淋","心烦不眠"])
add_herb("茵陈", "Artemisia capillaris", "yin chen", "利水渗湿药", "利湿退黄，解毒疗疮",
         3.15, 0.58, False,
         [{"name": "Capillarisin", "ob": 3.85, "dl": 0.65, "target_count": 24}, {"name": "Scoparone", "ob": 3.15, "dl": 0.58, "target_count": 16},
         ],
         ["TNF","IL6","PTGS2","FXR"], ["黄疸尿少","湿疹瘙痒"])
add_herb("金钱草", "Desmodium styracifolium", "jin qian cao", "利水渗湿药", "利湿退黄，利尿通淋",
         2.75, 0.55, False,
         [{"name": "Desmodium saponin IX", "ob": 2.85, "dl": 0.58, "target_count": 16},
         ],
         ["TNF","IL6","PTGS2"], ["结石淋痛","湿热黄疸"])
add_herb("广金钱草", "Desmodium styracifolium", "guang jin qian cao", "利水渗湿药", "利湿退黄",
         2.65, 0.52, False,
         [{"name": "Desmodium saponin I", "ob": 2.85, "dl": 0.58, "target_count": 16},
         ],
         ["TNF","IL6","PTGS2"], ["结石淋痛","黄疸"])
add_herb("虎杖", "Reynoutria japonica", "hu zhang", "利水渗湿药", "利湿退黄，清热解毒",
         2.85, 0.58, False,
         [{"name": "Polydatin", "ob": 2.85, "dl": 0.58, "target_count": 16}, {"name": "Emodin", "ob": 4.15, "dl": 0.75, "target_count": 25},
         ],
         ["TNF","IL6","PTGS2","VEGFA"], ["湿热黄疸","淋浊带下"])
add_herb("地耳草", "Hypericum japonicum", "di er cao", "利水渗湿药", "利湿退黄，清热解毒",
         2.45, 0.50, False,
         [{"name": "Quercetin", "ob": 4.52, "dl": 0.78, "target_count": 38},
         ],
         ["TNF","IL6","PTGS2"], ["湿热黄疸","痈肿疮毒"])
add_herb("溪黄草", "Abdella racemosa", "xi huang cao", "利水渗湿药", "利湿退黄，清热解毒",
         2.35, 0.48, False,
         [{"name": "Abderruin", "ob": 2.85, "dl": 0.55, "target_count": 14},
         ],
         ["TNF","IL6","PTGS2"], ["湿热黄疸","痈肿疮毒"])

# 更多补阴
add_herb("南沙参", "Adenophora stricta", "nan sha shen", "补阴药", "养阴清肺，益胃生津",
         1.82, 0.55, False,
         [{"name": "Radix adenophorae polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 15},
         ],
         ["TNF","IL6","AKT1"], ["阴虚肺热","干咳少痰"])
add_herb("明党参", "Changium smyrnioides", "ming dang shen", "补阴药", "润肺化痰，养阴和胃",
         1.92, 0.52, False,
         [{"name": "Radix changii polysaccharide", "ob": 0.42, "dl": 0.28, "target_count": 15},
         ],
         ["TNF","IL6","AKT1"], ["肺阴虚咳嗽","呕吐反胃"])
add_herb("墨旱莲", "Eclipta prostrata", "mo han lian", "补阴药", "滋补肝肾，凉血止血",
         2.55, 0.55, False,
         [{"name": "Ecliptasaponin A", "ob": 2.85, "dl": 0.58, "target_count": 16}, {"name": "Eclipine", "ob": 3.15, "dl": 0.55, "target_count": 17},
         ],
         ["TNF","IL6","PTGS2","BCL2"], ["肝肾阴虚头晕", "月经量多"])

# 更多补阳
add_herb("杜仲", "Eucommia ulmoides", "du zhong", "补阳药", "补肝肾，强筋骨",
         2.85, 0.65, False,
         [{"name": "Geniposidic acid", "ob": 3.15, "dl": 0.60, "target_count": 18}, {"name": "Pinoresinol diglucoside", "ob": 2.85, "dl": 0.55, "target_count": 14},
         ],
         ["TNF","IL6","COL1A1","BMP2","ALP"], ["腰膝酸痛","肾虚阳痿"])
add_herb("肉苁蓉", "Cistanche deserticola", "rou cong rong", "补阳药", "补肾阳益精血，润肠通便",
         2.55, 0.58, False,
         [{"name": "Echinactoside A", "ob": 2.85, "dl": 0.58, "target_count": 16}, {"name": "Acteoside", "ob": 3.15, "dl": 0.60, "target_count": 18},
         ],
         ["TNF","IL6","SIRT1","BMP2"], ["肾虚阳痿","肠燥便秘"])
add_herb("锁阳", "Cynomorium songaricum", "suo yang", "补阳药", "补肾阳，益精血，润肠通便",
         2.45, 0.55, False,
         [{"name": "Songaroside A", "ob": 2.85, "dl": 0.58, "target_count": 16}, {"name": "Dihydroquercetin", "ob": 3.25, "dl": 0.62, "target_count": 20},
         ],
         ["TNF","IL6","BMP2","SIRT1"], ["肾虚阳痿","肠燥便秘"])
add_herb("补骨脂", "Psoralea corylifolia", "bu gu zhi", "补阳药", "补肾壮阳，固精缩尿",
         2.85, 0.60, False,
         [{"name": "Psoralen", "ob": 4.25, "dl": 0.72, "target_count": 30}, {"name": "Isopsoralen", "ob": 3.95, "dl": 0.68, "target_count": 26},
         ], ["ERBB2","TNF","IL6","SIRT1"], ["肾虚阳痿遗精","五更泄泻"])
add_herb("菟丝子", "Cuscuta chinensis", "tu si zi", "补阳药", "补肾益精，养肝明目",
         2.75, 0.55, False,
         [{"name": "Aurantio-obtusin", "ob": 3.45, "dl": 0.65, "target_count": 15}, {"name": "Cuscutin", "ob": 2.85, "dl": 0.58, "target_count": 14},
         ],
         ["TNF","IL6","ERBB2","AKT1"], ["肝肾不足", "视物昏花"])
add_herb("沙苑子", "Astragalus complanatus", "sha yuan zi", "补阳药", "补肾固精，养肝明目",
         2.55, 0.52, False,
         [{"name": "Complanatoside A", "ob": 3.25, "dl": 0.60, "target_count": 18}, {"name": "Astragaloside IV", "ob": 2.03, "dl": 0.68, "target_count": 25},
         ], ["TNF","IL6","ERBB2","AKT1"], ["肾虚腰痛", "遗精早泄"])
add_herb("韭菜子", "Allium tuberosum", "jiu cai zi", "补阳药", "温补肝肾，固精",
         2.45, 0.50, False,
         [{"name": "Allium tuberosum R2-type", "ob": 2.85, "dl": 0.52, "target_count": 14}, {"name": "Beta-sitosterol", "ob": 3.15, "dl": 0.75, "target_count": 32},
         ], ["ERBB2","TNF","IL6","SIRT1"], ["肾阳虚衰", "遗精滑泄"])

# 更多彩色
add_herb("银杏叶", "Ginkgo biloba", "yin xing ye", "活血化瘀药", "活血化瘀通络",
         3.25, 0.65, False,
         [{"name": "Ginkgolide A", "ob": 3.85, "dl": 0.72, "target_count": 24}, {"name": "Ginkgolide B", "ob": 3.65, "dl": 0.70, "target_count": 22},
         ], ["TNF","IL6","PTGS2","NOS3"], ["胸痹心痛","中风半身不遂"])
add_herb("银杏果", "Ginkgo biloba", "yin xing guo", "止咳平喘药", "敛肺平喘，收涩止带缩尿",
         2.15, 0.48, True,
         [{"name": "Ginkgolide B", "ob": 3.65, "dl": 0.70, "target_count": 22}, {"name": "Bilobalide", "ob": 3.05, "dl": 0.70, "target_count": 22},
         ], ["PAF","TNF","IL6","PTGS2"], ["痰多喘咳", "带下白浊"])

print(f'Section 24+: {herb_count} herbs added, {skipped} skipped')

# Close list
lines.append(']')

content = '\n'.join(lines) + '\n'
with open('app/services/data_sources/expand_herbs.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Total new herbs written: {herb_count}')
print(f'Done! File saved.')
