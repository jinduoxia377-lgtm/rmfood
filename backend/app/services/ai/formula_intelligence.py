"""
配方智能校验与平台知识检索服务

为「智能对话」的配方设计场景提供科学级后验能力：
- validate_formula: 对配方成分做原料库识别、剂量状态判定、SafetyAlertSystem 三级预警、
  两两配伍禁忌（十八反/十九畏静态表 + CompatibilityChecker 4 层检测）、过敏原匹配；
- retrieve_herb_knowledge: 基于 FoodMaterial 平台原料库的关键词知识检索。

设计原则：
- 所有外部依赖（DB、SafetyAlertSystem、CompatibilityChecker）均在调用处 try/except 包裹，
  失败时优雅降级（记录日志并跳过该子能力），绝不让校验流程整体 500。
- 十八反/十九畏静态表与剂量状态判定为纯 Python 逻辑，可独立单测，不依赖数据库。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════
# 十八反 / 十九畏 静态禁忌对（传统中药配伍禁忌）
# 键名使用规范化后的药材名，见 _canonical_tcm_name
# ════════════════════════════════════════════════════════════════

# 十八反：本草明言十八反，半蒌贝蔹及攻乌；藻戟遂芫俱战草，诸参辛芍叛藜芦。
_SHIBA_FAN: frozenset = frozenset({
    ("甘草", "甘遂"),
    ("甘草", "大戟"),
    ("甘草", "海藻"),
    ("甘草", "芫花"),
    ("乌头", "半夏"),
    ("乌头", "瓜蒌"),
    ("乌头", "贝母"),
    ("乌头", "白蔹"),
    ("乌头", "白及"),
    ("藜芦", "人参"),
    ("藜芦", "沙参"),
    ("藜芦", "丹参"),
    ("藜芦", "玄参"),
    ("藜芦", "苦参"),
    ("藜芦", "细辛"),
    ("藜芦", "芍药"),
})

# 十九畏：硫黄原是火中精，朴硝一见便相争；水银莫与砒霜见，狼毒最怕密陀僧；
# 巴豆性烈最为上，偏与牵牛不顺情；丁香莫与郁金见，牙硝难合京三棱；
# 川乌草乌不顺犀，人参最怕五灵脂；官桂善能调冷气，若逢石脂便相欺。
_SHIJIU_WEI: frozenset = frozenset({
    ("硫黄", "朴硝"),
    ("水银", "砒霜"),
    ("狼毒", "密陀僧"),
    ("巴豆", "牵牛"),
    ("丁香", "郁金"),
    ("乌头", "犀角"),
    ("牙硝", "三棱"),
    ("官桂", "石脂"),
    ("人参", "五灵脂"),
})

# 常用别名/炮制品 → 禁忌表规范名
_TCM_ALIAS_TO_CANONICAL: Dict[str, str] = {
    # 乌头类
    "乌头": "乌头", "川乌": "乌头", "制川乌": "乌头", "草乌": "乌头", "制草乌": "乌头",
    "附子": "乌头", "制附子": "乌头", "黑顺片": "乌头", "白附片": "乌头",
    # 半夏类
    "半夏": "半夏", "法半夏": "半夏", "姜半夏": "半夏", "清半夏": "半夏", "半夏曲": "半夏",
    # 瓜蒌类（含天花粉）
    "瓜蒌": "瓜蒌", "栝楼": "瓜蒌", "瓜蒌皮": "瓜蒌", "瓜蒌仁": "瓜蒌", "瓜蒌子": "瓜蒌", "天花粉": "瓜蒌",
    # 贝母类
    "贝母": "贝母", "川贝母": "贝母", "浙贝母": "贝母", "平贝母": "贝母", "伊贝母": "贝母",
    # 白蔹 / 白及
    "白蔹": "白蔹", "白及": "白及", "白芨": "白及",
    # 芍药类
    "芍药": "芍药", "白芍": "芍药", "赤芍": "芍药", "白芍药": "芍药", "赤芍药": "芍药",
    # 人参类
    "人参": "人参", "红参": "人参", "生晒参": "人参", "糖参": "人参", "白参": "人参",
    # 沙参类
    "沙参": "沙参", "南沙参": "沙参", "北沙参": "沙参",
    # 甘草类
    "甘草": "甘草", "生甘草": "甘草", "炙甘草": "甘草", "粉甘草": "甘草",
    # 大戟类
    "大戟": "大戟", "京大戟": "大戟", "红大戟": "大戟",
    # 芒硝/朴硝
    "朴硝": "朴硝", "芒硝": "朴硝", "玄明粉": "朴硝", "皮硝": "朴硝",
    # 牵牛类
    "牵牛": "牵牛", "牵牛子": "牵牛", "白牵牛": "牵牛", "黑牵牛": "牵牛",
    # 丁香类
    "丁香": "丁香", "公丁香": "丁香", "母丁香": "丁香",
    # 官桂类
    "官桂": "官桂", "肉桂": "官桂", "紫油桂": "官桂",
    # 石脂类
    "石脂": "石脂", "赤石脂": "石脂", "白石脂": "石脂",
    # 三棱类
    "三棱": "三棱", "荆三棱": "三棱", "黑三棱": "三棱",
    # 五灵脂
    "五灵脂": "五灵脂", "灵脂": "五灵脂", "糖灵脂": "五灵脂",
    # 郁金类
    "郁金": "郁金", "广郁金": "郁金", "川郁金": "郁金", "温郁金": "郁金",
    # 硫黄
    "硫黄": "硫黄", "硫磺": "硫黄",
    # 狼毒
    "狼毒": "狼毒", "月腺大戟": "狼毒", "瑞香狼毒": "狼毒",
    # 密陀僧
    "密陀僧": "密陀僧", "陀僧": "密陀僧",
    # 巴豆
    "巴豆": "巴豆", "巴豆霜": "巴豆",
    # 水银 / 砒霜
    "水银": "水银", "汞": "水银",
    "砒霜": "砒霜", "信石": "砒霜", "砒石": "砒霜",
    # 牙硝
    "牙硝": "牙硝", "马牙硝": "牙硝",
    # 犀角（现多以水牛角代用）
    "犀角": "犀角", "水牛角": "犀角",
    # 细辛类
    "细辛": "细辛", "北细辛": "细辛", "华细辛": "细辛",
    # 参类
    "丹参": "丹参", "紫丹参": "丹参",
    "玄参": "玄参", "元参": "玄参",
    "苦参": "苦参", "苦参片": "苦参",
    # 藜芦
    "藜芦": "藜芦", "黑藜芦": "藜芦",
    # 甘遂 / 芫花 / 海藻
    "甘遂": "甘遂", "甘遂末": "甘遂",
    "芫花": "芫花", "芫花条": "芫花",
    "海藻": "海藻", "羊栖菜": "海藻", "海蒿子": "海藻",
}


def _canonical_tcm_name(name: str) -> str:
    """将药材名（含炮制品/别名）规范化为十八反/十九畏表使用的规范名。"""
    if not name:
        return ""
    key = str(name).strip()
    return _TCM_ALIAS_TO_CANONICAL.get(key, key)


def _find_tcm_incompatibilities(names: List[str]) -> List[Dict[str, Any]]:
    """
    两两检查十八反/十九畏禁忌。

    Args:
        names: 成分名称列表（原始输入名或原料库匹配名均可）。

    Returns:
        兼容性问题列表，十八反为 error 级，十九畏为 warning 级。
    """
    issues: List[Dict[str, Any]] = []
    cleaned = [str(n or "").strip() for n in names]
    canonical = [_canonical_tcm_name(n) for n in cleaned]

    for i in range(len(canonical)):
        for j in range(i + 1, len(canonical)):
            a, b = canonical[i], canonical[j]
            if not a or not b or a == b:
                continue
            if (a, b) in _SHIBA_FAN or (b, a) in _SHIBA_FAN:
                issues.append({
                    "level": "error",
                    "category": "tcm_incompatibility",
                    "description": f"十八反禁忌：{cleaned[i]} 与 {cleaned[j]} 不宜同用",
                    "suggestion": "请移除其中一味，或咨询中医师调整配伍。",
                    "affected_ingredients": [cleaned[i], cleaned[j]],
                    "source": "十八反",
                })
            elif (a, b) in _SHIJIU_WEI or (b, a) in _SHIJIU_WEI:
                issues.append({
                    "level": "warning",
                    "category": "tcm_incompatibility",
                    "description": f"十九畏禁忌：{cleaned[i]} 与 {cleaned[j]} 不宜同用",
                    "suggestion": "请谨慎配伍，或咨询中医师调整。",
                    "affected_ingredients": [cleaned[i], cleaned[j]],
                    "source": "十九畏",
                })
    return issues


# ════════════════════════════════════════════════════════════════
# 剂量状态判定（纯逻辑）
# ════════════════════════════════════════════════════════════════

def _classify_dosage(
    dosage_g: Optional[float],
    safe_dose_min: Optional[float],
    safe_dose_max: Optional[float],
) -> str:
    """
    根据原料安全剂量范围（g/天）判定剂量状态。

    返回: "范围内" | "低于" | "超上限" | "未知"
    """
    if dosage_g is None or dosage_g < 0:
        return "未知"
    if safe_dose_max is not None and dosage_g > safe_dose_max:
        return "超上限"
    if safe_dose_min is not None and dosage_g < safe_dose_min:
        return "低于"
    if safe_dose_min is not None and safe_dose_max is not None:
        return "范围内"
    return "未知"


# ════════════════════════════════════════════════════════════════
# 过敏原匹配（纯文本 + 同义词/别名扩展）
# ════════════════════════════════════════════════════════════════

# 常见过敏原 → 同义词/别名表（含英文与加工形态）。
# 匹配时先判断成分是否属于某个过敏原组，再用整组同义词扩展匹配，
# 可显著降低漏报（如用户写「落花生」，原料名为「花生」）。
# 注意：具体坚果/海鲜组放在泛化组（坚果/贝类/甲壳类/软体动物）之前，
# 避免 _allergen_group_for 被泛化组先命中而丢失细分同义词。
ALLERGEN_SYNONYMS: Dict[str, List[str]] = {
    # ── 豆/油料籽实类 ──
    "花生": ["落花生", "peanut", "groundnut", "花生仁", "花生米", "花生酱", "花生油", "花生碎", "鱼皮花生"],
    # ── 坚果类（细分在前，泛化在后） ──
    "核桃": ["核桃仁", "胡桃", "walnut", "山核桃"],
    "腰果": ["腰果仁", "cashew"],
    "榛子": ["榛仁", "hazelnut", "filbert"],
    "开心果": ["阿月浑子", "pistachio"],
    "松子": ["松子仁", "松仁", "pine nut", "pignoli"],
    "扁桃仁": ["巴旦木", "美国大杏仁", "甜杏仁", "almond"],
    "夏威夷果": ["澳洲坚果", "macadamia"],
    "碧根果": ["美国山核桃", "pecan"],
    "巴西坚果": ["鲍鱼果", "brazil nut"],
    "坚果": ["tree nuts", "nut", "mixed nuts", "什锦坚果", "每日坚果"],
    "芝麻": ["白芝麻", "黑芝麻", "胡麻", "芝麻酱", "芝麻糊", "芝麻油", "sesame", "tahini"],
    "罂粟籽": ["poppy seed"],
    "亚麻籽": ["胡麻籽", "flaxseed", "linseed"],
    "葵花籽": ["瓜子", "sunflower seed"],
    "南瓜籽": ["白瓜子", "pumpkin seed"],
    # ── 海鲜/水产类（细分在前，泛化在后） ──
    "虾": ["虾仁", "对虾", "基围虾", "河虾", "海虾", "虾皮", "虾米", "虾酱", "shrimp", "prawn", "海鲜"],
    "蟹": ["螃蟹", "大闸蟹", "梭子蟹", "青蟹", "crab", "海鲜"],
    "龙虾": ["小龙虾", "螯虾", "皮皮虾", "濑尿虾", "lobster", "crayfish", "海鲜"],
    "扇贝": ["鲜贝", "带子", "scallop"],
    "蛤蜊": ["花甲", "文蛤", "蚬子", "clam"],
    "牡蛎": ["生蚝", "蚝", "海蛎子", "oyster"],
    "墨鱼": ["乌贼", "cuttlefish", "墨鱼干"],
    "章鱼": ["八爪鱼", "octopus"],
    "鱿鱼": ["枪乌贼", "squid", "鱿鱼丝"],
    "鲍鱼": ["abalone"],
    "海参": ["刺参", "sea cucumber"],
    "贝类": ["贻贝", "青口", "瑶柱", "干贝", "shellfish", "mussel", "海鲜"],
    "甲壳类": ["crustacean", "海鲜"],
    "软体动物": ["蜗牛", "螺蛳", "田螺", "mollusc", "mollusk", "海鲜"],
    "鱼类": ["鱼", "鱼肉", "鱼油", "鱼粉", "鱼骨", "鳕鱼", "三文鱼", "鲈鱼", "金枪鱼", "鲑鱼", "fish"],
    # ── 乳及蛋类 ──
    "牛奶": ["乳制品", "乳清蛋白", "酪蛋白", "牛乳", "奶粉", "奶酪", "芝士", "黄油", "奶油", "酸奶", "炼乳", "milk", "whey", "casein", "dairy"],
    "乳糖": ["lactose", "乳制品"],
    "酪蛋白": ["干酪素", "casein"],
    "乳清蛋白": ["乳清", "浓缩乳清蛋白", "whey", "WPC", "WPI"],
    "乳铁蛋白": ["lactoferrin"],
    "鸡蛋": ["蛋清", "蛋黄", "全蛋", "蛋制品", "卵清蛋白", "卵白蛋白", "egg", "albumin"],
    "蛋清": ["蛋白", "egg white", "卵清蛋白", "卵白蛋白"],
    "蛋黄": ["egg yolk", "卵黄"],
    # ── 谷物/麸质类 ──
    "麸质": ["小麦", "面筋", "麦麸", "全麦", "gluten", "wheat", "rye", "barley"],
    "小麦": ["面粉", "小麦粉", "全麦粉", "麦片", "面包", "馒头", "面条", "饺子皮", "wheat flour"],
    "小麦制品": ["面筋", "面粉", "面包", "馒头", "面条", "饼干", "蛋糕", "麦片", "油条", "饺子皮"],
    "荞麦": ["荞麦面", "苦荞", "buckwheat"],
    "燕麦": ["燕麦片", "燕麦奶", "oat"],
    "大麦": ["大麦茶", "麦芽", "barley"],
    "黑麦": ["黑麦面包", "rye"],
    "玉米": ["玉米淀粉", "玉米糖浆", "corn", "maize"],
    "大米": ["米粉", "米线", "米糕", "rice"],
    "小米": ["millet"],
    "酵母": ["发酵粉", "面包酵母", "yeast"],
    # ── 豆类 ──
    "大豆": ["黄豆", "毛豆", "豆腐", "豆浆", "豆奶", "豆制品", "酱油", "大豆蛋白", "豆粕", "腐竹", "豆干", "soy", "soybean", "edamame"],
    "豌豆": ["青豆", "荷兰豆", "雪豆", "pea"],
    "鹰嘴豆": ["鸡豆", "chickpea"],
    "扁豆": ["小扁豆", "lentil"],
    "绿豆": ["绿豆芽", "mung bean"],
    "红豆": ["赤小豆", "红小豆", "adzuki bean"],
    # ── 蔬果类 ──
    "芹菜": ["西芹", "旱芹", "celery"],
    "胡萝卜": ["carrot"],
    "番茄": ["西红柿", "圣女果", "tomato"],
    "土豆": ["马铃薯", "薯条", "薯片", "potato"],
    "辣椒": ["辣椒粉", "甜椒", "彩椒", "chilli", "chili"],
    "茄子": ["eggplant", "aubergine"],
    "黄瓜": ["cucumber"],
    "香菜": ["芫荽", "coriander", "cilantro"],
    "大葱": ["葱", "青葱", "scallion", "spring onion"],
    "芥菜": ["芥末", "山葵", "辣根", "mustard", "wasabi"],
    "芒果": ["mango", "杧果"],
    "菠萝": ["凤梨", "pineapple"],
    "猕猴桃": ["奇异果", "kiwi"],
    "桃": ["桃子", "油桃", "peach"],
    "苹果": ["apple", "沙果"],
    "香蕉": ["banana", "大蕉"],
    "草莓": ["strawberry"],
    "西瓜": ["watermelon"],
    "甜瓜": ["哈密瓜", "cantaloupe"],
    "柑橘": ["橙子", "橘子", "柚子", "柠檬", "柑", "citrus"],
    "柠檬": ["青柠", "lemon"],
    "樱桃": ["cherry"],
    "葡萄": ["提子", "grape"],
    "榴莲": ["durian"],
    "荔枝": ["lychee", "litchi"],
    "龙眼": ["桂圆", "longan"],
    "枸杞": ["枸杞子", "goji berry"],
    # ── 肉类 ──
    "牛肉": ["牛排", "牛", "牛肉干", "beef"],
    "羊肉": ["lamb", "mutton"],
    "猪肉": ["火腿", "培根", "香肠", "pork"],
    "鸡肉": ["鸡", "鸡胸肉", "鸡腿", "chicken"],
    "鸭肉": ["鸭", "duck"],
    "鹅肉": ["goose"],
    "明胶": ["吉利丁", "猪皮胶", "gelatin"],
    # ── 蜂产品 ──
    "蜂蜜": ["honey"],
    "蜂花粉": ["花粉", "bee pollen"],
    "蜂王浆": ["royal jelly"],
    "蜂胶": ["propolis"],
    # ── 饮品/调味/食品添加剂 ──
    "酒精": ["乙醇", "白酒", "黄酒", "alcohol"],
    "咖啡因": ["咖啡", "浓茶", "caffeine"],
    "可可": ["巧克力", "cocoa", "chocolate"],
    "茶": ["绿茶", "红茶", "乌龙茶", "tea"],
    "亚硫酸盐": ["二氧化硫", "亚硫酸钠", "焦亚硫酸钠", "sulfite"],
    "山梨醇": ["sorbitol"],
    "苯甲酸钠": ["苯甲酸", "sodium benzoate"],
    "柠檬酸": ["citric acid"],
    "阿斯巴甜": ["甜味素", "aspartame"],
    "味精": ["谷氨酸钠", "MSG"],
    "大蒜": ["蒜", "蒜粉", "蒜蓉", "garlic"],
    "洋葱": ["葱头", "洋葱粉", "onion"],
    "生姜": ["姜", "姜粉", "ginger"],
    "肉桂": ["桂皮", "cinnamon"],
    "胡椒": ["黑胡椒", "白胡椒", "pepper"],
    "花椒": ["麻椒", "sichuan pepper"],
    "八角": ["大料", "star anise"],
    "茴香": ["小茴香", "茴香籽", "fennel"],
    "薄荷": ["留兰香", "mint"],
}


def _allergen_group_for(term: str) -> Optional[str]:
    """
    判断某个成分名（输入名/匹配名/别名）属于哪个过敏原组。

    返回过敏原组规范名；不属于任何已知组时返回 None。
    """
    t = (term or "").strip().lower()
    if not t:
        return None
    for group, synonyms in ALLERGEN_SYNONYMS.items():
        all_terms = [group.lower()] + [s.lower() for s in synonyms]
        if t in all_terms:
            return group
    return None


def _find_allergen_hit(candidates: List[str], profile_lower: str) -> Optional[str]:
    """
    在用户画像中查找与成分候选名匹配的过敏原。

    策略：
    1. 候选名长度 >= 2 时直接子串匹配（避免「花」等单字误报）；
    2. 候选名属于已知过敏原组时，用该组全部同义词/别名扩展匹配，
       降低漏报（如「落花生」「对虾」「乳清蛋白」）。
    """
    for cand in candidates:
        c_lower = (cand or "").strip().lower()
        if not c_lower:
            continue
        # 直接匹配：长度 >= 2，避免单字误报
        if len(c_lower) >= 2 and c_lower in profile_lower:
            return cand

    # 同义词组扩展匹配
    for cand in candidates:
        group = _allergen_group_for(cand)
        if not group:
            continue
        all_terms = [group.lower()] + [s.lower() for s in ALLERGEN_SYNONYMS[group]]
        for term in all_terms:
            if len(term) >= 2 and term in profile_lower:
                return term
    return None


def _match_allergens(
    user_profile: Optional[str],
    parsed_ingredients: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    将用户画像文本中的过敏原与成分名（输入名/匹配名/别名）匹配。

    使用过敏原同义词/别名表扩展匹配，降低漏报；同时避免单字误报。
    命中即返回 error 级兼容性问题（过敏原属于硬约束）。
    """
    issues: List[Dict[str, Any]] = []
    profile_lower = (user_profile or "").lower()
    if not profile_lower:
        return issues

    for item in parsed_ingredients:
        candidates = [item.get("name"), item.get("matched_name")]
        candidates.extend(str(a) for a in (item.get("aliases") or []))
        candidates = [c for c in candidates if c]

        hit = _find_allergen_hit(candidates, profile_lower)
        if hit:
            issues.append({
                "level": "error",
                "category": "allergen",
                "description": f"用户画像声明过敏原「{hit}」与成分「{item.get('name')}」匹配",
                "suggestion": "请移除该成分，或与用户确认是否可安全食用。",
                "affected_ingredients": [item.get("name")],
                "source": "过敏原检查",
            })
    return issues


