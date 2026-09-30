"""
配方解释生成服务

为遗传算法生成的配方提供：
1. 君臣佐使结构分析
2. 各药材现代药理学机制
3. 配伍协同原理
4. 适用人群与禁忌说明
"""
from __future__ import annotations
import json
import logging
import asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class HerbMechanism:
    """药材作用机理"""
    herb_name: str
    herb_id: str
    active_compounds: List[str]
    mechanisms: List[str]
    pathways: List[str]
    evidence_level: str  # strong/moderate/weak


@dataclass
class FormulaExplanation:
    """配方解释"""
    formula_name: str
    structure_analysis: str
    mechanism_explanation: str
    synergistic_analysis: str
    suitable_population: str
    contraindications: str
    usage_instructions: str
    monitoring_suggestions: str


class FormulaExplanationService:
    """配方解释生成服务"""

    # 药材活性成分数据库（简化版）
    _HERB_MECHANISMS: Dict[str, HerbMechanism] = {
        "aj": HerbMechanism(
            herb_name="阿胶",
            herb_id="aj",
            active_compounds=["补血", "养血", "美容养颜"],
            mechanisms=["促进造血功能，改善贫血状态", "促进胶原蛋白合成，改善皮肤状态"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "bh": HerbMechanism(
            herb_name="百合",
            herb_id="bh",
            active_compounds=["润肺", "安神", "美容养颜"],
            mechanisms=["调节神经递质，改善睡眠质量", "促进胶原蛋白合成，改善皮肤状态"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "bo": HerbMechanism(
            herb_name="薄荷",
            herb_id="bo",
            active_compounds=["疏散风热", "清利头目", "理气"],
            mechanisms=["理气疏肝，调节气机升降"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "bq": HerbMechanism(
            herb_name="白术",
            herb_id="bq",
            active_compounds=["消化系统", "免疫调节", "利尿"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进气血生成，改善能量代谢", "促进水液代谢，消除水肿"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "bsh": HerbMechanism(
            herb_name="白芍",
            herb_id="bsh",
            active_compounds=["养血", "柔肝止痛", "敛阴止汗"],
            mechanisms=["促进造血功能，改善贫血状态"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "bx": HerbMechanism(
            herb_name="半夏",
            herb_id="bx",
            active_compounds=["燥湿化痰", "降逆止呕", "消痞散结"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="moderate",
        ),
        "cs": HerbMechanism(
            herb_name="川芎",
            herb_id="cs",
            active_compounds=["活血", "止痛", "心血管保护"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "保护血管内皮，改善心血管功能", "活血化瘀，改善微循环"],
            pathways=["Nrf2/ARE", "SIRT1", "eNOS"],
            evidence_level="strong",
        ),
        "cx": HerbMechanism(
            herb_name="陈皮",
            herb_id="cx",
            active_compounds=["消化系统", "化痰", "理气"],
            mechanisms=["促进胃肠蠕动，改善消化吸收", "镇咳祛痰，保护呼吸道黏膜", "理气疏肝，调节气机升降"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "cyh": HerbMechanism(
            herb_name="金银花",
            herb_id="cyh",
            active_compounds=["清热解毒", "抗炎", "抗氧化"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "抑制炎症因子释放，调节免疫炎症平衡"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "dcx": HerbMechanism(
            herb_name="大枣",
            herb_id="dcx",
            active_compounds=["补气", "养血", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进气血生成，改善能量代谢", "促进造血功能，改善贫血状态"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "dg": HerbMechanism(
            herb_name="当归",
            herb_id="dg",
            active_compounds=["补血", "调经", "抗氧化"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "促进造血功能，改善贫血状态"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "dq": HerbMechanism(
            herb_name="当归",
            herb_id="dq",
            active_compounds=["补血", "调经", "抗氧化"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "促进造血功能，改善贫血状态"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "ds": HerbMechanism(
            herb_name="党参",
            herb_id="ds",
            active_compounds=["免疫调节", "抗疲劳", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进气血生成，改善能量代谢", "促进胃肠蠕动，改善消化吸收"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "dsz": HerbMechanism(
            herb_name="丹参",
            herb_id="dsz",
            active_compounds=["活血", "心血管保护", "抗氧化"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "保护血管内皮，改善心血管功能", "活血化瘀，改善微循环"],
            pathways=["Nrf2/ARE", "SIRT1", "eNOS"],
            evidence_level="strong",
        ),
        "fp": HerbMechanism(
            herb_name="茯苓",
            herb_id="fp",
            active_compounds=["利尿", "免疫调节", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "调节神经递质，改善睡眠质量", "促进水液代谢，消除水肿"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "fz": HerbMechanism(
            herb_name="附子",
            herb_id="fz",
            active_compounds=["回阳救逆", "止痛", "心血管保护"],
            mechanisms=["保护血管内皮，改善心血管功能"],
            pathways=["eNOS", "NO/cGMP"],
            evidence_level="moderate",
        ),
        "gh": HerbMechanism(
            herb_name="葛根",
            herb_id="gh",
            active_compounds=["心血管保护", "降血糖", "降压"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "改善胰岛素敏感性，促进葡萄糖代谢", "保护血管内皮，改善心血管功能"],
            pathways=["Nrf2/ARE", "SIRT1", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "gq": HerbMechanism(
            herb_name="甘草",
            herb_id="gq",
            active_compounds=["调和诸药", "抗炎", "止咳"],
            mechanisms=["抑制炎症因子释放，调节免疫炎症平衡", "镇咳祛痰，保护呼吸道黏膜"],
            pathways=["NF-kB", "MAPK"],
            evidence_level="strong",
        ),
        "gt": HerbMechanism(
            herb_name="钩藤",
            herb_id="gt",
            active_compounds=["降压", "清热平肝", "息风定惊"],
            mechanisms=["保护血管内皮，改善心血管功能"],
            pathways=["eNOS", "NO/cGMP"],
            evidence_level="strong",
        ),
        "gy": HerbMechanism(
            herb_name="桂圆",
            herb_id="gy",
            active_compounds=["养血", "安神", "补气"],
            mechanisms=["促进气血生成，改善能量代谢", "促进造血功能，改善贫血状态", "调节神经递质，改善睡眠质量"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "gz": HerbMechanism(
            herb_name="枸杞子",
            herb_id="gz",
            active_compounds=["抗氧化", "免疫调节", "护肝"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "保护视网膜，改善视觉功能"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "hd": HerbMechanism(
            herb_name="红豆",
            herb_id="hd",
            active_compounds=["利水", "祛湿", "解毒"],
            mechanisms=["促进水液代谢，消除水肿"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "hhz": HerbMechanism(
            herb_name="黑芝麻",
            herb_id="hhz",
            active_compounds=["补肾", "养血", "润肠"],
            mechanisms=["促进造血功能，改善贫血状态", "补肾益精，调节内分泌", "促进胶原蛋白合成，改善皮肤状态"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "hp": HerbMechanism(
            herb_name="厚朴",
            herb_id="hp",
            active_compounds=["燥湿消痰", "下气除满", "促进消化"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="moderate",
        ),
        "hq": HerbMechanism(
            herb_name="黄芪",
            herb_id="hq",
            active_compounds=["免疫调节", "抗氧化", "抗疲劳"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "改善胰岛素敏感性，促进葡萄糖代谢"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "hqg": HerbMechanism(
            herb_name="黄芪根",
            herb_id="hqg",
            active_compounds=["免疫调节", "抗氧化", "抗炎"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "抑制炎症因子释放，调节免疫炎症平衡"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "ht": HerbMechanism(
            herb_name="核桃",
            herb_id="ht",
            active_compounds=["补肾", "健脑益智", "润肠"],
            mechanisms=["补肾益精，调节内分泌"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "hy": HerbMechanism(
            herb_name="荷叶",
            herb_id="hy",
            active_compounds=["降脂", "清暑利湿", "升发清阳"],
            mechanisms=["调节脂质代谢，降低血清胆固醇"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "jgf": HerbMechanism(
            herb_name="桔梗",
            herb_id="jgf",
            active_compounds=["宣肺祛痰", "利咽", "排脓"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "jgh": HerbMechanism(
            herb_name="菊花",
            herb_id="jgh",
            active_compounds=["明目", "清热解毒", "抗氧化"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "保护血管内皮，改善心血管功能", "保护视网膜，改善视觉功能"],
            pathways=["Nrf2/ARE", "SIRT1", "eNOS"],
            evidence_level="strong",
        ),
        "jgl": HerbMechanism(
            herb_name="绞股蓝",
            herb_id="jgl",
            active_compounds=["免疫调节", "益气健脾", "降脂"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "保护血管内皮，改善心血管功能", "调节脂质代谢，降低血清胆固醇"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "jj": HerbMechanism(
            herb_name="金银花",
            herb_id="jj",
            active_compounds=["清热解毒", "抗炎", "抗氧化"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "抑制炎症因子释放，调节免疫炎症平衡"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "jq": HerbMechanism(
            herb_name="决明子",
            herb_id="jq",
            active_compounds=["降压", "降脂", "明目"],
            mechanisms=["保护血管内皮，改善心血管功能", "调节脂质代谢，降低血清胆固醇", "保护视网膜，改善视觉功能"],
            pathways=["PI3K/Akt", "AMPK", "eNOS"],
            evidence_level="strong",
        ),
        "lbm": HerbMechanism(
            herb_name="罗布麻",
            herb_id="lbm",
            active_compounds=["降压", "平肝安神", "清热利尿"],
            mechanisms=["保护血管内皮，改善心血管功能"],
            pathways=["eNOS", "NO/cGMP"],
            evidence_level="strong",
        ),
        "lk": HerbMechanism(
            herb_name="藜芦",
            herb_id="lk",
            active_compounds=["催吐", "降压"],
            mechanisms=["保护血管内皮，改善心血管功能"],
            pathways=["eNOS", "NO/cGMP"],
            evidence_level="moderate",
        ),
        "lq": HerbMechanism(
            herb_name="连翘",
            herb_id="lq",
            active_compounds=["清热解毒", "抗炎", "疏散风热"],
            mechanisms=["抑制炎症因子释放，调节免疫炎症平衡", "清热解毒，抗病毒抗菌"],
            pathways=["NF-kB", "MAPK"],
            evidence_level="moderate",
        ),
        "ls": HerbMechanism(
            herb_name="莲子",
            herb_id="ls",
            active_compounds=["安神", "健脾", "补肾"],
            mechanisms=["调节神经递质，改善睡眠质量", "促进胃肠蠕动，改善消化吸收", "补肾益精，调节内分泌"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "mcx": HerbMechanism(
            herb_name="马齿苋",
            herb_id="mcx",
            active_compounds=["清热解毒", "凉血止血", "降血糖"],
            mechanisms=["改善胰岛素敏感性，促进葡萄糖代谢", "清热解毒，抗病毒抗菌"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "md": HerbMechanism(
            herb_name="麦冬",
            herb_id="md",
            active_compounds=["润肺", "养阴生津", "清心除烦"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "mld": HerbMechanism(
            herb_name="马利兰",
            herb_id="mld",
            active_compounds=["马利兰提取物"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="moderate",
        ),
        "pyg": HerbMechanism(
            herb_name="蒲公英",
            herb_id="pyg",
            active_compounds=["清热解毒", "消肿散结", "利尿"],
            mechanisms=["促进水液代谢，消除水肿", "清热解毒，抗病毒抗菌"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "qss": HerbMechanism(
            herb_name="枸杞子",
            herb_id="qss",
            active_compounds=["抗氧化", "免疫调节", "护肝"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "清除自由基，抑制脂质过氧化反应", "保护视网膜，改善视觉功能"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "rq": HerbMechanism(
            herb_name="人参",
            herb_id="rq",
            active_compounds=["抗疲劳", "免疫调节", "认知功能"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "保护血管内皮，改善心血管功能"],
            pathways=["NF-kB", "MAPK", "eNOS"],
            evidence_level="moderate",
        ),
        "rs": HerbMechanism(
            herb_name="人参",
            herb_id="rs",
            active_compounds=["抗疲劳", "免疫调节", "认知功能"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "保护血管内皮，改善心血管功能"],
            pathways=["NF-kB", "MAPK", "eNOS"],
            evidence_level="moderate",
        ),
        "sj": HerbMechanism(
            herb_name="生姜",
            herb_id="sj",
            active_compounds=["消化系统", "止呕", "抗炎"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "抑制炎症因子释放，调节免疫炎症平衡", "促进胃肠蠕动，改善消化吸收"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "sjg": HerbMechanism(
            herb_name="生姜",
            herb_id="sjg",
            active_compounds=["消化系统", "止呕", "抗炎"],
            mechanisms=["清除自由基，抑制脂质过氧化反应", "抑制炎症因子释放，调节免疫炎症平衡", "促进胃肠蠕动，改善消化吸收"],
            pathways=["NF-kB", "MAPK", "Nrf2/ARE"],
            evidence_level="strong",
        ),
        "sq": HerbMechanism(
            herb_name="三七",
            herb_id="sq",
            active_compounds=["活血", "散瘀止血", "止痛"],
            mechanisms=["活血化瘀，改善微循环"],
            pathways=["经典通路"],
            evidence_level="moderate",
        ),
        "ss": HerbMechanism(
            herb_name="桑椹",
            herb_id="ss",
            active_compounds=["滋阴补血", "补肾", "明目"],
            mechanisms=["保护视网膜，改善视觉功能", "补肾益精，调节内分泌"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "ssn": HerbMechanism(
            herb_name="沙参",
            herb_id="ssn",
            active_compounds=["养阴清肺", "益胃生津", "润燥"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "sx": HerbMechanism(
            herb_name="山药",
            herb_id="sx",
            active_compounds=["健脾", "消化系统", "补肾"],
            mechanisms=["改善胰岛素敏感性，促进葡萄糖代谢", "促进胃肠蠕动，改善消化吸收", "补肾益精，调节内分泌"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "sy": HerbMechanism(
            herb_name="桑叶",
            herb_id="sy",
            active_compounds=["疏散风热", "清肺润燥", "降血糖"],
            mechanisms=["改善胰岛素敏感性，促进葡萄糖代谢", "保护视网膜，改善视觉功能"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "sz": HerbMechanism(
            herb_name="山楂",
            herb_id="sz",
            active_compounds=["降脂", "活血", "消化系统"],
            mechanisms=["保护血管内皮，改善心血管功能", "调节脂质代谢，降低血清胆固醇", "促进胃肠蠕动，改善消化吸收"],
            pathways=["PI3K/Akt", "AMPK", "eNOS"],
            evidence_level="strong",
        ),
        "tm": HerbMechanism(
            herb_name="天麻",
            herb_id="tm",
            active_compounds=["降压", "平肝息风", "祛风通络"],
            mechanisms=["保护血管内皮，改善心血管功能"],
            pathways=["eNOS", "NO/cGMP"],
            evidence_level="strong",
        ),
        "ypc": HerbMechanism(
            herb_name="鱼腥草",
            herb_id="ypc",
            active_compounds=["清热解毒", "消炎", "利尿"],
            mechanisms=["促进水液代谢，消除水肿", "清热解毒，抗病毒抗菌"],
            pathways=["PI3K/Akt", "AMPK"],
            evidence_level="strong",
        ),
        "yq": HerbMechanism(
            herb_name="薏苡仁",
            herb_id="yq",
            active_compounds=["利尿", "免疫调节", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进水液代谢，消除水肿", "促进胃肠蠕动，改善消化吸收"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "yys": HerbMechanism(
            herb_name="薏苡仁",
            herb_id="yys",
            active_compounds=["利尿", "免疫调节", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进水液代谢，消除水肿", "促进胃肠蠕动，改善消化吸收"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
        "yz": HerbMechanism(
            herb_name="玉竹",
            herb_id="yz",
            active_compounds=["养阴润燥", "生津止渴", "美容"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="strong",
        ),
        "zs": HerbMechanism(
            herb_name="枳实",
            herb_id="zs",
            active_compounds=["破气消积", "化痰散痞", "促进消化"],
            mechanisms=["调节机体阴阳平衡，发挥综合调理作用"],
            pathways=["经典通路"],
            evidence_level="moderate",
        ),
        "zz": HerbMechanism(
            herb_name="大枣",
            herb_id="zz",
            active_compounds=["补气", "养血", "消化系统"],
            mechanisms=["调节免疫细胞活性，增强机体防御能力", "促进气血生成，改善能量代谢", "促进造血功能，改善贫血状态"],
            pathways=["NF-kB", "MAPK", "PI3K/Akt"],
            evidence_level="strong",
        ),
    }

    # 经典配伍协同数据库
    _SYNERGY_PAIRS: Dict[frozenset, Dict] = {
        frozenset({"hq", "ds"}): {
            "name": "hq-ds配对",
            "effect": "补气健脾协同增效",
            "mechanism": "黄芪多糖与党参多糖协同增强肠道屏障功能与免疫功能",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"hq", "bq"}): {
            "name": "hq-bq配对",
            "effect": "补气健脾加强",
            "mechanism": "黄芪配白术增强补气健脾，提高运化功能",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"rs", "hq"}): {
            "name": "rs-hq配对",
            "effect": "大补元气",
            "mechanism": "人参皂苷与黄芪皂苷协同激活HPA轴，提升抗应激能力",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ds", "bq"}): {
            "name": "ds-bq配对",
            "effect": "健脾益气协同",
            "mechanism": "党参与白术配伍为四君子汤核心，健脾益气",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"dg", "cs"}): {
            "name": "dg-cs配对",
            "effect": "活血调经经典",
            "mechanism": "当归配川芎为四物汤核心，活血行气调经",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"dg", "gz"}): {
            "name": "dg-gz配对",
            "effect": "补血养肝协同",
            "mechanism": "当归补血活血与枸杞滋补肝肾养血协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ds", "dcx"}): {
            "name": "ds-dcx配对",
            "effect": "气血双补",
            "mechanism": "党参补气与大枣养血相须为用，气血同补",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"jgh", "gz"}): {
            "name": "jgh-gz配对",
            "effect": "养肝明目经典",
            "mechanism": "菊花清热明目与枸杞滋补肝肾明目协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"cyh", "jgh"}): {
            "name": "cyh-jgh配对",
            "effect": "清热解毒协同",
            "mechanism": "金银花与菊花配伍增强清热解毒疏散风热之功",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"cyh", "gq"}): {
            "name": "cyh-gq配对",
            "effect": "清热解毒调和",
            "mechanism": "金银花配甘草增强清热解毒同时调和诸药",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"cx", "sj"}): {
            "name": "cx-sj配对",
            "effect": "理气止呕",
            "mechanism": "陈皮理气燥湿与生姜温中止呕配伍增强消化功能",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"cx", "bq"}): {
            "name": "cx-bq配对",
            "effect": "健脾理气",
            "mechanism": "陈皮理气燥湿与白术健脾益气相辅相成",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"fp", "bq"}): {
            "name": "fp-bq配对",
            "effect": "健脾利湿经典",
            "mechanism": "茯苓利水渗湿与白术健脾燥湿配伍为四君子汤核心",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"fp", "yq"}): {
            "name": "fp-yq配对",
            "effect": "利水渗湿协同",
            "mechanism": "茯苓与薏苡仁配伍增强利水消肿祛湿之功",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"fp", "gq"}): {
            "name": "fp-gq配对",
            "effect": "健脾调和",
            "mechanism": "茯苓健脾渗湿与甘草调和诸药协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"gq", "dcx"}): {
            "name": "gq-dcx配对",
            "effect": "甘温益气",
            "mechanism": "甘草与大枣配伍甘温补中益气，调和药性",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"gq", "hq"}): {
            "name": "gq-hq配对",
            "effect": "补气调和",
            "mechanism": "甘草调和诸药与黄芪补气相须为用",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"dcx", "sj"}): {
            "name": "dcx-sj配对",
            "effect": "调和脾胃",
            "mechanism": "大枣甘缓补中配生姜辛散和胃，调和脾胃",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"bq", "fp"}): {
            "name": "bq-fp配对",
            "effect": "健脾渗湿",
            "mechanism": "白术健脾燥湿与茯苓健脾渗湿配伍健脾利水",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"sj", "cx"}): {
            "name": "sj-cx配对",
            "effect": "理气和胃",
            "mechanism": "生姜温中止呕与陈皮理气燥湿配伍和胃降逆",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"gy", "ls"}): {
            "name": "gy-ls配对",
            "effect": "养心安神",
            "mechanism": "桂圆养血安神与莲子健脾养心安神协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"bh", "md"}): {
            "name": "bh-md配对",
            "effect": "润肺养阴",
            "mechanism": "百合润肺安神与麦冬养阴生津配伍滋阴润肺",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"sz", "dsz"}): {
            "name": "sz-dsz配对",
            "effect": "活血降脂",
            "mechanism": "山楂消食降脂与丹参活血祛瘀协同改善血脂",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"tm", "gt"}): {
            "name": "tm-gt配对",
            "effect": "平肝息风",
            "mechanism": "天麻平肝息风与钩藤清热平肝协同降压定惊",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"sx", "fp"}): {
            "name": "sx-fp配对",
            "effect": "健脾利湿",
            "mechanism": "山药健脾补肾与茯苓健脾渗湿配伍健脾止泻",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"aj", "dg"}): {
            "name": "aj-dg配对",
            "effect": "补血调经",
            "mechanism": "阿胶补血止血与当归补血活血配伍调经养颜",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ht", "hhz"}): {
            "name": "ht-hhz配对",
            "effect": "补肾健脑",
            "mechanism": "核桃补肾健脑与黑芝麻滋补肝肾协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ss", "hz"}): {
            "name": "ss-hz配对",
            "effect": "滋阴补血",
            "mechanism": "桑椹滋阴补血与黑芝麻滋补肝肾协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ypc", "cyh"}): {
            "name": "ypc-cyh配对",
            "effect": "清热解毒增效",
            "mechanism": "鱼腥草清热解毒与金银花协同抗菌抗病毒",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"pyg", "cyh"}): {
            "name": "pyg-cyh配对",
            "effect": "清热解毒协同",
            "mechanism": "蒲公英清热解毒与金银花配伍增强抗炎之功",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"hy", "sz"}): {
            "name": "hy-sz配对",
            "effect": "降脂消食",
            "mechanism": "荷叶降脂清暑与山楂消食降脂协同",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"sy", "jgh"}): {
            "name": "sy-jgh配对",
            "effect": "清肝明目",
            "mechanism": "桑叶疏散风热与菊花清热明目配伍",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"lbm", "tm"}): {
            "name": "lbm-tm配对",
            "effect": "平肝降压",
            "mechanism": "罗布麻平肝安神与天麻平肝息风协同降压",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"jgl", "gz"}): {
            "name": "jgl-gz配对",
            "effect": "免疫调节协同",
            "mechanism": "绞股蓝益气健脾与枸杞子滋补肝肾协同增强免疫",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"mcx", "pyg"}): {
            "name": "mcx-pyg配对",
            "effect": "清热解毒凉血",
            "mechanism": "马齿苋清热解毒与蒲公英协同凉血消肿",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"dsz", "sq"}): {
            "name": "dsz-sq配对",
            "effect": "活血化瘀强力",
            "mechanism": "丹参活血祛瘀与三七散瘀止血协同改善循环",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"bx", "jgf"}): {
            "name": "bx-jgf配对",
            "effect": "化痰止咳",
            "mechanism": "半夏燥湿化痰与桔梗宣肺祛痰配伍止咳",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"zs", "hp"}): {
            "name": "zs-hp配对",
            "effect": "破气消积",
            "mechanism": "枳实破气消积与厚朴下气除满配伍消痞",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"bsh", "dg"}): {
            "name": "bsh-dg配对",
            "effect": "养血柔肝",
            "mechanism": "白芍养血柔肝与当归补血活血配伍调经",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"ssn", "yz"}): {
            "name": "ssn-yz配对",
            "effect": "养阴润燥",
            "mechanism": "沙参养阴清肺与玉竹养阴润燥协同生津",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"hd", "yq"}): {
            "name": "hd-yq配对",
            "effect": "利水祛湿",
            "mechanism": "红豆利水消肿与薏苡仁健脾渗湿配伍祛湿",
            "evidence": "中医经典配伍理论",
        },
        frozenset({"gq", "dsx"}): {
            "name": "gq-dsx配对",
            "effect": "调和诸药",
            "mechanism": "甘草调和诸药与大枣补中益气协同",
            "evidence": "中医经典配伍理论",
        },    }

    # 功效 ID → 中文标签映射（支持英文ID、后端键、前端label 三源统一）
    # 反向映射确保后端键（如"免疫调节"）也能正确翻译为前端显示标签（如"增强免疫"）
    _EFFECT_LABELS: Dict[str, str] = {
        # 英文ID → 中文标签（原始映射）
        "immune_enhancement": "增强免疫",
        "immune_regulation": "免疫调节",
        "resistance_boost": "提高抵抗力",
        "antioxidant": "抗氧化",
        "anti_aging": "延缓衰老",
        "free_radical_clear": "清除自由基",
        "anti_fatigue": "抗疲劳",
        "fatigue_relief": "缓解疲劳",
        "energy_boost": "提升精力",
        "qi_nourishing": "补气养阴",
        "yin_nourishing": "滋阴补肾",
        "spleen_qi_tonifying": "健脾益气",
        "blood_nourishing": "补血养血",
        "sleep_improvement": "改善睡眠",
        "calm_mind": "安神定志",
        "spleen_stomach": "健脾养胃",
        "digestion_promotion": "促进消化",
        "blood_lipid": "降血脂",
        "vascular_protection": "保护血管",
        "beauty_skin": "美容养颜",
        "blood_pressure": "降血压",
        "blood_sugar": "降血糖",
        "uric_acid": "降尿酸",
        # 后端键 → 前端显示标签（反向映射，确保 backend key 查询生效）
        "免疫调节": "增强免疫",
        "提高抵抗力": "增强免疫",
        "抗衰老": "延缓衰老",
        "补气": "补气养阴",
        "补肾": "滋阴补肾",
        "健脾": "健脾益气",
        "安神": "改善睡眠",
        "降脂": "降血脂",
        "心血管保护": "保护血管",
        "活血": "促进循环",
        "解毒": "解毒",
        "清热": "清热解毒",
        "止咳化痰": "润肺止咳",
        "清热生津": "清咽利喉",
        "明目": "明目护眼",
        "强筋健骨": "强健筋骨",
    }

    def _effect_label(self, effect_id: str) -> str:
        return self._EFFECT_LABELS.get(effect_id, effect_id)

    def __init__(self):
        self._herb_db = dict(self._HERB_MECHANISMS)
        self._synergy_db = dict(self._SYNERGY_PAIRS)
        # 数据库增强索引（名称 → 机制 / 名称对 → 协同）
        self._db_loaded = False
        self._name_to_id: Dict[str, str] = {}

    async def init_from_database(self, db) -> int:
        """
        从 TCMHerb 表加载药材机制与协同配伍，增强内置字典。

        将数据库中 583 味药材的 extra_knowledge（efficacy_scores /
        synergy_partners / antagonistic_pairs / active_compounds）注入
        _herb_db 与 _synergy_db，消除"通用假解释"。

        Returns: 加载的药材数量
        """
        from app.models.external_data import TCMHerb
        from sqlalchemy import select

        rows = (await db.execute(
            select(TCMHerb).where(TCMHerb.extra_knowledge.is_not(None)).limit(2000)
        )).scalars().all()

        # 按 name_cn 建立机制记录
        name_map: Dict[str, str] = {}
        for herb in rows:
            if not herb.name_cn:
                continue
            data = herb.extra_knowledge
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    data = None
            data = data if isinstance(data, dict) else {}
            hid = str(data.get("herb_id") or herb.name_cn)
            name_map[herb.name_cn] = hid

            eff_scores = data.get("efficacy_scores") or {}
            # 用数据库中的功效评分构造"活性成分/机制"描述（真实数据）
            top_effects = sorted(
                eff_scores.items(), key=lambda kv: kv[1], reverse=True
            )[:3]
            if top_effects:
                compounds = [str(e) for e, _ in top_effects]
                mechanisms = [f"对「{e}」具有评分 {s:.2f} 的调节潜力" for e, s in top_effects]
            else:
                compounds = [str(x) for x in (data.get("synergy_partners") or [])[:2]]
                mechanisms = ["基于数据库协同配伍网络，参与多靶点调节"]

            mech = HerbMechanism(
                herb_name=herb.name_cn,
                herb_id=hid,
                active_compounds=compounds,
                mechanisms=mechanisms,
                pathways=[str(x) for x in (data.get("pathways") or [])[:3]] or ["经典通路"],
                evidence_level="moderate",
            )
            self._herb_db[hid] = mech

        # 名称 → herb_id 反向索引（供 _generate_mechanisms 按 name 查机制）
        self._name_to_id = {v: k for k, v in name_map.items()}
        # 让按中文名也能查到机制（_herb_db 键为 id，补充 name 键别名）
        for name, hid in name_map.items():
            if hid in self._herb_db:
                self._herb_db.setdefault(name, self._herb_db[hid])

        # 协同配伍对（数据库 synergy_partners 共现；partner 多为药材名，兼容 herb_id 形态）
        from collections import Counter
        pair_count: Counter = Counter()
        name_pairs: Dict[frozenset, str] = {}
        for herb in rows:
            if not herb.name_cn:
                continue
            data = herb.extra_knowledge
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    data = None
            data = data if isinstance(data, dict) else {}
            base_name = herb.name_cn
            base_hid = str(data.get("herb_id") or base_name)
            for partner in (data.get("synergy_partners") or []):
                partner_s = str(partner)
                # 解析 partner：优先按名称，其次按 herb_id
                partner_name = (
                    partner_s
                    if partner_s in name_map.values()
                    else self._name_to_id.get(partner_s, partner_s)
                )
                partner_hid = self._name_to_id.get(partner_name, partner_name)
                pair = frozenset((base_hid, partner_hid))
                if len(pair) == 2:
                    pair_count[pair] += 1
                    name_pairs[pair] = f"{base_name}-{partner_name}配伍"

        for pair, weight in pair_count.most_common(80):
            a, b = sorted(pair)
            info = {
                "name": name_pairs.get(pair, f"{a}-{b}配伍"),
                "effect": "协同增效",
                "mechanism": f"{a} 与 {b} 在数据库协同配伍网络中共现 {weight} 次，配伍协同",
                "evidence": "数据库协同配伍网络（TCMSP extra_knowledge）",
            }
            self._synergy_db.setdefault(pair, info)

        self._db_loaded = True
        logger.info("[解释服务] 数据库机制库已加载: %d 味药材, %d 协同对",
                    len(name_map), len(pair_count))
        return len(name_map)

    def generate_explanation(
        self,
        candidate_genes: Dict[str, float],
        target_effects: List[str],
        herb_names: Optional[Dict[str, str]] = None,
    ) -> FormulaExplanation:
        """
        生成配方解释

        Args:
            candidate_genes: {herb_id: dosage_g}
            target_effects: 目标功效列表
            herb_names: 可选的 herb_id → 中文名映射

        Returns:
            FormulaExplanation 对象
        """
        herb_names = herb_names or {}

        # 1. 君臣佐使结构分析
        structure = self._analyze_structure(candidate_genes, herb_names)

        # 2. 各药材机理说明
        mechanisms = self._generate_mechanisms(candidate_genes, herb_names)

        # 3. 配伍协同分析
        synergy = self._analyze_synergy(candidate_genes, herb_names)

        # 4. 适用人群与禁忌
        population = self._analyze_population(candidate_genes, target_effects)

        # 5. 使用建议
        usage = self._generate_usage_instructions(candidate_genes)

        return FormulaExplanation(
            formula_name=self._generate_formula_name(target_effects, herb_names),
            structure_analysis=structure,
            mechanism_explanation=mechanisms,
            synergistic_analysis=synergy,
            suitable_population=population.get("suitable", ""),
            contraindications=population.get("contraindications", ""),
            usage_instructions=usage,
            monitoring_suggestions=self._generate_monitoring_suggestions(target_effects),
        )

    def _analyze_structure(
        self,
        genes: Dict[str, float],
        herb_names: Dict[str, str],
    ) -> str:
        """分析君臣佐使结构"""
        # 按剂量降序排列
        sorted_herbs = sorted(genes.items(), key=lambda x: x[1], reverse=True)

        if not sorted_herbs:
            return "配方为空"

        roles = ["君药", "臣药", "佐药", "使药"]
        role_assignments = []

        for i, (hid, dosage) in enumerate(sorted_herbs[:4]):
            name = herb_names.get(hid, hid)
            role = roles[min(i, len(roles) - 1)]
            role_assignments.append(f"{name}({dosage}g)作为{role}")

        return "、".join(role_assignments) + "。君药剂量最大，针对主证；臣药辅助君药；佐药减毒或兼治；使药引经或调和。"

    def _generate_mechanisms(
        self,
        genes: Dict[str, float],
        herb_names: Dict[str, str],
    ) -> str:
        """生成各药材现代药理机制说明"""
        explanations = []

        for hid, dosage in sorted(genes.items(), key=lambda x: x[1], reverse=True):
            herb = self._herb_db.get(hid)
            if not herb:
                name = herb_names.get(hid, hid)
                explanations.append(f"**{name}**：含多种活性成分，具有免疫调节、抗炎等作用。")
                continue

            name = herb.herb_name
            compounds = ", ".join(herb.active_compounds[:3])
            mechanisms = "、".join(herb.mechanisms[:2])

            explanations.append(
                f"**{name}**：主要含{compounds}等活性成分，"
                f"通过{mechanisms}等途径发挥功效。"
            )

        return "\n\n".join(explanations)

    def _analyze_synergy(
        self,
        genes: Dict[str, float],
        herb_names: Dict[str, str],
    ) -> str:
        """分析配伍协同效应"""
        herb_ids = list(genes.keys())
        synergies = []

        for i, hid1 in enumerate(herb_ids):
            for hid2 in herb_ids[i + 1 :]:
                pair = frozenset({hid1, hid2})
                if pair in self._synergy_db:
                    info = self._synergy_db[pair]
                    name1 = herb_names.get(hid1, hid1)
                    name2 = herb_names.get(hid2, hid2)
                    synergies.append(
                        f"★ {name1}+{name2}：{info['effect']}——{info['mechanism']}"
                    )

        if synergies:
            return "本方配伍亮点：\n" + "\n".join(synergies)
        return "本方基于君臣佐使原则配伍，各药材协同发挥综合调理作用。"

    def _analyze_population(
        self,
        genes: Dict[str, float],
        target_effects: List[str],
    ) -> Dict[str, str]:
        """分析适用人群与禁忌"""
        suitable = []
        contraindications = []

        # 根据功效目标推荐人群（键为后端键，由 _effect_label 翻译为前端标签后匹配）
        effect_population_map = {
            "增强免疫": ["免疫力低下者", "易感冒人群", "术后恢复期"],
            "抗疲劳": ["体力劳动者", "熬夜人群", "亚健康状态"],
            "抗氧化": ["衰老迹象明显者", "长期用眼人群"],
            "改善睡眠": ["睡眠质量差者", "焦虑紧张人群"],
            "降血压": ["高血压高危人群", "血压偏高者"],
            "降血糖": ["血糖偏高者", "糖尿病前期"],
            "降血脂": ["高血脂人群", "心脑血管疾病患者"],
            "补气养阴": ["气阴两虚者", "慢性疲劳人群"],
            "健脾益气": ["脾胃虚弱者", "消化不良人群"],
            "安神": ["睡眠质量差者", "焦虑紧张人群"],
            "明目护眼": ["长期用眼者", "老年人"],
            "美容养颜": ["皮肤暗沉者", "抗衰老需求人群"],
        }

        for effect in target_effects:
            label = self._effect_label(effect)
            if label in effect_population_map:
                suitable.extend(effect_population_map[label])

        # 去重
        suitable = list(dict.fromkeys(suitable))
        if not suitable:
            suitable = ["一般亚健康人群"]

        # 特殊人群禁忌
        contraindicated_herbs = {"lk": "藜芦（孕妇禁用）", "fz": "附子（孕妇慎用）"}
        for hid in genes:
            if hid in contraindicated_herbs:
                contraindications.append(contraindicated_herbs[hid])

        if not contraindications:
            contraindications.append("对本方成分过敏者禁用")

        return {
            "suitable": "、".join(suitable[:3]) + "适宜服用。",
            "contraindications": "、".join(contraindications) + "。",
        }

    def _generate_usage_instructions(
        self,
        genes: Dict[str, float],
    ) -> str:
        """生成使用说明"""
        total_dosage = sum(genes.values())

        if total_dosage > 60:
            form = "汤剂"
            instruction = f"每日1剂，水煎分2-3次温服。建议连续服用{min(14, max(7, total_dosage // 5))}天为一疗程。"
        elif total_dosage > 30:
            form = "代茶饮"
            instruction = f"将药材切碎，每日取适量沸水冲泡，代茶饮用。可反复冲泡至味淡。"
        else:
            form = "粉剂"
            instruction = f"研细末，每日2-3次，每次3-5g，温水送服。"

        return f"建议服用形式：{form}。\n{instruction}"

    def _generate_monitoring_suggestions(
        self,
        target_effects: List[str],
    ) -> str:
        """生成监测建议"""
        suggestions = []

        for effect in target_effects:
            label = self._effect_label(effect)
            if label == "增强免疫":
                suggestions.append("观察感冒频率变化")
                suggestions.append("定期检查血常规指标")
            elif label in ("抗疲劳", "提升精力"):
                suggestions.append("记录每日精力状态评分")
                suggestions.append("监测睡眠质量变化")
            elif label in ("改善睡眠", "安神"):
                suggestions.append("记录入睡时间及睡眠质量")
                suggestions.append("评估日间困倦程度")
            elif label in ("降血压", "保护血管"):
                suggestions.append("定期监测血压值")
                suggestions.append("关注心电图变化")
            elif label in ("降血糖", "调节代谢"):
                suggestions.append("定期检测血糖/血脂")
                suggestions.append("记录体重变化")
            elif label in ("降血脂", "控制体重"):
                suggestions.append("定期检测血脂四项")
                suggestions.append("记录饮食与运动情况")
            elif label == "补气养阴":
                suggestions.append("观察气短乏力改善情况")
                suggestions.append("监测心率与血压")
            elif label == "健脾益气":
                suggestions.append("观察食欲与消化改善")
                suggestions.append("记录大便性状变化")

        if not suggestions:
            suggestions.append("观察主观症状改善情况")
            suggestions.append("记录任何不适反应")

        return "建议监测指标：\n" + "\n".join(f"• {s}" for s in suggestions[:4])

    def _generate_formula_name(
        self,
        target_effects: List[str],
        herb_names: Dict[str, str],
    ) -> str:
        """生成配方名称"""
        if len(target_effects) <= 2:
            effects_str = "+".join(self._effect_label(e) for e in target_effects[:2])
            return f"复方{effects_str}汤"
        return f"复方调理方"

    async def generate_explanation_async(
        self,
        candidate_genes: Dict[str, float],
        target_effects: List[str],
        herb_names: Optional[Dict[str, str]] = None,
    ) -> FormulaExplanation:
        """异步版本（预留扩展接口）"""
        return self.generate_explanation(candidate_genes, target_effects, herb_names)
