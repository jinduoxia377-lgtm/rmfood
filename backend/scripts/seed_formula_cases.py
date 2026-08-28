# -*- coding: utf-8 -*-
"""Seed data for formula_cases - 真实配方案例数据"""
import sys
import asyncio
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

SEED_CASES = [
    # ── 补气养血类 ──────────────────────────────────────────
    {
        "title": "八珍汤加味治疗气血两虚型贫血",
        "formula_id": 1,
        "category": "补气养血",
        "tags": ["贫血", "气血两虚", "八珍汤"],
        "summary": "患者女性，32岁，面色苍白、乏力头晕3月，血常规示Hb 82g/L。予八珍汤加黄芪30g、当归15g，连服4周后Hb升至118g/L，症状明显改善。",
        "content": "## 病例信息\n\n- **患者**：女性，32岁\n- **主诉**：面色苍白、乏力头晕3月\n- **既往史**：月经量多5年\n- **辅助检查**：Hb 82g/L，MCV 78fL，血清铁蛋白 8ug/L\n\n## 辨证分析\n\n气血两虚，脾不统血。经量过多致气血耗伤，冲任失养。\n\n## 处方\n\n八珍汤加味：\n- 党参15g  白术12g  茯苓15g  甘草6g\n- 熟地15g  当归12g  川芎6g  白芍12g\n- 黄芪30g  阿胶10g(烊化)\n\n## 疗程与疗效\n\n服药4周后复查：Hb 118g/L，症状明显缓解。\n\n## 随访\n\n3个月后Hb稳定在120g/L以上，继续调理脾胃以固本。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1250,
        "likes": 89,
        "bookmarks": 34,
        "created_by": 1,
    },
    {
        "title": "归脾汤治疗心脾两虚失眠症",
        "formula_id": 2,
        "category": "补气养血",
        "tags": ["失眠", "心脾两虚", "归脾汤"],
        "summary": "患者男性，45岁，失眠多梦半年，伴心悸健忘、神疲食少。舌淡苔薄白，脉细弱。予归脾汤加减治疗，2周后睡眠改善，4周后夜眠安稳。",
        "content": "## 病例信息\n\n- **患者**：男性，45岁\n- **主诉**：失眠多梦半年\n- **伴随症状**：心悸健忘、神疲食少\n- **舌脉**：舌淡苔薄白，脉细弱\n\n## 辨证\n\n心脾两虚，气血不足，神不守舍。\n\n## 处方\n\n归脾汤加减：\n- 党参15g  黄芪20g  白术12g  茯苓15g\n- 龙眼肉15g  酸枣仁15g  远志6g\n- 当归10g  木香6g  甘草6g\n\n## 疗效\n\n2周后入睡时间缩短至30分钟，4周后睡眠基本正常。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 890,
        "likes": 56,
        "bookmarks": 21,
        "created_by": 1,
    },
    # ── 滋阴润燥类 ──────────────────────────────────────────
    {
        "title": "六味地黄丸加减治疗糖尿病肾病患者",
        "formula_id": 3,
        "category": "滋阴润燥",
        "tags": ["糖尿病肾病", "六味地黄丸", "蛋白尿"],
        "summary": "2型糖尿病肾病III期患者，男，58岁，大量蛋白尿伴双下肢水肿。予六味地黄丸合水陆二仙汤加减，3个月后24h尿蛋白由4.2g降至1.8g。",
        "content": "## 病例信息\n\n- **患者**：男性，58岁\n- **诊断**：2型糖尿病肾病III期\n- **基线指标**：24h尿蛋白 4.2g，Scr 156umol/L\n\n## 处方\n\n六味地黄丸合水陆二仙汤加减：\n- 熟地20g  山萸肉15g  山药20g\n- 泽泻10g  丹皮10g  茯苓15g\n- 金樱子15g  芡实15g  黄芪30g\n\n## 疗效\n\n服药3个月后：24h尿蛋白降至1.8g，Scr稳定。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 2100,
        "likes": 145,
        "bookmarks": 67,
        "created_by": 1,
    },
    {
        "title": "沙参麦冬汤治疗干燥综合征",
        "formula_id": 4,
        "category": "滋阴润燥",
        "tags": ["干燥综合征", "沙参麦冬汤", "口眼干燥"],
        "summary": "女性，42岁，口干眼干3年，双眼异物感，吞咽干性食物困难。SSA/SSB抗体阳性。予沙参麦冬汤加味，2月后症状显著改善。",
        "content": "## 病例信息\n\n- **患者**：女性，42岁\n- **主诉**：口干眼干3年\n- **实验室**：SSA(+)/SSB(+)\n\n## 处方\n\n沙参麦冬汤加味：\n- 北沙参15g  麦冬15g  玉竹12g\n- 天花粉12g  扁豆10g  桑叶10g  甘草6g\n- 加石斛15g  花粉15g  五味子6g\n\n## 疗效\n\n服药2月后面干眼干明显减轻，饮水次数减少50%。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 780,
        "likes": 43,
        "bookmarks": 18,
        "created_by": 1,
    },
    # ── 清热解毒类 ──────────────────────────────────────────
    {
        "title": "黄连解毒汤治疗特应性皮炎急性期",
        "formula_id": 5,
        "category": "清热解毒",
        "tags": ["特应性皮炎", "黄连解毒汤", "湿热"],
        "summary": "女性，28岁，面部及四肢红斑丘疹伴剧烈瘙痒2月，渗出明显。予黄连解毒汤合五味消毒饮，1周后渗出减少，2周后皮损基本消退。",
        "content": "## 病例信息\n\n- **患者**：女性，28岁\n- **诊断**：特应性皮炎（急性期）\n- **表现**：红斑丘疹、渗出、剧烈瘙痒\n\n## 处方\n\n黄连解毒汤合五味消毒饮：\n- 黄连6g  黄芩12g  黄柏12g  栀子10g\n- 金银花20g  野菊花15g  蒲公英20g\n- 紫花地丁15g  天花粉15g\n\n## 疗效\n\n1周后渗出减少，2周后皮损基本消退，瘙痒明显缓解。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1560,
        "likes": 98,
        "bookmarks": 42,
        "created_by": 1,
    },
    {
        "title": "普济消毒饮治疗流行性腮腺炎",
        "formula_id": 6,
        "category": "清热解毒",
        "tags": ["腮腺炎", "普济消毒饮", "传染"],
        "summary": "儿童，男，8岁，发热腮肿3天。体温38.5度，双侧腮颊肿胀疼痛。予普济消毒饮加减，3天后热退肿消。",
        "content": "## 病例信息\n\n- **患者**：男性，8岁\n- **主诉**：发热伴双侧腮颊肿胀3天\n- **体征**：T 38.5C，双侧腮腺肿大\n\n## 处方\n\n普济消毒饮加减：\n- 黄芩10g  黄连6g  板蓝根15g  马勃6g\n- 牛蒡子10g  玄参12g  柴胡6g  桔梗6g\n- 连翘15g  陈皮6g\n\n## 疗效\n\n服药3天后热退肿消，5天痊愈。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 620,
        "likes": 31,
        "bookmarks": 9,
        "created_by": 1,
    },
    # ── 活血化瘀类 ──────────────────────────────────────────
    {
        "title": "血府逐瘀汤治疗冠心病稳定型心绞痛",
        "formula_id": 7,
        "category": "活血化瘀",
        "tags": ["冠心病", "心绞痛", "血府逐瘀汤"],
        "summary": "男性，62岁，胸痹心痛反复发作1年，活动后加重。冠脉CTA示前降支狭窄60%。予血府逐瘀汤合丹参饮，3月后心绞痛发作频率减少80%。",
        "content": "## 病例信息\n\n- **患者**：男性，62岁\n- **诊断**：冠心病稳定型心绞痛\n- **检查**：冠脉CTA前降支狭窄60%\n\n## 处方\n\n血府逐瘀汤合丹参饮：\n- 桃仁12g  红花10g  当归12g  川芎10g\n- 赤芍15g  柴胡6g  枳壳10g  桔梗6g\n- 牛膝12g  丹参20g  檀香3g  砂仁3g\n\n## 疗效\n\n服药3月后心绞痛发作频率减少80%，运动耐量提高。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1890,
        "likes": 124,
        "bookmarks": 56,
        "created_by": 1,
    },
    {
        "title": "桂枝茯苓丸治疗卵巢囊肿",
        "formula_id": 8,
        "category": "活血化瘀",
        "tags": ["卵巢囊肿", "桂枝茯苓丸", "妇科"],
        "summary": "女性，35岁，体检发现左侧卵巢囊肿4.5cm，伴经期腹痛。予桂枝茯苓丸加减治疗3月，复查囊肿缩小至1.8cm。",
        "content": "## 病例信息\n\n- **患者**：女性，35岁\n- **B超**：左侧卵巢囊肿 4.5×3.8cm\n- **症状**：经期下腹疼痛\n\n## 处方\n\n桂枝茯苓丸加减：\n- 桂枝10g  茯苓15g  丹皮12g  桃仁12g  赤芍15g\n- 加莪术10g  三棱10g  香附12g\n\n## 疗效\n\n服药3月后复查B超：囊肿缩小至1.8cm。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 1340,
        "likes": 87,
        "bookmarks": 38,
        "created_by": 1,
    },
    # ── 祛湿化浊类 ──────────────────────────────────────────
    {
        "title": "温胆汤治疗高脂血症痰湿证",
        "formula_id": 9,
        "category": "祛湿化浊",
        "tags": ["高脂血症", "温胆汤", "痰湿"],
        "summary": "男性，50岁，体检发现总胆固醇7.2mmol/L，甘油三酯3.8mmol/L。形体偏胖，头重胸闷。予温胆汤合山楂 Reduction 制剂，2月后TC降至5.1。",
        "content": "## 病例信息\n\n- **患者**：男性，50岁\n- **血脂**：TC 7.2, TG 3.8, LDL 4.5\n- **体质**：形体偏胖，头重胸闷\n\n## 处方\n\n温胆汤合山楂 Reduction：\n- 半夏10g  陈皮10g  茯苓15g  竹茹10g\n- 枳实10g  甘草6g  山楂20g  决明子15g\n\n## 疗效\n\n服药2月后：TC 5.1, TG 2.1, LDL 3.0。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1670,
        "likes": 103,
        "bookmarks": 48,
        "created_by": 1,
    },
    {
        "title": "三仁汤治疗肠易激综合征腹泻型",
        "formula_id": 10,
        "category": "祛湿化浊",
        "tags": ["肠易激综合征", "三仁汤", "腹泻"],
        "summary": "女性，29岁，反复腹泻伴腹痛2年，便前腹痛、便后缓解，大便每日3-5次。肠镜检查未见器质性病变。予三仁汤加减，4周后症状明显改善。",
        "content": "## 病例信息\n\n- **患者**：女性，29岁\n- **病史**：反复腹泻伴腹痛2年\n- **肠镜**：未见器质性病变\n\n## 处方\n\n三仁汤加减：\n- 杏仁10g  白蔻仁6g  薏苡仁30g\n- 厚朴10g  通草6g  滑石15g\n- 半夏10g  茯苓15g  加苍术10g  防风10g\n\n## 疗效\n\n服药4周后大便次数减少至每日1-2次，腹痛消失。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 950,
        "likes": 62,
        "bookmarks": 25,
        "created_by": 1,
    },
    # ── 扶正固本类 ──────────────────────────────────────────
    {
        "title": "玉屏风散预防反复呼吸道感染",
        "formula_id": 11,
        "category": "扶正固本",
        "tags": ["免疫力", "玉屏风散", "呼吸道感染"],
        "summary": "女性，45岁，近半年反复感冒5次，每于气候变化时发作。予玉屏风散合桂枝汤调理，1年后随访仅感冒1次。",
        "content": "## 病例信息\n\n- **患者**：女性，45岁\n- **病史**：近半年反复感冒5次\n\n## 处方\n\n玉屏风散合桂枝汤：\n- 黄芪20g  白术12g  防风10g\n- 桂枝10g  白芍12g  生姜3片  甘草6g\n\n## 疗效\n\n服药2月后改为丸剂调理3月，1年后仅感冒1次。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 720,
        "likes": 45,
        "bookmarks": 16,
        "created_by": 1,
    },
    {
        "title": "左归丸治疗肾性贫血",
        "formula_id": 12,
        "category": "扶正固本",
        "tags": ["肾性贫血", "左归丸", "CKD"],
        "summary": "女性，61岁，CKD 4期伴肾性贫血，Hb 78g/L，不耐受促红细胞生成素。予左归丸合当归补血汤，2月后Hb升至96g/L。",
        "content": "## 病例信息\n\n- **患者**：女性，61岁\n- **诊断**：CKD 4期伴肾性贫血\n- **基线**：Hb 78g/L，eGFR 22ml/min\n\n## 处方\n\n左归丸合当归补血汤：\n- 熟地20g  山药15g  山萸肉12g\n- 枸杞15g  菟丝子15g  鹿角胶10g\n- 当归10g  黄芪30g\n\n## 疗效\n\n2月后Hb升至96g/L，乏力改善。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1120,
        "likes": 76,
        "bookmarks": 31,
        "created_by": 1,
    },
    # ── 疏肝理气类 ──────────────────────────────────────────
    {
        "title": "柴胡疏肝散治疗肝郁气滞型抑郁症",
        "formula_id": 13,
        "category": "疏肝理气",
        "tags": ["抑郁症", "柴胡疏肝散", "肝郁"],
        "summary": "女性，35岁，情绪低落伴胸闷胁胀6月，SCL-90抑郁因子分高于正常。予柴胡疏肝散合逍遥散加减，8周后HAMD评分从28分降至8分。",
        "content": "## 病例信息\n\n- **患者**：女性，35岁\n- **评分**：HAMD 28分，SCL-90抑郁因子增高\n\n## 处方\n\n柴胡疏肝散合逍遥散：\n- 柴胡12g  白芍15g  枳壳10g  香附12g\n- 川芎10g  郁金12g  合欢皮15g\n- 茯苓15g  白术12g  甘草6g\n\n## 疗效\n\n8周后HAMD 8分，情绪明显好转。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 1430,
        "likes": 95,
        "bookmarks": 44,
        "created_by": 1,
    },
    # ── 化痰散结类 ──────────────────────────────────────────
    {
        "title": "海藻玉壶汤治疗甲状腺结节",
        "formula_id": 14,
        "category": "化痰散结",
        "tags": ["甲状腺结节", "海藻玉壶汤", "气郁痰凝"],
        "summary": "女性，42岁，体检发现双侧甲状腺结节，最大1.5cm。伴胸闷叹息，情绪抑郁。予海藻玉壶汤加减，3月后结节缩小至0.8cm。",
        "content": "## 病例信息\n\n- **患者**：女性，42岁\n- **B超**：双侧甲状腺结节，最大1.5cm\n- **TSH**：正常范围\n\n## 处方\n\n海藻玉壶汤加减：\n- 海藻15g  昆布15g  浙贝母12g\n- 半夏10g  陈皮10g  青皮10g  连翘12g\n- 独活6g  川芎10g  当归12g  甘草6g\n\n## 疗效\n\n服药3月后复查：结节缩小至0.8cm。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1780,
        "likes": 118,
        "bookmarks": 52,
        "created_by": 1,
    },
    # ── 安神定志类 ──────────────────────────────────────────
    {
        "title": "安神定志丸治疗焦虑症伴惊恐发作",
        "formula_id": 15,
        "category": "安神定志",
        "tags": ["焦虑症", "惊恐发作", "安神定志丸"],
        "summary": "男性，38岁，反复惊恐发作4月，每次持续15-30分钟，伴心悸胸闷、濒死感。予安神定志丸合甘麦大枣汤，6周后惊恐发作完全控制。",
        "content": "## 病例信息\n\n- **患者**：男性，38岁\n- **症状**：反复惊恐发作，伴濒死感\n- **诊断**：广泛性焦虑障碍伴惊恐发作\n\n## 处方\n\n安神定志丸合甘麦大枣汤：\n- 人参10g  茯苓15g  茯神15g\n- 远志6g  石菖蒲10g  龙齿20g\n- 小麦30g  大枣10枚  甘草10g\n\n## 疗效\n\n6周后惊恐发作完全控制，GAD-7评分从18降至4。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 860,
        "likes": 54,
        "bookmarks": 22,
        "created_by": 1,
    },
    # ── 健脾和胃类 ──────────────────────────────────────────
    {
        "title": "参苓白术散治疗慢性胃炎脾虚湿盛证",
        "formula_id": 16,
        "category": "健脾和胃",
        "tags": ["慢性胃炎", "参苓白术散", "脾虚"],
        "summary": "女性，55岁，胃脘胀满、纳呆便溏2年。胃镜示慢性萎缩性胃炎。予参苓白术散加减，8周后胃部胀满消失，体重增加3kg。",
        "content": "## 病例信息\n\n- **患者**：女性，55岁\n- **胃镜**：慢性萎缩性胃炎\n- **症状**：胃脘胀满、纳呆便溏\n\n## 处方\n\n参苓白术散加减：\n- 人参10g  白术15g  茯苓15g  甘草6g\n- 山药15g  莲子12g  白扁豆12g\n- 薏苡仁20g  砂仁6g  桔梗6g\n\n## 疗效\n\n8周后症状消失，体重增加3kg。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 740,
        "likes": 48,
        "bookmarks": 19,
        "created_by": 1,
    },
    # ── 补肾填精类 ──────────────────────────────────────────
    {
        "title": "右归丸治疗男性不育肾阳虚证",
        "formula_id": 17,
        "category": "补肾填精",
        "tags": ["男性不育", "右归丸", "肾阳虚"],
        "summary": "男性，33岁，婚后3年未育，精液分析：精子密度8百万/ml，活动率35%。证属肾阳虚，予右归丸加减，4月后精液质量恢复正常。",
        "content": "## 病例信息\n\n- **患者**：男性，33岁\n- **精液分析**：密度8M/ml，活动率35%\n\n## 处方\n\n右归丸加减：\n- 熟地20g  山药15g  山萸肉12g\n- 枸杞15g  杜仲15g  菟丝子15g\n- 鹿角胶10g  肉桂6g  附子6g  当归12g\n\n## 疗效\n\n服药4月后精液分析：密度65M/ml，活动率62%。其妻已妊娠。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 2340,
        "likes": 167,
        "bookmarks": 78,
        "created_by": 1,
    },
    # ── 清热利湿类 ──────────────────────────────────────────
    {
        "title": "四妙丸治疗痛风性关节炎急性发作",
        "formula_id": 18,
        "category": "清热利湿",
        "tags": ["痛风", "四妙丸", "关节炎"],
        "summary": "男性，48岁，第一跖趾关节红肿热痛2天，尿酸680umol/L。予四妙丸合宣痹汤加减，3天后疼痛明显缓解，1周后尿酸降至420。",
        "content": "## 病例信息\n\n- **患者**：男性，48岁\n- **症状**：第一跖趾关节红肿热痛\n- **尿酸**：680 umol/L\n\n## 处方\n\n四妙丸合宣痹汤：\n- 苍术12g  黄柏12g  牛膝15g  薏苡仁30g\n- 防己12g  连翘15g  滑石20g  赤芍15g\n\n## 疗效\n\n3天后疼痛缓解，1周后尿酸420umol/L。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 1050,
        "likes": 71,
        "bookmarks": 29,
        "created_by": 1,
    },
    # ── 调和营卫类 ──────────────────────────────────────────
    {
        "title": "桂枝汤治疗自汗盗汗证",
        "formula_id": 19,
        "category": "调和营卫",
        "tags": ["自汗", "盗汗", "桂枝汤"],
        "summary": "女性，50岁，围绝经期自汗盗汗半年，动则汗出尤甚，伴烘热烦躁。予桂枝汤合牡蛎散加减，2周后汗出明显减少。",
        "content": "## 病例信息\n\n- **患者**：女性，50岁\n- **症状**：自汗盗汗，烘热烦躁\n- **背景**：围绝经期\n\n## 处方\n\n桂枝汤合牡蛎散：\n- 桂枝10g  白芍15g  生姜3片  大枣10枚\n- 煅牡蛎30g  黄芪20g  浮小麦30g  麻黄根10g\n\n## 疗效\n\n2周后汗出明显减少，烘热症状改善。",
        "cover_image": None,
        "is_featured": False,
        "generated_by_ai": False,
        "views": 580,
        "likes": 36,
        "bookmarks": 12,
        "created_by": 1,
    },
    # ── 通络止痛类 ──────────────────────────────────────────
    {
        "title": "独活寄生汤治疗腰椎间盘突出症",
        "formula_id": 20,
        "category": "通络止痛",
        "tags": ["腰椎间盘突出", "独活寄生汤", "腰痛"],
        "summary": "男性，45岁，腰痛伴左下肢放射痛3月，MRI示L4/5椎间盘突出。予独活寄生汤加减配合针灸，2月后症状消失，恢复工作。",
        "content": "## 病例信息\n\n- **患者**：男性，45岁\n- **MRI**：L4/5椎间盘突出\n- **症状**：腰痛伴左下肢放射痛\n\n## 处方\n\n独活寄生汤加减：\n- 独活12g  桑寄生20g  杜仲15g  牛膝15g\n- 细辛3g  秦艽12g  茯苓15g  肉桂6g\n- 防风10g  川芎10g  人参10g  甘草6g\n\n## 疗效\n\n配合针灸治疗2月后症状消失，恢复日常工作。",
        "cover_image": None,
        "is_featured": True,
        "generated_by_ai": False,
        "views": 1920,
        "likes": 132,
        "bookmarks": 61,
        "created_by": 1,
    },
]


