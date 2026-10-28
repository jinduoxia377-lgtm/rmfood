"""
中医药知识图谱服务
基于关系型数据库的知识图谱 - 节点/关系查询、路径分析、子图提取
无需 Neo4j 也能完整使用

v2.0 — 数据扩充：
  - HERB_INTERACTIONS: 26 → 50+ 条配伍/拮抗关系
  - COMPOUND_TARGET_PATHS: 25 → 60+ 条化合物-靶点-疾病路径
  - 新增蛋白质节点(PEPTIDE_TARGET_PATHS)
"""
import logging
from collections import defaultdict
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════
# 肽序列编码规范化
#
# 根因：DFBP_PEPTIDE_DATABASE 用单字母缩写连字符序列（"Val-Pro-Pro"），
# 而 PEPTIDE_TARGET_PATHS 用三字母代码（"VPP"）。两者描述的是同一批肽，
# 却因命名空间不同而永远无法关联，导致肽节点全部孤立（peptide_edges=0）。
# 修复：统一折算成三字母代码作为规范节点 ID。
# ═══════════════════════════════════════════════════
_AA_TO_CODE: dict[str, str] = {
    "Ala": "A", "Arg": "R", "Asn": "N", "Asp": "D", "Cys": "C",
    "Gln": "Q", "Glu": "E", "Gly": "G", "His": "H", "Ile": "I",
    "Leu": "L", "Lys": "K", "Met": "M", "Phe": "F", "Pro": "P",
    "Ser": "S", "Thr": "T", "Trp": "W", "Tyr": "Y", "Val": "V",
    # 非标准/修饰残基
    "Hyp": "H", "Ser(P)": "S", "Xaa": "X",
}


def peptide_canonical_code(seq: str) -> str | None:
    """把肽序列折算为规范三字母代码；无法解析返回 None。

    兼容两种上游编码：
      - DFBP_PEPTIDE_DATABASE:  "Val-Pro-Pro"          → "VPP"
      - PEPTIDE_TARGET_PATHS:   "VPP"（已是代码）      → "VPP"
    """
    if not seq:
        return None
    seq = seq.strip()
    # 无连字符且全大写 → 已是三字母代码，原样返回
    if "-" not in seq and seq.isalpha() and seq.isupper():
        return seq
    parts = [p.strip() for p in seq.split("-")]
    code = "".join(_AA_TO_CODE.get(p, "") for p in parts)
    if not code or len(code) != len(parts):
        return None
    return code