# ════════════════════════════════════════════════════════════════
# 通用工具
# ════════════════════════════════════════════════════════════════

def _truncate(text: Any, limit: int = 300) -> str:
    """截断文本到指定长度（用于 system prompt 注入）。"""
    s = str(text or "").strip()
    if len(s) <= limit:
        return s
    return s[:limit] + "…"


def _get_session_factory():
    """懒加载数据库会话工厂（避免模块导入期连接 DB）。"""
    from app.core.database.session import async_session_factory
    return async_session_factory


# ════════════════════════════════════════════════════════════════
# FoodMaterial 数据库检索
# ════════════════════════════════════════════════════════════════

def _score_material_match(name: str, material: Any) -> int:
    """对单个原料候选计算名称匹配得分（0-100）。"""
    name_lower = (name or "").strip().lower()
    if not name_lower:
        return 0
    name_cn = (material.name_cn or "").strip().lower()
    name_latin = (material.name_latin or "").strip().lower()
    name_en = (material.name_en or "").strip().lower()
    aliases = [str(a or "").strip().lower() for a in (material.aliases or [])]

    if name_cn == name_lower:
        return 100
    if name_lower in aliases:
        return 90
    if name_latin == name_lower or name_en == name_lower:
        return 85
    if name_cn.startswith(name_lower) or name_lower.startswith(name_cn):
        return 80
    if name_lower in name_cn or name_cn in name_lower:
        return 70
    if any(name_lower in a or a in name_lower for a in aliases):
        return 60
    if name_lower in name_latin or name_lower in name_en:
        return 55
    return 0