async def seed_cases(db):
    """Insert seed cases into the database."""
    from sqlalchemy import text

    # Ensure bookmarks column exists
    try:
        await db.execute(text("ALTER TABLE formula_cases ADD COLUMN bookmarks INTEGER DEFAULT 0"))
        await db.commit()
    except Exception:
        pass

    # Check if cases already exist
    result = await db.execute(text("SELECT COUNT(*) FROM formula_cases"))
    count = result.scalar_one()
    if count > 0:
        print(f"Cases table already has {count} records, skipping seed.")
        return

    for case_data in SEED_CASES:
        await db.execute(
            text("""
                INSERT INTO formula_cases
                (formula_id, category, tags, summary, content,
                 cover_image, is_featured, generated_by_ai,
                 views, likes, bookmarks, created_by, organization_id, created_at, updated_at)
                VALUES (:formula_id, :category, :tags, :summary, :content,
                        :cover_image, :is_featured, :generated_by_ai,
                        :views, :likes, :bookmarks, :created_by, :organization_id, NOW(), NOW())
            """),
            {
                "formula_id": case_data["formula_id"],
                "category": case_data["category"],
                "tags": case_data["tags"],
                "summary": case_data["summary"],
                "content": case_data["content"],
                "cover_image": case_data.get("cover_image"),
                "is_featured": case_data["is_featured"],
                "generated_by_ai": case_data["generated_by_ai"],
                "views": case_data["views"],
                "likes": case_data["likes"],
                "bookmarks": case_data["bookmarks"],
                "created_by": case_data["created_by"],
                "organization_id": None,
            },
        )

    await db.commit()
    print(f"Seeded {len(SEED_CASES)} formula cases.")


if __name__ == "__main__":
    import asyncio
    from app.core.database import async_session_factory

    async def main():
        async with async_session_factory() as db:
            await seed_cases(db)

    asyncio.run(main())
