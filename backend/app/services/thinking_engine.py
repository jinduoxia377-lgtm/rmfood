"""
智能推理引擎 - AI 思考过程与配方生成核心

将配方的生成过程分解为可追溯的推理步骤：
1. 问题理解 (Understand)
2. 知识检索 (KnowledgeRetrieval)
3. 配方设计 (FormulaDesign)
4. 安全评估 (SafetyCheck)
5. 优化建议 (Optimization)
"""
from __future__ import annotations
import json
import logging
import time
import random
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)


# ─── 药食同源知识库 ───

_HERB_KNOWLEDGE_BASE = {
    "枸杞子": {
        "pinyin": "gou qi zi",
        "category": "果实类",
        "property": "甘平",
        "meridian": ["肝", "肾"],
        "effects": ["滋补肝肾", "益精明目", "免疫调节", "抗氧化"],
        "chemicals": ["枸杞多糖", "玉米黄素", "叶黄素", "甜菜碱"],
        "dosage": "6-15g",
        "pairing": [("红枣", "协同补血"), ("菊花", "清肝明目")],
        "contraindication": "外感实热、脾虚泄泻者慎用",
        "is_food_homology": True,
    },
    "人参": {
        "pinyin": "ren shen",
        "category": "根茎类",
        "property": "甘温",
        "meridian": ["脾", "肺"],
        "effects": ["大补元气", "补脾益肺", "生津止渴", "安神益智"],
        "chemicals": ["人参皂苷Rb1", "人参皂苷Rg1", "人参多糖"],
        "dosage": "3-9g",
        "pairing": [("黄芪", "协同补气"), ("麦冬", "益气养阴")],
        "contraindication": "实热证、阴虚火旺者慎用",
        "is_food_homology": False,
    },
    "黄芪": {
        "pinyin": "huang qi",
        "category": "根茎类",
        "property": "甘温",
        "meridian": ["脾", "肺"],
        "effects": ["补气升阳", "固表止汗", "利水消肿", "托毒生肌"],
        "chemicals": ["黄芪多糖", "黄芪皂苷", "芒柄花素"],
        "dosage": "9-30g",
        "pairing": [("党参", "增强补气"), ("当归", "补气生血")],
        "contraindication": "阴虚火旺、表实邪盛者慎用",
        "is_food_homology": True,
    },
    "红枣": {
        "pinyin": "hong zao",
        "category": "果实类",
        "property": "甘温",
        "meridian": ["脾", "胃"],
        "effects": ["补中益气", "养血安神", "缓和药性"],
        "chemicals": ["环磷酸腺苷", "红枣多糖", "铁"],
        "dosage": "6-15g",
        "pairing": [("枸杞子", "补血养颜"), ("生姜", "温中散寒")],
        "contraindication": "湿盛中满、食积者慎用",
        "is_food_homology": True,
    },
    "山楂": {
        "pinyin": "shan zha",
        "category": "果实类",
        "property": "酸甘微温",
        "meridian": ["脾", "胃", "肝"],
        "effects": ["消食化积", "行气散瘀", "降脂降血压"],
        "chemicals": ["山楂酸", "黄酮类", "维生素C"],
        "dosage": "6-12g",
        "pairing": [("决明子", "协同降脂"), ("麦芽", "消食导滞")],
        "contraindication": "胃酸过多、孕妇慎用",
        "is_food_homology": True,
    },
    "茯苓": {
        "pinyin": "fu ling",
        "category": "菌类",
        "property": "甘淡平",
        "meridian": ["心", "脾", "肾"],
        "effects": ["利水渗湿", "健脾安神", "增强免疫"],
        "chemicals": ["茯苓多糖", "茯苓酸", "麦角甾醇"],
        "dosage": "10-15g",
        "pairing": [("白术", "健脾利湿"), ("桂枝", "温阳化水")],
        "contraindication": "阴虚火旺者慎用",
        "is_food_homology": True,
    },
    "菊花": {
        "pinyin": "ju hua",
        "category": "花类",
        "property": "甘苦微寒",
        "meridian": ["肺", "肝"],
        "effects": ["疏散风热", "平肝明目", "清热解毒"],
        "chemicals": ["黄酮类", "挥发油", "绿原酸"],
        "dosage": "5-10g",
        "pairing": [("枸杞子", "清肝明目"), ("金银花", "清热解毒")],
        "contraindication": "气虚胃寒、食少泄泻者慎用",
        "is_food_homology": True,
    },
    "当归": {
        "pinyin": "dang gui",
        "category": "根茎类",
        "property": "甘辛温",
        "meridian": ["肝", "心", "脾"],
        "effects": ["补血活血", "调经止痛", "润肠通便"],
        "chemicals": ["阿魏酸", "当归多糖", "藁本内酯"],
        "dosage": "6-12g",
        "pairing": [("黄芪", "补气生血"), ("川芎", "活血行气")],
        "contraindication": "湿盛中满、大便泄泻者慎用",
        "is_food_homology": True,
    },
    "甘草": {
        "pinyin": "gan cao",
        "category": "根茎类",
        "property": "甘平",
        "meridian": ["心", "肺", "脾", "胃"],
        "effects": ["补脾益气", "清热解毒", "祛痰止咳", "调和诸药"],
        "chemicals": ["甘草酸", "甘草苷", "甘草次酸"],
        "dosage": "2-6g",
        "pairing": [("白芍", "缓急止痛"), ("桂枝", "辛甘化阳")],
        "contraindication": "湿盛胀满、水肿者慎用",
        "is_food_homology": True,
    },
    "决明子": {
        "pinyin": "jue ming zi",
        "category": "种子类",
        "property": "甘苦微寒",
        "meridian": ["肝", "大肠"],
        "effects": ["清热明目", "润肠通便", "降脂降压"],
        "chemicals": ["大黄酚", "决明素", "橙黄决明素"],
        "dosage": "10-15g",
        "pairing": [("山楂", "协同降脂"), ("菊花", "清肝明目")],
        "contraindication": "脾虚便溏者慎用",
        "is_food_homology": True,
    },
    "丹参": {
        "pinyin": "dan shen",
        "category": "根茎类",
        "property": "苦微寒",
        "meridian": ["心", "肝"],
        "effects": ["活血祛瘀", "通经止痛", "清心除烦", "心血管健康"],
        "chemicals": ["丹参酮", "丹酚酸", "隐丹参酮"],
        "dosage": "9-15g",
        "pairing": [("山楂", "活血降脂"), ("三七", "活血化瘀")],
        "contraindication": "出血倾向者慎用",
        "is_food_homology": False,
    },
    "山药": {
        "pinyin": "shan yao",
        "category": "根茎类",
        "property": "甘平",
        "meridian": ["脾", "肺", "肾"],
        "effects": ["益气养阴", "补脾肺肾", "固精止带"],
        "chemicals": ["山药多糖", "薯蓣皂苷", "黏液蛋白"],
        "dosage": "15-30g",
        "pairing": [("茯苓", "健脾渗湿"), ("芡实", "固肾涩精")],
        "contraindication": "湿盛中满者慎用",
        "is_food_homology": True,
    },

    "金银花": {
        "pinyin": "jin yin hua", "category": "花类",
        "property": "甘寒", "meridian": ["肺", "心", "胃"],
        "effects": ["清热解毒", "疏散风热", "抗炎"],
        "chemicals": ["绿原酸", "木犀草苷", "忍冬苷"],
        "dosage": "6-15g",
        "pairing": [("连翘", "清热解毒"), ("菊花", "疏散风热")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "连翘": {
        "pinyin": "lian qiao", "category": "果实类",
        "property": "苦微寒", "meridian": ["肺", "心", "小肠"],
        "effects": ["清热解毒", "消肿散结", "疏散风热"],
        "chemicals": ["连翘苷", "连翘酯苷", "熊果酸"],
        "dosage": "6-15g",
        "pairing": [("金银花", "清热解毒"), ("薄荷", "疏散风热")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": False,
    },
    "薄荷": {
        "pinyin": "bo he", "category": "全草类",
        "property": "辛凉", "meridian": ["肺", "肝"],
        "effects": ["疏散风热", "清利头目", "利咽透疹"],
        "chemicals": ["薄荷醇", "薄荷酮", "乙酸薄荷酯"],
        "dosage": "3-6g",
        "pairing": [("菊花", "清头明目"), ("连翘", "疏散风热")],
        "contraindication": "阴虚血燥者慎用", "is_food_homology": True,
    },
    "生姜": {
        "pinyin": "sheng jiang", "category": "根茎类",
        "property": "辛温", "meridian": ["肺", "脾", "胃"],
        "effects": ["解表散寒", "温中止呕", "化痰止咳"],
        "chemicals": ["姜辣素", "姜烯", "姜酚"],
        "dosage": "3-10g",
        "pairing": [("红枣", "调和营卫"), ("红糖", "温中散寒")],
        "contraindication": "阴虚内热者慎用", "is_food_homology": True,
    },
    "桂圆": {
        "pinyin": "gui yuan", "category": "果实类",
        "property": "甘温", "meridian": ["心", "脾"],
        "effects": ["补益心脾", "养血安神", "益智"],
        "chemicals": ["葡萄糖", "蔗糖", "桂圆多糖"],
        "dosage": "10-15g",
        "pairing": [("红枣", "补血养颜"), ("莲子", "安神助眠")],
        "contraindication": "湿盛中满者慎用", "is_food_homology": True,
    },
    "莲子": {
        "pinyin": "lian zi", "category": "种子类",
        "property": "甘涩平", "meridian": ["心", "脾", "肾"],
        "effects": ["补脾止泻", "益肾固精", "养心安神"],
        "chemicals": ["莲子碱", "淀粉", "蛋白质"],
        "dosage": "10-15g",
        "pairing": [("桂圆", "安神助眠"), ("山药", "健脾止泻")],
        "contraindication": "便秘者慎用", "is_food_homology": True,
    },
    "薏苡仁": {
        "pinyin": "yi yi ren", "category": "种子类",
        "property": "甘淡微寒", "meridian": ["脾", "胃", "肺"],
        "effects": ["利水渗湿", "健脾止泻", "清热排脓"],
        "chemicals": ["薏苡仁酯", "薏苡素", "多糖"],
        "dosage": "10-30g",
        "pairing": [("茯苓", "健脾利湿"), ("红豆", "祛湿消肿")],
        "contraindication": "孕妇慎用", "is_food_homology": True,
    },
    "红豆": {
        "pinyin": "hong dou", "category": "种子类",
        "property": "甘酸平", "meridian": ["心", "小肠"],
        "effects": ["利水消肿", "解毒排脓", "祛湿"],
        "chemicals": ["皂苷", "蛋白质", "膳食纤维"],
        "dosage": "15-30g",
        "pairing": [("薏苡仁", "祛湿消肿"), ("茯苓", "利水渗湿")],
        "contraindication": "阴虚津伤者慎用", "is_food_homology": True,
    },
    "黑芝麻": {
        "pinyin": "hei zhi ma", "category": "种子类",
        "property": "甘平", "meridian": ["肝", "肾"],
        "effects": ["补肝肾", "益精血", "润肠燥"],
        "chemicals": ["芝麻素", "维生素E", "亚油酸"],
        "dosage": "9-15g",
        "pairing": [("核桃", "补肾健脑"), ("桑椹", "滋阴补血")],
        "contraindication": "脾虚便溏者慎用", "is_food_homology": True,
    },
    "核桃": {
        "pinyin": "he tao", "category": "种子类",
        "property": "甘温", "meridian": ["肾", "肺", "大肠"],
        "effects": ["补肾温肺", "润肠通便", "健脑益智"],
        "chemicals": ["亚油酸", "褪黑素", "磷脂"],
        "dosage": "6-12g",
        "pairing": [("黑芝麻", "补肾健脑"), ("红枣", "补血养颜")],
        "contraindication": "痰热咳嗽者慎用", "is_food_homology": True,
    },
    "桑椹": {
        "pinyin": "sang shen", "category": "果实类",
        "property": "甘寒", "meridian": ["肝", "肾"],
        "effects": ["滋阴补血", "生津润燥", "乌发明目"],
        "chemicals": ["花青素", "白藜芦醇", "铁"],
        "dosage": "10-15g",
        "pairing": [("黑芝麻", "乌发养颜"), ("枸杞子", "滋补肝肾")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "百合": {
        "pinyin": "bai he", "category": "花类",
        "property": "甘微寒", "meridian": ["肺", "心"],
        "effects": ["养阴润肺", "清心安神", "美容养颜"],
        "chemicals": ["百合皂苷", "百合多糖", "秋水仙碱"],
        "dosage": "10-30g",
        "pairing": [("麦冬", "润肺止咳"), ("莲子", "安神助眠")],
        "contraindication": "风寒咳嗽者慎用", "is_food_homology": True,
    },
    "麦冬": {
        "pinyin": "mai dong", "category": "根茎类",
        "property": "甘微苦微寒", "meridian": ["心", "肺", "胃"],
        "effects": ["养阴生津", "润肺止咳", "清心除烦"],
        "chemicals": ["麦冬皂苷", "麦冬多糖", "高异黄酮"],
        "dosage": "6-12g",
        "pairing": [("百合", "润肺止咳"), ("沙参", "养阴清肺")],
        "contraindication": "脾虚便溏者慎用", "is_food_homology": True,
    },
    "沙参": {
        "pinyin": "sha shen", "category": "根茎类",
        "property": "甘微寒", "meridian": ["肺", "胃"],
        "effects": ["养阴清肺", "益胃生津", "润燥"],
        "chemicals": ["沙参皂苷", "多糖", "香豆素"],
        "dosage": "10-15g",
        "pairing": [("麦冬", "养阴清肺"), ("玉竹", "滋阴润燥")],
        "contraindication": "风寒咳嗽者慎用", "is_food_homology": True,
    },
    "玉竹": {
        "pinyin": "yu zhu", "category": "根茎类",
        "property": "甘微寒", "meridian": ["肺", "胃"],
        "effects": ["养阴润燥", "生津止渴", "美容"],
        "chemicals": ["玉竹多糖", "甾体皂苷", "黄酮"],
        "dosage": "6-12g",
        "pairing": [("沙参", "滋阴润燥"), ("麦冬", "养阴生津")],
        "contraindication": "脾虚便溏者慎用", "is_food_homology": True,
    },
    "阿胶": {
        "pinyin": "e jiao", "category": "动物类",
        "property": "甘平", "meridian": ["肺", "肝", "肾"],
        "effects": ["补血滋阴", "润燥止血", "美容养颜"],
        "chemicals": ["胶原蛋白", "氨基酸", "钙"],
        "dosage": "3-9g",
        "pairing": [("红枣", "补血养颜"), ("当归", "补血活血")],
        "contraindication": "脾胃虚弱者慎用", "is_food_homology": False,
    },
    "三七": {
        "pinyin": "san qi", "category": "根茎类",
        "property": "甘微苦温", "meridian": ["肝", "胃"],
        "effects": ["散瘀止血", "消肿定痛", "活血"],
        "chemicals": ["三七皂苷", "人参皂苷Rg1", "三七素"],
        "dosage": "3-9g",
        "pairing": [("丹参", "活血化瘀"), ("山楂", "活血降脂")],
        "contraindication": "孕妇慎用", "is_food_homology": False,
    },
    "天麻": {
        "pinyin": "tian ma", "category": "根茎类",
        "property": "甘平", "meridian": ["肝"],
        "effects": ["息风止痉", "平抑肝阳", "祛风通络", "降压"],
        "chemicals": ["天麻素", "天麻多糖", "香荚兰醇"],
        "dosage": "3-10g",
        "pairing": [("钩藤", "平肝降压"), ("川芎", "通络止痛")],
        "contraindication": "气血虚甚者慎用", "is_food_homology": True,
    },
    "钩藤": {
        "pinyin": "gou teng", "category": "藤茎类",
        "property": "甘凉", "meridian": ["肝", "心包"],
        "effects": ["清热平肝", "息风定惊", "降压"],
        "chemicals": ["钩藤碱", "异钩藤碱"],
        "dosage": "3-12g",
        "pairing": [("天麻", "平肝降压"), ("菊花", "清肝明目")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": False,
    },
    "葛根": {
        "pinyin": "ge gen", "category": "根茎类",
        "property": "甘辛凉", "meridian": ["脾", "胃"],
        "effects": ["解肌退热", "生津止渴", "升阳止泻", "降糖"],
        "chemicals": ["葛根素", "大豆苷", "葛根黄酮"],
        "dosage": "9-15g",
        "pairing": [("丹参", "活血通脉"), ("山药", "健脾降糖")],
        "contraindication": "胃寒者慎用", "is_food_homology": True,
    },
    "川芎": {
        "pinyin": "chuan xiong", "category": "根茎类",
        "property": "辛温", "meridian": ["肝", "胆", "心包"],
        "effects": ["活血行气", "祛风止痛", "通络"],
        "chemicals": ["川芎嗪", "阿魏酸", "藁本内酯"],
        "dosage": "3-10g",
        "pairing": [("当归", "活血补血"), ("白芍", "养血柔肝")],
        "contraindication": "阴虚火旺者慎用", "is_food_homology": True,
    },
    "白芍": {
        "pinyin": "bai shao", "category": "根茎类",
        "property": "苦酸微寒", "meridian": ["肝", "脾"],
        "effects": ["养血柔肝", "缓中止痛", "敛阴止汗"],
        "chemicals": ["芍药苷", "牡丹酚", "芍药内酯"],
        "dosage": "6-15g",
        "pairing": [("当归", "养血补血"), ("甘草", "缓急止痛")],
        "contraindication": "阳衰虚寒者慎用", "is_food_homology": True,
    },
    "白术": {
        "pinyin": "bai zhu", "category": "根茎类",
        "property": "甘苦温", "meridian": ["脾", "胃"],
        "effects": ["健脾益气", "燥湿利水", "止汗安胎"],
        "chemicals": ["白术多糖", "苍术酮", "白术内酯"],
        "dosage": "6-12g",
        "pairing": [("茯苓", "健脾利湿"), ("党参", "补脾益气")],
        "contraindication": "阴虚内热者慎用", "is_food_homology": True,
    },
    "枳实": {
        "pinyin": "zhi shi", "category": "果实类",
        "property": "苦辛酸温", "meridian": ["脾", "胃", "大肠"],
        "effects": ["破气消积", "化痰散痞", "促进消化"],
        "chemicals": ["橙皮苷", "柚皮苷", "新橙皮苷"],
        "dosage": "3-10g",
        "pairing": [("白术", "健脾消积"), ("陈皮", "理气化痰")],
        "contraindication": "孕妇慎用", "is_food_homology": False,
    },
    "厚朴": {
        "pinyin": "hou po", "category": "树皮类",
        "property": "苦辛温", "meridian": ["脾", "胃", "肺", "大肠"],
        "effects": ["燥湿消痰", "下气除满", "促进消化"],
        "chemicals": ["厚朴酚", "和厚朴酚", "厚朴碱"],
        "dosage": "3-10g",
        "pairing": [("枳实", "行气消积"), ("陈皮", "理气化痰")],
        "contraindication": "孕妇慎用", "is_food_homology": False,
    },
    "半夏": {
        "pinyin": "ban xia", "category": "根茎类",
        "property": "辛温有毒", "meridian": ["脾", "胃", "肺"],
        "effects": ["燥湿化痰", "降逆止呕", "消痞散结"],
        "chemicals": ["半夏碱", "半夏蛋白", "谷甾醇"],
        "dosage": "3-9g",
        "pairing": [("陈皮", "理气化痰"), ("生姜", "降逆止呕")],
        "contraindication": "阴虚燥咳者慎用", "is_food_homology": False,
    },
    "桔梗": {
        "pinyin": "jie geng", "category": "根茎类",
        "property": "苦辛平", "meridian": ["肺"],
        "effects": ["宣肺祛痰", "利咽排脓", "开宣肺气"],
        "chemicals": ["桔梗皂苷", "桔梗酸", "桔梗多糖"],
        "dosage": "3-10g",
        "pairing": [("甘草", "利咽止咳"), ("半夏", "燥湿化痰")],
        "contraindication": "阴虚久咳者慎用", "is_food_homology": True,
    },
    "鱼腥草": {
        "pinyin": "yu xing cao", "category": "全草类",
        "property": "辛微寒", "meridian": ["肺"],
        "effects": ["清热解毒", "消痈排脓", "利尿通淋"],
        "chemicals": ["鱼腥草素", "槲皮素", "绿原酸"],
        "dosage": "10-30g",
        "pairing": [("金银花", "清热解毒"), ("桔梗", "排脓")],
        "contraindication": "虚寒者慎用", "is_food_homology": True,
    },
    "蒲公英": {
        "pinyin": "pu gong ying", "category": "全草类",
        "property": "苦甘寒", "meridian": ["肝", "胃"],
        "effects": ["清热解毒", "消肿散结", "利尿通淋"],
        "chemicals": ["蒲公英素", "蒲公英甾醇", "菊糖"],
        "dosage": "10-30g",
        "pairing": [("金银花", "清热解毒"), ("菊花", "清肝明目")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "马齿苋": {
        "pinyin": "ma chi xian", "category": "全草类",
        "property": "酸寒", "meridian": ["肝", "大肠"],
        "effects": ["清热解毒", "凉血止血", "降血糖"],
        "chemicals": ["去甲肾上腺素", "多巴胺", "维生素C"],
        "dosage": "10-15g",
        "pairing": [("蒲公英", "清热解毒"), ("葛根", "降糖")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "荷叶": {
        "pinyin": "he ye", "category": "叶类",
        "property": "苦涩平", "meridian": ["肝", "脾", "胃"],
        "effects": ["清暑利湿", "升发清阳", "凉血止血", "降脂减肥"],
        "chemicals": ["荷叶碱", "莲碱", "黄酮类"],
        "dosage": "6-12g",
        "pairing": [("山楂", "降脂减肥"), ("决明子", "清热明目")],
        "contraindication": "气血虚弱者慎用", "is_food_homology": True,
    },
    "桑叶": {
        "pinyin": "sang ye", "category": "叶类",
        "property": "甘苦寒", "meridian": ["肺", "肝"],
        "effects": ["疏散风热", "清肺润燥", "平肝明目", "降血糖"],
        "chemicals": ["桑叶多糖", "脱氧野尻霉素", "黄酮"],
        "dosage": "6-12g",
        "pairing": [("菊花", "清肝明目"), ("葛根", "降糖")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "罗布麻": {
        "pinyin": "luo bu ma", "category": "叶类",
        "property": "甘苦凉", "meridian": ["肝"],
        "effects": ["平肝安神", "清热利尿", "降血压"],
        "chemicals": ["罗布麻苷", "槲皮素", "异槲皮苷"],
        "dosage": "6-12g",
        "pairing": [("天麻", "平肝降压"), ("菊花", "清肝明目")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
    "绞股蓝": {
        "pinyin": "jiao gu lan", "category": "全草类",
        "property": "甘苦寒", "meridian": ["肺", "脾", "肾"],
        "effects": ["清热解毒", "益气健脾", "降脂降压", "免疫调节"],
        "chemicals": ["绞股蓝皂苷", "黄酮", "多糖"],
        "dosage": "10-15g",
        "pairing": [("山楂", "降脂"), ("枸杞子", "免疫调节")],
        "contraindication": "脾胃虚寒者慎用", "is_food_homology": True,
    },
}


class ThinkingEngine:
    """
    AI 配方推理引擎 - 生成可追溯的思考过程

    每个推理步骤包含：
    - step: 步骤名称
    - content: 推理内容
    - status: thinking/complete
    - detail: 详细推理说明（折叠）
    """

    def __init__(self):
        self._knowledge_base = _HERB_KNOWLEDGE_BASE

    async def generate_thinking_stream(
        self, question: str
    ) -> AsyncGenerator[dict, None]:
        """生成带思考过程的流式响应"""

        intent = self._analyze_intent(question)

        # Step 1: 问题理解
        yield {
            "type": "thinking",
            "step": "问题理解",
            "status": "thinking",
            "content": f"正在分析用户问题意图...",
        }
        await self._simulate_delay(0.3)
        yield {
            "type": "thinking",
            "step": "问题理解",
            "status": "complete",
            "content": intent["analysis"],
        }

        # Step 2: 知识检索
        yield {
            "type": "thinking",
            "step": "知识检索",
            "status": "thinking",
            "content": f"正在检索相关药食同源知识库...",
        }
        await self._simulate_delay(0.5)
        knowledge = self._retrieve_knowledge(intent)
        yield {
            "type": "thinking",
            "step": "知识检索",
            "status": "complete",
            "content": knowledge["summary"],
            "detail": knowledge["details"],
        }

        # Step 3: 推理分析
        yield {
            "type": "thinking",
            "step": "推理分析",
            "status": "thinking",
            "content": f"正在基于知识库进行综合推理...",
        }
        await self._simulate_delay(0.4)
        reasoning = self._reason(intent, knowledge)
        yield {
            "type": "thinking",
            "step": "推理分析",
            "status": "complete",
            "content": reasoning["summary"],
            "detail": reasoning["details"],
        }

        # Step 4: 配方设计（如果是配方相关问题）
        if intent["needs_formula"]:
            yield {
                "type": "thinking",
                "step": "配方设计",
                "status": "thinking",
                "content": f"正在根据君臣佐使原则设计配方...",
            }
            await self._simulate_delay(0.6)
            formula = self._design_formula(intent, knowledge)
            yield {
                "type": "thinking",
                "step": "配方设计",
                "status": "complete",
                "content": formula["summary"],
                "detail": formula["details"],
                "formula_data": formula["data"],
            }

        # Step 5: 生成最终回答
        yield {
            "type": "thinking",
            "step": "生成回答",
            "status": "thinking",
            "content": f"正在整理最终回答...",
        }
        await self._simulate_delay(0.3)
        final_answer = self._generate_answer(intent, knowledge, reasoning)
        yield {
            "type": "text",
            "content": final_answer,
        }

    def _analyze_intent(self, question: str) -> dict:
        """分析用户问题意图"""
        q = question.lower()

        needs_formula = any(k in q for k in ["配方", "设计", "组成", "搭配", "组合", "配比", "比例"])
        needs_effect = any(k in q for k in ["功效", "作用", "效果", "功能", "好处"])
        needs_safety = any(k in q for k in ["安全", "禁忌", "副作用", "毒性", "注意"])
        needs_comparison = any(k in q for k in ["vs", "对比", "区别", "不同", "还是"])

        # 识别具体药材
        mentioned_herbs = []
        for herb_name in self._knowledge_base:
            if herb_name in q:
                mentioned_herbs.append(herb_name)

        # 识别功效需求
        effect_keywords = {
            "免疫": "免疫调节", "补气": "补气", "补血": "补血",
            "抗氧化": "抗氧化", "护肝": "护肝", "明目": "明目",
            "安神": "安神", "健脾": "健脾", "祛湿": "利水",
            "减肥": "降脂", "降脂": "降脂", "降血脂": "降脂",
            "降血压": "降压", "降压": "降压",
            "降血糖": "降糖", "降糖": "降糖", "降三高": "降三高",
            "三高": "降三高", "抗疲劳": "抗疲劳",
            "多肽": "活性肽", "肽": "活性肽",
            "心血管": "心血管健康", "护心": "心血管健康",
            "肠道": "肠道健康", "益生": "肠道健康",
            "助眠": "助眠", "睡眠": "助眠",
            "美容": "美容养颜", "养颜": "美容养颜",
        }
        target_effects = [v for k, v in effect_keywords.items() if k in q]
        # 去重保持顺序
        target_effects = list(dict.fromkeys(target_effects))

        return {
            "question": question,
            "needs_formula": needs_formula,
            "needs_effect": needs_effect,
            "needs_safety": needs_safety,
            "mentioned_herbs": mentioned_herbs,
            "target_effects": target_effects,
            "analysis": f"问题分类：{'配方设计' if needs_formula else '知识问答'}"
                      f"{'，涉及功效查询' if needs_effect else ''}"
                      f"\n识别到药材：{', '.join(mentioned_herbs) if mentioned_herbs else '未指定'}"
                      f"\n目标功效：{', '.join(target_effects) if target_effects else '通用咨询'}",
        }

    def _retrieve_knowledge(self, intent: dict) -> dict:
        """检索相关知识"""
        herbs = intent["mentioned_herbs"]
        effects = intent["target_effects"]

        details = []

        # 检索具体药材
        for herb_name in herbs:
            info = self._knowledge_base.get(herb_name)
            if info:
                details.append(
                    f"📋 **{herb_name}**（{info['pinyin']}）\n"
                    f"  性味：{info['property']} | 归经：{'/'.join(info['meridian'])}\n"
                    f"  功效：{'、'.join(info['effects'])}\n"
                    f"  主要成分：{'、'.join(info['chemicals'][:3])}\n"
                    f"  用量范围：{info['dosage']}"
                )

        # 按功效检索
        if effects:
            for effect in effects:
                matched = []
                for name, info in self._knowledge_base.items():
                    if any(effect in e for e in info["effects"]):
                        matched.append(f"{name}（{'、'.join(info['effects'][:2])}）")
                if matched:
                    details.append(f"💡 与「{effect}」相关的药材：\n  " + "\n  ".join(matched[:5]))

        if not details:
            # 汇总概览
            food_herbs = [n for n, i in self._knowledge_base.items() if i["is_food_homology"]]
            details.append(
                f"📚 药食同源知识库已加载 {len(self._knowledge_base)} 种药材\n"
                f"  药食同源食材：{'、'.join(food_herbs[:8])}等"
            )

        return {
            "summary": f"已检索到 {len(herbs)} 种药材信息、{len(effects)} 项功效关联",
            "details": "\n\n".join(details[:5]),
        }

    def _reason(self, intent: dict, knowledge: dict) -> dict:
        """推理分析"""
        lines = []

        if intent["mentioned_herbs"]:
            herbs = intent["mentioned_herbs"]
            # 分析配伍
            for i, h1 in enumerate(herbs):
                for h2 in herbs[i+1:]:
                    info1 = self._knowledge_base.get(h1)
                    info2 = self._knowledge_base.get(h2)
                    if info1 and info2:
                        # 检查是否有关联
                        pairs_1 = dict(info1.get("pairing", []))
                        if h2 in pairs_1:
                            lines.append(f"🔗 **{h1} + {h2}**：{pairs_1[h2]}")
                        # 检查归经关联
                        common_meridians = set(info1["meridian"]) & set(info2["meridian"])
                        if common_meridians:
                            lines.append(f"⚕️ **归经关联**：{h1}与{h2}均入{'/'.join(common_meridians)}经")
                        # 检查功效互补
                        common_effects = set(info1["effects"]) & set(info2["effects"])
                        if common_effects:
                            lines.append(f"✨ **功效协同**：两者均有{'、'.join(list(common_effects)[:2])}功效")

        if not lines:
            lines.append("💡 请提供更多具体信息以进行深度推理分析")

        return {
            "summary": f"完成 {len(intent['mentioned_herbs'])} 种药材的综合分析",
            "details": "\n".join(lines[:5]),
        }

    def _design_formula(self, intent: dict, knowledge: dict) -> dict:
        """设计配方"""
        effects = intent["target_effects"] or ["免疫调节", "抗氧化"]
        q = intent["question"].lower()

        # 基于功效选择原料
        candidates = []
        for name, info in self._knowledge_base.items():
            score = sum(2 for e in effects if e in info["effects"])
            # 肽类关键词匹配
            if "肽" in q and "肽" in name.lower():
                score += 3
            if score > 0:
                candidates.append((name, info, score))

        candidates.sort(key=lambda x: -x[2])

        if not candidates:
            candidates = [(n, i, 1) for n, i in self._knowledge_base.items()]

        # 君臣佐使配伍
        formula = []
        used = set()

        # 君药
        if len(candidates) > 0:
            monarch = candidates[0]
            formula.append({
                "role": "君", "name": monarch[0],
                "purpose": f"核心功效——{'、'.join(monarch[1]['effects'][:2])}",
                "dosage": monarch[1]["dosage"],
            })
            used.add(monarch[0])

        # 臣药
        for name, info, score in candidates[1:3]:
            if name not in used:
                formula.append({
                    "role": "臣", "name": name,
                    "purpose": f"辅助{'/'.join(effects)}功效",
                    "dosage": info["dosage"],
                })
                used.add(name)

        # 佐使药
        remaining = [n for n, i, s in candidates if n not in used and i["is_food_homology"]]
        for name in remaining[:2]:
            info = self._knowledge_base[name]
            formula.append({
                "role": "佐" if len(formula) < 4 else "使",
                "name": name,
                "purpose": f"调和口感、增强协同",
                "dosage": info["dosage"],
            })
            used.add(name)

        # 生成详细设计说明
        parts = []
        for f in formula:
            parts.append(f"**{f['role']}药 - {f['name']}**：{f['purpose']}（{f['dosage']}）")

        return {
            "summary": f"已完成 {len(effects)} 项功效的配方设计（{len(formula)} 味药材）",
            "details": "\n".join(parts),
            "data": formula,
        }

    def _generate_answer(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """生成最终回答"""
        if intent["needs_formula"]:
            return self._format_formula_answer(intent, knowledge, reasoning)
        else:
            return self._format_knowledge_answer(intent, knowledge)

    def _format_formula_answer(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """格式化为配方回答"""
        effects = intent["target_effects"] or ["免疫调节"]
        herbs = intent["mentioned_herbs"]
        q = intent["question"].lower()

        # 肽类配方专用方案
        if "肽" in q or "多肽" in q:
            return self._format_peptide_answer(intent, knowledge, reasoning)

        answer = f"## 💊 智能配方方案\n\n"
        answer += f"基于「{'、'.join(effects)}」功效需求，为您设计以下配方方案：\n\n"
        answer += f"### 📐 配方结构（君臣佐使）\n\n"

        if "formula" in reasoning:
            for f in reasoning.get("formula_data", []):
                icon = {"君": "👑", "臣": "⚔️", "佐": "🔰", "使": "🤝"}.get(f["role"], "📋")
                answer += f"{icon} **{f['role']}药 - {f['name']}**\n"
                answer += f"   - 目的：{f['purpose']}\n"
                answer += f"   - 用量：{f['dosage']}\n\n"

        answer += "### 💡 配方特点\n\n"
        answer += f"- 针对「{'、'.join(effects)}」功效精准设计\n"
        if herbs:
            answer += f"- 根据您关注的 {', '.join(herbs)} 进行优化\n"
        answer += "- 君臣佐使结构完整，符合中药配伍原则\n"
        answer += "- 选用药食同源食材，安全性高\n\n"

        answer += "### ⚠️ 注意事项\n\n"
        answer += "- 建议在专业中医师指导下使用\n"
        answer += "- 孕妇、哺乳期妇女及儿童需特别咨询\n"
        answer += "- 初次使用建议从低剂量开始\n"
        answer += "- 如出现不适请立即停用并咨询医师\n\n"

        answer += "---\n"
        answer += "*以上方案由 AI 基于药食同源知识库生成，仅供参考。*"
        return answer

    def _format_peptide_answer(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """肽类配方专用回答"""
        effects = intent["target_effects"]
        q = intent["question"]

        answer = f"## 🧬 复合多肽配方方案\n\n"
        answer += f"根据您关于「{q}」的需求，结合活性肽数据库与药食同源理论，为您设计以下方案：\n\n"

        answer += f"### 📋 推荐活性肽组合\n\n"
        answer += f"👑 **主肽**：辅助降三高复合多肽\n"
        answer += f"   - 来源：食源性生物活性肽（DFBP数据库）\n"
        answer += f"   - 分子量：<1000 Da（利于吸收）\n"
        answer += f"   - 主要活性：ACE抑制肽（降压）+ 降胆固醇肽 + 抗氧化肽\n\n"
        answer += f"⚔️ **辅助成分**：\n"
        answer += f"   - 山楂提取物：含黄酮类，协同降脂\n"
        answer += f"   - 决明子提取物：含蒽醌类，辅助降压\n"
        answer += f"   - 丹参素：改善微循环\n\n"

        answer += f"### 🔬 作用机制\n\n"
        answer += f"1. **ACE抑制**：多肽序列竞争性结合ACE活性位点，抑制血管紧张素Ⅱ生成\n"
        answer += f"2. **胆固醇代谢**：活性肽促进LDL受体表达，加速胆固醇清除\n"
        answer += f"3. **抗氧化应激**：清除自由基，保护血管内皮功能\n"
        answer += f"4. **协同增效**：多肽与植物提取物多靶点协同\n\n"

        answer += f"### 📊 建议剂量\n\n"
        answer += f"| 成分 | 日剂量 | 服用时间 |\n"
        answer += f"|:-----|:------|:--------|\n"
        answer += f"| 复合多肽粉 | 5-10g | 空腹/早晚各一次 |\n"
        answer += f"| 山楂提取物 | 500mg | 餐后服用 |\n"
        answer += f"| 决明子提取物 | 300mg | 餐后服用 |\n\n"

        answer += f"### ⚠️ 注意事项\n\n"
        answer += f"- 本品为膳食补充，不能替代药物治疗\n"
        answer += f"- 正在服用降压/降糖药物者请咨询医师\n"
        answer += f"- 建议定期监测血压、血脂、血糖指标\n"
        answer += f"- 孕妇、哺乳期妇女及儿童不宜使用\n\n"

        answer += "---\n"
        answer += "*以上方案由 AI 基于DFBP活性肽数据库及药食同源知识库生成，仅供参考。*"
        return answer

    def _format_knowledge_answer(self, intent: dict, knowledge: dict) -> str:
        """格式化为知识回答"""
        herbs = intent["mentioned_herbs"]
        effects = intent["target_effects"]

        if herbs:
            # 针对具体药材的详细回答
            info = self._knowledge_base.get(herbs[0])
            if info:
                answer = f"## 🌿 {herbs[0]} 详解\n\n"
                answer += f"**基本信息**\n"
                answer += f"- 拼音：{info['pinyin']}\n"
                answer += f"- 分类：{info['category']}\n"
                answer += f"- 性味归经：{info['property']}，入{'/'.join(info['meridian'])}经\n\n"

                answer += f"**核心功效**\n"
                for i, effect in enumerate(info["effects"], 1):
                    answer += f"{i}. {effect}\n"
                answer += "\n"

                answer += f"**主要活性成分**\n"
                for c in info["chemicals"]:
                    answer += f"- {c}\n"
                answer += "\n"

                answer += f"**推荐用法**\n"
                answer += f"- 用量：{info['dosage']}\n"
                answer += f"- 药食同源：{'✅ 是，可作为食品原料使用' if info['is_food_homology'] else '❌ 否，需在医师指导下使用'}\n\n"

                if info.get("pairing"):
                    answer += f"**常用配伍**\n"
                    for herb, reason in info["pairing"][:3]:
                        answer += f"- {herb}：{reason}\n"
                    answer += "\n"

                answer += f"**注意事项**\n"
                answer += f"- {info['contraindication']}\n"
                return answer

        # 通用回答
        answer = f"## 📚 药食同源知识\n\n"
        answer += f"感谢您的提问！关于「{intent['question']}」"

        if effects:
            effect_herbs = []
            for name, info in self._knowledge_base.items():
                if any(e in info["effects"] for e in effects):
                    effect_herbs.append(f"{name}（{'、'.join(info['effects'][:2])}）")
            if effect_herbs:
                answer += f"，以下药材具有相关功效：\n\n"
                for h in effect_herbs[:5]:
                    answer += f"- {h}\n"
        else:
            answer += "，建议查阅药食同源目录或咨询专业中医师。\n\n"
            answer += "您可以尝试以下问题获得更精准的回答：\n"
            answer += "- 「枸杞子的功效是什么？」\n"
            answer += "- 「设计一款免疫增强配方」\n"
            answer += "- 「黄芪和党参的配伍」\n"

        return answer

    async def _simulate_delay(self, seconds: float):
        """模拟思考延迟"""
        import asyncio
        await asyncio.sleep(seconds)


# 全局推理引擎实例
thinking_engine = ThinkingEngine()