async def _match_food_material(db: Any, name: str) -> Optional[Any]:
    """
    在 FoodMaterial 表中按 name_cn / aliases / name_latin / name_en 模糊匹配单个成分。

    返回最佳匹配的 FoodMaterial 对象；无匹配或 DB 不可用时返回 None（降级不抛出）。
    """
    from sqlalchemy import func, or_, select

    from app.models.food_material import FoodMaterial

    keyword = (name or "").strip()
    if not keyword:
        return None
    pattern = f"%{keyword}%"

    try:
        # PostgreSQL 路径：aliases 为 ARRAY(Text)，用 array_to_string 做 ILIKE
        stmt = select(FoodMaterial).where(
            or_(
                FoodMaterial.name_cn.ilike(pattern),
                FoodMaterial.name_latin.ilike(pattern),
                FoodMaterial.name_en.ilike(pattern),
                func.array_to_string(FoodMaterial.aliases, ",").ilike(pattern),
            )
        ).order_by(
            FoodMaterial.food_homology.desc(),
            FoodMaterial.data_quality.desc(),
        ).limit(20)
        result = await db.execute(stmt)
        rows = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001 - 非 PG 环境或 DB 故障时降级
        logger.debug("array_to_string 检索不可用，回退到名称字段匹配: %s", exc)
        try:
            stmt = select(FoodMaterial).where(
                or_(
                    FoodMaterial.name_cn.ilike(pattern),
                    FoodMaterial.name_latin.ilike(pattern),
                    FoodMaterial.name_en.ilike(pattern),
                )
            ).order_by(
                FoodMaterial.food_homology.desc(),
                FoodMaterial.data_quality.desc(),
            ).limit(50)
            result = await db.execute(stmt)
            rows = list(result.scalars().all())
        except Exception as exc2:  # noqa: BLE001
            logger.warning("FoodMaterial 名称匹配查询失败，降级为未识别: %s", exc2)
            return None

        if rows:
            name_lower = keyword.lower()
            alias_rows = [
                r for r in rows
                if any(name_lower in (a or "").lower() for a in (r.aliases or []))
            ]
            if alias_rows:
                rows = alias_rows

    if not rows:
        return None

    best = None
    best_score = 0
    for row in rows:
        score = _score_material_match(keyword, row)
        if score > best_score:
            best_score = score
            best = row
    return best if best_score >= 50 else None


