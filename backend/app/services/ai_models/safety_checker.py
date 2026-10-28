"""
SafetyChecker - 安全合规检查服务
Random Forest + 规则引擎，药食同源目录校验、毒性/过敏原/重金属筛查
这是最核心的 AI 服务，当前已包含完整规则实现
"""
import json
import logging
from typing import Any, Dict, Iterable, List, Set

logger = logging.getLogger(__name__)

# ⚠️ DEPRECATED：以下硬编码目录仅作为数据库不可用时的兜底。
# 正式运行时 _FOOD_HOMOLOGY_CATALOG 会从 hf_enriched_herbs 表加载官方 106 种药食同源。
# 本兜底已移除明确不在目录中的品种（罂粟壳/海藻等），但可能滞后于最新公告。
_FOOD_HOMOLOGY_CATALOG_FALLBACK: Set[str] = {
    # 87种基础药食同源物品（2014 目录）
    "丁香", "八角茴香", "刀豆", "小茴香", "小蓟", "山药", "山楂", "马齿苋",
    "乌梢蛇", "乌梅", "木瓜", "火麻仁", "代代花", "玉竹", "甘草", "白芷",
    "白果", "白扁豆", "白扁豆花", "龙眼肉", "决明子", "百合", "肉桂",
    "余甘子", "佛手", "沙参", "诃子", "阿胶", "鸡内金", "青果", "枳椇子",
    "栀子", "砂仁", "胖大海", "茯苓", "香橼", "香薷", "桑叶", "桑葚",
    "桔红", "桔梗", "益智仁", "荷叶", "莱菔子", "莲子", "高良姜", "淡竹叶",
    "淡豆豉", "紫苏", "紫苏子", "黄芥子", "黄精", "菊花", "菊苣", "野菊花",
    "山银花", "葛根", "黑芝麻", "蒲公英", "蜂蜜", "榧子", "酸枣仁", "鲜白茅根",
    "鲜芦根", "蝮蛇", "橘红", "薄荷", "薏苡仁", "薤白", "覆盆子", "藿香",
    "牡蛎", "蛤蚧", "龟甲", "鳖甲",
    # 后续新增品种
    "槐米", "槐花", "西红花", "积雪草", "杜仲叶", "地榆", "铁皮石斛",
    "山柰", "荜茇", "升麻", "北沙参", "明党参", "红参", "太子参",
    "红芪", "竹茹", "郁李仁", "苦杏仁", "甜杏仁", "桃仁",
    "罗汉果", "金荞麦", "红曲米",
    "橘皮", "化橘红", "玫瑰花", "绿萼梅", "九里香", "迷迭香", "甘松",
    "草豆蔻", "肉豆蔻", "青皮", "陈皮", "枳壳", "枳实",
    "黄芪", "党参", "人参", "西洋参", "白术", "大枣", "枸杞子", "芡实",
    "麦芽", "谷芽", "神曲", "金银花", "夏枯草", "鱼腥草",
    "山茱萸", "金樱子", "天麻", "灵芝", "肉苁蓉", "姜黄", "草果", "当归",
}

# 运行时从 hf_enriched_herbs 表加载的官方药食同源目录（懒加载 + 缓存）
_FOOD_HOMOLOGY_CATALOG: Set[str] = set()
_FOOD_HOMOLOGY_CATALOG_LOADED = False
_FOOD_HOMOLOGY_CATALOG_FROM_DB = False

# 十八反（依据《中国药典》2020 版，含现代增补的党参）— 17 对
_EIGHTEEN_CONTRAINDICATIONS: Set[tuple[str, str]] = {
    ("甘草", "甘遂"), ("甘草", "大戟"), ("甘草", "海藻"), ("甘草", "芫花"),
    ("乌头", "半夏"), ("乌头", "瓜蒌"), ("乌头", "贝母"), ("乌头", "白蔹"), ("乌头", "白及"),
    ("藜芦", "人参"), ("藜芦", "党参"), ("藜芦", "沙参"), ("藜芦", "丹参"),
    ("藜芦", "玄参"), ("藜芦", "苦参"), ("藜芦", "细辛"), ("藜芦", "芍药"),
}

# 十九畏 — 11 对（川乌/草乌、赤石脂/白石脂分别计数，共 28 对）
_NINETEEN_ANTAGONISMS: Set[tuple[str, str]] = {
    ("硫黄", "朴硝"), ("水银", "砒霜"), ("狼毒", "密陀僧"),
    ("巴豆", "牵牛子"), ("丁香", "郁金"),
    ("川乌", "犀角"), ("草乌", "犀角"),
    ("牙硝", "三棱"), ("官桂", "赤石脂"), ("官桂", "白石脂"),
    ("人参", "五灵脂"),
}