# ═══════════════════════════════════════════════════
# 药材-药材 已知协同/拮抗关系（50+ 条）
# ═══════════════════════════════════════════════════
HERB_INTERACTIONS: list[dict[str, Any]] = [
    # ── 补气协同 ──
    {"a": "人参", "b": "黄芪", "type": "synergy", "strength": 0.92, "basis": "补气协同增效，参芪合用增强免疫功能"},
    {"a": "人参", "b": "白术", "type": "synergy", "strength": 0.88, "basis": "四君子汤核心配伍，益气健脾"},
    {"a": "人参", "b": "茯苓", "type": "synergy", "strength": 0.84, "basis": "益气健脾协同，标本兼治"},
    {"a": "人参", "b": "甘草", "type": "synergy", "strength": 0.82, "basis": "补气和中，调和诸药"},
    {"a": "人参", "b": "山药", "type": "synergy", "strength": 0.78, "basis": "益气养阴，脾肾双补"},
    {"a": "黄芪", "b": "当归", "type": "synergy", "strength": 0.90, "basis": "当归补血汤，气血双补经典"},
    {"a": "黄芪", "b": "丹参", "type": "synergy", "strength": 0.80, "basis": "益气活血，改善微循环"},
    {"a": "黄芪", "b": "防风", "type": "synergy", "strength": 0.82, "basis": "玉屏风散，固表止汗"},
    {"a": "黄芪", "b": "白术", "type": "synergy", "strength": 0.80, "basis": "玉屏风散核心，健脾益气固表"},
    {"a": "白术", "b": "茯苓", "type": "synergy", "strength": 0.86, "basis": "健脾渗湿，四君子汤配伍"},
    {"a": "甘草", "b": "白芍", "type": "synergy", "strength": 0.88, "basis": "芍药甘草汤缓急止痛，酸甘化阴"},
    {"a": "山药", "b": "茯苓", "type": "synergy", "strength": 0.82, "basis": "健脾渗湿协同"},
    {"a": "西洋参", "b": "枸杞子", "type": "synergy", "strength": 0.80, "basis": "气阴双补，滋阴益气"},

    # ── 补血养血协同 ──
    {"a": "当归", "b": "白芍", "type": "synergy", "strength": 0.87, "basis": "养血柔肝，四物汤配伍"},
    {"a": "当归", "b": "川芎", "type": "synergy", "strength": 0.85, "basis": "四物汤核心，养血活血"},
    {"a": "当归", "b": "熟地黄", "type": "synergy", "strength": 0.86, "basis": "四物汤配伍，补血填精"},
    {"a": "白芍", "b": "熟地黄", "type": "synergy", "strength": 0.80, "basis": "养血滋阴协同"},
    {"a": "阿胶", "b": "当归", "type": "synergy", "strength": 0.88, "basis": "补血养血协同增效"},
    {"a": "龙眼肉", "b": "酸枣仁", "type": "synergy", "strength": 0.82, "basis": "归脾汤养心血，安神定志"},

    # ── 活血化瘀协同 ──
    {"a": "丹参", "b": "三七", "type": "synergy", "strength": 0.90, "basis": "活血化瘀协同，改善冠脉血流"},
    {"a": "丹参", "b": "川芎", "type": "synergy", "strength": 0.84, "basis": "活血行气，通络止痛"},
    {"a": "丹参", "b": "红花", "type": "synergy", "strength": 0.82, "basis": "丹红注射液基础，活血通脉"},
    {"a": "川芎", "b": "红花", "type": "synergy", "strength": 0.80, "basis": "血府逐瘀汤配伍，行气活血"},
    {"a": "三七", "b": "红花", "type": "synergy", "strength": 0.78, "basis": "活血化瘀，消肿止痛"},
    {"a": "丹参", "b": "山楂", "type": "synergy", "strength": 0.76, "basis": "活血降脂，心血管保护"},

    # ── 清热解毒协同 ──
    {"a": "金银花", "b": "连翘", "type": "synergy", "strength": 0.92, "basis": "银翘散核心，清热解毒经典"},
    {"a": "黄芩", "b": "黄连", "type": "synergy", "strength": 0.86, "basis": "黄连解毒汤，清热泻火"},
    {"a": "黄芩", "b": "黄柏", "type": "synergy", "strength": 0.84, "basis": "三黄配伍，清热燥湿"},
    {"a": "金银花", "b": "蒲公英", "type": "synergy", "strength": 0.80, "basis": "清热解毒协同，抗炎增效"},
    {"a": "板蓝根", "b": "大青叶", "type": "synergy", "strength": 0.82, "basis": "同源药物，清热凉血解毒"},

    # ── 理气化痰协同 ──
    {"a": "陈皮", "b": "半夏", "type": "synergy", "strength": 0.85, "basis": "二陈汤燥湿化痰，理气和中"},
    {"a": "陈皮", "b": "茯苓", "type": "synergy", "strength": 0.80, "basis": "二陈汤配伍，健脾理气化痰"},
    {"a": "陈皮", "b": "山楂", "type": "synergy", "strength": 0.80, "basis": "消食化滞，健脾理气"},
    {"a": "陈皮", "b": "木香", "type": "synergy", "strength": 0.78, "basis": "香砂六君子汤配伍，行气健脾"},
    {"a": "香附", "b": "川芎", "type": "synergy", "strength": 0.80, "basis": "越鞠丸配伍，行气活血解郁"},
    {"a": "枳实", "b": "厚朴", "type": "synergy", "strength": 0.78, "basis": "行气消痞，除满止痛"},

    # ── 养阴润燥协同 ──
    {"a": "枸杞子", "b": "菊花", "type": "synergy", "strength": 0.88, "basis": "杞菊地黄丸，养肝明目"},
    {"a": "百合", "b": "麦冬", "type": "synergy", "strength": 0.82, "basis": "百合固金汤配伍，润肺养阴"},
    {"a": "黄精", "b": "玉竹", "type": "synergy", "strength": 0.82, "basis": "养阴润燥协同，补气养阴"},
    {"a": "麦冬", "b": "五味子", "type": "synergy", "strength": 0.80, "basis": "生脉散配伍，益气养阴生津"},
    {"a": "百合", "b": "莲子", "type": "synergy", "strength": 0.78, "basis": "百合莲子羹，清心养神"},
    {"a": "酸枣仁", "b": "柏子仁", "type": "synergy", "strength": 0.84, "basis": "养心安神协同，酸枣仁汤配伍"},
    {"a": "薄荷", "b": "菊花", "type": "synergy", "strength": 0.76, "basis": "疏散风热协同，清利头目"},

    # ── 利水渗湿协同 ──
    {"a": "茯苓", "b": "薏苡仁", "type": "synergy", "strength": 0.84, "basis": "四君子汤衍化，利水渗湿健脾"},
    {"a": "茯苓", "b": "泽泻", "type": "synergy", "strength": 0.80, "basis": "五苓散配伍，利水渗湿"},
    {"a": "薏苡仁", "b": "冬瓜子", "type": "synergy", "strength": 0.78, "basis": "苇茎汤配伍，清热利湿排脓"},

    # ── 温里散寒协同 ──
    {"a": "附子", "b": "肉桂", "type": "synergy", "strength": 0.86, "basis": "温肾助阳协同，回阳救逆"},
    {"a": "干姜", "b": "附子", "type": "synergy", "strength": 0.84, "basis": "四逆汤配伍，回阳救逆"},
    {"a": "肉桂", "b": "吴茱萸", "type": "synergy", "strength": 0.76, "basis": "温里散寒协同"},

    # ── 安神协同 ──
    {"a": "酸枣仁", "b": "远志", "type": "synergy", "strength": 0.80, "basis": "安神定志协同"},
    {"a": "合欢皮", "b": "酸枣仁", "type": "synergy", "strength": 0.78, "basis": "解郁安神协同"},

    # ── 消食协同 ──
    {"a": "山楂", "b": "神曲", "type": "synergy", "strength": 0.82, "basis": "保和丸配伍，消食和胃"},
    {"a": "山楂", "b": "麦芽", "type": "synergy", "strength": 0.80, "basis": "消食化积协同"},
    {"a": "莱菔子", "b": "山楂", "type": "synergy", "strength": 0.78, "basis": "保和丸配伍，消食导滞"},

    # ── 平肝息风协同 ──
    {"a": "天麻", "b": "钩藤", "type": "synergy", "strength": 0.84, "basis": "天麻钩藤饮，平肝息风"},
    {"a": "天麻", "b": "地龙", "type": "synergy", "strength": 0.78, "basis": "通络息风协同"},

    # ── 补阳协同 ──
    {"a": "淫羊藿", "b": "巴戟天", "type": "synergy", "strength": 0.82, "basis": "补肾壮阳协同"},
    {"a": "杜仲", "b": "续断", "type": "synergy", "strength": 0.84, "basis": "补肝肾强筋骨协同"},

    # ═══ 十八反（拮抗/禁忌）═══
    {"a": "人参", "b": "藜芦", "type": "antagonism", "strength": 0.95, "basis": "十八反: 人参反藜芦"},
    {"a": "甘草", "b": "甘遂", "type": "antagonism", "strength": 0.96, "basis": "十八反: 甘草反甘遂"},
    {"a": "甘草", "b": "大戟", "type": "antagonism", "strength": 0.95, "basis": "十八反: 甘草反大戟"},
    {"a": "甘草", "b": "芫花", "type": "antagonism", "strength": 0.95, "basis": "十八反: 甘草反芫花"},
    {"a": "乌头", "b": "白蔹", "type": "antagonism", "strength": 0.92, "basis": "十八反: 乌头反白蔹"},

    # ═══ 十九畏 ═══
    {"a": "丹参", "b": "藜芦", "type": "antagonism", "strength": 0.90, "basis": "十九畏: 丹参反藜芦"},
    {"a": "人参", "b": "五灵脂", "type": "antagonism", "strength": 0.88, "basis": "十九畏: 人参畏五灵脂"},
    {"a": "肉桂", "b": "赤石脂", "type": "antagonism", "strength": 0.85, "basis": "十九畏: 肉桂畏赤石脂"},

    # ── 新增扩展配伍关系 ──
    # 补气 + 补血组合
    {"a": "人参", "b": "当归", "type": "synergy", "strength": 0.85, "basis": "气血双补，八珍汤配伍"},
    {"a": "党参", "b": "黄芪", "type": "synergy", "strength": 0.82, "basis": "益气健脾协同"},
    {"a": "黄芪", "b": "党参", "type": "synergy", "strength": 0.80, "basis": "补中益气汤核心"},
    {"a": "太子参", "b": "麦冬", "type": "synergy", "strength": 0.78, "basis": "益气养阴，生津润肺"},
    {"a": "红景天", "b": "黄芪", "type": "synergy", "strength": 0.82, "basis": "益气活血，耐缺氧"},
    {"a": "绞股蓝", "b": "茯苓", "type": "synergy", "strength": 0.75, "basis": "益气健脾，降脂"},
    {"a": "蜂蜜", "b": "甘草", "type": "synergy", "strength": 0.80, "basis": "补中益气，润燥解毒"},
    {"a": "大枣", "b": "生姜", "type": "synergy", "strength": 0.82, "basis": "调和脾胃，益气养血"},
    {"a": "白扁豆", "b": "茯苓", "type": "synergy", "strength": 0.78, "basis": "健脾化湿"},
    {"a": "山药", "b": "莲子", "type": "synergy", "strength": 0.80, "basis": "补脾益肾，涩精止泻"},

    # 补血 + 活血组合
    {"a": "熟地黄", "b": "当归", "type": "synergy", "strength": 0.88, "basis": "四物汤核心，补血填精"},
    {"a": "白芍", "b": "当归", "type": "synergy", "strength": 0.85, "basis": "养血柔肝，缓急止痛"},
    {"a": "阿胶", "b": "熟地黄", "type": "synergy", "strength": 0.86, "basis": "补血滋阴，益精填髓"},
    {"a": "何首乌", "b": "当归", "type": "synergy", "strength": 0.82, "basis": "补肝肾，益精血，乌须发"},
    {"a": "鸡血藤", "b": "当归", "type": "synergy", "strength": 0.84, "basis": "活血补血，调经止痛"},
    {"a": "黑芝麻", "b": "枸杞子", "type": "synergy", "strength": 0.80, "basis": "补肝肾，益精血"},
    {"a": "桑葚", "b": "枸杞子", "type": "synergy", "strength": 0.82, "basis": "滋阴补血，生津润燥"},
    {"a": "龙眼肉", "b": "当归", "type": "synergy", "strength": 0.80, "basis": "补益心脾，养血安神"},

    # 补阴 + 清热组合
    {"a": "麦冬", "b": "玉竹", "type": "synergy", "strength": 0.85, "basis": "养阴润燥，生津止渴"},
    {"a": "天冬", "b": "麦冬", "type": "synergy", "strength": 0.82, "basis": "滋阴润肺，清热生津"},
    {"a": "女贞子", "b": "墨旱莲", "type": "synergy", "strength": 0.88, "basis": "二至丸，滋补肝肾"},
    {"a": "黄精", "b": "枸杞子", "type": "synergy", "strength": 0.82, "basis": "补气养阴，滋补肝肾"},
    {"a": "百合", "b": "生地黄", "type": "synergy", "strength": 0.80, "basis": "养阴润肺，清心安神"},
    {"a": "北沙参", "b": "麦冬", "type": "synergy", "strength": 0.82, "basis": "养阴清肺，益胃生津"},
    {"a": "南沙参", "b": "玉竹", "type": "synergy", "strength": 0.78, "basis": "养阴益气，润肺生津"},
    {"a": "龟甲", "b": "鳖甲", "type": "synergy", "strength": 0.85, "basis": "滋阴潜阳，软坚散结"},
    {"a": "石斛", "b": "麦冬", "type": "synergy", "strength": 0.80, "basis": "养阴清热，生津益胃"},
    {"a": "玉竹", "b": "沙参", "type": "synergy", "strength": 0.78, "basis": "滋阴润肺，生津止渴"},

    # 活血化瘀扩展
    {"a": "川芎", "b": "当归", "type": "synergy", "strength": 0.85, "basis": "血府逐瘀汤，活血行气"},
    {"a": "红花", "b": "桃仁", "type": "synergy", "strength": 0.82, "basis": "桃红四物汤，活血祛瘀"},
    {"a": "赤芍", "b": "丹参", "type": "synergy", "strength": 0.80, "basis": "凉血活血，祛瘀止痛"},
    {"a": "益母草", "b": "当归", "type": "synergy", "strength": 0.82, "basis": "活血调经，补血祛瘀"},
    {"a": "鸡血藤", "b": "丹参", "type": "synergy", "strength": 0.78, "basis": "活血补血，舒筋活络"},
    {"a": "三七", "b": "丹参", "type": "synergy", "strength": 0.88, "basis": "活血化瘀，消肿定痛"},
    {"a": "桃仁", "b": "红花", "type": "synergy", "strength": 0.85, "basis": "桃红四物汤，活血祛瘀"},
    {"a": "益母草", "b": "香附", "type": "synergy", "strength": 0.78, "basis": "调经止痛，疏肝理气"},

    # 理气药扩展
    {"a": "木香", "b": "砂仁", "type": "synergy", "strength": 0.82, "basis": "香砂六君子汤，行气和中"},
    {"a": "枳壳", "b": "陈皮", "type": "synergy", "strength": 0.80, "basis": "理气宽中，消积化痰"},
    {"a": "香附", "b": "佛手", "type": "synergy", "strength": 0.78, "basis": "疏肝解郁，理气和中"},
    {"a": "玫瑰花", "b": "香附", "type": "synergy", "strength": 0.76, "basis": "行气解郁，和血止痛"},
    {"a": "绿萼梅", "b": "佛手", "type": "synergy", "strength": 0.75, "basis": "疏肝和胃，化痰理气"},
    {"a": "代代花", "b": "厚朴花", "type": "synergy", "strength": 0.72, "basis": "理气宽中，和胃化痰"},
    {"a": "陈皮", "b": "青皮", "type": "synergy", "strength": 0.80, "basis": "理气健脾，疏肝破气"},
    {"a": "木香", "b": "陈皮", "type": "synergy", "strength": 0.82, "basis": "行气止痛，健脾消食"},

    # 清热药扩展
    {"a": "黄连", "b": "黄芩", "type": "synergy", "strength": 0.88, "basis": "黄连解毒汤，清热燥湿"},
    {"a": "连翘", "b": "板蓝根", "type": "synergy", "strength": 0.84, "basis": "清热解毒，凉血消肿"},
    {"a": "栀子", "b": "淡竹叶", "type": "synergy", "strength": 0.78, "basis": "清热泻火，除烦利尿"},
    {"a": "夏枯草", "b": "决明子", "type": "synergy", "strength": 0.82, "basis": "清肝明目，散结降压"},
    {"a": "野菊花", "b": "蒲公英", "type": "synergy", "strength": 0.80, "basis": "清热解毒，消肿散结"},
    {"a": "紫花地丁", "b": "蒲公英", "type": "synergy", "strength": 0.82, "basis": "五味消毒饮，清热解毒"},
    {"a": "穿心莲", "b": "板蓝根", "type": "synergy", "strength": 0.78, "basis": "清热解毒，凉血消肿"},
    {"a": "马齿苋", "b": "蒲公英", "type": "synergy", "strength": 0.80, "basis": "清热解毒，凉血止痢"},
    {"a": "鱼腥草", "b": "桔梗", "type": "synergy", "strength": 0.82, "basis": "清热排脓，利肺止咳"},
    {"a": "青黛", "b": "板蓝根", "type": "synergy", "strength": 0.78, "basis": "清热解毒，凉血消斑"},

    # 化痰止咳药扩展
    {"a": "半夏", "b": "茯苓", "type": "synergy", "strength": 0.84, "basis": "二陈汤，燥湿化痰"},
    {"a": "陈皮", "b": "浙贝母", "type": "synergy", "strength": 0.82, "basis": "理气化痰，清热散结"},
    {"a": "桔梗", "b": "甘草", "type": "synergy", "strength": 0.85, "basis": "桔梗甘草汤，宣肺利咽"},
    {"a": "杏仁", "b": "紫苏", "type": "synergy", "strength": 0.82, "basis": "杏苏散，宣肺止咳"},
    {"a": "百部", "b": "紫菀", "type": "synergy", "strength": 0.80, "basis": "润肺止咳，下气化痰"},
    {"a": "桑白皮", "b": "黄芩", "type": "synergy", "strength": 0.78, "basis": "清肺热，止咳平喘"},
    {"a": "瓜蒌", "b": "薤白", "type": "synergy", "strength": 0.84, "basis": "瓜蒌薤白汤，宽胸散结"},
    {"a": "川贝母", "b": "知母", "type": "synergy", "strength": 0.80, "basis": "清热润肺，化痰止咳"},
    {"a": "前胡", "b": "白前", "type": "synergy", "strength": 0.78, "basis": "降气化痰，宣肺止咳"},
    {"a": "紫苏子", "b": "莱菔子", "type": "synergy", "strength": 0.82, "basis": "降气化痰，消食导滞"},

    # 利水渗湿药扩展
    {"a": "猪苓", "b": "茯苓", "type": "synergy", "strength": 0.85, "basis": "利水渗湿，增强渗利"},
    {"a": "泽泻", "b": "茯苓", "type": "synergy", "strength": 0.82, "basis": "五苓散，利水渗湿"},
    {"a": "车前子", "b": "泽泻", "type": "synergy", "strength": 0.80, "basis": "利水渗湿，清热通淋"},
    {"a": "瞿麦", "b": "扁蓄", "type": "synergy", "strength": 0.78, "basis": "清热利湿，通淋止痛"},
    {"a": "金钱草", "b": "海金沙", "type": "synergy", "strength": 0.82, "basis": "利湿通淋，利胆排石"},
    {"a": "茵陈", "b": "栀子", "type": "synergy", "strength": 0.85, "basis": "茵陈蒿汤，清热利湿退黄"},
    {"a": "冬瓜皮", "b": "薏苡仁", "type": "synergy", "strength": 0.78, "basis": "利水渗湿，健脾消肿"},
    {"a": "玉米须", "b": "茯苓", "type": "synergy", "strength": 0.75, "basis": "利水消肿，利湿退黄"},

    # 安神药扩展
    {"a": "茯神", "b": "酸枣仁", "type": "synergy", "strength": 0.85, "basis": "养心安神，宁心定志"},
    {"a": "远志", "b": "石菖蒲", "type": "synergy", "strength": 0.82, "basis": "开窍醒神，益智安神"},
    {"a": "夜交藤", "b": "合欢皮", "type": "synergy", "strength": 0.80, "basis": "养心安神，祛风通络"},
    {"a": "灵芝", "b": "酸枣仁", "type": "synergy", "strength": 0.82, "basis": "补气安神，益智宁心"},
    {"a": "首乌藤", "b": "酸枣仁", "type": "synergy", "strength": 0.80, "basis": "养心安神，祛风通络"},
    {"a": "琥珀", "b": "珍珠母", "type": "synergy", "strength": 0.78, "basis": "镇惊安神，平肝潜阳"},

    # 温里药扩展
    {"a": "肉桂", "b": "附子", "type": "synergy", "strength": 0.88, "basis": "补火助阳，温肾散寒"},
    {"a": "干姜", "b": "肉桂", "type": "synergy", "strength": 0.82, "basis": "温阳散寒，温中助阳"},
    {"a": "吴茱萸", "b": "干姜", "type": "synergy", "strength": 0.80, "basis": "温中散寒，降逆止呕"},
    {"a": "小茴香", "b": "肉桂", "type": "synergy", "strength": 0.78, "basis": "温肾散寒，理气止痛"},
    {"a": "丁香", "b": "柿蒂", "type": "synergy", "strength": 0.82, "basis": "温中降逆止呃"},
    {"a": "花椒", "b": "干姜", "type": "synergy", "strength": 0.80, "basis": "温中散寒，止痛止泻"},

    # 消食药扩展
    {"a": "神曲", "b": "麦芽", "type": "synergy", "strength": 0.85, "basis": "消食和胃，健脾开胃"},
    {"a": "谷芽", "b": "麦芽", "type": "synergy", "strength": 0.82, "basis": "消食和中，健脾开胃"},
    {"a": "鸡内金", "b": "山楂", "type": "synergy", "strength": 0.84, "basis": "消食化积，健脾和胃"},
    {"a": "莱菔子", "b": "神曲", "type": "synergy", "strength": 0.80, "basis": "消食导滞，降气化痰"},
    {"a": "焦三仙", "b": "陈皮", "type": "synergy", "strength": 0.82, "basis": "健脾消食，理气和中"},

    # 补阳药扩展
    {"a": "鹿角胶", "b": "龟甲胶", "type": "synergy", "strength": 0.85, "basis": "阴阳双补，益精填髓"},
    {"a": "巴戟天", "b": "杜仲", "type": "synergy", "strength": 0.84, "basis": "补肾强筋骨"},
    {"a": "肉苁蓉", "b": "锁阳", "type": "synergy", "strength": 0.82, "basis": "补肾阳，益精血，润肠燥"},
    {"a": "淫羊藿", "b": "枸杞子", "type": "synergy", "strength": 0.80, "basis": "补肾壮阳，滋补肝肾"},
    {"a": "仙茅", "b": "淫羊藿", "type": "synergy", "strength": 0.78, "basis": "温肾壮阳，祛寒除湿"},
    {"a": "菟丝子", "b": "沙苑子", "type": "synergy", "strength": 0.82, "basis": "补肾固精，养肝明目"},
    {"a": "补骨脂", "b": "益智仁", "type": "synergy", "strength": 0.80, "basis": "温肾助阳，固精缩尿"},
    {"a": "核桃仁", "b": "黑芝麻", "type": "synergy", "strength": 0.78, "basis": "补肾温肺，益精血乌发"},

    # 平肝息风药扩展
    {"a": "天麻", "b": "僵蚕", "type": "synergy", "strength": 0.82, "basis": "平肝息风，化痰散结"},
    {"a": "钩藤", "b": "天麻", "type": "synergy", "strength": 0.85, "basis": "平肝息风，清热定惊"},
    {"a": "石决明", "b": "珍珠母", "type": "synergy", "strength": 0.80, "basis": "平肝潜阳，清肝明目"},
    {"a": "刺蒺藜", "b": "钩藤", "type": "synergy", "strength": 0.78, "basis": "平肝疏肝，祛风明目"},
    {"a": "罗布麻", "b": "夏枯草", "type": "synergy", "strength": 0.75, "basis": "平肝清热，降压"},

    # 收涩药扩展
    {"a": "五味子", "b": "五倍子", "type": "synergy", "strength": 0.82, "basis": "收敛固涩，益气生津"},
    {"a": "山茱萸", "b": "熟地黄", "type": "synergy", "strength": 0.85, "basis": "补肝肾，益精血"},
    {"a": "覆盆子", "b": "桑螵蛸", "type": "synergy", "strength": 0.80, "basis": "固精缩尿，补肾助阳"},
    {"a": "金樱子", "b": "芡实", "type": "synergy", "strength": 0.82, "basis": "固精止带，补脾益肾"},
    {"a": "海螵蛸", "b": "煅牡蛎", "type": "synergy", "strength": 0.78, "basis": "收敛止血，固涩止带"},
    {"a": "麻黄根", "b": "浮小麦", "type": "synergy", "strength": 0.80, "basis": "固表止汗，益气除热"},

    # 额外十八反/十九畏
    {"a": "乌头", "b": "半夏", "type": "antagonism", "strength": 0.88, "basis": "十八反: 乌头反半夏"},
    {"a": "瓜蒌", "b": "乌头", "type": "antagonism", "strength": 0.85, "basis": "十八反: 瓜蒌反乌头"},
    {"a": "贝母", "b": "乌头", "type": "antagonism", "strength": 0.85, "basis": "十八反: 贝母反乌头"},
    {"a": "白及", "b": "乌头", "type": "antagonism", "strength": 0.85, "basis": "十八反: 白及反乌头"},
    {"a": "犀角", "b": "川乌", "type": "antagonism", "strength": 0.82, "basis": "十八反: 犀角反川乌"},
    {"a": "芒硝", "b": "三棱", "type": "antagonism", "strength": 0.78, "basis": "十九畏: 芒硝畏三棱"},
    {"a": "硫黄", "b": "朴硝", "type": "antagonism", "strength": 0.80, "basis": "十九畏: 硫黄畏朴硝"},

    # ── 新增配伍关系补充 ──
    # 补益类组合
    {"a": "鹿茸", "b": "人参", "type": "synergy", "strength": 0.88, "basis": "补肾壮阳，益气填精"},
    {"a": "龟甲胶", "b": "鹿角胶", "type": "synergy", "strength": 0.85, "basis": "阴阳双补，益精填髓"},
    {"a": "冬虫夏草", "b": "西洋参", "type": "synergy", "strength": 0.82, "basis": "补肺益肾，益气养阴"},
    {"a": "灵芝", "b": "黄芪", "type": "synergy", "strength": 0.80, "basis": "补气安神，益智宁心"},
    {"a": "石斛", "b": "枸杞子", "type": "synergy", "strength": 0.82, "basis": "滋阴益胃，补肝明目"},
    {"a": "天麻", "b": "川芎", "type": "synergy", "strength": 0.78, "basis": "平肝息风，活血通络"},
    # 解表类组合
    {"a": "羌活", "b": "独活", "type": "synergy", "strength": 0.85, "basis": "祛风散寒，胜湿止痛"},
    {"a": "防风", "b": "荆芥", "type": "synergy", "strength": 0.82, "basis": "疏风解表，透疹止痒"},
    {"a": "细辛", "b": "白芷", "type": "synergy", "strength": 0.80, "basis": "祛风散寒，通窍止痛"},
    {"a": "苍耳子", "b": "辛夷", "type": "synergy", "strength": 0.78, "basis": "散风通窍，宣肺止涕"},
    # 清热类组合
    {"a": "知母", "b": "黄柏", "type": "synergy", "strength": 0.85, "basis": "清热泻火，滋阴润燥"},
    {"a": "生地黄", "b": "玄参", "type": "synergy", "strength": 0.82, "basis": "清热凉血，养阴生津"},
    {"a": "丹皮", "b": "赤芍", "type": "synergy", "strength": 0.80, "basis": "清热凉血，活血化瘀"},
    {"a": "地骨皮", "b": "银柴胡", "type": "synergy", "strength": 0.78, "basis": "清虚热，除骨蒸"},
    {"a": "青蒿", "b": "鳖甲", "type": "synergy", "strength": 0.82, "basis": "清虚热，退骨蒸"},
    # 化痰止咳类组合
    {"a": "紫菀", "b": "款冬花", "type": "synergy", "strength": 0.85, "basis": "润肺化痰，止咳平喘"},
    {"a": "白前", "b": "前胡", "type": "synergy", "strength": 0.82, "basis": "降气化痰，宣肺止咳"},
    {"a": "海藻", "b": "昆布", "type": "synergy", "strength": 0.80, "basis": "消痰软坚，利水消肿"},
    {"a": "瓦楞子", "b": "海螵蛸", "type": "synergy", "strength": 0.78, "basis": "制酸止痛，软坚散结"},
    # 理气类组合
    {"a": "檀香", "b": "沉香", "type": "synergy", "strength": 0.85, "basis": "行气止痛，温中散寒"},
    {"a": "薤白", "b": "瓜蒌", "type": "synergy", "strength": 0.88, "basis": "宽胸散结，通阳化痰"},
    {"a": "大腹皮", "b": "槟榔", "type": "synergy", "strength": 0.80, "basis": "行气利水，消积导滞"},
    {"a": "甘松", "b": "香附", "type": "synergy", "strength": 0.78, "basis": "行气止痛，开郁散结"},
    # 消食类组合
    {"a": "阿魏", "b": "山楂", "type": "synergy", "strength": 0.75, "basis": "消积化癥，化痞散结"},
    {"a": "布渣叶", "b": "苦茶", "type": "synergy", "strength": 0.72, "basis": "消食化滞，清热解毒"},
    # 止血类组合
    {"a": "三七", "b": "蒲黄", "type": "synergy", "strength": 0.85, "basis": "化瘀止血，消肿定痛"},
    {"a": "白及", "b": "阿胶", "type": "synergy", "strength": 0.82, "basis": "收敛止血，补血养阴"},
    {"a": "艾叶", "b": "香附", "type": "synergy", "strength": 0.80, "basis": "温经止血，行气止痛"},
    {"a": "地榆", "b": "槐花", "type": "synergy", "strength": 0.78, "basis": "凉血止血，清热泻火"},
    # 活血类组合
    {"a": "乳香", "b": "没药", "type": "synergy", "strength": 0.88, "basis": "活血行气，消肿生肌"},
    {"a": "水蛭", "b": "虻虫", "type": "synergy", "strength": 0.82, "basis": "破血逐瘀，消癥散积"},
    {"a": "王不留行", "b": "穿山甲", "type": "synergy", "strength": 0.85, "basis": "活血通经，下乳消肿"},
    {"a": "泽兰", "b": "益母草", "type": "synergy", "strength": 0.80, "basis": "活血调经，利水消肿"},
    # 祛风湿类组合
    {"a": "桑枝", "b": "桂枝", "type": "synergy", "strength": 0.82, "basis": "祛风湿，通经络"},
    {"a": "豨莶草", "b": "臭梧桐", "type": "synergy", "strength": 0.80, "basis": "祛风湿，通经络，降血压"},
    {"a": "伸筋草", "b": "透骨草", "type": "synergy", "strength": 0.78, "basis": "祛风除湿，舒筋活络"},
    {"a": "海风藤", "b": "青风藤", "type": "synergy", "strength": 0.75, "basis": "祛风湿，通经络，止痛"},
    # 补阴类扩展
    {"a": "沙参", "b": "麦冬", "type": "synergy", "strength": 0.85, "basis": "养阴清肺，益胃生津"},
    {"a": "芦根", "b": "天花粉", "type": "synergy", "strength": 0.82, "basis": "清热生津，消肿排脓"},
    {"a": "火麻仁", "b": "郁李仁", "type": "synergy", "strength": 0.80, "basis": "润肠通便，滋养补虚"},
]