async def _search_materials(db: Any, pattern: str, limit: int) -> List[Any]:
    """
    按关键词在 FoodMaterial 的 name_cn/aliases/effects/active_ingredients 中检索，
    优先 food_homology=true 且 data_quality 高的原料。

    非 PG 环境自动回退到名称字段检索 + Python 侧数组过滤。
    """
    from sqlalchemy import func, or_, select

    from app.models.food_material import FoodMaterial

    try:
        stmt = select(FoodMaterial).where(
            or_(
                FoodMaterial.name_cn.ilike(pattern),
                FoodMaterial.name_latin.ilike(pattern),
                FoodMaterial.name_en.ilike(pattern),
                func.array_to_string(FoodMaterial.aliases, ",").ilike(pattern),
                func.array_to_string(FoodMaterial.effects, ",").ilike(pattern),
                func.array_to_string(FoodMaterial.active_ingredients, ",").ilike(pattern),
            )
        ).order_by(
            FoodMaterial.food_homology.desc(),
            FoodMaterial.data_quality.desc(),
        ).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001
        logger.debug("PG 数组检索不可用，回退到名称字段检索: %s", exc)
        try:
            stmt = select(FoodMaterial).where(
                or_(
                    FoodMaterial.name_cn.ilike(pattern),
                    FoodMaterial.name_latin.ilike(pattern),
                    FoodMaterial.name_en.ilike(pattern),
                )
            ).order_by(
                FoodMaterial.food_homology.desc(),
                FoodMaterial.data_quality.desc(),
            ).limit(limit * 5)
            result = await db.execute(stmt)
            rows = list(result.scalars().all())
        except Exception as exc2:  # noqa: BLE001
            logger.warning("FoodMaterial 知识检索查询失败，返回空列表: %s", exc2)
            return []

        keyword = pattern.strip("%").lower()
        filtered = []
        for m in rows:
            parts = [
                m.name_cn or "", m.name_latin or "", m.name_en or "",
                ",".join(m.aliases or []),
                ",".join(m.effects or []),
                ",".join(m.active_ingredients or []),
            ]
            if keyword in ",".join(parts).lower():
                filtered.append(m)
        return filtered[:limit]