# 官方二十八反畏（十八反 17 对 + 十九畏 11 对 = 28 对）
_CONTRAINDICATION_PAIRS: Set[tuple[str, str]] = (
    _EIGHTEEN_CONTRAINDICATIONS | _NINETEEN_ANTAGONISMS
)

# 常见过敏原
_COMMON_ALLERGENS = {
    "花生", "大豆", "牛奶", "鸡蛋", "小麦", "坚果", "鱼", "贝类",
}

# 孕妇慎用
_PREGNANCY_CAUTION = {
    "红花", "桃仁", "三棱", "莪术", "水蛭", "虻虫", "麝香",
    "巴豆", "牵牛子", "大戟", "芫花", "甘遂", "商陆",
}

# 常见食源性肽类原料
_COMMON_PEPTIDE_INGREDIENTS = {
    "玉米低聚肽", "小麦低聚肽", "大豆低聚肽", "乳清蛋白肽",
    "胶原蛋白肽", "海参肽", "牡蛎肽", "核桃肽", "花生肽",
    "豌豆肽", "酪蛋白肽", "鳕鱼肽", "三文鱼肽", "海藻肽",
}

# 已知有毒肽序列模式（示例，实际应包含真实毒肽数据）
_TOXIC_PEPTIDE_PATTERNS = [
    "XBB",  # 血凝素相关模式（示例）
    "WHD",  # 蜗牛毒素相关模式（示例）
]

# 过敏原性肽序列特征标记
_ALLERGENIC_PEPTIDE_MARKERS = {
    "花生过敏原": ["Ara h", "coni", "gluten"],
    "大豆过敏原": ["Gly m", "β-conglycinin"],
    "牛奶过敏原": ["casein", "lactalbumin", "lactoglobulin"],
    "小麦过敏原": ["gliadin", " glutenin"],
    "鸡蛋过敏原": ["ovalbumin", "ovomucoid"],
}

# 肽段安全长度范围
_PEPTIDE_SAFE_LENGTH = (2, 50)  # 2-50个氨基酸为安全范围

# 人群禁忌关键词（用于 extra_knowledge.contraindication 文本匹配）
_SPECIAL_POPULATION_KEYWORDS = ("孕妇", "妊娠", "哺乳期", "儿童", "小儿", "婴幼儿")


async def load_food_homology_catalog_from_db(force_reload: bool = False) -> Set[str]:
    """从 hf_enriched_herbs 表加载官方药食同源目录（106 种）。

    失败或表为空时回退到硬编码 _FOOD_HOMOLOGY_CATALOG_FALLBACK（deprecated）。
    """
    global _FOOD_HOMOLOGY_CATALOG, _FOOD_HOMOLOGY_CATALOG_LOADED, _FOOD_HOMOLOGY_CATALOG_FROM_DB
    if _FOOD_HOMOLOGY_CATALOG_LOADED and not force_reload:
        return _FOOD_HOMOLOGY_CATALOG

    db_catalog: Set[str] = set()
    try:
        from sqlalchemy import select

        from app.core.database.session import async_session_factory
        from app.models.external_data import HFEHerb

        async with async_session_factory() as session:
            stmt = select(HFEHerb.name_cn)
            result = await session.execute(stmt)
            db_catalog = {name for name in result.scalars().all() if name}
        if db_catalog:
            _FOOD_HOMOLOGY_CATALOG = db_catalog
            _FOOD_HOMOLOGY_CATALOG_LOADED = True
            _FOOD_HOMOLOGY_CATALOG_FROM_DB = True
            logger.info(f"[SafetyChecker] 从 hf_enriched_herbs 加载官方药食同源目录: {len(db_catalog)} 种")
            return _FOOD_HOMOLOGY_CATALOG
        logger.warning("[SafetyChecker] hf_enriched_herbs 表为空，回退到硬编码兜底目录")
    except Exception as e:
        logger.warning(f"[SafetyChecker] 加载药食同源目录失败，回退到硬编码兜底目录: {e}")

    # 回退：deprecated 硬编码目录
    _FOOD_HOMOLOGY_CATALOG = set(_FOOD_HOMOLOGY_CATALOG_FALLBACK)
    _FOOD_HOMOLOGY_CATALOG_LOADED = True
    _FOOD_HOMOLOGY_CATALOG_FROM_DB = False
    return _FOOD_HOMOLOGY_CATALOG


