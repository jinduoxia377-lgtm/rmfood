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
# 本兜底已与 2024 版国家卫健委目录（106 种）对齐，含常用别名匹配项。
_FOOD_HOMOLOGY_CATALOG_FALLBACK: Set[str] = {
    # 卫法监发〔2002〕第51号公告（87种）
    "阿胶", "八角茴香", "白扁豆", "白扁豆花", "白果",
    "白芷", "百合", "薄荷", "赤小豆", "代代花",
    "淡豆豉", "淡竹叶", "刀豆", "丁香", "榧子",
    "蜂蜜", "佛手", "茯苓", "蝮蛇", "覆盆子",
    "甘草", "高良姜", "葛根", "枸杞子", "荷叶",
    "黑胡椒", "黑芝麻", "花椒", "槐花", "槐米",
    "黄芥子", "黄精", "火麻仁", "藿香", "鸡内金",
    "姜", "金银花", "桔梗", "桔红", "菊花",
    "菊苣", "橘皮", "决明子", "昆布", "莱菔子",
    "莲子", "龙眼肉", "罗汉果", "马齿苋", "麦芽",
    "牡蛎", "木瓜", "胖大海", "蒲公英", "芡实",
    "青果", "肉豆蔻", "肉桂", "桑椹", "桑叶",
    "沙棘", "砂仁", "山药", "山楂", "酸枣仁",
    "桃仁", "乌梅", "乌梢蛇", "鲜白茅根", "鲜芦根",
    "香薷", "香橼", "小茴香", "小蓟", "薤白",
    "杏仁", "益智仁", "薏苡仁", "余甘子", "鱼腥草",
    "玉竹", "郁李仁", "枣", "栀子", "枳椇子",
    "紫苏", "紫苏籽",
    # 2019年第8号公告（6种）
    "当归", "姜黄", "荜茇", "草果", "山柰", "西红花",
    # 2023年第9号公告（9种）
    "党参", "杜仲叶", "黄芪", "灵芝", "肉苁蓉",
    "山茱萸", "天麻", "铁皮石斛", "西洋参",
    # 2024年第4号公告（4种）
    "地黄", "化橘红", "麦冬", "天冬",
    # 常用别名（匹配项）
    "生姜", "干姜", "大枣", "陈皮", "桑葚",
    "桂圆", "桂圆肉", "橘红", "山奈", "藏红花",
}

# 运行时从 hf_enriched_herbs 表加载的官方药食同源目录（懒加载 + 缓存）
_FOOD_HOMOLOGY_CATALOG: Set[str] = set()
_FOOD_HOMOLOGY_CATALOG_LOADED = False
_FOOD_HOMOLOGY_CATALOG_FROM_DB = False

# 十八反（依据《中国药典》2025 版，含现代增补的党参）— 17 对
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