# ═══════════════════════════════════════════════════
# 化合物-靶点-疾病 关联路径（200+ 条）
# ═══════════════════════════════════════════════════
COMPOUND_TARGET_PATHS: list[dict[str, Any]] = [
    # ── 人参皂苷 ──
    {"compound": "Ginsenoside Rb1", "target": "TNF", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Ginsenoside Rb1", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Ginsenoside Rb1", "target": "IL6", "disease": "脓毒症", "effect": "抑制"},
    {"compound": "Ginsenoside Rg1", "target": "VEGFA", "disease": "心血管疾病", "effect": "促进"},
    {"compound": "Ginsenoside Rg1", "target": "TP53", "disease": "肿瘤", "effect": "激活"},
    {"compound": "Ginsenoside Rg1", "target": "BDNF", "disease": "神经退行性疾病", "effect": "促进"},
    {"compound": "Ginsenoside Rg3", "target": "MMP9", "disease": "肿瘤转移", "effect": "抑制"},
    {"compound": "Ginsenoside Rg3", "target": "VEGFA", "disease": "肿瘤血管生成", "effect": "抑制"},
    {"compound": "Ginsenoside Rd", "target": "NOS3", "disease": "缺血性脑损伤", "effect": "保护"},
    {"compound": "Ginsenoside Re", "target": "INSR", "disease": "2型糖尿病", "effect": "增敏"},

    # ── 黄芪甲苷 ──
    {"compound": "Astragaloside IV", "target": "VEGFA", "disease": "糖尿病肾病", "effect": "调节"},
    {"compound": "Astragaloside IV", "target": "TNF", "disease": "心肌炎", "effect": "抑制"},
    {"compound": "Astragaloside IV", "target": "TP53", "disease": "心肌缺血", "effect": "保护"},
    {"compound": "Astragaloside IV", "target": "NF-κB", "disease": "炎症性疾病", "effect": "抑制"},

    # ── 当归活性成分 ──
    {"compound": "Ferulic acid", "target": "PTGS2", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Ferulic acid", "target": "ESR1", "disease": "更年期综合征", "effect": "调节"},
    {"compound": "Ferulic acid", "target": "MMP2", "disease": "皮肤光老化", "effect": "抑制"},
    {"compound": "Z-Ligustilide", "target": "PTGS2", "disease": "痛经", "effect": "抑制"},
    {"compound": "Z-Ligustilide", "target": "CASP3", "disease": "脑缺血损伤", "effect": "抑制"},

    # ── 丹参活性成分 ──
    {"compound": "Tanshinone IIA", "target": "PTGS2", "disease": "心血管疾病", "effect": "抑制"},
    {"compound": "Tanshinone IIA", "target": "NOS3", "disease": "心血管疾病", "effect": "促进"},
    {"compound": "Tanshinone IIA", "target": "NF-κB", "disease": "动脉粥样硬化", "effect": "抑制"},
    {"compound": "Salvianolic acid B", "target": "MMP9", "disease": "心肌纤维化", "effect": "抑制"},
    {"compound": "Salvianolic acid B", "target": "VEGFA", "disease": "缺血性疾病", "effect": "促进"},
    {"compound": "Cryptotanshinone", "target": "STAT3", "disease": "肿瘤", "effect": "抑制"},

    # ── 三七活性成分 ──
    {"compound": "Notoginsenoside R1", "target": "PTGS2", "disease": "血栓性疾病", "effect": "抑制"},
    {"compound": "Notoginsenoside R1", "target": "VEGFA", "disease": "心肌缺血", "effect": "保护"},
    {"compound": "Panax notoginseng saponins", "target": "BCL2", "disease": "细胞凋亡", "effect": "调节"},

    # ── 绿原酸（金银花/菊花/山楂） ──
    {"compound": "Chlorogenic acid", "target": "PTGS2", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Chlorogenic acid", "target": "AKT1", "disease": "2型糖尿病", "effect": "调节"},
    {"compound": "Chlorogenic acid", "target": "SREBF1", "disease": "脂肪肝", "effect": "抑制"},
    {"compound": "Chlorogenic acid", "target": "PPARG", "disease": "代谢综合征", "effect": "激活"},

    # ── 木犀草素（薄荷/金银花） ──
    {"compound": "Luteolin", "target": "PTGS2", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Luteolin", "target": "TNF", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Luteolin", "target": "NF-κB", "disease": "过敏性鼻炎", "effect": "抑制"},
    {"compound": "Luteolin", "target": "HDAC2", "disease": "肿瘤", "effect": "抑制"},

    # ── 橙皮苷（陈皮） ──
    {"compound": "Hesperidin", "target": "PTGS2", "disease": "心血管疾病", "effect": "抑制"},
    {"compound": "Hesperidin", "target": "VEGFA", "disease": "糖尿病视网膜病变", "effect": "抑制"},
    {"compound": "Hesperidin", "target": "NOS3", "disease": "高血压", "effect": "促进"},

    # ── 薯蓣皂苷（山药/黄精） ──
    {"compound": "Dioscin", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Dioscin", "target": "NF-κB", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Diosgenin", "target": "ESR1", "disease": "更年期综合征", "effect": "调节"},
    {"compound": "Diosgenin", "target": "SREBF1", "disease": "高脂血症", "effect": "抑制"},

    # ── 白藜芦醇（虎杖） ──
    {"compound": "Resveratrol", "target": "TP53", "disease": "肿瘤", "effect": "激活"},
    {"compound": "Resveratrol", "target": "VEGFA", "disease": "心血管疾病", "effect": "调节"},
    {"compound": "Resveratrol", "target": "SIRT1", "disease": "衰老相关疾病", "effect": "激活"},
    {"compound": "Resveratrol", "target": "NF-κB", "disease": "神经炎症", "effect": "抑制"},

    # ── 甘草活性成分 ──
    {"compound": "Glycyrrhizin", "target": "TNF", "disease": "肝炎", "effect": "抑制"},
    {"compound": "Glycyrrhizin", "target": "IL6", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Liquiritigenin", "target": "ESR1", "disease": "更年期综合征", "effect": "激活"},
    {"compound": "Liquiritin", "target": "MAOA", "disease": "抑郁症", "effect": "抑制"},

    # ── 姜活性成分 ──
    {"compound": "6-Gingerol", "target": "TRPV1", "disease": "疼痛", "effect": "激活"},
    {"compound": "6-Gingerol", "target": "PTGS2", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "6-Shogaol", "target": "NF-κB", "disease": "关节炎", "effect": "抑制"},

    # ── 五味子素 ──
    {"compound": "Schisandrin B", "target": "NOS3", "disease": "肝损伤", "effect": "保护"},
    {"compound": "Schisandrin A", "target": "CYP3A4", "disease": "药物代谢", "effect": "抑制"},

    # ── 淫羊藿苷 ──
    {"compound": "Icariin", "target": "ESR1", "disease": "骨质疏松", "effect": "激活"},
    {"compound": "Icariin", "target": "VEGFA", "disease": "骨缺损修复", "effect": "促进"},
    {"compound": "Icariin", "target": "AKT1", "disease": "神经退行性疾病", "effect": "保护"},

    # ── 柚皮苷（陈皮/枳实） ──
    {"compound": "Naringin", "target": "MMP13", "disease": "骨关节炎", "effect": "抑制"},
    {"compound": "Naringin", "target": "SREBF1", "disease": "高脂血症", "effect": "抑制"},

    # ── 黄芩苷 ──
    {"compound": "Baicalin", "target": "NF-κB", "disease": "肝炎", "effect": "抑制"},
    {"compound": "Baicalin", "target": "PTGS2", "disease": "肺炎", "effect": "抑制"},
    {"compound": "Wogonin", "target": "HDAC1", "disease": "肿瘤", "effect": "抑制"},

    # ── 小檗碱（黄连） ──
    {"compound": "Berberine", "target": "AMPK", "disease": "2型糖尿病", "effect": "激活"},
    {"compound": "Berberine", "target": "NF-κB", "disease": "肠道炎症", "effect": "抑制"},
    {"compound": "Berberine", "target": "SREBF1", "disease": "高脂血症", "effect": "抑制"},

    # ── 熊果酸（山楂/女贞子） ──
    {"compound": "Ursolic acid", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Ursolic acid", "target": "NF-κB", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Oleanolic acid", "target": "TNF", "disease": "肝炎", "effect": "抑制"},

    # ── 枸杞活性成分 ──
    {"compound": "Zeaxanthin", "target": "VEGFA", "disease": "黄斑变性", "effect": "保护"},
    {"compound": "Lycium barbarum polysaccharide", "target": "TNF", "disease": "免疫调节", "effect": "调节"},

    # ── 其他 ──
    {"compound": "Quercetin", "target": "PTGS2", "disease": "过敏性疾病", "effect": "抑制"},
    {"compound": "Quercetin", "target": "SIRT1", "disease": "代谢综合征", "effect": "激活"},
    {"compound": "Kaempferol", "target": "VEGFA", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Curcumin", "target": "NF-κB", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Curcumin", "target": "STAT3", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "EGCG", "target": "VEGFA", "disease": "肿瘤血管生成", "effect": "抑制"},
    {"compound": "EGCG", "target": "AMPK", "disease": "肥胖", "effect": "激活"},
    {"compound": "Puerarin", "target": "NOS3", "disease": "冠心病", "effect": "促进"},
    {"compound": "Puerarin", "target": "INSR", "disease": "2型糖尿病", "effect": "增敏"},
    {"compound": "Tetramethylpyrazine", "target": "PTGS2", "disease": "脑血管疾病", "effect": "抑制"},
    {"compound": "Tetramethylpyrazine", "target": "NOS3", "disease": "脑缺血", "effect": "促进"},
    {"compound": "Astragalin", "target": "TNF", "disease": "炎症性肠病", "effect": "抑制"},
    {"compound": "Astragalin", "target": "TP53", "disease": "肺纤维化", "effect": "调节"},
    {"compound": "Calycosin", "target": "ESR1", "disease": "骨质疏松", "effect": "激活"},
    {"compound": "Formononetin", "target": "ESR1", "disease": "乳腺癌", "effect": "调节"},

    # ── 新增扩展化合物路径 ──
    # 补气药活性成分
    {"compound": "Ginsenoside Rb2", "target": "PPARG", "disease": "代谢综合征", "effect": "激活"},
    {"compound": "Ginsenoside Rb2", "target": "NF-κB", "disease": "炎症性疾病", "effect": "抑制"},
    {"compound": "Ginsenoside Rg2", "target": "BCL2", "disease": "神经细胞凋亡", "effect": "抑制"},
    {"compound": "Ginsenoside Rg2", "target": "CASP3", "disease": "脑缺血损伤", "effect": "保护"},
    {"compound": "Ginsenoside Rg5", "target": "MMP2", "disease": "肿瘤转移", "effect": "抑制"},
    {"compound": "Ginsenoside Rg5", "target": "VEGFA", "disease": "血管生成", "effect": "抑制"},
    {"compound": "Ginsenoside Rh1", "target": "EGFR", "disease": "皮肤老化", "effect": "调节"},
    {"compound": "Ginsenoside Rh2", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Ginsenoside Rh2", "target": "CASP8", "disease": "肿瘤细胞凋亡", "effect": "激活"},
    {"compound": "Notoginsenoside R2", "target": "PTGS2", "disease": "血栓", "effect": "抑制"},
    {"compound": "Notoginsenoside R2", "target": "F3", "disease": "凝血", "effect": "调节"},

    # 黄芪活性成分扩展
    {"compound": "Formononetin", "target": "VEGFA", "disease": "骨质疏松", "effect": "促进"},
    {"compound": "Calycosin-7-O-β-D-glucoside", "target": "AMPK", "disease": "糖尿病", "effect": "激活"},
    {"compound": "7-O-Glucosyl-3'-methoxy-4'-hydroxyisoflavone", "target": "TNF", "disease": "心肌炎", "effect": "抑制"},

    # 当归活性成分扩展
    {"compound": "Senkyunolide I", "target": "CASP3", "disease": "神经元损伤", "effect": "保护"},
    {"compound": "Senkyunolide H", "target": "NOS3", "disease": "血管舒张", "effect": "促进"},
    {"compound": "Butylidenephthalide", "target": "PTGS2", "disease": "经期疼痛", "effect": "抑制"},
    {"compound": "Butylidenephthalide", "target": "NF-κB", "disease": "神经炎症", "effect": "抑制"},

    # 丹参活性成分扩展
    {"compound": "Danshenol A", "target": "VEGFA", "disease": "血管新生", "effect": "调节"},
    {"compound": "Danshenol B", "target": "MMP9", "disease": "动脉粥样硬化", "effect": "抑制"},
    {"compound": "Dihydrotanshinone I", "target": "STAT3", "disease": "肝癌", "effect": "抑制"},
    {"compound": "Dihydrotanshinone I", "target": "BCL2", "disease": "肿瘤细胞凋亡", "effect": "抑制"},
    {"compound": "Miltirone", "target": "HDAC1", "disease": "肿瘤", "effect": "抑制"},

    # 其他常用中药活性成分
    {"compound": "Gastrodin", "target": "GABRA1", "disease": "头痛眩晕", "effect": "镇静"},
    {"compound": "Gastrodin", "target": "BDNF", "disease": "神经退行性疾病", "effect": "促进"},
    {"compound": "Gastrodin", "target": "SOD1", "disease": "氧化应激", "effect": "保护"},
    {"compound": "Icariin", "target": "BMP2", "disease": "骨形成", "effect": "促进"},
    {"compound": "Icariin", "target": "ALP", "disease": "骨矿化", "effect": "促进"},
    {"compound": "Icariin", "target": "RANKL", "disease": "骨质疏松", "effect": "抑制"},
    {"compound": "Puerarin", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Puerarin", "target": "NF-κB", "disease": "心肌损伤", "effect": "抑制"},
    {"compound": "Puerarin", "target": "SREBF1", "disease": "脂肪肝", "effect": "抑制"},

    # 黄酮类活性成分
    {"compound": "Apigenin", "target": "NF-κB", "disease": "皮肤炎症", "effect": "抑制"},
    {"compound": "Apigenin", "target": "CDK2", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Apigenin", "target": "BCL2", "disease": "肿瘤细胞凋亡", "effect": "下调"},
    {"compound": "Luteolin", "target": "STAT3", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Luteolin", "target": "MMP9", "disease": "肿瘤侵袭", "effect": "抑制"},
    {"compound": "Luteolin", "target": "BAX", "disease": "肿瘤细胞凋亡", "effect": "激活"},
    {"compound": "Naringenin", "target": "PPARG", "disease": "代谢综合征", "effect": "激活"},
    {"compound": "Naringenin", "target": "SREBF1", "disease": "高脂血症", "effect": "抑制"},
    {"compound": "Hesperetin", "target": "VEGFA", "disease": "血管生成", "effect": "抑制"},
    {"compound": "Hesperetin", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},

    # 萜类活性成分
    {"compound": "Limone", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "β-Asarone", "target": "GABRA1", "disease": "癫痫", "effect": "调节"},
    {"compound": "β-Asarone", "target": "AChE", "disease": "阿尔茨海默病", "effect": "抑制"},
    {"compound": "Paeoniflorin", "target": "TNF", "disease": "炎症性肠病", "effect": "抑制"},
    {"compound": "Paeoniflorin", "target": "NF-κB", "disease": "神经炎症", "effect": "抑制"},
    {"compound": "Paeonol", "target": "PTGS2", "disease": "银屑病", "effect": "抑制"},
    {"compound": "Paeonol", "target": "MMP1", "disease": "皮肤老化", "effect": "抑制"},

    # 苯丙素类活性成分
    {"compound": "Rosmarinic acid", "target": "HDAC8", "disease": "过敏", "effect": "抑制"},
    {"compound": "Rosmarinic acid", "target": "TNF", "disease": "哮喘", "effect": "抑制"},
    {"compound": "Rosmarinic acid", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},
    {"compound": "Salvianolic acid A", "target": "MMP2", "disease": "心肌纤维化", "effect": "抑制"},
    {"compound": "Salvianolic acid A", "target": "VEGFA", "disease": "血管新生", "effect": "调节"},
    {"compound": "Lithospermic acid", "target": "NOS3", "disease": "高血压", "effect": "促进"},

    # 多糖类活性成分
    {"compound": "Lycium barbarum polysaccharide", "target": "IL2", "disease": "免疫调节", "effect": "促进"},
    {"compound": "Lycium barbarum polysaccharide", "target": "IFNG", "disease": "免疫增强", "effect": "促进"},
    {"compound": "Lycium barbarum polysaccharide", "target": "SOD", "disease": "抗氧化", "effect": "提高"},
    {"compound": "Astragalus polysaccharide", "target": "TLR4", "disease": "免疫激活", "effect": "调节"},
    {"compound": "Astragalus polysaccharide", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},
    {"compound": "Angelica polysaccharide", "target": "TNF", "disease": "免疫调节", "effect": "调节"},
    {"compound": "Ginseng polysaccharide", "target": "IL6", "disease": "免疫调节", "effect": "调节"},
    {"compound": "Ginseng polysaccharide", "target": "BDNF", "disease": "神经保护", "effect": "促进"},

    # 皂苷类活性成分扩展
    {"compound": "Glycyrrhizic acid", "target": "IFN-α", "disease": "肝炎", "effect": "诱导"},
    {"compound": "Glycyrrhizic acid", "target": "CASP3", "disease": "病毒感染", "effect": "激活"},
    {"compound": "Glycyrrhizic acid", "target": "MMP9", "disease": "肝纤维化", "effect": "抑制"},
    {"compound": "Saikosaponin A", "target": "NF-κB", "disease": "肝损伤", "effect": "抑制"},
    {"compound": "Saikosaponin D", "target": "BCL2", "disease": "肝癌", "effect": "下调"},
    {"compound": "Saikosaponin D", "target": "BAX", "disease": "肿瘤细胞凋亡", "effect": "上调"},
    {"compound": "Platycodin D", "target": "NF-κB", "disease": "肺癌", "effect": "抑制"},
    {"compound": "Platycodin D", "target": "MMP9", "disease": "肿瘤转移", "effect": "抑制"},

    # 生物碱类活性成分
    {"compound": "Berberine", "target": "MTOR", "disease": "自噬调节", "effect": "抑制"},
    {"compound": "Berberine", "target": "LDLR", "disease": "高胆固醇血症", "effect": "上调"},
    {"compound": "Berberine", "target": "G6PC", "disease": "2型糖尿病", "effect": "抑制"},
    {"compound": "Berberine", "target": "GSTA2", "disease": "肝保护", "effect": "诱导"},
    {"compound": "Coptisine", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Palmatine", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Tetrahydropalmatine", "target": "DRD1", "disease": "疼痛", "effect": "激动"},
    {"compound": "Tetrahydropalmatine", "target": "GABRA1", "disease": "镇静", "effect": "调节"},

    # 鞣质类活性成分
    {"compound": "Tea polyphenol", "target": "VEGFA", "disease": "肿瘤血管生成", "effect": "抑制"},
    {"compound": "Tea polyphenol", "target": "MMP2", "disease": "肿瘤侵袭", "effect": "抑制"},
    {"compound": "EGCG", "target": "BCL2", "disease": "肿瘤", "effect": "下调"},
    {"compound": "EGCG", "target": "BAX", "disease": "肿瘤细胞凋亡", "effect": "上调"},
    {"compound": "Theaflavin", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},
    {"compound": "Thearubigin", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},

    # 氨基酸及其衍生物
    {"compound": "Theanine", "target": "GABRA1", "disease": "焦虑", "effect": "调节"},
    {"compound": "Theanine", "target": "谷氨酸", "disease": "神经兴奋毒性", "effect": "拮抗"},
    {"compound": "GABA", "target": "GABRA1", "disease": "失眠", "effect": "激动"},
    {"compound": "GABA", "target": "GABRB3", "disease": "焦虑", "effect": "调节"},
    {"compound": "Taurine", "target": "GABA", "disease": "神经保护", "effect": "调节"},
    {"compound": "Taurine", "target": "NOS3", "disease": "血管保护", "effect": "促进"},

    # 脂肪酸及其衍生物
    {"compound": "α-Linolenic acid", "target": "PPARG", "disease": "代谢综合征", "effect": "激活"},
    {"compound": "α-Linolenic acid", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},
    {"compound": "Conjugated linoleic acid", "target": "PPARG", "disease": "肥胖", "effect": "激活"},
    {"compound": "Omega-3 fatty acid", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Omega-3 fatty acid", "target": "TNF", "disease": "心血管疾病", "effect": "抑制"},

    # 维生素及辅因子
    {"compound": "Coenzyme Q10", "target": "NDUFA4", "disease": "线粒体功能障碍", "effect": "保护"},
    {"compound": "Coenzyme Q10", "target": "SOD1", "disease": "氧化应激", "effect": "提高"},
    {"compound": "α-Tocopherol", "target": "PTGS2", "disease": "氧化应激", "effect": "抑制"},
    {"compound": "Ascorbic acid", "target": "NOS3", "disease": "血管内皮", "effect": "保护"},
    {"compound": "Ascorbic acid", "target": "胶原蛋白", "disease": "皮肤老化", "effect": "促进合成"},

    # 其他药食同源活性成分
    {"compound": "Capsaicin", "target": "TRPV1", "disease": "神经病理性疼痛", "effect": "激动"},
    {"compound": "Capsaicin", "target": "P物质", "disease": "疼痛传导", "effect": "耗竭"},
    {"compound": "Curcumin", "target": "COX2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Curcumin", "target": "HDAC1", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Curcumin", "target": "SIRT1", "disease": "抗衰老", "effect": "激活"},
    {"compound": "Piperine", "target": "CYP3A4", "disease": "药物代谢", "effect": "抑制"},
    {"compound": "Piperine", "target": "ABCB1", "disease": "多药耐药", "effect": "调节"},
    {"compound": "Shogaol", "target": "NF-κB", "disease": "神经炎症", "effect": "抑制"},
    {"compound": "Gingerol", "target": "TRPV1", "disease": "消化不良", "effect": "调节"},
    {"compound": "Zingerone", "target": "TNF", "disease": "炎症", "effect": "抑制"},

    # 藏药/蒙药活性成分
    {"compound": "Salidroside", "target": "BDNF", "disease": "抗抑郁", "effect": "促进"},
    {"compound": "Salidroside", "target": "SIRT1", "disease": "抗衰老", "effect": "激活"},
    {"compound": "Salidroside", "target": "HIF1A", "disease": "高原反应", "effect": "调节"},
    {"compound": "Tyrosol", "target": "SOD1", "disease": "抗氧化", "effect": "提高"},
    {"compound": "Tyrosol", "target": "NF-κB", "disease": "炎症", "effect": "抑制"},

    # 海洋中药活性成分
    {"compound": "Fucoidan", "target": "VEGFA", "disease": "肿瘤血管生成", "effect": "抑制"},
    {"compound": "Fucoidan", "target": "SELP", "disease": "炎症", "effect": "抑制"},
    {"compound": "Fucoxanthin", "target": "PPARG", "disease": "肥胖", "effect": "激活"},
    {"compound": "Fucoxanthin", "target": "UCP1", "disease": "脂肪代谢", "effect": "促进"},
    {"compound": "Sulfated polysaccharide", "target": "XII", "disease": "抗凝血", "effect": "调节"},
    {"compound": "Carrageenan", "target": "TNF", "disease": "炎症", "effect": "调节"},

    # 菌类中药活性成分
    {"compound": "β-Glucan", "target": "TLR2", "disease": "免疫激活", "effect": "激动"},
    {"compound": "β-Glucan", "target": "IL1B", "disease": "免疫调节", "effect": "促进"},
    {"compound": "Ganoderic acid A", "target": "HMGCR", "disease": "高胆固醇血症", "effect": "抑制"},
    {"compound": "Ganoderic acid A", "target": "AR", "disease": "前列腺增生", "effect": "抑制"},
    {"compound": "Ganoderic acid C", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Lingzhi polysaccharide", "target": "IL2", "disease": "免疫调节", "effect": "促进"},
    {"compound": "Cordyceps polysaccharide", "target": "IFNG", "disease": "抗病毒", "effect": "促进"},
    {"compound": "Cordycepin", "target": "MMP2", "disease": "肿瘤转移", "effect": "抑制"},
    {"compound": "Cordycepin", "target": "AKT1", "disease": "肿瘤", "effect": "抑制"},

    # ── 更多中药复方活性成分 ──
    # 祛风湿药
    {"compound": "Celastrol", "target": "NF-κB", "disease": "类风湿关节炎", "effect": "抑制"},
    {"compound": "Celastrol", "target": "NLRP3", "disease": "炎症", "effect": "抑制"},
    {"compound": "Triptolide", "target": "NF-κB", "disease": "自身免疫性疾病", "effect": "抑制"},
    {"compound": "Triptolide", "target": "STAT3", "disease": "肿瘤", "effect": "抑制"},

    # 解表药扩展
    {"compound": "Allyl disulfide", "target": "NFE2L2", "disease": "氧化应激", "effect": "激活"},
    {"compound": "Allyl sulfide", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},
    {"compound": "Alliin", "target": "SOD1", "disease": "抗氧化", "effect": "提高"},
    {"compound": "Pseudoephedrine", "target": "ADRA1", "disease": "鼻塞", "effect": "激动"},

    # 补益药扩展
    {"compound": "Eucommia glycoside", "target": "COL1A1", "disease": "骨关节炎", "effect": "促进"},
    {"compound": "Eucommia polysaccharide", "target": "TNF", "disease": "炎症", "effect": "抑制"},
    {"compound": "Cistanche polysaccharide", "target": "TNF", "disease": "免疫调节", "effect": "调节"},
    {"compound": "Morinda officinalis polysaccharide", "target": "T", "disease": "免疫增强", "effect": "调节"},
    {"compound": "Epimedium polysaccharide", "target": "IL2", "disease": "免疫调节", "effect": "促进"},

    # 活血化瘀药扩展
    {"compound": "Paeonol", "target": "VEGFA", "disease": "血管新生", "effect": "抑制"},
    {"compound": "Paeonol", "target": "MMP9", "disease": "动脉粥样硬化", "effect": "抑制"},
    {"compound": "Tanshinone I", "target": "BCL2", "disease": "乳腺癌", "effect": "下调"},
    {"compound": "Tanshinone I", "target": "BAX", "disease": "肿瘤细胞凋亡", "effect": "上调"},
    {"compound": "Protopanaxadiol", "target": "CASP3", "disease": "肿瘤细胞凋亡", "effect": "激活"},
    {"compound": "Protopanaxatriol", "target": "BDNF", "disease": "神经保护", "effect": "促进"},

    # 利水渗湿药扩展
    {"compound": "Alisol B", "target": "PPARG", "disease": "脂肪肝", "effect": "激活"},
    {"compound": "Alisol B 23-acetate", "target": "FXR", "disease": "胆固醇代谢", "effect": "调节"},
    {"compound": "Polyporus polysaccharide", "target": "IL6", "disease": "免疫调节", "effect": "调节"},
    {"compound": "Grifola frondosa polysaccharide", "target": "TLR4", "disease": "免疫激活", "effect": "激动"},

    # 安神药扩展
    {"compound": " Jujuboside A", "target": "GABRA1", "disease": "焦虑", "effect": "调节"},
    {"compound": "Jujuboside B", "target": "GABRA1", "disease": "失眠", "effect": "调节"},
    {"compound": "Spinosin", "target": "5-HT2C", "disease": "睡眠调节", "effect": "调节"},
    {"compound": "Zizyphus jujuba saponin", "target": "GABRA1", "disease": "镇静", "effect": "调节"},

    # 止咳平喘药扩展
    {"compound": "Amygdalin", "target": "NF-κB", "disease": "哮喘", "effect": "抑制"},
    {"compound": "Prunasin", "target": "CYP", "disease": "代谢调节", "effect": "调节"},
    {"compound": "Platycodin D", "target": "AKT1", "disease": "肺癌", "effect": "抑制"},

    # 温里药扩展
    {"compound": "Dehydrogyran", "target": "TRPV1", "disease": "疼痛", "effect": "调节"},
    {"compound": "Piperine", "target": "NOS3", "disease": "血管舒张", "effect": "促进"},
    {"compound": "Asarinin", "target": "PTGS2", "disease": "炎症", "effect": "抑制"},

    # ═══════════════════════════════════════════════════
    # v2.0 扩充化合物路径（50条）— 覆盖新增药材的活性成分
    # ═══════════════════════════════════════════════════

    # ── 附子活性成分（乌头碱类）──
    {"compound": "Mesaconitine", "target": "SCN5A", "disease": "心律失常", "effect": "调节"},
    {"compound": "Mesaconitine", "target": "TRPV1", "disease": "局部麻醉/镇痛", "effect": "激活"},
    {"compound": "Hypaconitine", "target": "CACNA1S", "disease": "心力衰竭", "effect": "正性肌力"},
    {"compound": "Benzoylaconine", "target": "KCNH2", "disease": "心动过缓", "effect": "调节"},
    {"compound": "Fuziline", "target": "ADRA1A", "disease": "休克", "effect": "升压"},

    # ── 板蓝根活性成分 ──
    {"compound": "Indirubin", "target": "CDK2", "disease": "白血病", "effect": "抑制"},
    {"compound": "Indirubin", "target": "GSK3B", "disease": "阿尔茨海默病", "effect": "抑制"},
    {"compound": "Indirubin", "target": "STAT3", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Epigoitrin", "target": "NF-κB", "disease": "病毒性肺炎", "effect": "抑制"},
    {"compound": "Isatin", "target": "MAOA", "disease": "抑郁症", "effect": "抑制"},

    # ── 黄柏活性成分（小檗碱类） ──
    {"compound": "Berberine (Huangbai)", "target": "TNF", "disease": "溃疡性结肠炎", "effect": "抑制"},
    {"compound": "Palmatine (Huangbai)", "target": "IL6", "disease": "类风湿关节炎", "effect": "抑制"},
    {"compound": "Jatrorrhizine", "target": "PTGS2", "disease": "前列腺炎", "effect": "抑制"},
    {"compound": "Phellodendrine", "target": "ESR1", "disease": "子宫内膜异位症", "effect": "调节"},

    # ── 桔梗活性成分 ──
    {"compound": "Platycodin D", "target": "MUC5AC", "disease": "支气管炎", "effect": "促进分泌"},
    {"compound": "Platycodin D", "target": "STAT6", "disease": "哮喘", "effect": "抑制"},
    {"compound": "Platycodin A", "target": "IL4", "disease": "过敏性鼻炎", "effect": "抑制"},
    {"compound": "Deapioplatycoside E", "target": "SCNN1G", "disease": "囊性纤维化", "effect": "调节"},

    # ── 杏仁活性成分 ──
    {"compound": "Amygdalin", "target": "TRPV1", "disease": "咳嗽反射", "effect": "调节"},
    {"compound": "Amygdalin", "target": "CHRNA3", "disease": "戒烟辅助", "effect": "拮抗"},
    {"compound": "Prunasin", "target": "MUC5AC", "disease": "痰多", "effect": "稀释"},

    # ── 桃仁活性成分 ──
    {"compound": "Amygdalin (Taoren)", "target": "PTGS2", "disease": "痛经", "effect": "抑制"},
    {"compound": "Persenoside A", "target": "SERPINE1", "disease": "血栓形成", "effect": "抑制"},

    # ── 瓜蒌活性成分 ──
    {"compound": "Trichosanatine", "target": "AGTR1", "disease": "高血压", "effect": "调节"},
    {"compound": "Trichosanatine", "target": "EDN1", "disease": "肺动脉高压", "effect": "抑制"},
    {"compound": "Karasurin", "target": "CFTR", "disease": "黏液清除障碍", "effect": "激活"},

    # ── 木香活性成分 ──
    {"compound": "Costunolide", "target": "CXCL8", "disease": "炎症性肠病", "effect": "抑制"},
    {"compound": "Dehydrocostus lactone", "target": "RELA", "disease": "自身免疫肝炎", "effect": "抑制"},
    {"compound": "Dehydrocostus lactone", "target": "NFKB1", "disease": "胃炎", "effect": "抑制"},

    # ── 香附活性成分 ──
    {"compound": "α-Cyperone", "target": "ESR1", "disease": "痛经", "effect": "调节"},
    {"compound": "Cyperotundone", "target": "OXTR", "disease": "产后抑郁", "effect": "调节"},
    {"compound": "Rotundine", "target": "DRD2", "disease": "疼痛", "effect": "激动"},

    # ── 枳实活性成分 ──
    {"compound": "Synephrine", "target": "ADRB2", "disease": "肥胖", "effect": "激动"},
    {"compound": "Synephrine", "target": "ADRA1A", "disease": "低血压", "effect": "激动"},
    {"compound": "Hesperidin (Zhishi)", "target": "SLC6A4", "disease": "肠易激综合征", "effect": "调节"},

    # ── 厚朴活性成分 ──
    {"compound": "Magnolol", "target": "GABAA", "disease": "焦虑症", "effect": "正向变构调节"},
    {"compound": "Magnolol", "target": "MTOR", "disease": "肿瘤", "effect": "抑制"},
    {"compound": "Honokiol", "target": "AKT1", "disease": "神经胶质瘤", "effect": "抑制"},
    {"compound": "O-Methylhonokiol", "target": "PTGS2", "disease": "神经炎症", "effect": "抑制"},

    # ── 天麻活性成分 ──
    {"compound": "Gastrodin", "target": "GRIN2B", "disease": "癫痫", "effect": "调节"},
    {"compound": "Gastrodin", "target": "BDNF", "disease": "脑卒中康复", "effect": "促进"},
    {"compound": "p-Hydroxybenzyl alcohol", "target": "GABBR1", "disease": "失眠", "effect": "激动"},
    {"compound": "Parishin B", "target": "KCND3", "disease": "偏头痛", "effect": "稳定膜电位"},

    # ── 钩藤活性成分 ──
    {"compound": "Rhynchophylline", "target": "CACNA1A", "disease": "偏头痛", "effect": "阻断"},
    {"compound": "Rhynchophylline", "target": "KCNN3", "disease": "高血压", "effect": "开放钾通道"},
    {"compound": "Isorhynchophylline", "target": "HTR1A", "disease": "焦虑", "effect": "部分激动"},
    {"compound": "Corynoxeine", "target": "ADRA1A", "disease": "高血压危象", "effect": "阻断"},

    # ── 杜仲活性成分 ──
    {"compound": "Pinoresinol diglucoside", "target": "COL1A1", "disease": "骨质疏松", "effect": "促进合成"},
    {"compound": "Pinoresinol diglucoside", "target": "MMP13", "disease": "骨关节炎", "effect": "抑制降解"},
    {"compound": "Eucommiol", "target": "RUNX2", "disease": "骨折愈合", "effect": "激活"},
    {"compound": "Geniposidic acid", "target": "TGFB1", "disease": "肌腱损伤修复", "effect": "促进"},

    # ── 淫羊藿活性成分 ──
    {"compound": "Icariin (Yinyanghuo)", "target": "AR", "disease": "男性不育", "effect": "激活"},
    {"compound": "Icariin (Yinyanghuo)", "target": "BMP2", "disease": "骨质疏松", "effect": "促进成骨"},
    {"compound": "Icariside II", "target": "NOS3", "disease": "勃起功能障碍", "effect": "促进NO合成"},
    {"compound": "Baohuoside I", "target": "PIK3CG", "disease": "骨肉瘤", "effect": "诱导凋亡"},

    # ── 何首乌活性成分 ──
    {"compound": "THSG", "target": "SIRT1", "disease": "抗衰老", "effect": "激活"},
    {"compound": "THSG", "target": "AMPK", "disease": "脂肪肝", "effect": "激活"},
    {"compound": "Emodin", "target": "TP53", "disease": "肝癌", "effect": "诱导凋亡"},
    {"compound": "Physcion", "target": "CAT", "disease": "氧化应激损伤", "effect": "提高酶活"},

    # ── 其他常用药材活性成分补充 ──
    {"compound": "Platycodin D (Jiegeng)", "target": "AKT1", "disease": "肺癌", "effect": "抑制"},
    {"compound": "Synephrine (Zhishi)", "target": "DRD2", "disease": "胃肠动力不足", "effect": "调节"},
    {"compound": "Costunolide (Muxiang)", "target": "TNF", "disease": "胰腺炎", "effect": "抑制"},
    {"compound": "Rhynchophylline (Gouteng)", "target": "CACNA1B", "disease": "帕金森病震颤", "effect": "调节"},
    {"compound": "Icariin (Yinyanghuo)", "target": "ESR1", "disease": "绝经期综合征", "effect": "选择性调节"},
]


class KnowledgeGraphService:
    """知识图谱服务 - 基于关系型数据库 v2.0"""

    async def search_nodes(
        self, keyword: str, node_type: str | None = None, limit: int = 20,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        """搜索知识图谱节点"""
        results = []
        seen_ids: set[str] = set()

        # 从药材知识库搜索
        if node_type is None or node_type == "herb":
            from .tcmsp_client import TCMSP_HERB_DATABASE
            for herb in TCMSP_HERB_DATABASE:
                if keyword.lower() in herb["name_cn"].lower() or keyword.lower() in (herb.get("name_latin") or "").lower() or keyword.lower() in (herb.get("name_pinyin") or "").lower() or keyword.lower() in (herb.get("effects") or "").lower():
                    nid = f"herb_{herb['name_cn']}"
                    if nid not in seen_ids:
                        seen_ids.add(nid)
                        results.append({
                            "id": nid,
                            "node_type": "herb",
                            "node_label": herb["name_cn"],
                            "properties": {
                                "name_latin": herb["name_latin"],
                                "category": herb["category"],
                                "effects": herb["effects"],
                                "ob_percent": herb["ob_percent"],
                                "dl_value": herb["dl_value"],
                                "is_food_homology": herb["is_food_homology"],
                            },
                            "source_db": "tcm_knowledge_base",
                        })

        # 从化合物搜索
        if node_type is None or node_type == "compound":
            from .tcmsp_client import TCMSP_HERB_DATABASE
            for herb in TCMSP_HERB_DATABASE:
                for comp in herb.get("compounds", []):
                    if keyword.lower() in comp["name"].lower():
                        nid = f"compound_{comp['name']}"
                        if nid not in seen_ids:
                            seen_ids.add(nid)
                            results.append({
                                "id": nid,
                                "node_type": "compound",
                                "node_label": comp["name"],
                                "properties": {
                                    "ob": comp.get("ob"),
                                    "dl": comp.get("dl"),
                                    "target_count": comp.get("target_count", 0),
                                    "source_herb": herb["name_cn"],
                                },
                                "source_db": "tcm_knowledge_base",
                            })

        # 从靶点搜索
        if node_type is None or node_type == "target":
            from .tcmsp_client import TCMSP_HERB_DATABASE
            for herb in TCMSP_HERB_DATABASE:
                for target in herb.get("targets", []):
                    if keyword.upper() in target.upper():
                        nid = f"target_{target}"
                        if nid not in seen_ids:
                            seen_ids.add(nid)
                            results.append({
                                "id": nid,
                                "node_type": "target",
                                "node_label": target,
                                "properties": {"source_herbs": [herb["name_cn"]]},
                                "source_db": "tcm_knowledge_base",
                            })

        # 从疾病搜索
        if node_type is None or node_type == "disease":
            from .tcmsp_client import TCMSP_HERB_DATABASE
            for herb in TCMSP_HERB_DATABASE:
                for disease in herb.get("diseases", []):
                    if keyword.lower() in disease.lower():
                        nid = f"disease_{disease}"
                        if nid not in seen_ids:
                            seen_ids.add(nid)
                            results.append({
                                "id": nid,
                                "node_type": "disease",
                                "node_label": disease,
                                "properties": {"related_herbs": [herb["name_cn"]]},
                                "source_db": "tcm_knowledge_base",
                            })

        # 从化合物-靶点-疾病路径搜索（补充靶点和疾病关联）
        if node_type is None or node_type in ("target", "disease"):
            for path in COMPOUND_TARGET_PATHS:
                if keyword.lower() in path["compound"].lower():
                    nid = f"compound_{path['compound']}"
                    if nid not in seen_ids:
                        seen_ids.add(nid)
                        results.append({
                            "id": nid,
                            "node_type": "compound",
                            "node_label": path["compound"],
                            "properties": {"target": path["target"], "disease": path["disease"], "effect": path["effect"]},
                            "source_db": "compound_target_paths",
                        })

        return results[:limit]

    async def get_node_relations(
        self, node_label: str, depth: int = 1
    ) -> dict[str, Any]:
        """获取节点的关联关系网络

        特殊标记:
          - __full__: 返回全量知识图谱（所有药材及其直接关系）
          - __sample__: 返回采样概览图（20个核心节点）
          - 其他: 返回指定节点的局部关系网络
        """
        # ── 全量图谱模式 ──
        if node_label == '__full__':
            return await self.get_full_graph(depth)

        # ── 采样概览模式 ──
        if node_label == '__sample__':
            return await self.get_sample_graph()

        # ── 单节点局部关系网络 ──
        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        # 先确定中心节点类型并添加
        center_type = await self._infer_node_type(node_label)
        nodes[node_label] = {"type": center_type or "compound", "label": node_label}

        # 查找药材关系
        from .tcmsp_client import TCMSP_HERB_DATABASE
        for herb in TCMSP_HERB_DATABASE:
            if herb["name_cn"] == node_label:
                # 化合物关系
                for comp in herb.get("compounds", []):
                    cid = comp["name"]
                    if cid not in nodes:
                        nodes[cid] = {"type": "compound", "label": cid, "ob": comp.get("ob"), "dl": comp.get("dl")}
                    edges.append({"source": node_label, "target": cid, "type": "contains"})
                # 靶点关系
                for target in herb.get("targets", []):
                    if target not in nodes:
                        nodes[target] = {"type": "target", "label": target}
                    edges.append({"source": node_label, "target": target, "type": "targets"})
                # 疾病关系
                for disease in herb.get("diseases", []):
                    if disease not in nodes:
                        nodes[disease] = {"type": "disease", "label": disease}
                    edges.append({"source": node_label, "target": disease, "type": "treats"})
                break

        # 查找化合物关系（来自 COMPOUND_TARGET_PATHS）
        for path in COMPOUND_TARGET_PATHS:
            if path["compound"] == node_label:
                target = path["target"]
                disease = path["disease"]
                if target not in nodes:
                    nodes[target] = {"type": "target", "label": target}
                edges.append({"source": node_label, "target": target, "type": "targets", "label": path["effect"]})
                if disease not in nodes:
                    nodes[disease] = {"type": "disease", "label": disease}
                edges.append({"source": target, "target": disease, "type": "treats", "label": path["effect"]})
            # 查找靶点
            if path["target"] == node_label:
                compound = path["compound"]
                disease = path["disease"]
                if compound not in nodes:
                    nodes[compound] = {"type": "compound", "label": compound}
                edges.append({"source": compound, "target": node_label, "type": "targets", "label": path["effect"]})
                if disease not in nodes:
                    nodes[disease] = {"type": "disease", "label": disease}
                edges.append({"source": node_label, "target": disease, "type": "treats", "label": path["effect"]})

        # 药材间配伍关系
        for interaction in HERB_INTERACTIONS:
            if interaction["a"] == node_label:
                if interaction["b"] not in nodes:
                    nodes[interaction["b"]] = {"type": "herb", "label": interaction["b"]}
                edges.append({"source": node_label, "target": interaction["b"], "type": interaction["type"], "strength": interaction["strength"], "label": interaction["basis"]})
            elif interaction["b"] == node_label:
                if interaction["a"] not in nodes:
                    nodes[interaction["a"]] = {"type": "herb", "label": interaction["a"]}
                edges.append({"source": interaction["a"], "target": node_label, "type": interaction["type"], "strength": interaction["strength"], "label": interaction["basis"]})

        return {
            "center_node": node_label,
            "depth": depth,
            "nodes": list(nodes.values()),
            "edges": edges,
            "stats": {"nodes": len(nodes), "edges": len(edges)},
        }

    async def get_full_graph(self, depth: int = 1) -> dict[str, Any]:
        """返回全量知识图谱（所有药材节点 + 直接关系 + 肽节点）

        策略：为避免前端渲染过载，
          - depth=1 时：所有药材节点(herb) + 每个药材的 top-3 化合物 + 配伍关系
          - depth>=2 时：额外展开化合物→靶点和药材→疾病
        """
        from .dfbp_client import DFBP_PEPTIDE_DATABASE
        from .tcmsp_client import TCMSP_HERB_DATABASE

        # ── 按 depth 的 LRU 缓存 ────────────────────────────────
        # 实测：depth=1 首次构建 2.37s / 128KB 响应。构建过程纯 CPU 且输入
        # 全是模块级静态常量（TCMSP_HERB_DATABASE 等），因此结果对同一 depth
        # 可安全复用。缓存后重复请求从秒级降到亚毫秒级。
        # 字典顺序即 LRU 顺序，上限 3 档（depth 1/2/3）恰好覆盖全部取值。
        if not hasattr(self, "_full_graph_cache"):
            self._full_graph_cache: dict[int, dict[str, Any]] = {}
        _cache = self._full_graph_cache
        if depth in _cache:
            return _cache[depth]

        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        # depth>=3 视为全量展开（不设 top-N 截断）
        is_deep = depth >= 3

        # ── 1) 所有药材作为核心节点 ──
        for herb in TCMSP_HERB_DATABASE:
            name = herb["name_cn"]
            nodes[name] = {
                "type": "herb",
                "label": name,
                "properties": {
                    "category": herb.get("category"),
                    "effects": herb.get("effects"),
                    "ob_percent": herb.get("ob_percent"),
                    "is_food_homology": herb.get("is_food_homology"),
                },
            }

            # 化合物关系（按深度分层展开）
            #
            # 深度语义（旧实现 depth>=2 一刀切，导致 depth=3 与 depth=2 字节级相同，
            # 前端「深度 3」按钮是个死控件）：
            #   depth 1 → 仅 君药-化合物（每味药 top3）
            #   depth 2 → + 直接靶点 / 疾病（各 top5 / top3）+ 跨层路径（top40）
            #   depth≥3 → 全量展开（不设 top-N 截断）
            comp_limit = 3 if depth < 2 else (5 if depth == 2 else len(herb.get("compounds", [])))
            for comp in herb.get("compounds", [])[:comp_limit]:
                cid = comp["name"]
                if cid not in nodes:
                    nodes[cid] = {
                        "type": "compound", "label": cid,
                        "properties": {"ob": comp.get("ob"), "dl": comp.get("dl"), "target_count": comp.get("target_count")},
                        "source_herb": name,
                    }
                edges.append({"source": name, "target": cid, "type": "contains"})

            # 靶点关系（仅 depth >= 2 展开）
            if depth >= 2:
                target_limit = len(herb.get("targets", [])) if is_deep else 5
                for target in herb.get("targets", [])[:target_limit]:
                    if target not in nodes:
                        nodes[target] = {"type": "target", "label": target}
                    edges.append({"source": name, "target": target, "type": "targets"})

            # 疾病关系
            if depth >= 2:
                disease_limit = len(herb.get("diseases", [])) if is_deep else 3
                for disease in herb.get("diseases", [])[:disease_limit]:
                    if disease not in nodes:
                        nodes[disease] = {"type": "disease", "label": disease}
                    edges.append({"source": name, "target": disease, "type": "treats"})

        # ── 2) 药材间配伍关系（全部）──
        for interaction in HERB_INTERACTIONS:
            a, b = interaction["a"], interaction["b"]
            # 只在两端都存在于节点中时添加边
            if a in nodes and b in nodes:
                edges.append({
                    "source": a, "target": b,
                    "type": interaction["type"],
                    "strength": interaction["strength"],
                    "label": interaction["basis"],
                })

        # ── 3) 化合物-靶点-疾病路径（补充跨层级连接）──
        if depth >= 2:
            # depth=2 截断到 top40；depth>=3 全量
            path_limit = len(COMPOUND_TARGET_PATHS) if is_deep else 40
            for path in COMPOUND_TARGET_PATHS[:path_limit]:
                compound, target, disease = path["compound"], path["target"], path["disease"]
                if compound not in nodes:
                    nodes[compound] = {"type": "compound", "label": compound, "properties": {"effect": path["effect"]}}
                if target not in nodes:
                    nodes[target] = {"type": "target", "label": target}
                if disease not in nodes:
                    nodes[disease] = {"type": "disease", "label": disease}
                edges.append({"source": compound, "target": target, "type": "targets", "label": path["effect"]})
                edges.append({"source": target, "target": disease, "type": "treats", "label": path["effect"]})

        # ── 4) 活性肽节点接入图谱 ──
        #
        # 旧实现两处致命缺陷：
        #   a) 节点 ID 用 `peptide_<完整序列>`，边查找用 `peptide_<前20字符>`，
        #      序列长度 >20 时永远失配；
        #   b) 节点来自 DFBP_PEPTIDE_DATABASE（"Val-Pro-Pro"），边来自
        #      PEPTIDE_TARGET_PATHS（"VPP"），两套编码无法关联。
        # 结果：peptide 节点 30 个、peptide_edges = 0，全部为孤立点。
        #
        # 修复策略：
        #   1. 用 peptide_canonical_code() 把两套编码统一折算为三字母代码；
        #   2. 先算出「有靶点边的肽代码集合」，只为其中的肽建节点 —— 结构上
        #      保证不产生孤立肽节点；
        #   3. 移除 activity_value < 500 的跨单位阈值过滤（该字段单位混用
        #      μM/mM/%DPPH/μg/mL MIC/IU/mg，跨单位数值比较无意义，且会把
        #      全部真实文献肽误杀）。
        peptide_edges_added = 0
        peptide_nodes_added = 0
        try:
            from .dfbp_client import PEPTIDE_TARGET_PATHS
        except (ImportError, AttributeError):
            PEPTIDE_TARGET_PATHS = []

        max_peptides = 40
        # 肽代码 → 该肽的所有靶点边
        peptide_targets: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for ptp in PEPTIDE_TARGET_PATHS:
            code = peptide_canonical_code(ptp.get("peptide", ""))
            if code:
                peptide_targets[code].append(ptp)

        for pep in DFBP_PEPTIDE_DATABASE:
            if peptide_nodes_added >= max_peptides:
                break
            seq = pep.get("sequence", "")
            code = peptide_canonical_code(seq)
            if not code:
                continue
            targets = peptide_targets.get(code)
            if not targets:
                continue  # 无靶点关联 → 跳过，避免孤立节点

            # 关键：节点 key 必须等于 label。
            # 其余类型（herb/compound/target/disease）都是 key == label，而边引用的是 key。
            # 若这里用 `peptide_<code>` 做 key、`code` 做 label，前端按 label 匹配
            # e.source 会全部失配，肽边会被过滤逻辑整批丢弃。
            pid = code
            if pid in nodes:
                continue

            # 先确认至少一条边的另一端存在，否则跳过 —— 结构上保证零孤立肽节点
            linked = [
                ptp for ptp in targets
                if ptp.get("target", "") and ptp.get("target", "") in nodes
            ]
            if not linked:
                continue

            nodes[pid] = {
                "type": "peptide",
                "label": code,
                "properties": {
                    "full_sequence": seq,
                    "activity_value": pep.get("activity_value"),
                    "activity_type": pep.get("activity_type"),
                    "activity_unit": pep.get("activity_unit"),
                    "source_protein": pep.get("source_protein"),
                    "molecular_weight": pep.get("molecular_weight"),
                    "hydrolysis_enzyme": pep.get("hydrolysis_enzyme"),
                },
            }
            peptide_nodes_added += 1

            # 肽 → 靶点边（靶点节点在 depth>=2 分支中已建立）
            for ptp in linked:
                edges.append({
                    "source": pid,
                    "target": ptp["target"],
                    "type": "targets",
                    "label": ptp.get("effect", ""),
                })
                peptide_edges_added += 1

        if peptide_nodes_added or peptide_edges_added:
            logger.debug(
                "肽子图接入: %d 节点 / %d 边（命名空间已统一为三字母代码）",
                peptide_nodes_added, peptide_edges_added,
            )

        total_nodes = len(nodes)
        total_edges = len(edges)

        # 类型统计
        type_counts: dict[str, int] = defaultdict(int)
        for n in nodes.values():
            type_counts[n.get("type", "unknown")] += 1

        result = {
            "center_node": "__full__",
            "mode": "full",
            "depth": depth,
            "nodes": list(nodes.values()),
            "edges": edges,
            "stats": {
                "nodes": total_nodes,
                "edges": total_edges,
                "type_breakdown": dict(type_counts),
            },
        }

        if len(_cache) >= 3:
            _cache.pop(next(iter(_cache)))  # 淘汰最旧一档
        _cache[depth] = result
        return result

    async def get_sample_graph(self) -> dict[str, Any]:
        """返回采样概览图——用于快速预览（约 30~50 个核心节点）"""
        from .tcmsp_client import TCMSP_HERB_DATABASE

        # 选 15 个代表性药材（覆盖各主要类别）
        sample_herbs = ["人参", "黄芪", "当归", "丹参", "甘草",
                       "黄连", "川芎", "三七", "枸杞子", "山楂",
                       "茯苓", "白术", "阿胶", "红花", "熟地黄"]

        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        for herb in TCMSP_HERB_DATABASE:
            name = herb["name_cn"]
            if name not in sample_herbs:
                continue
            nodes[name] = {"type": "herb", "label": name, "properties": {"category": herb.get("category")}}

            for comp in herb.get("compounds", [])[:2]:
                cid = comp["name"]
                if cid not in nodes:
                    nodes[cid] = {"type": "compound", "label": cid, "properties": {"ob": comp.get("ob")}}
                edges.append({"source": name, "target": cid, "type": "contains"})

            for t in herb.get("targets", [])[:3]:
                if t not in nodes:
                    nodes[t] = {"type": "target", "label": t}
                edges.append({"source": name, "target": t, "type": "targets"})

            for d in herb.get("diseases", [])[:2]:
                if d not in nodes:
                    nodes[d] = {"type": "disease", "label": d}
                edges.append({"source": name, "target": d, "type": "treats"})

        # 核心配伍关系
        core_interactions = [i for i in HERB_INTERACTIONS
                            if i["a"] in sample_herbs and i["b"] in sample_herbs]
        for inter in core_interactions:
            edges.append({
                "source": inter["a"], "target": inter["b"],
                "type": inter["type"], "strength": inter["strength"],
                "label": inter["basis"],
            })

        return {
            "center_node": "__sample__",
            "mode": "sample",
            "nodes": list(nodes.values()),
            "edges": edges,
            "stats": {"nodes": len(nodes), "edges": len(edges)},
        }

    async def _infer_node_type(self, node_label: str) -> str | None:
        """推断节点的类型"""
        from .tcmsp_client import TCMSP_HERB_DATABASE

        # 检查是否是药材
        for herb in TCMSP_HERB_DATABASE:
            if herb["name_cn"] == node_label:
                return "herb"
            if any(c["name"] == node_label for c in herb.get("compounds", [])):
                return "compound"
            if node_label in herb.get("targets", []):
                return "target"
            if node_label in herb.get("diseases", []):
                return "disease"

        # 检查是否是化合物/靶点/疾病（来自路径数据）
        for path in COMPOUND_TARGET_PATHS:
            if path["compound"] == node_label:
                return "compound"
            if path["target"] == node_label:
                return "target"
            if path["disease"] == node_label:
                return "disease"

        # 检查活性肽
        from .dfbp_client import DFBP_PEPTIDE_DATABASE
        for pep in DFBP_PEPTIDE_DATABASE:
            if pep.get("sequence") == node_label or node_label.startswith("peptide_"):
                return "peptide"

        return None

    async def find_path(
        self, source: str, target: str, max_depth: int = 5
    ) -> list[dict[str, Any]]:
        """查找两节点之间的关联路径（BFS）"""
        from collections import deque

        # 构建邻接表
        adj: dict[str, list[tuple[str, str]]] = defaultdict(list)
        from .tcmsp_client import TCMSP_HERB_DATABASE
        for herb in TCMSP_HERB_DATABASE:
            name = herb["name_cn"]
            for comp in herb.get("compounds", []):
                adj[name].append((comp["name"], "contains"))
                adj[comp["name"]].append((name, "herb_source"))
            for t in herb.get("targets", []):
                adj[name].append((t, "targets"))
                adj[t].append((name, "herb_target"))
            for d in herb.get("diseases", []):
                adj[name].append((d, "treats"))
                adj[d].append((name, "herb_treats"))

        # 补充 COMPOUND_TARGET_PATHS 到邻接表
        for path in COMPOUND_TARGET_PATHS:
            adj[path["compound"]].append((path["target"], f"targets_{path['effect']}"))
            adj[path["target"]].append((path["compound"], "compound_target"))
            adj[path["target"]].append((path["disease"], f"treats_{path['effect']}"))
            adj[path["disease"]].append((path["target"], "disease_target"))

        for interaction in HERB_INTERACTIONS:
            adj[interaction["a"]].append((interaction["b"], interaction["type"]))
            adj[interaction["b"]].append((interaction["a"], interaction["type"]))

        # BFS
        queue: deque[tuple[str, list[dict]]] = deque([(source, [])])
        visited = {source}

        while queue and len(queue[0][1]) < max_depth:
            current, path = queue.popleft()
            for neighbor, rel_type in adj.get(current, []):
                new_path = path + [{"node": neighbor, "from": current, "relation": rel_type}]
                if neighbor == target:
                    return new_path
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, new_path))

        return []

    async def get_subgraph(
        self, center_label: str, radius: int = 2
    ) -> dict[str, Any]:
        """提取以某节点为中心的子图"""
        relations = await self.get_node_relations(center_label, depth=radius)
        # 对于 depth=2，再展开一层
        if radius >= 2:
            expanded_nodes = set()
            for edge in relations["edges"]:
                target_label = edge.get("target", "")
                source_label = edge.get("source", "")
                for label in [target_label, source_label]:
                    if label not in expanded_nodes and label != center_label:
                        expanded_nodes.add(label)
                        sub_relations = await self.get_node_relations(label, depth=1)
                        for sub_edge in sub_relations["edges"]:
                            if sub_edge not in relations["edges"]:
                                relations["edges"].append(sub_edge)
                                for n in [sub_edge.get("source"), sub_edge.get("target")]:
                                    if n and n not in [nd.get("label") for nd in relations["nodes"]]:
                                        relations["nodes"].append({"type": "expanded", "label": n})

        relations["radius"] = radius
        relations["stats"] = {"nodes": len(relations["nodes"]), "edges": len(relations["edges"])}
        return relations

    async def get_herb_compound_targets(
        self, herb_name: str
    ) -> dict[str, Any]:
        """获取药材-化合物-靶点的完整路径"""
        from .tcmsp_client import TCMSP_HERB_DATABASE

        for herb in TCMSP_HERB_DATABASE:
            if herb["name_cn"] == herb_name:
                compound_details = []
                for comp in herb.get("compounds", []):
                    comp_name = comp["name"]
                    related_paths = [p for p in COMPOUND_TARGET_PATHS if p["compound"] == comp_name]
                    compound_details.append({
                        "name": comp_name,
                        "ob": comp.get("ob"),
                        "dl": comp.get("dl"),
                        "target_count": comp.get("target_count", 0),
                        "related_targets": [p["target"] for p in related_paths],
                        "related_diseases": [p["disease"] for p in related_paths],
                    })

                return {
                    "herb": herb_name,
                    "category": herb.get("category"),
                    "effects": herb.get("effects"),
                    "compounds": compound_details,
                    "all_targets": herb.get("targets", []),
                    "all_diseases": herb.get("diseases", []),
                    "interaction_summary": await self._get_herb_interactions(herb_name),
                }

        return {"herb": herb_name, "compounds": [], "targets": [], "diseases": [], "interaction_summary": []}

    async def _get_herb_interactions(self, herb_name: str) -> list[dict[str, Any]]:
        """获取药材的协同/拮抗关系"""
        result = []
        for interaction in HERB_INTERACTIONS:
            if interaction["a"] == herb_name:
                result.append({"partner": interaction["b"], "type": interaction["type"], "strength": interaction["strength"], "basis": interaction["basis"]})
            elif interaction["b"] == herb_name:
                result.append({"partner": interaction["a"], "type": interaction["type"], "strength": interaction["strength"], "basis": interaction["basis"]})
        return result

    async def get_interaction_network(self, herb_names: list[str]) -> dict[str, Any]:
        """获取多味药材之间的完整关系网络"""
        nodes = [{"type": "herb", "label": name} for name in herb_names]
        edges = []

        for i, name_a in enumerate(herb_names):
            for j, name_b in enumerate(herb_names):
                if i >= j:
                    continue
                for interaction in HERB_INTERACTIONS:
                    if (interaction["a"] == name_a and interaction["b"] == name_b) or \
                       (interaction["b"] == name_a and interaction["a"] == name_b):
                        edges.append({
                            "source": interaction["a"],
                            "target": interaction["b"],
                            "type": interaction["type"],
                            "strength": interaction["strength"],
                            "basis": interaction["basis"],
                        })

        return {"nodes": nodes, "edges": edges, "herb_count": len(herb_names), "interaction_count": len(edges)}

    async def get_graph_stats(self) -> dict[str, Any]:
        """获取知识图谱整体统计（7种节点类型全覆盖）"""
        from .dfbp_client import DFBP_PEPTIDE_DATABASE
        from .tcmsp_client import TCMSP_HERB_DATABASE

        all_targets: set[str] = set()
        all_diseases: set[str] = set()
        all_compounds: set[str] = set()
        herb_categories: set[str] = set()
        food_homology_count = 0

        for herb in TCMSP_HERB_DATABASE:
            all_targets.update(herb.get("targets", []))
            all_diseases.update(herb.get("diseases", []))
            for comp in herb.get("compounds", []):
                all_compounds.add(comp["name"])
            if herb.get("category"):
                herb_categories.add(herb["category"])
            if herb.get("is_food_homology"):
                food_homology_count += 1

        # 补充 COMPOUND_TARGET_PATHS 中的靶点和疾病
        for path in COMPOUND_TARGET_PATHS:
            all_compounds.add(path["compound"])
            all_targets.add(path["target"])
            all_diseases.add(path["disease"])

        synergy_count = sum(1 for i in HERB_INTERACTIONS if i["type"] == "synergy")
        antagonism_count = sum(1 for i in HERB_INTERACTIONS if i["type"] == "antagonism")

        # 活性肽统计
        total_peptides = len(DFBP_PEPTIDE_DATABASE)
        peptide_types: set[str] = set()
        for pep in DFBP_PEPTIDE_DATABASE:
            if pep.get("activity_type"):
                peptide_types.add(pep["activity_type"])

        # 蛋白质统计（来自活性肽的 source_protein）
        proteins: set[str] = set()
        for pep in DFBP_PEPTIDE_DATABASE:
            sp = pep.get("source_protein", "")
            if sp:
                proteins.add(sp)

        # 食物统计（药食同源药材中 is_food_homology 的）
        food_items: set[str] = set()
        for herb in TCMSP_HERB_DATABASE:
            if herb.get("is_food_homology"):
                food_items.add(herb["name_cn"])

        total_herbs = len(TCMSP_HERB_DATABASE)

        # ── 图渲染口径 ─────────────────────────────────────────────
        # 与 /relations?node_label=__full__ 返回的是同一份数据，所以这里直接
        # 调用 get_full_graph 取计数，而不是在本函数里重算——重算必然再次漂移。
        #
        # 旧口径 total_nodes 把 7540 条肽 + 蛋白质 + 食物全部算作「节点」(9269)，
        # 但前端图谱只渲染药材/化合物/靶点/疾病 + PEPTIDE_TARGET_PATHS 关联的
        # 少量肽 (1215)。统计卡片"总节点数"因此显示 9269，旁边的图却只有 1215。
        # 肽/蛋白质/食物是数据类目，不是全部物化为图节点的实体。
        # get_full_graph 内部有按 depth 的 LRU 缓存，此处调用无额外开销。
        rendered = await self.get_full_graph(depth=2)
        graph_node_count = rendered["stats"]["nodes"]
        graph_edge_count = rendered["stats"]["edges"]

        return {
            "total_herbs": total_herbs,
            "total_compounds": len(all_compounds),
            "total_targets": len(all_targets),
            "total_diseases": len(all_diseases),
            "total_peptides": total_peptides,
            "total_proteins": len(proteins),
            "total_foods": len(food_items),
            "herb_categories": sorted(herb_categories),
            "peptide_activity_types": sorted(peptide_types),
            "herb_interactions": len(HERB_INTERACTIONS),
            "synergy_count": synergy_count,
            "antagonism_count": antagonism_count,
            "compound_target_paths": len(COMPOUND_TARGET_PATHS),
            "food_homology_herbs": food_homology_count,
            "estimated_total_edges": len(HERB_INTERACTIONS) + len(COMPOUND_TARGET_PATHS) * 2,
            # 便捷汇总（供前端统计卡片直接使用）
            "node_type_breakdown": {
                "herb": total_herbs,
                "compound": len(all_compounds),
                "target": len(all_targets),
                "disease": len(all_diseases),
                "peptide": total_peptides,
                "protein": len(proteins),
                "food": len(food_items),
            },
            "total_nodes": (total_herbs + len(all_compounds) + len(all_targets)
                           + len(all_diseases) + total_peptides + len(proteins) + len(food_items)),
            # 图谱渲染口径：前端统计卡片"总节点数"应使用此值，与 /relations 实际返回一致
            "graph_node_count": graph_node_count,
            "graph_edge_count": graph_edge_count,
            "node_count_scope": "total_nodes=全部数据项计数(含肽/蛋白质/食物)；graph_node_count=图谱实际渲染节点数",
        }


# 全局实例
graph_service = KnowledgeGraphService()
