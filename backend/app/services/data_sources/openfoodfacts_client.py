"""
OpenFoodFacts 实时数据服务

对标 TCMSP/DFBP 的三级数据源架构：
  1. PostgreSQL retail_products 缓存（最快）
  2. OFF REST API 实时查询（数据最新）
  3. 内置分类词表兜底（离线可用）

复用已有的 openfoodfacts/ 服务层（client, mapper, loader）。
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .off_api import OFFClient
from .openfoodfacts.config import OFFConfig
from .openfoodfacts.mapper import OFFMapper

# 延迟导入，避免循环依赖
_RetailProduct = None

logger = logging.getLogger(__name__)


# ── 内置常用食品分类词表（离线兜底，约 80 个高频分类） ──

POPULAR_CATEGORIES: list[dict[str, str]] = [
    # 饮料类
    {"tag": "beverages", "name_en": "Beverages", "name_cn": "饮料"},
    {"tag": "soft-drinks", "name_en": "Soft drinks", "name_cn": "软饮料"},
    {"tag": "juices", "name_en": "Juices", "name_cn": "果汁"},
    {"tag": "fruit-juices", "name_en": "Fruit juices", "name_cn": "果汁"},
    {"tag": "vegetable-juices", "name_en": "Vegetable juices", "name_cn": "蔬菜汁"},
    {"tag": "carbonated-drinks", "name_en": "Carbonated drinks", "name_cn": "碳酸饮料"},
    {"tag": "tea", "name_en": "Tea", "name_cn": "茶饮料"},
    {"tag": "coffee", "name_en": "Coffee", "name_cn": "咖啡饮料"},
    {"tag": "energy-drinks", "name_en": "Energy drinks", "name_cn": "能量饮料"},
    {"tag": "sport-drinks", "name_en": "Sport drinks", "name_cn": "运动饮料"},
    {"tag": "water", "name_en": "Water", "name_cn": "饮用水"},
    {"tag": "mineral-water", "name_en": "Mineral water", "name_cn": "矿泉水"},
    {"tag": "sparkling-water", "name_en": "Sparkling water", "name_cn": "气泡水"},
    # 乳制品
    {"tag": "milk", "name_en": "Milk", "name_cn": "乳制品"},
    {"tag": "dairy-products", "name_en": "Dairy products", "name_cn": "乳制品"},
    {"tag": "yogurt", "name_en": "Yogurt", "name_cn": "酸奶"},
    {"tag": "plant-based-milk", "name_en": "Plant-based milk", "name_cn": "植物奶"},
    {"tag": "almond-milk", "name_en": "Almond milk", "name_cn": "杏仁奶"},
    {"tag": "soy-milk", "name_en": "Soy milk", "name_cn": "豆奶"},
    {"tag": "oat-milk", "name_en": "Oat milk", "name_cn": "燕麦奶"},
    # 谷物类
    {"tag": "breakfast-cereals", "name_en": "Breakfast cereals", "name_cn": "早餐谷物"},
    {"tag": "cereal-grains", "name_en": "Cereal grains", "name_cn": "谷物"},
    {"tag": "bread", "name_en": "Bread", "name_cn": "面包"},
    {"tag": "pastries", "name_en": "Pastries", "name_cn": "糕点"},
    {"tag": "cakes", "name_en": "Cakes", "name_cn": "蛋糕"},
    {"tag": "cookies", "name_en": "Cookies", "name_cn": "饼干"},
    {"tag": "crackers", "name_en": "Crackers", "name_cn": "薄脆饼干"},
    {"tag": "pasta", "name_en": "Pasta", "name_cn": "意面"},
    {"tag": "rice", "name_en": "Rice", "name_cn": "米饭"},
    # 零食类
    {"tag": "snacks", "name_en": "Snacks", "name_cn": "零食"},
    {"tag": "chips", "name_en": "Chips", "name_cn": "薯片"},
    {"tag": "nuts", "name_en": "Nuts", "name_cn": "坚果"},
    {"tag": "seeds", "name_en": "Seeds", "name_cn": "种子"},
    {"tag": "popcorn", "name_en": "Popcorn", "name_cn": "爆米花"},
    {"tag": "chocolate", "name_en": "Chocolate", "name_cn": "巧克力"},
    {"tag": "candy", "name_en": "Candy", "name_cn": "糖果"},
    {"tag": "gum", "name_en": "Gum", "name_cn": "口香糖"},
    {"tag": "ice-cream", "name_en": "Ice cream", "name_cn": "冰淇淋"},
    # 蔬果类
    {"tag": "fruits", "name_en": "Fruits", "name_cn": "水果"},
    {"tag": "vegetables", "name_en": "Vegetables", "name_cn": "蔬菜"},
    {"tag": "dried-fruits", "name_en": "Dried fruits", "name_cn": "果干"},
    {"tag": "dried-vegetables", "name_en": "Dried vegetables", "name_cn": "蔬干"},
    {"tag": "canned-fruits", "name_en": "Canned fruits", "name_cn": "罐头水果"},
    {"tag": "canned-vegetables", "name_en": "Canned vegetables", "name_cn": "罐头蔬菜"},
    {"tag": "salads", "name_en": "Salads", "name_cn": "沙拉"},
    # 肉类
    {"tag": "meat", "name_en": "Meat", "name_cn": "肉类"},
    {"tag": "poultry", "name_en": "Poultry", "name_cn": "禽类"},
    {"tag": "beef", "name_en": "Beef", "name_cn": "牛肉"},
    {"tag": "pork", "name_en": "Pork", "name_cn": "猪肉"},
    {"tag": "sausages", "name_en": "Sausages", "name_cn": "香肠"},
    # 水产
    {"tag": "fish", "name_en": "Fish", "name_cn": "鱼类"},
    {"tag": "seafood", "name_en": "Seafood", "name_cn": "海鲜"},
    {"tag": "shrimp", "name_en": "Shrimp", "name_cn": "虾"},
    # 调味
    {"tag": "condiments", "name_en": "Condiments", "name_cn": "调味品"},
    {"tag": "sauces", "name_en": "Sauces", "name_cn": "酱料"},
    {"tag": "dressings", "name_en": "Dressings", "name_cn": "沙拉酱"},
    {"tag": "mustard", "name_en": "Mustard", "name_cn": "芥末"},
    {"tag": "ketchup", "name_en": "Ketchup", "name_cn": "番茄酱"},
    {"tag": "soy-sauce", "name_en": "Soy sauce", "name_cn": "酱油"},
    {"tag": "vinegar", "name_en": "Vinegar", "name_cn": "醋"},
    {"tag": "honey", "name_en": "Honey", "name_cn": "蜂蜜"},
    {"tag": "jam", "name_en": "Jam", "name_cn": "果酱"},
    # 保健食品
    {"tag": "dietetic-foods", "name_en": "Dietetic foods", "name_cn": "保健食品"},
    {"tag": "supplements", "name_en": "Supplements", "name_cn": "营养补充剂"},
    {"tag": "protein-supplements", "name_en": "Protein supplements", "name_cn": "蛋白补充剂"},
    {"tag": "vitamins", "name_en": "Vitamins", "name_cn": "维生素"},
    {"tag": "minerals", "name_en": "Minerals", "name_cn": "矿物质"},
    {"tag": "probiotics", "name_en": "Probiotics", "name_cn": "益生菌"},
    # 其他
    {"tag": "baby-food", "name_en": "Baby food", "name_cn": "婴幼儿食品"},
    {"tag": "soups", "name_en": "Soups", "name_cn": "汤类"},
    {"tag": "ready-meals", "name_en": "Ready meals", "name_cn": "即食餐"},
    {"tag": "frozen-meals", "name_en": "Frozen meals", "name_cn": "冷冻餐"},
    {"tag": "pizza", "name_en": "Pizza", "name_cn": "披萨"},
    {"tag": "tofu", "name_en": "Tofu", "name_cn": "豆腐"},
    {"tag": "vegan", "name_en": "Vegan", "name_cn": "纯素食品"},
    {"tag": "organic", "name_en": "Organic", "name_cn": "有机食品"},
]


# ── 分类标签 → 中文映射（从 POPULAR_CATEGORIES 构建） ──
CATEGORY_MAP: dict[str, str] = {
    cat["tag"]: cat["name_cn"] for cat in POPULAR_CATEGORIES
}


# ── 轻量中英同义词表（用于 OFF 实时结果相关性过滤与英文搜索词选取） ──
# 中文关键词可同时匹配英文同义词（如"胶原蛋白肽" → collagen / peptide），
# 不要求完整翻译，覆盖常见保健食品/功能性食品查询词。
QUERY_SYNONYMS: dict[str, list[str]] = {
    "胶原蛋白肽": ["collagen", "collagen peptide", "peptide", "胶原蛋白", "胶原蛋白肽"],
    "胶原蛋白": ["collagen", "collagen peptide", "胶原蛋白", "胶原"],
    "胶原": ["collagen", "胶原"],
    "肽": ["peptide", "peptides", "肽"],
    "蛋白粉": ["protein powder", "whey protein", "protein", "蛋白质", "蛋白粉", "蛋白"],
    "蛋白": ["protein", "proteins", "protein powder", "whey", "蛋白质", "蛋白"],
    "蛋白质": ["protein", "proteins", "protein powder", "whey", "蛋白质", "蛋白"],
    "维生素c": ["vitamin c", "ascorbic acid", "vitamin", "维生素c", "维生素"],
    "维生素d": ["vitamin d", "vitamin", "维生素d", "维生素"],
    "维生素": ["vitamin", "vitamins", "multivitamin", "维生素"],
    "复合维生素": ["multivitamin", "vitamin", "复合维生素"],
    "矿物质": ["mineral", "minerals", "矿物质"],
    "益生菌": ["probiotic", "probiotics", "益生菌"],
    "钙片": ["calcium", "calcium tablet", "钙片", "钙"],
    "钙": ["calcium", "钙"],
    "铁": ["iron", "铁"],
    "锌": ["zinc", "锌"],
    "镁": ["magnesium", "镁"],
    "鱼油": ["fish oil", "omega-3", "omega 3", "鱼油"],
    "卵磷脂": ["lecithin", "卵磷脂"],
    "辅酶": ["coenzyme", "coq10", "coenzyme q10", "辅酶"],
    "辅酶q10": ["coenzyme q10", "coq10", "ubiquinone", "辅酶q10"],
    "葡萄籽": ["grape seed", "grape seed extract", "葡萄籽"],
    "氨糖": ["glucosamine", "氨糖"],
    "软骨素": ["chondroitin", "软骨素"],
    "褪黑素": ["melatonin", "褪黑素"],
    "叶酸": ["folic acid", "folate", "叶酸"],
    "膳食纤维": ["fiber", "fibre", "dietary fiber", "膳食纤维"],
    "大豆异黄酮": ["soy isoflavone", "isoflavone", "大豆异黄酮"],
    "护肝": ["milk thistle", "silymarin", "liver", "护肝"],
    "护眼": ["lutein", "zeaxanthin", "bilberry", "护眼"],
    "叶黄素": ["lutein", "叶黄素"],
    "花青素": ["anthocyanin", "anthocyanins", "花青素"],
    "胶原蛋白肽口服液": ["collagen", "collagen drink", "胶原蛋白", "胶原蛋白肽"],
    # ── 英文键（供英文用户输入，同时用于 OFF 结果相关性过滤） ──
    "protein powder": ["protein powder", "whey protein", "protein"],
    "collagen": ["collagen", "collagen peptide", "kollagen"],
    "collagen peptide": ["collagen peptide", "collagen"],
    "vitamin c": ["vitamin c", "ascorbic acid", "vitamin"],
    "vitamin d": ["vitamin d", "vitamin"],
    "vitamin": ["vitamin", "vitamins", "multivitamin"],
    "multivitamin": ["multivitamin", "vitamin", "vitamins"],
    "calcium": ["calcium", "calcium tablet"],
    "probiotic": ["probiotic", "probiotics"],
    "fish oil": ["fish oil", "omega-3", "omega 3"],
    "melatonin": ["melatonin"],
    "glucosamine": ["glucosamine"],
    "chondroitin": ["chondroitin"],
    "coenzyme q10": ["coenzyme q10", "coq10", "ubiquinone"],
    "lutein": ["lutein"],
    "milk thistle": ["milk thistle", "silymarin"],
    "iron": ["iron"],
    "zinc": ["zinc"],
    "magnesium": ["magnesium"],
    "folic acid": ["folic acid", "folate"],
    "dietary fiber": ["fiber", "fibre", "dietary fiber"],
    "lecithin": ["lecithin"],
    "grape seed": ["grape seed", "grape seed extract"],
    # ── 德文键（供德文用户输入；保留变音并附无变音变体） ──
    "eiweißpulver": ["eiweißpulver", "eiweisspulver", "proteinpulver", "protein powder", "protein"],
    "eiweisspulver": ["eiweisspulver", "eiweißpulver", "proteinpulver", "protein powder", "protein"],
    "proteinpulver": ["proteinpulver", "eiweißpulver", "eiweisspulver", "protein powder", "protein"],
    "kollagen": ["kollagen", "collagen"],
    "kollagenpeptid": ["kollagenpeptid", "collagen peptide", "collagen"],
    "vitamin c": ["vitamin c", "ascorbic acid"],
    "kalzium": ["kalzium", "calcium"],
    "probiotika": ["probiotika", "probiotic", "probiotics"],
    "fischöl": ["fischöl", "fischol", "fischoele", "fish oil", "omega-3"],
    "fischol": ["fischol", "fischöl", "fischoele", "fish oil"],
    "fischoele": ["fischoele", "fischöl", "fischol", "fish oil"],
    "glucosamin": ["glucosamin", "glucosamine"],
    "coenzym q10": ["coenzym q10", "coenzyme q10", "coq10"],
    "mariendistel": ["mariendistel", "milk thistle", "silymarin"],
    "eisen": ["eisen", "iron"],
    "zink": ["zink", "zinc"],
    "folsäure": ["folsäure", "folsaure", "folic acid", "folate"],
    "folsaure": ["folsaure", "folsäure", "folic acid", "folate"],
    "ballaststoffe": ["ballaststoffe", "fiber", "dietary fiber"],
}


# ── 中文查询词 → 英文主搜索词（供 OFF API 搜索） ──
# OFF 全文搜索对中文匹配极差，优先用英文词搜索（如 蛋白粉→protein powder）。
QUERY_ENGLISH_PRIMARY: dict[str, str] = {
    "胶原蛋白肽": "collagen peptide",
    "胶原蛋白": "collagen",
    "胶原": "collagen",
    "肽": "peptide",
    "蛋白粉": "protein powder",
    "蛋白质": "protein",
    "蛋白": "protein",
    "维生素c": "vitamin c",
    "维生素d": "vitamin d",
    "维生素": "vitamin",
    "复合维生素": "multivitamin",
    "益生菌": "probiotic",
    "钙片": "calcium",
    "钙": "calcium",
    "铁": "iron",
    "锌": "zinc",
    "镁": "magnesium",
    "鱼油": "fish oil",
    "卵磷脂": "lecithin",
    "辅酶q10": "coenzyme q10",
    "辅酶": "coenzyme q10",
    "葡萄籽": "grape seed",
    "氨糖": "glucosamine",
    "软骨素": "chondroitin",
    "褪黑素": "melatonin",
    "叶酸": "folic acid",
    "膳食纤维": "dietary fiber",
    "大豆异黄酮": "soy isoflavone",
    "护肝": "milk thistle",
    "护眼": "lutein",
    "叶黄素": "lutein",
    "花青素": "anthocyanin",
    "矿物质": "mineral",
    # ── 英文键 ──
    "protein powder": "protein powder",
    "whey protein": "protein powder",
    "collagen": "collagen",
    "collagen peptide": "collagen peptide",
    "vitamin c": "vitamin c",
    "vitamin d": "vitamin d",
    "vitamin": "vitamin",
    "multivitamin": "multivitamin",
    "calcium": "calcium",
    "probiotic": "probiotic",
    "probiotics": "probiotic",
    "fish oil": "fish oil",
    "omega-3": "fish oil",
    "melatonin": "melatonin",
    "glucosamine": "glucosamine",
    "chondroitin": "chondroitin",
    "coenzyme q10": "coenzyme q10",
    "lutein": "lutein",
    "milk thistle": "milk thistle",
    "iron": "iron",
    "zinc": "zinc",
    "magnesium": "magnesium",
    "folic acid": "folic acid",
    "dietary fiber": "dietary fiber",
    "lecithin": "lecithin",
    "grape seed": "grape seed",
    # ── 德文键（变音原形 + 无变音变体） ──
    "eiweißpulver": "protein powder",
    "eiweisspulver": "protein powder",
    "proteinpulver": "protein powder",
    "kollagen": "collagen",
    "kollagenpeptid": "collagen peptide",
    "kalzium": "calcium",
    "probiotika": "probiotic",
    "fischöl": "fish oil",
    "fischol": "fish oil",
    "fischoele": "fish oil",
    "glucosamin": "glucosamine",
    "coenzym q10": "coenzyme q10",
    "mariendistel": "milk thistle",
    "eisen": "iron",
    "zink": "zinc",
    "folsäure": "folic acid",
    "folsaure": "folic acid",
    "ballaststoffe": "dietary fiber",
}


def _expand_query_terms(keyword: str) -> list[str]:
    """将查询关键词扩展为大小写不敏感的匹配词列表（含中英同义词）。

    例如 "胶原蛋白肽" → ["胶原蛋白肽", "collagen", "collagen peptide",
    "peptide", "胶原蛋白", "胶原"]。

    中文同义词按"最长匹配"过滤：当短词是更长命中词的一部分时（如
    "胶原蛋白肽" 包含 "胶原蛋白"/"胶原"/"肽"/"蛋白"），只保留最长词
    及其同义词，避免"蛋白"→protein 等过度扩展导致含 milk protein 的
    奶酪等无关产品被误判为相关。
    """
    kw = (keyword or "").strip().lower()
    if not kw:
        return []
    terms: list[str] = [kw]

    # 命中 QUERY_SYNONYMS 的中文基础词（按是否出现在查询词中）
    matched_bases = [base for base in QUERY_SYNONYMS if base in kw]
    # 只保留不被其他命中词包含的"最长"基础词
    for base in matched_bases:
        if any(base != other and base in other for other in matched_bases):
            continue
        terms.extend(QUERY_SYNONYMS[base])

    # 去重，保持顺序
    seen: set[str] = set()
    result: list[str] = []
    for t in terms:
        t = t.strip().lower()
        if t and t not in seen:
            seen.add(t)
            result.append(t)
    return result


def _product_relevance_score(item: dict[str, Any], terms: list[str]) -> int:
    """计算产品与查询词的相关性得分（0=不相关，得分越高越相关）。

    检查字段：product_name / brand / category / full_ingredients /
    key_ingredients 序列化文本 / 成分标签（allergens/additives/traces）。
    """
    if not terms:
        return 0
    name = str(item.get("product_name") or "").lower()
    brand = str(item.get("brand") or "").lower()
    category = str(item.get("category") or "").lower()
    ingredients = str(item.get("full_ingredients") or "").lower()
    key_ing = item.get("key_ingredients") or {}
    key_text = " ".join(str(v) for v in key_ing.values()).lower()
    tags_text = " ".join(
        str(v) for v in (item.get("allergens_tags") or [])
    ).lower()
    tags_text += " " + " ".join(
        str(v) for v in (item.get("additives_tags") or [])
    ).lower()
    tags_text += " " + " ".join(
        str(v) for v in (item.get("traces_tags") or [])
    ).lower()

    haystack = [name, brand, category, ingredients, key_text, tags_text]
    score = 0
    for term in terms:
        if any(term in part for part in haystack):
            score += 1
    return score


class OFFDataService:
    """OpenFoodFacts 实时数据服务 — 三级数据源架构"""

    def __init__(self) -> None:
        self.client = OFFClient()
        self.mapper = OFFMapper()
        self._regconfig = OFFConfig.FTS_REGCONFIG
        # retail_products.search_vector 列是否存在（运行时探测并缓存，避免每次搜索报错）
        self._has_search_vector: Optional[bool] = None
        # 可观测性：进程内请求指标（内存计数器，失败不影响主流程）
        self._metrics: dict[str, Any] = {
            "started_at": time.time(),
            "total_requests": 0,
            "realtime_requests": 0,
            "fallbacks": 0,
            "mirror_failures": 0,
            "cache_hits": 0,
            "errors": 0,
            "total_duration_ms": 0.0,
        }
        if self._regconfig != "simple":
            logger.info("[OFFDataService] 使用 FTS 分词配置: %s", self._regconfig)
        else:
            logger.warning(
                "[OFFDataService] FTS 分词器为 'simple'，中文搜索质量差。"
                "建议安装 pg_jieba 并将 OFF_FTS_REGCONFIG 设为 'jieba'"
            )

    # ── 属性 ──

    @property
    def category_count(self) -> int:
        """内置分类词表数量"""
        return len(POPULAR_CATEGORIES)

    # ── 可观测性 ──

    def get_diagnostics(self) -> dict[str, Any]:
        """返回 OFF 数据源进程内诊断指标（只读、轻量，不依赖数据库）。

        供 GET /api/v1/databases/openfoodfacts/diagnostics 使用。
        """
        m = self._metrics
        total = m["total_requests"]
        avg_duration = (
            round(m["total_duration_ms"] / total, 2) if total else 0.0
        )
        return {
            "service": "openfoodfacts",
            "counts": {
                "total_requests": m["total_requests"],
                "realtime_requests": m["realtime_requests"],
                "fallbacks": m["fallbacks"],
                "mirror_failures": m["mirror_failures"],
                "cache_hits": m["cache_hits"],
                "errors": m["errors"],
            },
            "avg_duration_ms": avg_duration,
            "uptime_seconds": round(time.time() - m["started_at"], 2),
            "fts_available": self._has_search_vector,
        }

    def _record_duration(self, start: float) -> None:
        """累加一次顶层请求的耗时（毫秒）。"""
        self._metrics["total_duration_ms"] += (time.perf_counter() - start) * 1000

    # ── 实时搜索 ──

    async def search_products(
        self,
        keyword: str,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        realtime: bool = False,
        origin: str = "all",
        category: Optional[str] = None,
        brand: Optional[str] = None,
        formulation_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        effects: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        """
        混合搜索零售产品。

        - DB 优先：在 retail_products 表中搜索，支持多种过滤条件
        - realtime=True：直接调 OFF REST API，不走本地缓存
        - realtime=False 且 DB 命中少于 3 条时：自动回退 OFF 实时搜索，
          从互联网 OpenFoodFacts 获取真实产品；OFF 网络异常时优雅降级，
          仍返回 DB 结果（HTTP 200）。
        """
        self._metrics["total_requests"] += 1
        start = time.perf_counter()

        if realtime:
            result = await self._realtime_search(
                keyword,
                page=page,
                page_size=page_size,
                brand=brand,
                category_tag=category,
            )
            rt_items = result.get("items") or []
            if rt_items:
                # 实时搜索成功 → 幂等写入本地缓存（best-effort，失败不影响主流程）
                try:
                    await self._cache_off_products(db, rt_items)
                except Exception as cache_err:
                    logger.warning(
                        "[OFFDataService] OFF 实时结果缓存失败 keyword=%s "
                        "error_type=%s error=%s",
                        keyword, type(cache_err).__name__, cache_err,
                    )
            else:
                # 所有镜像失败/无结果 → 尝试本地 OFF 缓存兜底
                cached = await self._search_off_cache(keyword, db, page, page_size)
                if cached.get("items"):
                    self._metrics["cache_hits"] += 1
                    self._record_duration(start)
                    logger.info(
                        "[OFFDataService] search keyword=%s status=off_cache_hit "
                        "duration_ms=%.1f items=%s",
                        keyword, (time.perf_counter() - start) * 1000,
                        len(cached["items"]),
                    )
                    return cached
            self._record_duration(start)
            return result

        # DB 优先（本地缓存，支持全量过滤条件）
        db_result = await self._db_search(
            keyword, db, page, page_size,
            origin=origin,
            category=category, brand=brand,
            formulation_type=formulation_type,
            min_price=min_price, max_price=max_price,
            min_rating=min_rating, effects=effects,
        )
        db_items = db_result.get("items") or []

        # 本地命中足够多（≥3）时直接返回缓存结果，避免无谓的 OFF 请求
        if len(db_items) >= 3:
            self._metrics["cache_hits"] += 1
            self._record_duration(start)
            logger.info(
                "[OFFDataService] search keyword=%s status=cache_hit "
                "duration_ms=%.1f db_items=%s",
                keyword, (time.perf_counter() - start) * 1000, len(db_items),
            )
            return db_result

        # 本地无命中或命中不足 → 自动回退 OFF 实时搜索（互联网真实产品）
        self._metrics["fallbacks"] += 1
        try:
            fallback = await self._realtime_search(
                keyword,
                page,
                page_size,
                brand=brand,
                category_tag=category,
            )
            off_items = fallback.get("items") or []
            if off_items:
                # 保留本地 DB 命中（仅首页合并，避免分页时重复）
                merged_items = (
                    self._merge_items(db_items, off_items)
                    if page == 1
                    else off_items
                )

                try:
                    off_total = int(fallback.get("off_total") or len(off_items))
                except (TypeError, ValueError):
                    off_total = len(off_items)
                # total 沿用 _realtime_search 已截断的合理值（min(count,10000)）
                fallback_total = fallback.get("total")
                try:
                    fallback_total = int(fallback_total)
                except (TypeError, ValueError):
                    fallback_total = min(off_total, 10000) if off_total else len(merged_items)

                # 实时回退成功 → 幂等写入本地缓存（best-effort，失败不影响主流程）
                try:
                    await self._cache_off_products(db, off_items)
                except Exception as cache_err:
                    logger.warning(
                        "[OFFDataService] OFF 回退结果缓存失败 keyword=%s "
                        "error_type=%s error=%s",
                        keyword, type(cache_err).__name__, cache_err,
                    )

                self._record_duration(start)
                logger.info(
                    "[OFFDataService] search keyword=%s status=fallback_success "
                    "duration_ms=%.1f db_items=%s off_items=%s",
                    keyword, (time.perf_counter() - start) * 1000,
                    len(db_items), len(off_items),
                )
                return {
                    "items": merged_items,
                    "total": fallback_total,
                    "off_total": off_total,
                    "page": page,
                    "page_size": page_size,
                    "data_source": "openfoodfacts_api_fallback",
                    "db_total": len(db_items),
                }

            # OFF 无结果（网络异常/超时/无匹配）→ 先尝试本地 OFF 缓存兜底
            cached = await self._search_off_cache(keyword, db, page, page_size)
            if cached.get("items"):
                self._metrics["cache_hits"] += 1
                self._record_duration(start)
                logger.info(
                    "[OFFDataService] search keyword=%s status=off_cache_fallback "
                    "duration_ms=%.1f items=%s",
                    keyword, (time.perf_counter() - start) * 1000,
                    len(cached["items"]),
                )
                return cached

            # 无缓存 → 优雅降级，保留 DB 结果
            logger.warning(
                "[OFFDataService] OFF 实时回退无结果，保留 DB 结果: "
                "keyword=%s fallback_data_source=%s error=%s",
                keyword,
                fallback.get("data_source"),
                fallback.get("error"),
            )
            db_result = dict(db_result)
            db_result["off_error"] = (
                fallback.get("error") or "OFF 实时回退无结果"
            )
            self._record_duration(start)
            return db_result
        except Exception as err:
            self._metrics["errors"] += 1
            logger.warning(
                "[OFFDataService] OFF 实时回退异常，保留 DB 结果: "
                "keyword=%s error_type=%s error=%s",
                keyword, type(err).__name__, err,
            )
            self._record_duration(start)
            return db_result

    async def _db_search(
        self,
        keyword: str,
        db: AsyncSession,
        page: int,
        page_size: int,
        *,
        origin: str = "all",
        category: Optional[str] = None,
        brand: Optional[str] = None,
        formulation_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        effects: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        """数据库搜索（BM25 FTS + ILIKE 回退），支持多种过滤条件。

        注意：该端点实际承担「市售产品」通用搜索（前端 searchOpenFoodFacts 直接使用），
        默认不限制 source（all）。origin 过滤：
        - all：manual + openfoodfacts 全部来源
        - internet：仅 source='openfoodfacts'（OFF 缓存）
        - local：仅 source='manual'（平台参考数据）
        """
        try:

            # ── 构建附加过滤条件（支持 origin 来源过滤） ──
            where_clauses: list[str] = []
            params: dict[str, Any] = {"rc": self._regconfig, "kw": keyword}

            if origin == "internet":
                where_clauses.append("source = 'openfoodfacts'")
            elif origin == "local":
                where_clauses.append("source = 'manual'")

            if category:
                where_clauses.append("category ILIKE :cat")
                params["cat"] = f"%{category}%"
            if brand:
                where_clauses.append("brand ILIKE :brd")
                params["brd"] = f"%{brand}%"
            if formulation_type:
                where_clauses.append("formulation_type ILIKE :fmt")
                params["fmt"] = f"%{formulation_type}%"
            if min_price is not None:
                where_clauses.append("price >= :min_p")
                params["min_p"] = min_price
            if max_price is not None:
                where_clauses.append("price <= :max_p")
                params["max_p"] = max_price
            if min_rating is not None:
                where_clauses.append("avg_rating >= :min_r")
                params["min_r"] = min_rating
            if effects and len(effects) > 0:
                # Build array literal safely: '{effect1,effect2}'
                arr_literal = "{" + ",".join(e.replace('"', '""') for e in effects) + "}"
                where_clauses.append(f"effects && {arr_literal}")

            # FTS 查询中的附加条件片段（避免空 WHERE）
            where_extra = (" AND " + " AND ".join(where_clauses)) if where_clauses else ""

            # ── FTS 搜索（仅当 search_vector 列存在；列缺失时跳过避免 aborted 事务） ──
            if await self._fts_available(db):
                try:
                    count_sql = text(f"""
                        SELECT COUNT(*) FROM retail_products
                        WHERE search_vector @@ plainto_tsquery(:rc, :kw){where_extra}
                    """)
                    total = (await db.execute(count_sql, params)).scalar() or 0

                    if total > 0:
                        sql = text(f"""
                            SELECT id, brand, product_name, product_line,
                                   category, sub_category, formulation_type,
                                   effects, target_population,
                                   full_ingredients, key_ingredients,
                                   price, currency, package_size,
                                   volume_ml, weight_g,
                                   sales_channels, avg_rating, review_count,
                                   monthly_sales, image_urls,
                                   reg_number, reg_type, approved_region,
                                   source, crawl_timestamp, data_quality,
                                   allergens_tags, additives_tags, ecoscore_grade,
                                   traces_tags, contaminants,
                                   ts_rank(search_vector,
                                            plainto_tsquery(:rc, :kw)) AS rank
                            FROM retail_products
                            WHERE search_vector @@ plainto_tsquery(:rc, :kw){where_extra}
                            ORDER BY rank DESC
                            LIMIT :limit OFFSET :offset
                        """)
                        result = await db.execute(sql, {**params, "limit": page_size, "offset": (page - 1) * page_size})
                        rows = result.fetchall()
                        if rows:
                            items = [self._row_to_product_dict(row) for row in rows]
                            return {
                                "items": items,
                                "total": total,
                                "page": page,
                                "page_size": page_size,
                                "data_source": "postgresql_fts",
                            }
                except Exception as e:
                    # 任何 FTS 失败（列缺失/分词器错误等）都必须回滚事务，
                    # 否则后续 ILIKE 回退会在 aborted 事务中全部失败。
                    await self._rollback_safely(db)
                    logger.warning("[OFFDataService] FTS 搜索失败，回退 ILIKE: %s", e)

            # ILIKE 回退（关键词匹配，所有来源）
            # 三语增强：用 _expand_query_terms 生成中/英/德扩展词，
            # 并匹配 full_ingredients（manual 产品成分含英文关键词，如 protein/collagen）。
            expanded_terms = _expand_query_terms(keyword)
            # 取前 6 个扩展词（含中文原词与中/英/德同义词），保证 "Eiweißpulver" 等
            # 德文词能包含短英文词（如 protein），命中本地产品 full_ingredients。
            match_terms = expanded_terms[:6] or [keyword]
            ilike_or: list[str] = []
            ilike_params: dict[str, Any] = {}
            for i, term in enumerate(match_terms):
                param = f"pat{i}"
                ilike_or.append(
                    f"(product_name ILIKE :{param} OR brand ILIKE :{param} "
                    f"OR category ILIKE :{param} OR sub_category ILIKE :{param} "
                    f"OR full_ingredients ILIKE :{param})"
                )
                ilike_params[param] = f"%{term}%"
            ilike_where = ["(" + " OR ".join(ilike_or) + ")"]

            # 来源过滤（origin）：internet 仅 OFF，local 仅平台参考数据
            if origin == "internet":
                ilike_where.append("source = 'openfoodfacts'")
            elif origin == "local":
                ilike_where.append("source = 'manual'")

            if category:
                ilike_where.append("category ILIKE :cat2")
                ilike_params["cat2"] = f"%{category}%"
            if brand:
                ilike_where.append("brand ILIKE :brd2")
                ilike_params["brd2"] = f"%{brand}%"
            if formulation_type:
                ilike_where.append("formulation_type ILIKE :fmt2")
                ilike_params["fmt2"] = f"%{formulation_type}%"
            if min_price is not None:
                ilike_where.append("price >= :min_p2")
                ilike_params["min_p2"] = min_price
            if max_price is not None:
                ilike_where.append("price <= :max_p2")
                ilike_params["max_p2"] = max_price
            if min_rating is not None:
                ilike_where.append("avg_rating >= :min_r2")
                ilike_params["min_r2"] = min_rating
            if effects and len(effects) > 0:
                arr_literal = "{" + ",".join(e.replace('"', '""') for e in effects) + "}"
                ilike_where.append(f"effects && {arr_literal}")

            ilike_where_sql = " AND ".join(ilike_where)

            count_sql = text(f"""
                SELECT COUNT(*) FROM retail_products
                WHERE {ilike_where_sql}
            """)
            total = (await db.execute(count_sql, ilike_params)).scalar() or 0

            if total > 0:
                sql = text(f"""
                    SELECT id, brand, product_name, product_line,
                           category, sub_category, formulation_type,
                           effects, target_population,
                           full_ingredients, key_ingredients,
                           price, currency, package_size,
                           volume_ml, weight_g,
                           sales_channels, avg_rating, review_count,
                           monthly_sales, image_urls,
                           reg_number, reg_type, approved_region,
                           source, crawl_timestamp, data_quality,
                           allergens_tags, additives_tags, ecoscore_grade,
                           traces_tags, contaminants
                    FROM retail_products
                    WHERE {ilike_where_sql}
                    ORDER BY data_quality DESC
                    LIMIT :limit OFFSET :offset
                """)
                result = await db.execute(sql, {**ilike_params, "limit": page_size, "offset": (page - 1) * page_size})
                rows = result.fetchall()
                if rows:
                    items = [self._row_to_product_dict(row) for row in rows]
                    return {
                        "items": items,
                        "total": total,
                        "page": page,
                        "page_size": page_size,
                        "data_source": "postgresql_ilike",
                    }
            # 数据库无缓存数据 → 不自动回退实时 API（避免限流）
            logger.info("[OFFDataService] DB 无缓存数据，返回空结果")
            return {
                "items": [], "total": 0,
                "page": page, "page_size": page_size,
                "data_source": "postgresql_ilike_empty",
            }
        except Exception as err:
            logger.warning("[OFFDataService] DB 搜索失败，返回空结果: %s", err)
            await self._rollback_safely(db)

        # DB 不可用 → 不再调用实时 API（避免限流）
        return {
            "items": [], "total": 0,
            "page": page, "page_size": page_size,
            "data_source": "postgresql_error",
        }

    async def _fts_available(self, db: AsyncSession) -> bool:
        """探测 retail_products 是否含 search_vector 列（结果缓存在实例上）。

        若列不存在，跳过 FTS 直接走 ILIKE，避免 UndefinedColumnError 把事务置为
        aborted 导致后续 ILIKE 全部失败（postgresql_error）。
        """
        if self._has_search_vector is None:
            try:
                result = await db.execute(text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_name = 'retail_products' AND column_name = 'search_vector'
                """))
                self._has_search_vector = (result.scalar() or 0) > 0
                logger.info(
                    "[OFFDataService] retail_products.search_vector 列存在: %s",
                    self._has_search_vector,
                )
            except Exception as err:
                logger.warning("[OFFDataService] search_vector 列探测失败，按不存在处理: %s", err)
                self._has_search_vector = False
        return self._has_search_vector

    async def _rollback_safely(self, db: AsyncSession) -> None:
        """重置 aborted 事务，确保同一会话后续查询可继续执行。"""
        try:
            await db.rollback()
        except Exception as err:
            logger.debug("[OFFDataService] 事务回滚失败: %s", err)

    # ── 多镜像故障转移 ──

    async def _search_mirrors(
        self,
        keyword: str,
        page: int,
        page_size: int,
        brand: Optional[str] = None,
        category_tag: Optional[str] = None,
        *,
        per_mirror_timeout: float = 6.0,
    ) -> tuple[list[dict], int, Optional[str], Optional[str]]:
        """按顺序尝试 OFF 镜像搜索；503/超时/网络异常自动切换下一镜像。

        返回 (products, count, last_error, used_mirror)：
        - products 非空时 used_mirror 为命中的镜像 URL；
        - 镜像可达但无结果时立即返回空（不再请求后续镜像）；
        - 全部失败时 products 为空，last_error 为最后一个错误。
        """
        mirrors = OFFConfig().MIRROR_URLS
        loop = asyncio.get_running_loop()
        last_error: Optional[str] = None
        for mirror in mirrors:
            try:
                products_data = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda m=mirror: self.client.search_by_keyword(
                            keyword,
                            page=page,
                            page_size=page_size,
                            brand=brand,
                            category_tag=category_tag,
                            base_url=m,
                        ),
                    ),
                    timeout=per_mirror_timeout,
                )
                # 防御：非法响应类型（如 mock/代理异常）视为该镜像失败
                if not isinstance(products_data, dict):
                    last_error = f"{mirror}: 非法响应类型 {type(products_data).__name__}"
                    self._metrics["mirror_failures"] += 1
                    logger.warning(
                        "[OFFDataService] 镜像 %s 返回非法响应，切换下一镜像: "
                        "keyword=%s response_type=%s",
                        mirror, keyword, type(products_data).__name__,
                    )
                    continue
                raw_products = products_data.get("products", [])
                if not isinstance(raw_products, list):
                    raw_products = []
                try:
                    count = int(products_data.get("count", len(raw_products)))
                except (TypeError, ValueError):
                    count = len(raw_products)
                if raw_products:
                    logger.info(
                        "[OFFDataService] 镜像 %s 命中 keyword=%s count=%s products=%s",
                        mirror, keyword, count, len(raw_products),
                    )
                    return raw_products, count, None, mirror
                # 镜像可达但关键词无匹配 → 直接返回空结果（不是故障）
                if "count" in products_data:
                    return [], 0, None, mirror
                last_error = f"{mirror}: 空响应"
                logger.warning(
                    "[OFFDataService] 镜像 %s 返回空响应，切换下一镜像: keyword=%s",
                    mirror, keyword,
                )
            except asyncio.TimeoutError:
                last_error = f"{mirror}: 超时"
                self._metrics["mirror_failures"] += 1
                logger.warning(
                    "[OFFDataService] 镜像 %s 超时，切换下一镜像: keyword=%s",
                    mirror, keyword,
                )
            except Exception as e:
                last_error = f"{mirror}: {type(e).__name__}: {e}"
                self._metrics["mirror_failures"] += 1
                logger.warning(
                    "[OFFDataService] 镜像 %s 请求失败，切换下一镜像: "
                    "keyword=%s error_type=%s error=%s",
                    mirror, keyword, type(e).__name__, e,
                )
        return [], 0, last_error, None

    async def _barcode_mirrors(
        self,
        barcode: str,
        *,
        per_mirror_timeout: float = 6.0,
    ) -> Optional[dict]:
        """按顺序尝试 OFF 镜像查询条码；503/超时/网络异常自动切下一个。

        返回第一个成功镜像的原始响应 dict；全部失败返回 None。
        """
        mirrors = OFFConfig().MIRROR_URLS
        loop = asyncio.get_running_loop()
        last_error: Optional[str] = None
        for mirror in mirrors:
            try:
                raw = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda m=mirror: self.client.search_by_barcode(
                            barcode, base_url=m,
                        ),
                    ),
                    timeout=per_mirror_timeout,
                )
                # 防御：非法响应类型（如 mock/代理异常）视为该镜像失败
                if isinstance(raw, dict):
                    return raw
                last_error = f"{mirror}: 非法响应类型 {type(raw).__name__}"
            except asyncio.TimeoutError:
                last_error = f"{mirror}: 超时"
                self._metrics["mirror_failures"] += 1
                logger.warning(
                    "[OFFDataService] 条码 %s 镜像 %s 超时，切换下一镜像",
                    barcode, mirror,
                )
            except Exception as e:
                last_error = f"{mirror}: {type(e).__name__}: {e}"
                self._metrics["mirror_failures"] += 1
                logger.warning(
                    "[OFFDataService] 条码 %s 镜像 %s 请求失败，切换下一镜像: "
                    "error_type=%s error=%s",
                    barcode, mirror, type(e).__name__, e,
                )
        if last_error:
            logger.warning(
                "[OFFDataService] 条码 %s 所有镜像失败: %s", barcode, last_error,
            )
        return None

    async def _realtime_search(
        self,
        keyword: str,
        page: int,
        page_size: int,
        brand: Optional[str] = None,
        category_tag: Optional[str] = None,
    ) -> dict[str, Any]:
        """实时调 OFF REST API 搜索 — 直接调用官方 /cgi/search.pl。

        返回结果包含：
        - 相关性过滤：product_name/brand/ingredients 含查询词（含中英同义词）的产品优先；
          过滤后不足 page_size 时用 OFF 原始结果补足。
        - 修正后的 total：OFF 原始 count 可能是数百万（如 4828053），对用户无意义，
          这里截断为 min(原始 count, 10000)，并在 off_total 字段保留原始 count。
        """
        self._metrics["realtime_requests"] += 1
        rt_start = time.perf_counter()
        try:
            # ── 中文 → 英文主搜索词（OFF 全文搜索对中文匹配极差） ──
            # 如 蛋白粉→protein powder、胶原蛋白肽→collagen peptide、
            # 维生素C→vitamin c；取最长匹配的中文词对应的英文词。
            kw_lower = (keyword or "").strip().lower()
            off_keyword = keyword
            best_len = 0
            for base, en in QUERY_ENGLISH_PRIMARY.items():
                if base in kw_lower and len(base) > best_len:
                    best_len = len(base)
                    off_keyword = en

            # 首页多取一些候选（最多 100 条），便于相关性过滤后仍能凑满 page_size。
            fetch_size = min(max(page_size * 2, 20), 100) if page == 1 else page_size
            # 多镜像故障转移：503/超时/网络异常自动切换下一镜像，全部失败才降级
            raw_products, total_count, last_error, used_mirror = (
                await self._search_mirrors(
                    off_keyword,
                    page,
                    fetch_size,
                    brand=brand,
                    category_tag=category_tag,
                )
            )

            all_products: list[dict] = []
            if raw_products:
                all_products = raw_products

            # ── 外部 API 全失败 → 内置词表兜底 ──
            if not all_products:
                logger.warning(
                    "[OFFDataService] OFF API 无结果，启用内置词表兜底: "
                    "keyword=%s last_error=%s",
                    keyword, last_error,
                )
                keyword_lower = keyword.lower()
                matched = [cat for cat in POPULAR_CATEGORIES
                           if keyword_lower in cat["name_cn"].lower()
                           or keyword_lower in cat["name_en"].lower()
                           or keyword_lower in cat["tag"].lower()]
                if matched:
                    total_count = len(matched)
                    all_products = matched[(page - 1) * page_size:page * page_size]

            # 统一输出格式
            items = []
            for raw_product in all_products:
                # 只要有 code 字段就尝试映射（search_simple 模式可能不含 product_name）
                mapped = self.mapper.map_product(raw_product) if "code" in raw_product else None
                if mapped:
                    item = self._map_off_product(mapped)
                    item["source"] = "openfoodfacts_api"
                    items.append(item)
                elif "name_cn" in raw_product and "tag" in raw_product:
                    items.append({
                        "id": raw_product["tag"], "sku": None,
                        "brand": "OpenFoodFacts", "product_name": raw_product["name_cn"],
                        "product_line": None, "category": raw_product["name_cn"],
                        "sub_category": None, "formulation_type": "",
                        "effects": [], "target_population": [],
                        "full_ingredients": None, "key_ingredients": {},
                        "price": 0, "currency": "CNY", "package_size": None,
                        "volume_ml": None, "weight_g": None,
                        "sales_channels": [], "avg_rating": None,
                        "review_count": None, "monthly_sales": None,
                        "image_urls": [], "reg_number": None,
                        "reg_type": None, "approved_region": None,
                        "allergens_tags": [], "additives_tags": [],
                        "ecoscore_grade": None, "traces_tags": [],
                        "contaminants": [], "source": "openfoodfacts_api",
                        "data_quality": 0, "crawl_timestamp": None,
                        "created_at": None, "updated_at": None,
                    })

            # ── 强相关性过滤：仅保留产品名/品牌/成分含查询词（含中英同义词）的产品 ──
            # 过滤后不足 page_size 就少返回，绝不用 OFF 原始结果中的无关产品凑数。
            terms = _expand_query_terms(keyword)
            relevant_count = len(items)
            if terms and items:
                relevant = [it for it in items if _product_relevance_score(it, terms) > 0]
                relevant.sort(
                    key=lambda it: _product_relevance_score(it, terms),
                    reverse=True,
                )
                items = relevant
                relevant_count = len(relevant)

            # 有产品 → api；镜像可达但无匹配 → empty；所有镜像失败 → error_network
            if all_products:
                data_source = "openfoodfacts_api"
            elif last_error:
                data_source = "error_network"
            else:
                data_source = "empty"
            off_total = total_count or len(items)
            # total 反映过滤后的相关产品数（对用户有意义），off_total 保留 OFF 原始 count
            if relevant_count < fetch_size:
                display_total = relevant_count
            else:
                display_total = min(off_total, 10000) if off_total else relevant_count

            elapsed_ms = (time.perf_counter() - rt_start) * 1000
            logger.info(
                "[OFFDataService] realtime_search keyword=%s status=%s "
                "duration_ms=%.1f items=%s total=%s mirror=%s",
                keyword, data_source, elapsed_ms, len(items), display_total,
                used_mirror or "none",
            )
            return {
                "items": items[:page_size],
                "total": display_total,
                "off_total": off_total,
                "page": page,
                "page_size": page_size,
                "data_source": data_source,
                "mirror": used_mirror,
            }

        except Exception as err:
            self._metrics["errors"] += 1
            elapsed_ms = (time.perf_counter() - rt_start) * 1000
            logger.warning(
                "[OFFDataService] realtime_search keyword=%s status=error_network "
                "duration_ms=%.1f error_type=%s error=%s",
                keyword, elapsed_ms, type(err).__name__, err,
            )
            return {
                "items": [], "total": 0, "off_total": 0,
                "page": page, "page_size": page_size,
                "data_source": "error_network",
                "error": str(err),
            }

    # ── 实时结果辅助方法 ──

    def _rank_relevant_items(self, items: list[dict], terms: list[str]) -> list[dict]:
        """按查询词相关性稳定排序：含关键词的产品在前，其余在后补足。

        Python sort 是稳定的，同分产品保持 OFF 原始顺序。
        """
        scored = [(_product_relevance_score(item, terms), item) for item in items]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in scored]

    def _merge_items(self, db_items: list[dict], off_items: list[dict]) -> list[dict]:
        """合并 DB 本地命中与 OFF 实时结果，按 id 去重，DB 命中在前。"""
        seen: set[Any] = set()
        merged: list[dict] = []
        for it in list(db_items) + list(off_items):
            key = it.get("id")
            if key is None or key in seen:
                continue
            seen.add(key)
            merged.append(it)
        return merged

    # ── 实时结果本地缓存 ──

    async def _cache_off_products(self, db: AsyncSession, items: list[dict]) -> int:
        """将 OFF 实时搜索成功的产品幂等 upsert 到 retail_products 表。

        - source='openfoodfacts'，external_id=条码（幂等冲突键）；
        - 冲突时仅当现有行 source='openfoodfacts' 才更新，绝不覆盖 manual 数据；
        - data_quality 沿用 OFF completeness 映射值。
        返回写入/更新的行数（best-effort，失败不影响主流程）。
        """
        if not items:
            return 0
        global _RetailProduct
        if _RetailProduct is None:
            from app.models.retail_product import RetailProduct
            _RetailProduct = RetailProduct

        from sqlalchemy.dialects.postgresql import insert as pg_insert

        written = 0
        now = datetime.now(timezone.utc)
        # crawl_timestamp 列是 TIMESTAMP WITHOUT TIME ZONE，必须传 naive UTC
        now_naive = now.replace(tzinfo=None)
        table = _RetailProduct.__table__
        # 冲突时不更新的列：主键/幂等键/创建审计
        {c.name: getattr(table.c, c.name) for c in table.columns}
        for it in items:
            external_id = it.get("id") or it.get("sku")
            if not external_id:
                continue
            try:
                values = {
                    "external_id": str(external_id),
                    "sku": it.get("sku") or str(external_id),
                    "brand": it.get("brand") or "Unknown",
                    "product_name": it.get("product_name") or "",
                    "product_line": it.get("product_line"),
                    "category": it.get("category"),
                    "sub_category": it.get("sub_category"),
                    "formulation_type": it.get("formulation_type"),
                    "effects": it.get("effects") or [],
                    "target_population": it.get("target_population") or [],
                    "full_ingredients": it.get("full_ingredients"),
                    "key_ingredients": it.get("key_ingredients") or {},
                    "price": it.get("price"),
                    "currency": it.get("currency") or "CNY",
                    "package_size": it.get("package_size"),
                    "volume_ml": it.get("volume_ml"),
                    "weight_g": it.get("weight_g"),
                    "sales_channels": it.get("sales_channels") or [],
                    "avg_rating": it.get("avg_rating"),
                    "review_count": it.get("review_count"),
                    "monthly_sales": it.get("monthly_sales"),
                    "image_urls": it.get("image_urls") or [],
                    "reg_number": it.get("reg_number"),
                    "reg_type": it.get("reg_type"),
                    "approved_region": it.get("approved_region"),
                    "allergens_tags": it.get("allergens_tags") or [],
                    "additives_tags": it.get("additives_tags") or [],
                    "ecoscore_grade": it.get("ecoscore_grade"),
                    "traces_tags": it.get("traces_tags") or [],
                    "contaminants": it.get("contaminants") or [],
                    "source": "openfoodfacts",
                    "data_quality": float(it.get("data_quality") or 0.5),
                    "crawl_timestamp": now_naive,
                    "created_at": now,
                    "updated_at": now,
                }
                stmt = pg_insert(_RetailProduct).values(**values)
                # 幂等：external_id 冲突时更新；仅当现有行是 OFF 数据时更新（不覆盖 manual）
                update_cols = {
                    c.name: stmt.excluded[c.name]
                    for c in table.columns
                    if c.name not in ("id", "external_id", "created_at", "created_by")
                }
                stmt = stmt.on_conflict_do_update(
                    index_elements=[_RetailProduct.external_id],
                    set_=update_cols,
                    where=(_RetailProduct.source == "openfoodfacts"),
                )
                result = await db.execute(stmt)
                written += result.rowcount or 0
            except Exception as err:
                logger.warning(
                    "[OFFDataService] OFF 产品缓存写入失败 external_id=%s error_type=%s error=%s",
                    external_id, type(err).__name__, err,
                )
                await self._rollback_safely(db)
        try:
            await db.commit()
        except Exception as err:
            logger.warning(
                "[OFFDataService] OFF 产品缓存提交失败 error_type=%s error=%s",
                type(err).__name__, err,
            )
            await self._rollback_safely(db)
        return written

    async def _search_off_cache(
        self,
        keyword: str,
        db: AsyncSession,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """在 retail_products 中查找 source='openfoodfacts' 的本地缓存产品。

        所有 OFF 镜像失败时用于缓存兜底，返回 data_source='openfoodfacts_cache'。
        """
        try:
            like_pattern = f"%{keyword}%"
            where_sql = """
                source = 'openfoodfacts'
                AND (product_name ILIKE :pat OR brand ILIKE :pat
                     OR category ILIKE :pat OR sub_category ILIKE :pat
                     OR full_ingredients ILIKE :pat)
            """
            count_sql = text(f"SELECT COUNT(*) FROM retail_products WHERE {where_sql}")
            total = (await db.execute(count_sql, {"pat": like_pattern})).scalar() or 0
            if total <= 0:
                return {
                    "items": [], "total": 0,
                    "page": page, "page_size": page_size,
                    "data_source": "openfoodfacts_cache_empty",
                }

            sql = text(f"""
                SELECT id, brand, product_name, product_line,
                       category, sub_category, formulation_type,
                       effects, target_population,
                       full_ingredients, key_ingredients,
                       price, currency, package_size,
                       volume_ml, weight_g,
                       sales_channels, avg_rating, review_count,
                       monthly_sales, image_urls,
                       reg_number, reg_type, approved_region,
                       source, crawl_timestamp, data_quality,
                       allergens_tags, additives_tags, ecoscore_grade,
                       traces_tags, contaminants
                FROM retail_products
                WHERE {where_sql}
                ORDER BY data_quality DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await db.execute(sql, {
                "pat": like_pattern,
                "limit": page_size,
                "offset": (page - 1) * page_size,
            })
            rows = result.fetchall()
            items = [self._row_to_product_dict(row) for row in rows]
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "data_source": "openfoodfacts_cache",
            }
        except Exception as err:
            logger.warning(
                "[OFFDataService] OFF 本地缓存查询失败 keyword=%s error_type=%s error=%s",
                keyword, type(err).__name__, err,
            )
            await self._rollback_safely(db)
            return {
                "items": [], "total": 0,
                "page": page, "page_size": page_size,
                "data_source": "openfoodfacts_cache_error",
            }

    # ── 按条码查询 ──

    async def get_product_by_barcode(
        self,
        barcode: str,
        db: AsyncSession,
        *,
        realtime: bool = False,
    ) -> dict[str, Any] | None:
        """
        按条形码查询产品。
        DB 优先，未命中则实时调 OFF API。
        """
        start = time.perf_counter()
        if not realtime:
            global _RetailProduct
            if _RetailProduct is None:
                from app.models.retail_product import RetailProduct
                _RetailProduct = RetailProduct
            try:
                result = await db.execute(
                    select(_RetailProduct).where(
                        _RetailProduct.external_id == barcode
                    ).limit(1)
                )
                product = result.scalar_one_or_none()
                if product:
                    self._metrics["cache_hits"] += 1
                    logger.info(
                        "[OFFDataService] barcode=%s status=cache_hit duration_ms=%.1f",
                        barcode, (time.perf_counter() - start) * 1000,
                    )
                    return self._product_to_dict(product)
            except Exception as err:
                logger.warning(
                    "[OFFDataService] barcode=%s status=db_error error_type=%s error=%s",
                    barcode, type(err).__name__, err,
                )

        # 实时查询 OFF API（多镜像故障转移）
        try:
            raw = await self._barcode_mirrors(barcode)
            if raw:
                # 适配新的返回格式：search_by_barcode 现在返回完整响应字典
                product_data = raw.get("product") or raw
                mapped = self.mapper.map_product(product_data)
                if mapped:
                    mapped["_source"] = "openfoodfacts_api"
                    logger.info(
                        "[OFFDataService] barcode=%s status=api duration_ms=%.1f",
                        barcode, (time.perf_counter() - start) * 1000,
                    )
                    return mapped
        except Exception as err:
            self._metrics["errors"] += 1
            logger.warning(
                "[OFFDataService] barcode=%s status=api_error error_type=%s error=%s "
                "duration_ms=%.1f",
                barcode, type(err).__name__, err,
                (time.perf_counter() - start) * 1000,
            )

        logger.info(
            "[OFFDataService] barcode=%s status=miss duration_ms=%.1f",
            barcode, (time.perf_counter() - start) * 1000,
        )
        return None

    # ── 按 ID 查询 ──

    async def get_product_by_id(
        self,
        product_id: int,
        db: AsyncSession,
    ) -> dict[str, Any] | None:
        """按数据库 ID 查询零售产品"""
        global _RetailProduct
        if _RetailProduct is None:
            from app.models.retail_product import RetailProduct
            _RetailProduct = RetailProduct
        try:
            result = await db.execute(
                select(_RetailProduct).where(_RetailProduct.id == product_id).limit(1)
            )
            product = result.scalar_one_or_none()
            if product:
                return self._product_to_dict(product)
        except Exception as err:
            logger.warning("[OFFDataService] 按 ID 查询失败: %s", err)
        return None

    # ── 按分类浏览 ──

    async def list_by_category(
        self,
        category_tag: str,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 50,
        realtime: bool = False,
    ) -> dict[str, Any]:
        """按分类浏览零售产品"""
        chinese_name = CATEGORY_MAP.get(category_tag, category_tag)

        if realtime:
            return await self._realtime_category_search(category_tag, page, page_size)
        # _db_category_search 内部已实现多级回退（DB→实时搜索），直接返回
        return await self._db_category_search(
            chinese_name, category_tag, db, page, page_size
        )

    async def _db_category_search(
        self,
        chinese_name: str,
        category_tag: str,
        db: AsyncSession,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """数据库分类搜索"""
        try:
            like = f"%{chinese_name}%"
            tag_like = f"%{category_tag}%"

            sql = text("""
                SELECT id, brand, product_name, product_line,
                       category, sub_category, formulation_type,
                       effects, target_population,
                       full_ingredients, key_ingredients,
                       price, currency, package_size,
                       volume_ml, weight_g,
                       sales_channels, avg_rating, review_count,
                       monthly_sales, image_urls,
                       reg_number, reg_type, approved_region,
                       source, crawl_timestamp, data_quality,
                       allergens_tags, additives_tags, ecoscore_grade,
                       traces_tags, contaminants
                FROM retail_products
                WHERE source = 'openfoodfacts'
                  AND (category ILIKE :chn
                       OR sub_category ILIKE :chn
                       OR product_line ILIKE :tag
                       OR product_name ILIKE :chn)
                ORDER BY data_quality DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await db.execute(sql, {
                "chn": like,
                "tag": tag_like,
                "limit": page_size,
                "offset": (page - 1) * page_size,
            })
            rows = result.fetchall()

            count_sql = text("""
                SELECT COUNT(*) FROM retail_products
                WHERE source = 'openfoodfacts'
                  AND (category ILIKE :chn
                       OR sub_category ILIKE :chn
                       OR product_line ILIKE :tag
                       OR product_name ILIKE :chn)
            """)
            total = (await db.execute(count_sql, {
                "chn": like,
                "tag": tag_like,
            })).scalar() or 0

            items = [self._row_to_product_dict(row) for row in rows]
            if items:
                return {
                    "items": items,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                    "category": chinese_name,
                    "category_tag": category_tag,
                    "data_source": "postgresql",
                }
            # 数据库无缓存数据 → 不自动回退实时 API（避免限流）
            logger.info("[OFFDataService] DB 分类搜索无缓存数据，返回空结果")
            return {
                "items": [], "total": 0,
                "page": page, "page_size": page_size,
                "data_source": "postgresql_ilike_empty",
                "category_tag": category_tag,
            }
        except Exception as err:
            logger.warning("[OFFDataService] DB 分类搜索失败: %s", err)
            return await self._realtime_category_search(category_tag, page, page_size)

    async def _realtime_category_search(
        self,
        category_tag: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """实时调 OFF API 按分类搜索 — 多镜像源容错"""
        mirrors = [
            "https://world.openfoodfacts.org",
            "https://world-en.openfoodfacts.org",
        ]
        base_params = {
            "categories_tags_contains": category_tag,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": min(page_size, 50),
            "page": page,
        }

        # OFF API 分页直接传参，不需前端切片（修复 N+1 bug）
        (page - 1) * page_size
        all_products, total_count, last_error = await self._parallel_probe_mirrors(
            mirrors, base_params,
        )

        items = []
        for raw_product in all_products:
            mapped = self.mapper.map_product(raw_product)
            if mapped:
                items.append(self._map_off_product(mapped))

        data_source = "openfoodfacts_api" if items else "error_network"

        return {
            "items": items[:page_size],
            "total": max(total_count, len(items)),
            "page": page,
            "page_size": page_size,
            "category_tag": category_tag,
            "data_source": data_source,
        }

    # ── 分类列表 ──

    async def get_categories(
        self,
        db: AsyncSession | None = None,
    ) -> list[dict[str, Any]]:
        """
        获取所有分类及其产品数量。
        数据库优先，无数据时回退内置词表。
        """
        try:
            if db is None:
                raise Exception("No database session provided")

            result = await db.execute(text("""
                SELECT category, COUNT(*) as cnt
                FROM retail_products
                WHERE source = 'openfoodfacts' AND category IS NOT NULL
                GROUP BY category
                ORDER BY cnt DESC
            """))
            rows = result.fetchall()
            if rows:
                return [
                    {"category": str(row[0]), "count": row[1]}
                    for row in rows
                ]
        except Exception as err:
            logger.warning("[OFFDataService] 分类查询失败: %s", err)

        # Fallback: 内置词表（返回全部，不再截断）
        return [
            {"category": cat["name_cn"], "category_tag": cat["tag"], "count": 0}
            for cat in POPULAR_CATEGORIES
        ]

    # ── 同步统计 ──

    async def get_sync_stats(self, db: AsyncSession) -> dict[str, Any]:
        """获取 OFF 数据同步统计（数据库优先，无数据时返回词表信息）。

        各项统计独立查询并单独降级：表结构不完整（如缺少某列）时仅该项降级，
        绝不因单条 SQL 失败而静默吞掉其余真实统计（不再整体返回全 0）。
        """
        total = 0
        with_emb = 0
        avg_quality = 0.0
        unique_brands = 0
        last_sync = None

        try:
            total = (await db.execute(text("""
                SELECT COUNT(*) FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0
        except Exception as err:
            logger.warning(
                "[OFFDataService] total_products 统计失败（retail_products 表可能不存在）: %s", err
            )

        try:
            with_emb = (await db.execute(text("""
                SELECT COUNT(*) FROM retail_products
                WHERE source = 'openfoodfacts' AND embedding IS NOT NULL
            """))).scalar() or 0
        except Exception as err:
            logger.warning(
                "[OFFDataService] with_embedding 统计失败（embedding 列不可用）: %s", err
            )

        try:
            # data_quality 为 double precision，ROUND(x, 2) 只接受 numeric，
            # 必须显式 ::numeric 转换，否则 PostgreSQL 报
            # “function round(double precision, integer) does not exist”。
            avg_quality = (await db.execute(text("""
                SELECT ROUND(AVG(data_quality)::numeric, 2)
                FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0
            avg_quality = float(avg_quality)
        except Exception as err:
            logger.warning("[OFFDataService] avg_quality 统计失败: %s", err)

        try:
            unique_brands = (await db.execute(text("""
                SELECT COUNT(DISTINCT brand) FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0
        except Exception as err:
            logger.warning(
                "[OFFDataService] unique_brands 统计失败（brand 列不可用）: %s", err
            )

        # off_sync_state 表可能尚未创建（OFF 导入未初始化），单项降级
        try:
            snap_result = await db.execute(text("""
                SELECT last_sync_date, status
                FROM off_sync_state
                WHERE source = 'openfoodfacts'
                ORDER BY last_sync_date DESC
                LIMIT 1
            """))
            snap_row = snap_result.fetchone()
            if snap_row:
                last_sync = {
                    "date": str(snap_row[0]) if snap_row[0] else None,
                    "status": snap_row[1],
                }
        except Exception as e:
            logger.debug(
                "[OFFDataService] OFF 同步状态查询失败（off_sync_state 表可能不存在）: %s", e
            )

        logger.info(
            "[OFFDataService] sync-stats: total_products=%s with_embedding=%s "
            "avg_quality=%s unique_brands=%s last_sync=%s",
            total, with_emb, avg_quality, unique_brands, last_sync,
        )

        return {
            "total_products": total,
            "with_embedding": with_emb,
            "avg_quality": avg_quality,
            "unique_brands": unique_brands,
            "kb_categories": self.category_count,
            "last_sync": last_sync,
        }

    # ── 辅助方法 ──

    async def _probe_mirror(
        self, url: str, params: dict[str, Any], timeout: float = 15.0,
    ) -> tuple[str, Optional[dict], Exception | None]:
        """并行探测单个 OFF 镜像，返回 (url, result_dict_or_None, error_or_None)"""
        try:
            loop = asyncio.get_running_loop()

            def _fetch():
                import time as _time
                _time.sleep(0.5)
                return self.client._http_client.get(url, timeout=10.0)

            resp = await asyncio.wait_for(
                loop.run_in_executor(None, _fetch),
                timeout=timeout,
            )
            resp.raise_for_status()
            raw_data = resp.json()
            products = raw_data.get("products", [])
            count = raw_data.get("count", len(products))
            logger.info(f"[OFFDataService] [{url}] count={count}, products={len(products)}")
            if products:
                return url, {"products": products, "count": count}, None
            return url, None, None  # 成功但无结果

        except asyncio.TimeoutError:
            self._metrics["mirror_failures"] += 1
            logger.warning(
                "[OFFDataService] mirror_probe url=%s status=timeout", url,
            )
            return url, None, TimeoutError(f"{url}: 超时")
        except Exception as e:
            self._metrics["mirror_failures"] += 1
            logger.warning(
                "[OFFDataService] mirror_probe url=%s status=error "
                "error_type=%s error=%s",
                url, type(e).__name__, e,
            )
            return url, None, e

    async def _parallel_probe_mirrors(
        self, mirrors: list[str], params: dict[str, Any],
    ) -> tuple[list[dict], int, str]:
        """并行探测多个镜像，按镜像顺序取第一个成功。

        使用 gather 等待全部探测结束，确保镜像失败计数（mirror_failures）
        在返回前已落盘，避免 as_completed+break 的调度竞态导致计数丢失。
        返回 (products, total_count, last_error)。
        """
        all_products: list[dict] = []
        total_count = 0
        last_error: str = ""

        tasks = [self._probe_mirror(mirror, params) for mirror in mirrors]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, BaseException):
                last_error = f"镜像探测异常: {res}"
                continue
            url, result, err = res
            if result is not None:
                all_products.extend(result["products"])
                total_count = max(total_count, result["count"])
                break  # 按镜像顺序取第一个成功
            if err:
                last_error = f"{url}: {err}"

        return all_products, total_count, last_error

    def _product_to_dict(self, product: Any) -> dict[str, Any]:
        """将 RetailProduct ORM 对象转为字典"""
        d = product.to_dict() if hasattr(product, "to_dict") else {}
        d["_source"] = product.source if hasattr(product, "source") else "postgresql"
        d["data_origin"] = (
            "internet_cache" if d.get("source") == "openfoodfacts"
            else "local_reference"
        )
        return d

    def _row_to_product_dict(self, row: Any) -> dict[str, Any]:
        """将 DB row 转为产品字典"""
        if row is None:
            return {}
        d = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
        d["_source"] = "postgresql"
        d["data_origin"] = (
            "internet_cache" if d.get("source") == "openfoodfacts"
            else "local_reference"
        )
        # 确保数组字段不为 None
        for arr_field in ("effects", "target_population", "sales_channels", "image_urls",
                          "allergens_tags", "additives_tags", "traces_tags", "contaminants"):
            if d.get(arr_field) is None:
                d[arr_field] = []
        for obj_field in ("key_ingredients",):
            if d.get(obj_field) is None:
                d[obj_field] = {}
        return d

    def _map_off_product(self, mapped: dict | None) -> dict[str, Any]:
        """將 mapper 輸出統一轉為標準 API 回應格式"""
        if mapped is None:
            return {}
        return {
            "id": mapped.get("external_id"),
            "sku": mapped.get("sku"),
            "brand": mapped.get("brand") or "Unknown",
            "product_name": mapped.get("product_name") or "",
            "product_line": mapped.get("product_line"),
            "category": mapped.get("category"),
            "sub_category": mapped.get("sub_category"),
            "formulation_type": mapped.get("formulation_type"),
            "effects": mapped.get("effects") or [],
            "target_population": mapped.get("target_population") or [],
            "full_ingredients": mapped.get("full_ingredients"),
            "key_ingredients": mapped.get("key_ingredients") or {},
            "price": mapped.get("price"),
            "currency": "CNY",
            "package_size": mapped.get("package_size"),
            "volume_ml": mapped.get("volume_ml"),
            "weight_g": mapped.get("weight_g"),
            "sales_channels": mapped.get("sales_channels") or [],
            "avg_rating": mapped.get("avg_rating"),
            "review_count": mapped.get("review_count"),
            "monthly_sales": mapped.get("monthly_sales"),
            "image_urls": mapped.get("image_urls") or [],
            "reg_number": mapped.get("reg_number"),
            "reg_type": mapped.get("reg_type"),
            "approved_region": mapped.get("approved_region"),
            "allergens_tags": mapped.get("allergens_tags") or [],
            "additives_tags": mapped.get("additives_tags") or [],
            "ecoscore_grade": mapped.get("ecoscore_grade"),
            "traces_tags": mapped.get("traces_tags") or [],
            "contaminants": mapped.get("contaminants") or [],
            "source": "openfoodfacts_api",
            "data_origin": "internet_realtime",
            "data_quality": mapped.get("data_quality") or 0,
            "crawl_timestamp": None,
            "created_at": None,
            "updated_at": None,
        }


# ── 全局单例 ──

off_service = OFFDataService()