# ════════════════════════════════════════════════════════════════
# 知识条目构建与格式化
# ════════════════════════════════════════════════════════════════

def _build_knowledge_entry(material: Any) -> Dict[str, Any]:
    """将 FoodMaterial 对象转换为平台知识库条目。"""
    min_g = getattr(material, "safe_dose_min", None)
    max_g = getattr(material, "safe_dose_max", None)
    return {
        "name_cn": material.name_cn,
        "name_latin": material.name_latin,
        "name_en": material.name_en,
        "aliases": list(material.aliases or []),
        "effects": list(material.effects or []),
        "active_ingredients": list(material.active_ingredients or []),
        "safe_dose_range": (
            {"min_g": min_g, "max_g": max_g}
            if (min_g is not None or max_g is not None)
            else None
        ),
        "contraindications": list(material.contraindications or []),
        "interactions": list(material.interactions or []),
        "food_homology": bool(material.food_homology),
        "data_quality": getattr(material, "data_quality", 1.0),
        "source": "平台原料库",
    }


def format_knowledge_entry(entry: Dict[str, Any]) -> str:
    """
    将知识条目格式化为可注入 system prompt 的短文本（单条截断约 300 字符）。
    """
    name = entry.get("name_cn") or ""
    effects = "、".join(entry.get("effects") or []) or "未收录"
    active = "、".join(entry.get("active_ingredients") or []) or "未收录"
    dose = entry.get("safe_dose_range") or {}
    if dose.get("min_g") is not None and dose.get("max_g") is not None:
        dose_text = f"{dose['min_g']}-{dose['max_g']}g/天"
    elif dose.get("max_g") is not None:
        dose_text = f"≤{dose['max_g']}g/天"
    elif dose.get("min_g") is not None:
        dose_text = f"≥{dose['min_g']}g/天"
    else:
        dose_text = "未收录"
    contraindications = "、".join(entry.get("contraindications") or []) or "未收录"
    line = (
        f"- 名称：{name}；功效：{effects}；活性成分：{active}；"
        f"安全剂量：{dose_text}；禁忌：{contraindications}"
    )
    return _truncate(line, 300)


# ════════════════════════════════════════════════════════════════
# 配方校验
# ════════════════════════════════════════════════════════════════