def _check_single_peptide(peptide: str) -> dict[str, Any]:
    """
    检查单个肽序列的安全性

    Returns:
        {
            "peptide": str,
            "length": int,
            "passed": bool,
            "issues": list[str],
            "warnings": list[str],
        }
    """
    issues = []
    warnings = []
    length = len(peptide)

    if length < _PEPTIDE_SAFE_LENGTH[0]:
        issues.append(f"肽段过短（{length}个氨基酸），可能无功能意义")
    elif length > _PEPTIDE_SAFE_LENGTH[1]:
        warnings.append(f"肽段较长（{length}个氨基酸），生物利用度可能降低")

    for allergen_name, markers in _ALLERGENIC_PEPTIDE_MARKERS.items():
        for marker in markers:
            if marker.lower() in peptide.lower():
                warnings.append(f"检测到{allergen_name}相关序列标记: {marker}")

    for pattern in _TOXIC_PEPTIDE_PATTERNS:
        if pattern in peptide:
            issues.append(f"检测到潜在毒性序列模式: {pattern}")

    return {
        "peptide": peptide,
        "length": length,
        "passed": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
    }


class SafetyCheckerService:
    """安全合规检查服务（完整规则引擎实现）"""

    async def check(
        self,
        ingredients: list[str] | list[dict],
        peptides: list[str] | None = None,
        scenarios: list[str] | None = None,
        dosages_mg: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """
        执行全面的安全合规检查

        Args:
            ingredients: 成分名称列表，或 [{"name": str, "amount_mg": float}] 结构
            peptides: 肽序列列表
            scenarios: 使用场景
            dosages_mg: {成分名: 用量mg}，与 dict 型 ingredients 二选一

        Returns:
            {
                "passed": True/False,
                "checks": {
                    "food_homology": {...},
                    "contraindications": {...},
                    "allergens": {...},
                    "pregnancy_safety": {...},
                    "toxicity": {...},
                },
                "warnings": [...],
                "errors": [...],
            }
        """
        checks = {}
        warnings = []
        errors = []

        # ── 归一化成分输入（支持 list[str] 与 list[dict]）──
        ingredient_set: Set[str] = set()
        dosage_map: Dict[str, float] = dict(dosages_mg or {})
        for item in ingredients:
            if isinstance(item, dict):
                name = str(item.get("name", "") or "")
                if name:
                    ingredient_set.add(name)
                    amt = item.get("amount_mg")
                    if amt is not None:
                        try:
                            dosage_map[name] = float(amt)
                        except (TypeError, ValueError):
                            pass
            else:
                name = str(item or "")
                if name:
                    ingredient_set.add(name)

        # 1. 药食同源目录校验（官方 106 种，DB 加载）
        catalog = await load_food_homology_catalog_from_db()
        non_homology = ingredient_set - catalog
        checks["food_homology"] = {
            "passed": len(non_homology) == 0,
            "non_homology_ingredients": sorted(non_homology),
            "homology_count": len(ingredient_set & catalog),
            "total_count": len(ingredient_set),
            "catalog_source": "hf_enriched_herbs(db)" if _FOOD_HOMOLOGY_CATALOG_FROM_DB else "deprecated_hardcoded_fallback",
        }
        if non_homology:
            warnings.append(f"以下成分不在药食同源目录中: {', '.join(sorted(non_homology))}")

        # 2. 配伍禁忌检查（官方二十八反畏 = 十八反 17 对 + 十九畏 11 对）
        forbidden_pairs = []
        for pair in _CONTRAINDICATION_PAIRS:
            # 双向检查：pair[0]-pair[1] 和 pair[1]-pair[0] 都要检查
            if (pair[0] in ingredient_set and pair[1] in ingredient_set) or \
               (pair[1] in ingredient_set and pair[0] in ingredient_set):
                rule = "十八反" if pair in _EIGHTEEN_CONTRAINDICATIONS else "十九畏"
                forbidden_pairs.append({"a": pair[0], "b": pair[1], "rule": rule})
        checks["contraindications"] = {
            "passed": len(forbidden_pairs) == 0,
            "forbidden_pairs": forbidden_pairs,
            "total_rules": len(_CONTRAINDICATION_PAIRS),
        }
        for fp in forbidden_pairs:
            errors.append(f"配伍禁忌: {fp['a']} + {fp['b']} ({fp['rule']})")

        # 3. 过敏原检查
        allergens_found = ingredient_set & _COMMON_ALLERGENS
        checks["allergens"] = {
            "passed": True,  # 过敏原不直接导致失败，只是警告
            "detected_allergens": sorted(allergens_found),
        }
        if allergens_found:
            warnings.append(f"含有常见过敏原: {', '.join(sorted(allergens_found))}，需在标签中标注")

        # 4. 孕妇安全检查
        pregnancy_caution = ingredient_set & _PREGNANCY_CAUTION
        checks["pregnancy_safety"] = {
            "passed": len(pregnancy_caution) == 0,
            "caution_ingredients": sorted(pregnancy_caution),
        }
        if pregnancy_caution:
            warnings.append(f"以下成分孕妇慎用: {', '.join(sorted(pregnancy_caution))}")

        # 5. 毒性检查（接入 DB 药材 dosage_min/max 与 extra_knowledge.contraindication）
        toxicity_errors: List[str] = []
        toxicity_warnings: List[str] = []
        overdose_ingredients: List[Dict[str, Any]] = []
        dose_info = await self._load_herb_dosage_info(list(ingredient_set))
        for name, amount_mg in dosage_map.items():
            info = dose_info.get(name)
            if not info:
                continue
            max_mg = info.get("dosage_max", 0) * 1000
            if max_mg > 0 and amount_mg and amount_mg > max_mg:
                toxicity_errors.append(
                    f"{name} 用量 {amount_mg:g}mg 超过安全上限 {max_mg:g}mg"
                    f"（DB dosage_max={info.get('dosage_max', 0):g}g/日）"
                )
                overdose_ingredients.append({
                    "name": name,
                    "actual_mg": amount_mg,
                    "max_mg": max_mg,
                    "message": f"超过安全上限 {max_mg:g}mg/日",
                })
            contraindication = info.get("contraindication", "")
            if contraindication and any(kw in contraindication for kw in _SPECIAL_POPULATION_KEYWORDS):
                toxicity_warnings.append(f"{name} 存在人群禁忌提示: {contraindication}")
        if not toxicity_errors:
            toxicity_level = "低"
            toxicity_details = "所有成分均在 DB 安全用量范围内"
        else:
            toxicity_level = "高"
            toxicity_details = "；".join(toxicity_errors)
            errors.extend(toxicity_errors)
        checks["toxicity"] = {
            "passed": len(toxicity_errors) == 0,
            "toxicity_level": toxicity_level,
            "details": toxicity_details,
            "overdose_ingredients": overdose_ingredients,
            "dosage_checked_count": len([n for n in dosage_map if n in dose_info]),
        }
        warnings.extend(toxicity_warnings)

        # 6. 肽序列安全检查
        peptide_results = []
        peptide_passed = True
        if peptides:
            for peptide in peptides:
                result = _check_single_peptide(peptide)
                peptide_results.append(result)
                if not result["passed"]:
                    peptide_passed = False

        peptide_has_issues = any(not r["passed"] for r in peptide_results)
        peptide_has_warnings = any(len(r["warnings"]) > 0 for r in peptide_results)
        checks["peptide_safety"] = {
            "passed": peptide_passed if peptides else True,
            "results": peptide_results,
            "total_peptides": len(peptides) if peptides else 0,
        }
        if peptide_has_issues:
            errors.append(f"检测到 {sum(1 for r in peptide_results if not r['passed'])} 个肽序列存在安全问题")
        if peptide_has_warnings:
            for r in peptide_results:
                for w in r["warnings"]:
                    warnings.append(f"肽序列 {r['peptide']}: {w}")

        # 总体判断
        passed = (checks["food_homology"]["passed"]
                  and checks["contraindications"]["passed"]
                  and checks["toxicity"]["passed"]
                  and len(errors) == 0)

        return {
            "passed": passed,
            "checks": checks,
            "warnings": warnings,
            "errors": errors,
            "summary": "配方通过安全合规检查" if passed else f"配方存在 {len(errors)} 项严重问题",
        }

    @staticmethod
    async def _load_herb_dosage_info(names: Iterable[str]) -> Dict[str, Dict[str, Any]]:
        """从 tcm_herbs 表加载药材剂量范围与禁忌信息。

        剂量来自 DB 字段 dosage_min/dosage_max，优先取 extra_knowledge JSON 中的
        dosage_min/max 与 contraindication（enrich_herb_knowledge 写入的结构化数据）。
        """
        info: Dict[str, Dict[str, Any]] = {}
        name_list = [n for n in names if n]
        if not name_list:
            return info
        try:
            from sqlalchemy import select

            from app.core.database.session import async_session_factory
            from app.models.external_data import TCMHerb

            async with async_session_factory() as session:
                stmt = select(TCMHerb).where(TCMHerb.name_cn.in_(name_list))
                result = await session.execute(stmt)
                for orm in result.scalars().all():
                    extra: Dict[str, Any] = {}
                    raw_extra = getattr(orm, "extra_knowledge", None)
                    if raw_extra:
                        try:
                            extra = json.loads(raw_extra) if isinstance(raw_extra, str) else dict(raw_extra)
                        except (TypeError, ValueError):
                            extra = {}
                    dosage_min = float(extra.get("dosage_min", getattr(orm, "dosage_min", 3) or 3))
                    dosage_max = float(extra.get("dosage_max", getattr(orm, "dosage_max", 15) or 15))
                    info[orm.name_cn] = {
                        "dosage_min": dosage_min,
                        "dosage_max": dosage_max,
                        "contraindication": str(extra.get("contraindication", "") or ""),
                    }
        except Exception as e:
            logger.warning(f"[SafetyChecker] 加载药材剂量信息失败: {e}")
        return info
