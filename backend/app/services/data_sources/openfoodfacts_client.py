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
from typing import Any, List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..openfoodfacts.client import OFFClient
from ..openfoodfacts.mapper import OFFMapper
from ..openfoodfacts.config import OFFConfig

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


class OFFDataService:
    """OpenFoodFacts 实时数据服务 — 三级数据源架构"""

    def __init__(self) -> None:
        self.client = OFFClient()
        self.mapper = OFFMapper()
        self._regconfig = OFFConfig.FTS_REGCONFIG
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

    # ── 实时搜索 ──

    async def search_products(
        self,
        keyword: str,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        realtime: bool = False,
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
        """
        if realtime:
            return await self._realtime_search(keyword, page, page_size)
        # _db_search 内部已实现多级回退（DB→实时搜索→内置词表），直接返回
        return await self._db_search(keyword, db, page, page_size,
                                     category=category, brand=brand,
                                     formulation_type=formulation_type,
                                     min_price=min_price, max_price=max_price,
                                     min_rating=min_rating, effects=effects)

    async def _db_search(
        self,
        keyword: str,
        db: AsyncSession,
        page: int,
        page_size: int,
        *,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        formulation_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        effects: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        """数据库搜索（BM25 FTS + ILIKE 回退），支持多种过滤条件"""
        try:
            like_pattern = f"%{keyword}%"

            # ── 构建 WHERE 子句 ──
            where_clauses: list[str] = ["source = 'openfoodfacts'"]
            params: dict[str, Any] = {"rc": self._regconfig, "kw": keyword}

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
                where_clauses.append(f"effects && ARRAY[:effs]::text[]")
                params["effs"] = ",".join(effects)

            where_sql = " AND ".join(where_clauses)

            # 尝试 FTS 搜索
            try:
                count_sql = text(f"""
                    SELECT COUNT(*) FROM retail_products
                    WHERE search_vector @@ plainto_tsquery(:rc, :kw)
                      AND {where_sql}
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
                        WHERE search_vector @@ plainto_tsquery(:rc, :kw)
                          AND {where_sql}
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
            except Exception:
                logger.warning("[OFFDataService] FTS 搜索失败，回退 ILIKE: %s", exc_info=True)

            # ILIKE 回退（关键词匹配）
            ilike_where = ["source = 'openfoodfacts'",
                           "(product_name ILIKE :pat OR brand ILIKE :pat OR category ILIKE :pat OR sub_category ILIKE :pat)"]
            ilike_params = {"pat": like_pattern}

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
                ilike_where.append(f"effects && ARRAY[:effs2]::text[]")
                ilike_params["effs2"] = ",".join(effects)

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
            # 数据库无缓存数据 → 自动走实时搜索
            logger.warning("[OFFDataService] DB 无缓存数据，自动回退实时 API")
            return await self._realtime_search(keyword, page, page_size)
        except Exception as err:
            logger.warning("[OFFDataService] DB 搜索失败，回退实时 API: %s", err)

        # DB 不可用 → 实时 API
        return await self._realtime_search(keyword, page, page_size)

    async def _realtime_search(
        self,
        keyword: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """实时调 OFF REST API 搜索 — 多镜像源容错 + 内置词表兜底"""
        mirrors = [
            "https://world.openfoodfacts.org",
            "https://world-en.openfoodfacts.org",
        ]
        base_params = {
            "search_terms_s": keyword,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": min(page_size, 50),
            "page": page,
        }

        all_products: list[dict] = []
        total_count = 0
        last_error: str = ""

        # OFF API 分页直接传参，不需前端切片（修复 N+1 bug）
        offset = (page - 1) * page_size

        # ── 并行探测镜像 ──
        params_str = "&".join(f"{k}={v}" for k, v in base_params.items())
        mirrors_with_params = {m: params_str for m in mirrors}
        all_products, total_count, last_error = await self._parallel_probe_mirrors(
            mirrors, base_params,
        )

        # ── 外部 API 全失败 → 内置词表兜底 ──
        if not all_products:
            logger.warning("[OFFDataService] OFF API 全部不可用，启用内置词表兜底")
            keyword_lower = keyword.lower()
            matched = [cat for cat in POPULAR_CATEGORIES
                       if keyword_lower in cat["name_cn"].lower()
                       or keyword_lower in cat["name_en"].lower()
                       or keyword_lower in cat["tag"].lower()]
            if matched:
                total_count = len(matched)
                all_products = matched[offset:offset + page_size]

        # 统一输出格式：每个 item 都包含 RetailProductResponse 的所有字段
        # 避免 response_model=RetailProductResponse 校验失败
        items = []
        for raw_product in all_products:
            mapped = self.mapper.map_product(raw_product) if "product_name" in raw_product else None
            if mapped:
                item = self._map_off_product(mapped)
                item["source"] = "openfoodfacts_api"
                items.append(item)
            elif "name_cn" in raw_product and "tag" in raw_product:
                # 内置词表兜底格式 — 同样补齐全部字段
                items.append({
                    "id": raw_product["tag"],
                    "sku": None,
                    "brand": "OpenFoodFacts",
                    "product_name": raw_product["name_cn"],
                    "product_line": None,
                    "category": raw_product["name_cn"],
                    "sub_category": None,
                    "formulation_type": "",
                    "effects": [],
                    "target_population": [],
                    "full_ingredients": None,
                    "key_ingredients": {},
                    "price": 0,
                    "currency": "CNY",
                    "package_size": None,
                    "volume_ml": None,
                    "weight_g": None,
                    "sales_channels": [],
                    "avg_rating": None,
                    "review_count": None,
                    "monthly_sales": None,
                    "image_urls": [],
                    "reg_number": None,
                    "reg_type": None,
                    "approved_region": None,
                    "allergens_tags": [],
                    "additives_tags": [],
                    "ecoscore_grade": None,
                    "traces_tags": [],
                    "contaminants": [],
                    "source": "openfoodfacts_api",
                    "data_quality": 0,
                    "crawl_timestamp": None,
                    "created_at": None,
                    "updated_at": None,
                })

        data_source = "openfoodfacts_api" if all_products else ("error_network" if mirrors else "empty")

        return {
            "items": items[:page_size],
            "total": max(total_count, len(items)),
            "page": page,
            "page_size": page_size,
            "data_source": data_source,
            **({"error": last_error} if not items and last_error else {}),
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
                    return self._product_to_dict(product)
            except Exception as err:
                logger.warning("[OFFDataService] DB 查询失败: %s", err)

        # 实时查询 OFF API
        try:
            loop = asyncio.get_running_loop()
            raw = await loop.run_in_executor(
                None,
                lambda: self.client.search_by_barcode(barcode),
            )
            if raw:
                mapped = self.mapper.map_product(raw)
                if mapped:
                    mapped["_source"] = "openfoodfacts_api"
                    return mapped
        except Exception as err:
            logger.error("[OFFDataService] 条码实时查询失败: %s", err)

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
            # 数据库无缓存数据 → 自动走实时搜索
            logger.warning("[OFFDataService] DB 分类搜索无缓存数据，自动回退实时 API")
            return await self._realtime_category_search(category_tag, page, page_size)
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
        offset = (page - 1) * page_size
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
        """获取 OFF 数据同步统计（数据库优先，无数据时返回词表信息）"""
        try:
            total = (await db.execute(text("""
                SELECT COUNT(*) FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0

            with_emb = (await db.execute(text("""
                SELECT COUNT(*) FROM retail_products
                WHERE source = 'openfoodfacts' AND embedding IS NOT NULL
            """))).scalar() or 0

            avg_quality = (await db.execute(text("""
                SELECT ROUND(AVG(data_quality), 2)
                FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0

            unique_brands = (await db.execute(text("""
                SELECT COUNT(DISTINCT brand) FROM retail_products
                WHERE source = 'openfoodfacts'
            """))).scalar() or 0

            # off_sync_state 查询
            last_sync = None
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
            except Exception:
                logger.warning("[OFFDataService] off_sync_state 表查询失败")

            return {
                "total_products": total,
                "with_embedding": with_emb,
                "avg_quality": float(avg_quality),
                "unique_brands": unique_brands,
                "kb_categories": self.category_count,
                "last_sync": last_sync,
            }
        except Exception as err:
            logger.warning("[OFFDataService] get_sync_stats 失败: %s", err)
            return {
                "total_products": 0,
                "with_embedding": 0,
                "avg_quality": 0,
                "unique_brands": 0,
                "kb_categories": self.category_count,
                "last_sync": None,
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
            return url, None, TimeoutError(f"{url}: 超时")
        except Exception as e:
            return url, None, e

    async def _parallel_probe_mirrors(
        self, mirrors: list[str], params: dict[str, Any],
    ) -> tuple[list[dict], int, str]:
        """并行探测多个镜像，最快获胜。返回 (products, total_count, last_error)"""
        all_products: list[dict] = []
        total_count = 0
        last_error: str = ""

        tasks = [self._probe_mirror(mirror, params) for mirror in mirrors]
        for coro in asyncio.as_completed(tasks):
            try:
                url, result, err = await asyncio.wait_for(coro, timeout=18.0)
                if result is not None:
                    all_products.extend(result["products"])
                    total_count = max(total_count, result["count"])
                    break  # 最快获胜
                if err:
                    last_error = f"{url}: {err}"
            except asyncio.TimeoutError:
                last_error = "所有镜像探测超时"

        return all_products, total_count, last_error

    def _product_to_dict(self, product: Any) -> dict[str, Any]:
        """将 RetailProduct ORM 对象转为字典"""
        d = product.to_dict() if hasattr(product, "to_dict") else {}
        d["_source"] = product.source if hasattr(product, "source") else "postgresql"
        return d

    def _row_to_product_dict(self, row: Any) -> dict[str, Any]:
        """将 DB row 转为产品字典"""
        if row is None:
            return {}
        d = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
        d["_source"] = "postgresql"
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
            "data_quality": mapped.get("data_quality") or 0,
            "crawl_timestamp": None,
            "created_at": None,
            "updated_at": None,
        }


# ── 全局单例 ──

off_service = OFFDataService()