def _build_ingredient_info(
    name: str,
    dosage_g: float,
    amount_mg: float,
    role: Optional[str],
    material: Optional[Any],
    match_error: Optional[str] = None,
) -> Dict[str, Any]:
    """构建单个成分的校验结果。"""
    base = {
        "name": name,
        "role": role,
        "recognized": False,
        "matched_name": None,
        "aliases": [],
        "food_homology": False,
        "toxicity_class": None,
        "safe_dose_range": None,
        "dosage_status": "未知",
        "contraindications": [],
        "interactions": [],
        "regulatory_status": None,
        "amount_mg": round(amount_mg, 2),
        "match_error": match_error,
    }
    if material is None:
        return base

    min_g = getattr(material, "safe_dose_min", None)
    max_g = getattr(material, "safe_dose_max", None)
    base.update({
        "recognized": True,
        "matched_name": material.name_cn,
        "aliases": list(material.aliases or []),
        "food_homology": bool(getattr(material, "food_homology", False)),
        "toxicity_class": getattr(material, "toxicity_class", None),
        "safe_dose_range": (
            {"min_g": min_g, "max_g": max_g}
            if (min_g is not None or max_g is not None)
            else None
        ),
        "dosage_status": _classify_dosage(dosage_g, min_g, max_g),
        "contraindications": list(material.contraindications or []),
        "interactions": list(material.interactions or []),
        "regulatory_status": getattr(material, "regulatory_status", None),
    })
    return base


def _match_target_effects(
    parsed_ingredients: List[Dict[str, Any]],
    target_effects: Optional[List[str]],
) -> List[Dict[str, str]]:
    """将目标功效与已识别原料的功效标签做子串匹配（辅助信息）。"""
    matched: List[Dict[str, str]] = []
    for effect in (target_effects or []):
        effect = str(effect or "").strip()
        if not effect:
            continue
        hit_ingredient = None
        for item in parsed_ingredients:
            for tag in item.get("effects") or []:
                if effect.lower() in str(tag).lower() or str(tag).lower() in effect.lower():
                    hit_ingredient = item.get("name")
                    break
            if hit_ingredient:
                break
        if hit_ingredient:
            matched.append({"effect": effect, "matched_in": hit_ingredient})
    return matched


def _compat_issue_to_dict(issue: Any) -> Dict[str, Any]:
    """将 CompatibilityChecker 的 CompatibilityIssue 转为普通 dict。"""
    try:
        return {
            "level": issue.level.value,
            "category": issue.category.value,
            "description": issue.description,
            "suggestion": issue.suggestion,
            "affected_ingredients": list(issue.affected_ingredients or []),
            "source": "CompatibilityChecker",
        }
    except Exception:  # noqa: BLE001
        return {
            "level": "warning",
            "category": "unknown",
            "description": str(getattr(issue, "description", "")),
            "suggestion": str(getattr(issue, "suggestion", "")),
            "affected_ingredients": list(getattr(issue, "affected_ingredients", []) or []),
            "source": "CompatibilityChecker",
        }


async def _validate_formula_with_db(
    db: Any,
    ingredients: List[Dict[str, Any]],
    target_effects: Optional[List[str]],
    user_profile: Optional[str],
) -> Dict[str, Any]:
    """validate_formula 的 DB 会话内实现。"""
    parsed_ingredients: List[Dict[str, Any]] = []
    for ing in ingredients or []:
        name = (ing.get("name") or "").strip()
        if not name:
            continue
        try:
            dosage_g = float(ing.get("dosage_g") or 0)
        except (TypeError, ValueError):
            dosage_g = 0.0
        if dosage_g < 0:
            dosage_g = 0.0
        role = ing.get("role")
        amount_mg = dosage_g * 1000.0

        material = None
        match_error = None
        try:
            material = await _match_food_material(db, name)
        except Exception as exc:  # noqa: BLE001
            match_error = str(exc)
            logger.warning("成分 %s 匹配异常（降级为未识别）: %s", name, exc)

        parsed_ingredients.append(
            _build_ingredient_info(name, dosage_g, amount_mg, role, material, match_error)
        )

    # 成分名列表（优先原料库匹配名）
    ingredient_names = [
        item["matched_name"] or item["name"] for item in parsed_ingredients
    ]

    # ── SafetyAlertSystem 三级预警 ──
    safety_alerts: List[Dict[str, Any]] = []
    safety_recommendations: List[str] = []
    safety_risk = 0.0
    safety_blocked = False
    try:
        from ...services.formula.safety_alert_system import SafetyAlertSystem

        safety_system = SafetyAlertSystem()
        safety_result = safety_system.check_formula_safety([
            {"name": name, "amount_mg": item["amount_mg"]}
            for name, item in zip(ingredient_names, parsed_ingredients)
            if name
        ])
        safety_alerts = [a.to_dict() for a in safety_result.alerts]
        safety_recommendations = list(safety_result.recommendations)
        safety_risk = float(safety_result.overall_risk_score or 0)
        safety_blocked = bool(safety_result.blocked_by_critical)
    except Exception as exc:  # noqa: BLE001
        logger.warning("SafetyAlertSystem 检查失败（降级跳过）: %s", exc)

    # ── CompatibilityChecker 4 层兼容性检测 ──
    compatibility_issues: List[Dict[str, Any]] = []
    try:
        from ...services.formula.compatibility_checker import CompatibilityChecker

        checker = CompatibilityChecker()
        report = checker.check_compatibility([
            {"name": name, "amount_mg": item["amount_mg"]}
            for name, item in zip(ingredient_names, parsed_ingredients)
            if name
        ])
        for issue in report.issues:
            compatibility_issues.append(_compat_issue_to_dict(issue))
    except Exception as exc:  # noqa: BLE001
        logger.warning("CompatibilityChecker 检查失败（降级跳过）: %s", exc)

    # ── 十八反 / 十九畏 静态禁忌叠加 ──
    compatibility_issues.extend(_find_tcm_incompatibilities(ingredient_names))

    # ── 过敏原检查 ──
    allergen_issues = _match_allergens(user_profile, parsed_ingredients)
    compatibility_issues.extend(allergen_issues)

    # ── 汇总 ──
    error_issues = [i for i in compatibility_issues if i.get("level") == "error"]
    warning_issues = [i for i in compatibility_issues if i.get("level") == "warning"]

    blocked_by_critical = safety_blocked or bool(error_issues)
    risk_score = safety_risk
    if error_issues:
        risk_score = max(risk_score, 80.0)
    elif warning_issues:
        risk_score = max(risk_score, 50.0)
    risk_score = min(100.0, round(risk_score, 2))

    recommendations = list(safety_recommendations)
    for issue in error_issues[:3]:
        recommendations.append(f"🔴 {issue['description']}。建议：{issue['suggestion']}")
    for issue in warning_issues[:3]:
        recommendations.append(f"⚠️ {issue['description']}。建议：{issue['suggestion']}")
    if not recommendations:
        recommendations.append("整体安全性良好，可正常使用。")

    allergen_alerts = [
        {
            "level": "critical",
            "ingredient": issue["affected_ingredients"][0] if issue["affected_ingredients"] else "",
            "parameter": "allergen",
            "current_value": None,
            "threshold_value": None,
            "percentage": 100.0,
            "message": issue["description"],
            "recommendation": issue["suggestion"],
            "blocking": True,
        }
        for issue in allergen_issues
    ]
    alerts = safety_alerts + allergen_alerts

    return {
        "valid": not blocked_by_critical,
        "blocked_by_critical": blocked_by_critical,
        "risk_score": risk_score,
        "alerts": alerts,
        "ingredients": parsed_ingredients,
        "compatibility_issues": compatibility_issues,
        "recommendations": recommendations,
        "target_effects": list(target_effects or []),
        "matched_effects": _match_target_effects(parsed_ingredients, target_effects),
        "checked_ingredients_count": len(parsed_ingredients),
    }