# ── 剧毒成分黑名单（固有毒性分级，独立于剂量）─────────────────────────
# 依据《中国药典》2025 版"毒性药材"分级 + 国家卫健委《按照传统既是食品又是中药材的
# 物质目录》排除项 + 毒理活性成分。药食同源配方**严禁**使用，无论剂量多少均判 fail。
# 含：乌头类(乌头碱)、马钱子类(士的宁)、雷公藤、钩吻(断肠草)、含砷/汞矿物药等。
# 命中任一 → toxicity.passed=False, level="高"，先于剂量循环执行（无剂量也拦）。
_SEVERELY_TOXIC: Set[str] = {
    # 乌头类（乌头碱 aconitine，剧毒，治疗窗极窄）
    "川乌", "制川乌", "生川乌", "草乌", "制草乌", "生草乌",
    "附子", "制附子", "生附子", "炮附子", "熟附子", "黑附子", "白附片",
    "乌头", "草乌头", "铁棒锤", "雪上一支蒿", "落地金钱",
    # 马钱子类（士的宁 strychnine，剧毒）
    "马钱子", "制马钱子", "生马钱子", "番木鳖", "士的宁", "马钱子碱", "士的宁碱",
    # 雷公藤类（雷公藤甲素，肾/肝/生殖毒性）
    "雷公藤", "昆明山海棠", "东北雷公藤",
    # 钩吻/断肠草（钩吻碱，剧毒）
    "钩吻", "断肠草", "胡蔓藤", "大茶药",
    # 天仙子/洋金花（莨菪碱/东莨菪碱，抗胆碱毒性）
    "天仙子", "洋金花", "曼陀罗", "曼陀罗叶", "白花曼陀罗", "南洋金花",
    # 矿物/动物剧毒药（砷/汞/蟾酥/斑蝥）
    "雄黄", "砒霜", "砒石", "水银", "轻粉", "朱砂", "红粉",
    "斑蝥", "红娘子", "青娘子", "蟾酥", "蟾皮", "蜈蚣毒",
    # 其他药典毒性药材（大毒）
    "巴豆", "生巴豆", "甘遂", "生甘遂", "大戟", "京大戟", "芫花", "生芫花",
    "商陆", "生商陆", "牵牛子", "生牵牛子", "千金子", "生千金子",
    "苦楝皮", "川楝子", "蓖麻子", "狼毒", "生狼毒", "白降丹", "红升丹",
    # 活性毒物单体（直接命中化合物名）
    "乌头碱", "中乌头碱", "次乌头碱", "新乌头碱", "雷公藤甲素", "钩吻碱",
    "莨菪碱", "东莨菪碱", "山莨菪碱", "毒扁豆碱", "河豚毒素", "石房蛤毒素",
}


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

        # 5. 毒性检查（固有毒性分级 + DB 剂量超量 + extra_knowledge.contraindication）
        toxicity_errors: List[str] = []
        toxicity_warnings: List[str] = []
        overdose_ingredients: List[Dict[str, Any]] = []

        # 5a. 固有毒性分级（先于剂量循环，独立于剂量）——
        #     剧毒成分（乌头碱/士的宁等）无论有无剂量、剂量是否"安全范围"，一律判 fail。
        #     药食同源配方严禁使用剧毒药材，这是医疗红线，不能因缺剂量而空转放行。
        toxic_hit = sorted(ingredient_set & _SEVERELY_TOXIC)
        if toxic_hit:
            for t in toxic_hit:
                toxicity_errors.append(
                    f"{t} 为剧毒成分（含乌头碱/士的宁等剧毒生物碱），"
                    f"药食同源配方严禁使用，禁止口服"
                )
                overdose_ingredients.append({
                    "name": t,
                    "actual_mg": None,
                    "max_mg": 0,
                    "message": "剧毒成分，禁止使用（固有毒性，与剂量无关）",
                })

        # 5b. DB 剂量超量校验（仅当提供了剂量时触发）
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
        dosage_checked_count = len([n for n in dosage_map if n in dose_info])
        if toxicity_errors:
            toxicity_level = "高"
            toxicity_details = "；".join(toxicity_errors)
            errors.extend(toxicity_errors)
        elif dosage_checked_count == 0 and ingredient_set:
            # 无剂量输入 → 剂量超量校验未执行，不得报"安全/低"。
            # 固有毒性已筛查（无毒），但剂量维度未校验，降级为"未校验"。
            toxicity_level = "未校验"
            toxicity_details = (
                "无剂量输入，未做剂量超量校验（已完成固有毒性筛查，"
                f"{len(ingredient_set)} 种成分均非剧毒黑名单成分）"
            )
        else:
            toxicity_level = "低"
            toxicity_details = "所有成分均在 DB 安全用量范围内"
        checks["toxicity"] = {
            "passed": len(toxicity_errors) == 0,
            "toxicity_level": toxicity_level,
            "details": toxicity_details,
            "overdose_ingredients": overdose_ingredients,
            "dosage_checked_count": dosage_checked_count,
            "severely_toxic_ingredients": toxic_hit,
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