async def validate_formula(
    ingredients: List[Dict[str, Any]],
    target_effects: Optional[List[str]] = None,
    user_profile: Optional[str] = None,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    校验配方安全性。

    Args:
        ingredients: 成分列表，每项 {"name": str, "dosage_g": float, "role"?: str}
        target_effects: 目标功效标签列表（可选）。
        user_profile: 用户画像文本（含过敏原/饮食禁忌），用于过敏原检查。
        db: 可选 AsyncSession；不传时自动创建独立会话。

    Returns:
        结构化校验结果 dict。
    """
    if db is None:
        factory = _get_session_factory()
        async with factory() as session:
            return await _validate_formula_with_db(session, ingredients, target_effects, user_profile)
    return await _validate_formula_with_db(db, ingredients, target_effects, user_profile)


# ════════════════════════════════════════════════════════════════
# 平台知识检索
# ════════════════════════════════════════════════════════════════

async def _retrieve_herb_knowledge_with_db(db: Any, query: str, top_k: int) -> List[Dict[str, Any]]:
    query = (query or "").strip()
    if not query:
        return []
    top_k = max(1, min(int(top_k or 5), 20))
    pattern = f"%{query}%"
    try:
        rows = await _search_materials(db, pattern, top_k)
    except Exception as exc:  # noqa: BLE001
        logger.warning("平台知识检索失败（返回空列表）: %s", exc)
        return []
    return [_build_knowledge_entry(m) for m in rows]


async def retrieve_herb_knowledge(
    query: str,
    top_k: int = 5,
    db: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    从 FoodMaterial 平台原料库按关键词检索药材/食材知识。

    Args:
        query: 检索关键词。
        top_k: 返回条目数上限（1-20）。
        db: 可选 AsyncSession；不传时自动创建独立会话。

    Returns:
        知识条目列表，每条含名称/功效/活性成分/安全剂量/禁忌，source="平台原料库"。
    """
    if db is None:
        factory = _get_session_factory()
        async with factory() as session:
            return await _retrieve_herb_knowledge_with_db(session, query, top_k)
    return await _retrieve_herb_knowledge_with_db(db, query, top_k)


# ════════════════════════════════════════════════════════════════
# 结构化修复（LLM 兜底）
# ════════════════════════════════════════════════════════════════

_REPAIR_SYSTEM_PROMPT = """你是 RMFOOD 配方设计平台的文本结构化引擎。你的任务是把用户提供的非结构化配方文本修复为规范的「专业配方设计卡」JSON blocks 结构，供前端专业组件渲染。

输出必须是严格的 JSON 对象，且 JSON 必须放在回复最开头。推荐结构（按需选用）：
```json
{
  "blocks": [
    {"type": "header", "data": {"title": "配方名称", "description": "一句话定位", "level": 1, "metadata": [{"label": "目标人群", "value": "…"}, {"label": "使用场景", "value": "…"}]}},
    {"type": "data-table", "data": {"title": "配方组成", "columns": [{"key": "role", "label": "角色"}, {"key": "name", "label": "成分"}, {"key": "dosage", "label": "用量(g)"}, {"key": "nature_flavor", "label": "性味归经"}, {"key": "active_compound", "label": "功效成分"}, {"key": "mechanism", "label": "作用机理"}], "rows": [{"role": "君", "name": "示例", "dosage": "10", "nature_flavor": "甘，微温；归脾、肺经", "active_compound": "示例多糖", "mechanism": "调节免疫通路"}]}},
    {"type": "metrics", "data": {"title": "多维评分", "items": [{"label": "功效", "value": 88, "unit": "分"}, {"label": "安全性", "value": 92, "unit": "分"}, {"label": "口感", "value": 80, "unit": "分"}, {"label": "稳定性", "value": 85, "unit": "分"}, {"label": "成本", "value": 75, "unit": "分"}]}},
    {"type": "ingredient-detail", "data": {"name": "核心成分", "latin": "拉丁名", "properties": "性味归经", "efficacy": "功效", "active_compounds": ["活性物质1"], "dosage_range": "6-12g", "safety_level": "药食同源/无毒", "notes": "配伍注意"}},
    {"type": "synergy-chart", "data": {"type": "network", "title": "君臣佐使配伍", "nodes": [{"id": "a", "label": "黄芪", "role": "君"}, {"id": "b", "label": "当归", "role": "臣"}], "edges": [{"from": "a", "to": "b", "type": "相须", "weight": 0.8}]}},
    {"type": "timeline", "data": {"title": "服用周期", "duration_days": 28, "phases": [{"key": "初期", "label": "初期", "days": [1, 7]}, {"key": "中期", "label": "中期", "days": [8, 21]}, {"key": "巩固", "label": "巩固", "days": [22, 28]}], "items": [{"day": 1, "phase": "初期", "title": "适应期", "description": "…", "dosage": "每日1次，每次10g"}]}},
    {"type": "list", "data": {"title": "制备工艺SOP", "variant": "number", "items": [{"label": "称量", "description": "按配方精确称量各成分"}, {"label": "提取", "description": "加10倍水，沸后文火煎煮30分钟"}]}},
    {"type": "callout", "data": {"variant": "warning", "title": "注意事项/禁忌人群", "content": "孕妇慎用；脾胃虚寒者减量"}},
    {"type": "callout", "data": {"variant": "info", "title": "监测与迭代建议", "content": "建议2周后复查血糖/睡眠等指标；如不适请停用并咨询医师"}},
    {"type": "list", "data": {"title": "参考文献", "variant": "analysis", "items": [{"label": "《中国药典》2025年版一部"}]}}
  ]
}
```

支持以下 block 类型（按需选用，不要编造原文没有的信息）：
- header: 配方标题与一句话定位，metadata 可含目标人群/使用场景
- data-table: 配方组成表，行优先补全 role/name/dosage；若原文含性味归经/功效成分/机理，填入 nature_flavor/active_compound/mechanism 列
- metrics: 多维评分（功效/安全性/口感/稳定性/成本），value 为 0-100 整数
- ingredient-detail: 核心成分详情（latin/properties/efficacy/active_compounds/dosage_range/safety_level/notes）
- synergy-chart: 君臣佐使配伍关系（nodes 角色 君/臣/佐/使，edges type 协同/相须/相使/相畏）
- timeline: 服用周期（phases 初期/中期/后期/巩固，items 含 day/phase/title/description/dosage）
- list: variant=number 用于制备工艺SOP（label=步骤名，description=参数/操作）；variant=analysis 用于参考文献
- callout: variant=warning 用于注意事项/禁忌人群；variant=info 用于监测与迭代建议

严格规则：
- JSON 必须放在回复最开头，包裹在 ```json 和 ``` 之间
- 仅根据原文内容修复结构，不得虚构原文未出现的成分、剂量或数据
- 若原文缺少某类信息，可省略对应 block 或字段
- 不要输出 JSON 以外的解释文字"""


def _extract_json(text: str) -> dict:
    """
    从 LLM 返回文本中提取 JSON 对象（兼容 markdown 代码块包裹与前后杂讯）。
    """
    import json
    import re

    raw = (text or "").strip()
    # 优先提取 ```json ... ``` 代码块
    m = re.search(r"```(?:json)?\s*(.*?)```", raw, re.DOTALL)
    if m:
        raw = m.group(1).strip()
    start = raw.find("{")
    if start == -1:
        raise ValueError("响应中未找到 JSON 对象")
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(raw[start:])
    if not isinstance(obj, dict):
        raise ValueError("JSON 顶层必须是对象")
    return obj


async def repair_formula_structure(
    content: str,
    formula_name: Optional[str] = None,
    db: Optional[Any] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    调用 LLM（低温度）将非结构化配方文本修复为 JSON blocks 结构。

    Args:
        content: 非结构化配方文本。
        formula_name: 可选配方名称。
        db: 可选 AsyncSession（本函数不使用 DB，仅为调用链一致性预留）。
        user_id: 可选用户 ID；提供时优先使用该用户配置的 LLM 密钥。

    Returns:
        - 成功: {"success": True, "structured": {"blocks": [...]}, "message": None}
        - 失败（LLM 不可用/解析失败/网络异常）:
          {"success": False, "structured": None, "message": "错误描述"}，绝不抛出。
    """
    content = (content or "").strip()
    if not content:
        return {
            "success": False,
            "structured": None,
            "message": "待修复的配方文本不能为空",
        }

    try:
        from ...services.llm_service import LLMMessage, LLMService, llm_service

        llm = llm_service
        if user_id is not None:
            try:
                user_llm = await LLMService.get_user_service(user_id)
                if user_llm is not None:
                    llm = user_llm
            except Exception as exc:  # noqa: BLE001
                logger.debug("用户级 LLM 服务解析失败，回退全局实例: %s", exc)

        if not llm.is_available:
            return {
                "success": False,
                "structured": None,
                "message": "LLM 服务未配置或不可用，无法执行结构化修复",
            }

        name_line = formula_name or "未命名配方"
        user_content = f"配方名称：{name_line}\n\n原始配方文本：\n{content}"
        messages = [
            LLMMessage(role="system", content=_REPAIR_SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_content),
        ]

        try:
            structured = await llm.chat_with_json(messages)
        except Exception as exc:  # noqa: BLE001 - chat_with_json 失败时走纯文本兜底
            logger.debug("chat_with_json 失败，尝试手动提取 JSON: %s", exc)
            result = await llm.chat(messages, temperature=0.2)
            structured = _extract_json(result.content)

        if not isinstance(structured, dict) or "blocks" not in structured:
            return {
                "success": False,
                "structured": None,
                "message": "LLM 返回内容缺少 blocks 结构",
            }

        return {
            "success": True,
            "structured": structured,
            "message": None,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("repair_formula_structure 执行失败（返回 success:false）: %s", exc)
        return {
            "success": False,
            "structured": None,
            "message": f"结构化修复失败：{exc}",
        }


__all__ = [
    "validate_formula",
    "retrieve_herb_knowledge",
    "repair_formula_structure",
    "format_knowledge_entry",
    "_canonical_tcm_name",
    "_find_tcm_incompatibilities",
    "_classify_dosage",
    "_match_allergens",
    "_truncate",
    "_SHIBA_FAN",
    "_SHIJIU_WEI",
]
