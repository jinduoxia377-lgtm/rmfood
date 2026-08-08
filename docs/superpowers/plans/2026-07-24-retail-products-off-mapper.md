# Phase 1: OpenFoodFacts Mapper 实现计划

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 修复 `OFFDataService` 因缺少 `OFFMapper` 和 `OFFConfig` 导致的 ImportError，使零售产品搜索功能真正可用。

**Architecture:** 创建独立的 `openfoodfacts/` 包，包含配置类和映射器类，将 OFF API 原始响应转换为 RMFOORM 统一格式。

**Tech Stack:** Python 3.12+, FastAPI, httpx, SQLAlchemy

## Global Constraints

- 遵循 PEP 8 代码规范，所有函数必须带类型注解
- 使用 `@dataclass(frozen=True)` 不可变数据类（common/coding-style.md）
- 不使用 `any`，用 `unknown` 或具体类型替代
- 不使用 `console.log`，使用 `logging` 模块
- 文件不超过 400 行，超过则拆分
- 不修改任何未请求的文件

---

## 任务 1: 创建 `__init__.py` 包文件

**Files:**
- Create: `backend/app/services/data_sources/openfoodfacts/__init__.py`

**Interfaces:**
- Produces: 使 `openfoodfacts` 成为可导入的 Python 包

- [ ] **Step 1: 创建空包 __init__.py**

```python
"""OpenFoodFacts 数据源子包

包含配置、映射器和加载器。
"""
```

- [ ] **Step 2: 验证包可导入**

运行: `cd backend && python -c "from app.services.data_sources.openfoodfacts import *; print('OK')"`
Expected: `OK`

---

## 任务 2: 创建 `config.py`

**Files:**
- Create: `backend/app/services/data_sources/openfoodfacts/config.py`

**Interfaces:**
- Consumes: 无
- Produces: `OFFConfig` dataclass — 所有配置常量

- [ ] **Step 1: 创建配置类**

```python
"""OpenFoodFacts 配置

对标 OFF 官方 API 文档:
https://world.openfoodfacts.org/api/v2
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class OFFConfig:
    """OpenFoodFacts API 配置"""

    # ── API 端点 ──
    BASE_URL: str = "https://world.openfoodfacts.org"
    SEARCH_ENDPOINT: str = "/cgi/search.pl"
    PRODUCT_ENDPOINT: str = "/api/v2/{code}.json"
    BARCODES_ENDPOINT: str = "/data/barcodes/{code}.json"
    JSONL_DIFF_BASE: str = "https://static.openfoodfacts.org/data/diffs"

    # ── 搜索参数默认值 ──
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    SEARCH_SIMPLE: int = 1
    SEARCH_ACTION: str = "process"
    SEARCH_JSON: str = "1"

    # ── HTTP 客户端配置 ──
    USER_AGENT: str = "RMFOOD-DataPipeline/1.0"
    HTTP_TIMEOUT: float = 30.0
    MIRROR_URLS: list[str] = field(default_factory=lambda: [
        "https://world.openfoodfacts.org",
        "https://world-en.openfoodfacts.org",
    ])

    # ── PostgreSQL FTS 配置 ──
    FTS_REGCONFIG: str = "simple"

    # ── 镜像探测配置 ──
    MIRROR_PROBE_TIMEOUT: float = 15.0
    MIRROR_PROBE_DELAY: float = 0.5

    # ── JSONL 增量同步 ──
    JSONL_GZIP: bool = True
    JSONL_BATCH_SIZE: int = 1000
```

- [ ] **Step 2: 验证配置可导入**

运行: `cd backend && python -c "from app.services.data_sources.openfoodfacts.config import OFFConfig; c=OFFConfig(); print(c.BASE_URL, c.DEFAULT_PAGE_SIZE)"`
Expected: `https://world.openfoodfacts.org 20`

---

## 任务 3: 创建 `mapper.py` — 核心映射逻辑

**Files:**
- Create: `backend/app/services/data_sources/openfoodfacts/mapper.py`

**Interfaces:**
- Consumes: `OFFConfig` (用于 FTS_REGCONFIG)
- Produces: `OFFMapper.map_product(raw: dict) -> dict` — 将 OFF API 原始响应转为 RMFOORM 统一格式
- Produces: `OFFMapper.map_products(raw_list: list[dict]) -> list[dict]` — 批量映射

**关键映射规则（基于实际 OFF API 响应）：**

| OFF 字段 | RMFOORM 字段 | 转换逻辑 |
|----------|-------------|---------|
| `code` | `sku`, `external_id` | 直接赋值 |
| `product_name` / `product_name_zh` / `product_name_en` | `product_name` | 优先 zh → en → 原语言 |
| `brands` | `brand` | 直接赋值 |
| `categories_tags[0]` (去掉 `en:` 前缀) | `category` | 查分类词表得中文名 |
| `categories_tags[1:]` | `sub_category` | 取第二级 |
| `quantity` | `package_size` | 直接赋值 |
| `nutriscore_grade` / `nutrition_grades` | 存入 `key_ingredients` | 营养等级 |
| `ecoscore_grade` | `ecoscore_grade` | 直接赋值 |
| `nova_group` | 存入 `key_ingredients` | NOVA 加工等级 |
| `ingredients_text` / `ingredients_text_zh` / `ingredients_text_en` | `full_ingredients` | 优先 zh |
| `ingredients_tags` | `key_ingredients["ingredients"]` | 成分标签列表 |
| `allergens_tags` | `allergens_tags` | 去掉 `en:` 前缀 |
| `additives_tags` | `additives_tags` | 去掉 `en:` 前缀 |
| `traces_tags` | `traces_tags` | 交叉污染物质 |
| `stores` | `sales_channels` | 逗号分隔 → 列表 |
| `labels` | 存入 `key_ingredients` | 认证标签 |
| `image_front_url` / `image_front_small_url` / `image_front_thumb_url` | `image_urls` | 收集所有图片 URL |
| `nutriments` | `key_ingredients["nutrition"]` | 提取核心营养素 per 100g |
| `countries` | 存入 `key_ingredients` | 销售地区 |
| `serving_size` | 存入 `key_ingredients` | 份量说明 |
| `product_quantity` | `volume_ml` / `weight_g` | 解析净含量 |

**营养数据处理规则：**
从 `nutriments` 对象中提取以下核心字段（优先 `_100g` 后缀版本）：
- `energy-kcal_100g` → 能量 (kcal)
- `proteins_100g` → 蛋白质
- `fat_100g` → 脂肪
- `carbohydrates_100g` → 碳水化合物
- `sugars_100g` → 糖
- `fiber_100g` → 膳食纤维
- `sodium_100g` → 钠
- `salt_100g` → 盐
- `saturated-fat_100g` → 饱和脂肪
- `added-sugars_100g` → 添加糖

**分类标签映射：** 使用已有的 `POPULAR_CATEGORIES` 词表做中英对照。

- [ ] **Step 1: 创建 Mapper 类骨架**

```python
"""OpenFoodFacts 数据映射器

将 OFF API 原始响应转换为 RMFOORM 统一产品格式。

对标 OFF 官方 Product Schema:
https://world.openfoodfacts.org/api/v2
"""

import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 核心营养素字段列表（per 100g）
CORE_NUTRIENTS = [
    "energy-kcal", "proteins", "fat", "carbohydrates",
    "sugars", "fiber", "sodium", "salt", "saturated-fat",
    "added-sugars",
]

# OFF 分类标签 → 中文名称映射（补充 POPULAR_CATEGORIES 中未覆盖的常用分类）
CATEGORY_NAME_MAP: dict[str, str] = {
    # 饮料
    "en:beverages": "饮料",
    "en:soft-drinks": "软饮料",
    "en:juices": "果汁",
    "en:fruit-juices": "果汁",
    "en:tea": "茶饮料",
    "en:coffee": "咖啡饮料",
    "en:energy-drinks": "能量饮料",
    "en:water": "饮用水",
    "en:mineral-water": "矿泉水",
    "en:sparkling-water": "气泡水",
    # 乳制品
    "en:dairies": "乳制品",
    "en:fermented-foods": "发酵食品",
    "en:fermented-milk-products": "发酵乳制品",
    "en:cheeses": "奶酪",
    "en:yogurt": "酸奶",
    "en:plant-based-milk": "植物奶",
    "en:almond-milk": "杏仁奶",
    "en:soy-milk": "豆奶",
    "en:oat-milk": "燕麦奶",
    # 谷物
    "en:breakfast-cereals": "早餐谷物",
    "en:bread": "面包",
    "en:pasta": "意面",
    "en:rice": "米饭",
    # 零食
    "en:snacks": "零食",
    "en:nuts": "坚果",
    "en:seeds": "种子",
    "en:chocolate": "巧克力",
    "en:candy": "糖果",
    "en:ice-cream": "冰淇淋",
    # 蔬果
    "en:fruits": "水果",
    "en:vegetables": "蔬菜",
    "en:dried-fruits": "果干",
    "en:canned-fruits": "罐头水果",
    "en:canned-vegetables": "罐头蔬菜",
    # 肉类
    "en:meat": "肉类",
    "en:poultry": "禽类",
    "en:beef": "牛肉",
    "en:pork": "猪肉",
    "en:sausages": "香肠",
    "en:fish": "鱼类",
    "en:seafood": "海鲜",
    "en:shrimp": "虾",
    # 调味
    "en:condiments": "调味品",
    "en:sauces": "酱料",
    "en:honey": "蜂蜜",
    "en:jam": "果酱",
    # 保健
    "en:dietetic-foods": "保健食品",
    "en:supplements": "营养补充剂",
    "en:vitamins": "维生素",
    "en:probiotics": "益生菌",
    # 特殊
    "en:vegan": "纯素食品",
    "en:organic": "有机食品",
    "en:baby-food": "婴幼儿食品",
    "en:frozen-meals": "冷冻餐",
}


def _strip_en_prefix(tag: str) -> str:
    """去掉 'en:' 前缀"""
    if tag.startswith("en:"):
        return tag[3:]
    return tag


def _parse_quantity(qty_str: str) -> tuple[Optional[float], Optional[str]]:
    """解析 quantity 字符串，返回 (数值, 单位)"""
    if not qty_str:
        return None, None
    m = re.match(r"(\d+(?:\.\d+)?)\s*(ml|g|kg|mg|l|oz|lb|pack|box|can|bottle|piece)?", qty_str.strip(), re.IGNORECASE)
    if m:
        value = float(m.group(1))
        unit = (m.group(2) or "").lower()
        # 标准化单位
        if unit in ("kg",):
            return value * 1000, "g"
        if unit in ("mg",):
            return value / 1000, "g"
        if unit in ("l",):
            return value * 1000, "ml"
        return value, unit or None
    return None, None


class OFFMapper:
    """OpenFoodFacts → RMFOORM 产品数据映射器"""

    def map_product(self, raw: dict[str, Any]) -> Optional[dict[str, Any]]:
        """
        将单个 OFF 产品原始数据映射为 RMFOORM 统一格式。

        Args:
            raw: OFF API 返回的产品字典

        Returns:
            映射后的产品字典，如果输入无效则返回 None
        """
        if not raw or not isinstance(raw, dict):
            return None

        product_code = raw.get("code")
        if not product_code:
            return None

        # ── 产品名称（优先中文） ──
        product_name = (
            raw.get("product_name_zh")
            or raw.get("product_name_en")
            or raw.get("product_name")
            or ""
        )

        # ── 品牌 ──
        brand = raw.get("brands") or "Unknown"

        # ── 分类 ──
        categories_tags = raw.get("categories_tags") or []
        category_cn = self._resolve_category(categories_tags, level=0)
        sub_category_cn = self._resolve_category(categories_tags, level=1)

        # ── 规格 ──
        package_size = raw.get("quantity")
        volume_ml = None
        weight_g = None
        if package_size:
            vol, wt = _parse_quantity(package_size)
            if vol is not None:
                volume_ml = vol
            # 尝试从 product_quantity 获取精确值
        product_quantity = raw.get("product_quantity")
        if product_quantity:
            volume_ml = product_quantity if product_quantity > 100 else None
            weight_g = product_quantity if product_quantity <= 100 else product_quantity

        # ── 完整成分表 ──
        full_ingredients = (
            raw.get("ingredients_text_zh")
            or raw.get("ingredients_text_en")
            or raw.get("ingredients_text")
        )

        # ── 营养成分 ──
        key_ingredients = self._extract_nutriments(raw.get("nutriments", {}))

        # ── 食品安全 ──
        allergens = [
            _strip_en_prefix(t) for t in (raw.get("allergens_tags") or [])
        ]
        additives = [
            _strip_en_prefix(t) for t in (raw.get("additives_tags") or [])
        ]
        traces = [
            _strip_en_prefix(t) for t in (raw.get("traces_tags") or [])
        ]

        # ── 生态评分 ──
        ecoscore_grade = raw.get("ecoscore_grade")

        # ── 图片 ──
        image_urls = self._collect_images(raw)

        # ── 销售渠道 ──
        sales_channels = [
            s.strip() for s in (raw.get("stores") or "").split(",") if s.strip()
        ]

        # ── NOVA 分组 ──
        nova_group = raw.get("nova_group")
        if nova_group:
            key_ingredients["nova_group"] = int(nova_group)

        # ── 营养等级 ──
        nutriscore = raw.get("nutriscore_grade") or raw.get("nutrition_grades")
        if nutriscore:
            key_ingredients["nutrition_grade"] = nutriscore

        # ── 标签 ──
        labels = [
            l.strip() for l in (raw.get("labels") or "").split(",") if l.strip()
        ]
        if labels:
            key_ingredients["labels"] = labels

        # ── 销售地区 ──
        countries = [
            c.strip() for c in (raw.get("countries") or "").split(",") if c.strip()
        ]
        if countries:
            key_ingredients["countries"] = countries

        # ── 份量 ──
        serving_size = raw.get("serving_size")
        if serving_size:
            key_ingredients["serving_size"] = serving_size

        # ── 数据质量 ──
        completeness = raw.get("completeness")
        data_quality = float(completeness) if completeness else 0.5

        return {
            "external_id": str(product_code),
            "sku": str(product_code),
            "brand": brand,
            "product_name": product_name,
            "product_line": None,
            "category": category_cn or None,
            "sub_category": sub_category_cn or None,
            "formulation_type": None,
            "effects": [],
            "target_population": [],
            "full_ingredients": full_ingredients,
            "key_ingredients": key_ingredients,
            "price": None,
            "currency": "CNY",
            "package_size": package_size,
            "volume_ml": volume_ml,
            "weight_g": weight_g,
            "sales_channels": sales_channels,
            "avg_rating": None,
            "review_count": None,
            "monthly_sales": None,
            "image_urls": image_urls,
            "reg_number": None,
            "reg_type": None,
            "approved_region": None,
            "allergens_tags": allergens,
            "additives_tags": additives,
            "ecoscore_grade": ecoscore_grade,
            "traces_tags": traces,
            "contaminants": [],
            "source": "openfoodfacts_api",
            "data_quality": data_quality,
            "crawl_timestamp": None,
            "created_at": None,
            "updated_at": None,
        }

    def map_products(self, raw_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量映射产品列表"""
        results = []
        for raw in raw_list:
            mapped = self.map_product(raw)
            if mapped:
                results.append(mapped)
        return results

    # ── 私有方法 ──

    def _resolve_category(
        self, tags: list[str], level: int = 0
    ) -> Optional[str]:
        """将 OFF 分类标签解析为中文名称"""
        if level >= len(tags):
            return None
        tag = tags[level]
        # 直接匹配
        name = CATEGORY_NAME_MAP.get(tag)
        if name:
            return name
        # 去掉 en: 前缀后匹配
        clean_tag = _strip_en_prefix(tag)
        # 尝试从标签名推断中文（简单启发式）
        return clean_tag.replace("-", " ").title() or None

    def _extract_nutriments(
        self, nutriments: dict[str, Any]
    ) -> dict[str, Any]:
        """从 nutriments 提取核心营养素（per 100g）"""
        result: dict[str, Any] = {"nutrition": {}}
        nutr = nutriments or {}

        for nutrient in CORE_NUTRIENTS:
            # 优先取 _100g 版本
            key_100g = f"{nutrient}_100g"
            value = nutr.get(key_100g)
            if value is None or value == 0:
                value = nutr.get(nutrient)
            if value is not None:
                try:
                    result["nutrition"][nutrient] = float(value)
                except (ValueError, TypeError):
                    pass

        return result

    def _collect_images(self, raw: dict[str, Any]) -> list[str]:
        """收集所有产品图片 URL"""
        images: list[str] = []
        for suffix in ("_front_url", "_ingredients_url", "_nutrition_url", "_packaging_url", "_other_url"):
            url = raw.get(f"image_url{suffix}".replace("_url_url", "_url"))
            # 处理 image_front_url, image_ingredients_url 等
            base_key = f"image{suffix}"
            img_url = raw.get(base_key)
            if img_url:
                images.append(img_url)

        # 也检查 images 嵌套对象
        images_obj = raw.get("images")
        if isinstance(images_obj, dict):
            for img_key, img_val in images_obj.items():
                if isinstance(img_val, dict):
                    url = img_val.get("en") or img_val.get("en-full")
                    if url and url not in images:
                        images.append(url)

        return images[:5]  # 最多返回 5 张图片
```

- [ ] **Step 2: 验证映射器可导入**

运行: `cd backend && python -c "from app.services.data_sources.openfoodfacts.mapper import OFFMapper; print('OK')"`
Expected: `OK`

- [ ] **Step 3: 端到端测试映射**

运行: `cd backend && python -c "
from app.services.data_sources.openfoodfacts.mapper import OFFMapper
mapper = OFFMapper()
raw = {'code': '123', 'product_name': 'Test Product', 'brands': 'Test Brand', 'categories_tags': ['en:dairies', 'en:cheeses'], 'nutriments': {'proteins_100g': 5, 'fat_100g': 10}, 'allergens_tags': ['en:milk'], 'additives_tags': ['en:e202'], 'image_front_url': 'http://example.com/img.jpg'}
result = mapper.map_product(raw)
print('product_name:', result['product_name'])
print('brand:', result['brand'])
print('category:', result['category'])
print('allergens:', result['allergens_tags'])
print('nutrition proteins:', result['key_ingredients']['nutrition'].get('proteins'))
print('SUCCESS')
"`
Expected: 输出各字段正确值 + `SUCCESS`

---

## 任务 4: 修复 `off_api.py` — 条码查询返回格式

**Files:**
- Modify: `backend/app/services/data_sources/off_api.py:76-94`

**Interfaces:**
- Consumes: 无
- Produces: `search_by_barcode` 现在返回完整 API 响应 `{product: {...}, status: ...}` 而非直接取 `data.get("product")`

- [ ] **Step 1: 修复 search_by_barcode 返回值**

将 `off_api.py` 中的 `search_by_barcode` 方法修改为：

```python
def search_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
    """
    按条码查询单个产品

    官方端点: https://world.openfoodfacts.org/api/v2/{product_code}.json
    返回完整响应（包含 product 和 status 字段），由调用方决定如何解析。
    """
    url = f"{self.BASE_URL or 'https://world.openfoodfacts.org'}{self.PRODUCT_ENDPOINT.format(code=barcode)}"

    try:
        response = self._http_client.get(url)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        # 返回完整响应，让调用方决定如何处理
        return data
    except httpx.HTTPError as e:
        logger.warning(f"[OFF] barcode query failed for {barcode}: {e}")
        return None
```

同时需要在 `OFFClient.__init__` 中添加 `BASE_URL` 和 `PRODUCT_ENDPOINT` 属性，或使用硬编码 URL。

- [ ] **Step 2: 验证修复**

运行: `cd backend && python -c "
from app.services.data_sources.off_api import OFFClient
client = OFFClient()
result = client.search_by_barcode('6111246721261')
print('Type:', type(result))
print('Has product key:', 'product' in result if result else False)
print('SUCCESS')
"`

---

## 任务 5: 修复 `openfoodfacts_client.py` — 服务层调用适配

**Files:**
- Modify: `backend/app/services/data_sources/openfoodfacts_client.py:19-21`
- Modify: `backend/app/services/data_sources/openfoodfacts_client.py:130-136`
- Modify: `backend/app/services/data_sources/openfoodfacts_client.py:358`
- Modify: `backend/app/services/data_sources/openfoodfacts_client.py:461`

**Interfaces:**
- Consumes: `OFFMapper` (from Task 3), `OFFConfig` (from Task 2)
- Produces: `OFFDataService` 现在可以正常实例化和调用

- [ ] **Step 1: 修复导入路径**

将第 20-21 行的导入修改为：

```python
from .openfoodfacts.mapper import OFFMapper
from .openfoodfacts.config import OFFConfig
```

- [ ] **Step 2: 修复 `__init__` 中的配置引用**

将 `OFFConfig.FTS_REGCONFIG` 改为正确的访问方式。确认 `OFFConfig` 是 frozen dataclass 且 `FTS_REGCONFIG` 是类属性。

- [ ] **Step 3: 修复 `_realtime_search` 中的 `search_by_keyword` 调用**

`off_api.py` 的 `search_by_keyword` 返回的是完整响应字典（含 `count`, `products`），服务层第 358 行的调用已经是正确的：
```python
products = self.client.search_by_keyword(keyword, page=page, page_size=page_size)
raw_products = products.get("products", [])
```
确认无需修改。

- [ ] **Step 4: 修复 `get_product_by_barcode` 中的调用**

第 461 行调用 `self.client.search_by_barcode(barcode)`，现在它返回完整响应字典。需要适配：

```python
raw = await loop.run_in_executor(None, lambda: self.client.search_by_barcode(barcode))
if raw:
    # 适配新的返回格式
    product_data = raw.get("product") or raw
    mapped = self.mapper.map_product(product_data)
```

- [ ] **Step 5: 端到端验证**

运行: `cd backend && python -c "
from app.services.data_sources.openfoodfacts_client import off_service
print('Service created:', off_service is not None)
print('Mapper:', off_service.mapper is not None)
print('Category count:', off_service.category_count)
print('SUCCESS')
"`
Expected: 所有字段正常输出 + `SUCCESS`

---

## 任务 6: 集成测试 — 验证搜索功能

**Files:**
- Create: `backend/tests/test_off_mapper_integration.py`

**Interfaces:**
- Consumes: `OFFMapper`, `OFFDataService`
- Produces: 确认搜索功能端到端可用

- [ ] **Step 1: 编写集成测试**

```python
"""OpenFoodFacts 映射器和数据服务的集成测试"""

import pytest
from app.services.data_sources.openfoodfacts.mapper import OFFMapper


class TestOFFMapperIntegration:
    """OFFMapper 端到端映射测试"""

    @pytest.fixture
    def mapper(self):
        return OFFMapper()

    def test_map_complete_product(self, mapper):
        """测试完整产品数据的映射"""
        raw = {
            "code": "5000159103625",
            "product_name": "Yaourt Nature",
            "product_name_en": "Natural Yogurt",
            "brands": "Yoplait",
            "categories_tags": ["en:dairies", "en:fermented-milk-products", "en:yogurt"],
            "quantity": "125 g",
            "ingredients_text": "Lait pasteurisé, Ferments lactiques",
            "ingredients_text_en": "Pasteurized milk, Lactic ferments",
            "nutriments": {
                "proteins_100g": 4.0,
                "fat_100g": 3.2,
                "carbohydrates_100g": 4.6,
                "sugars_100g": 4.6,
                "calcium_100g": 120,
            },
            "allergens_tags": ["en:milk"],
            "additives_tags": [],
            "ecoscore_grade": "a",
            "image_front_url": "https://images.openfoodfacts.org/images/products/500/015/910/3625/front_en.123.400.jpg",
            "stores": "Carrefour, Leclerc",
            "nova_group": 3,
            "nutrition_grades": "b",
            "completeness": 0.9,
        }
        result = mapper.map_product(raw)

        assert result is not None
        assert result["sku"] == "5000159103625"
        assert result["product_name"] == "Yaourt Nature"
        assert result["brand"] == "Yoplait"
        assert result["category"] == "乳制品"
        assert result["sub_category"] == "发酵乳制品"
        assert result["allergens_tags"] == ["milk"]
        assert result["additives_tags"] == []
        assert result["ecoscore_grade"] == "a"
        assert "Carrefour" in result["sales_channels"]
        assert result["key_ingredients"]["nutrition"]["proteins"] == 4.0
        assert result["key_ingredients"]["nova_group"] == 3
        assert result["key_ingredients"]["nutrition_grade"] == "b"
        assert result["data_quality"] == 0.9

    def test_map_product_with_chinese_name(self, mapper):
        """测试中文产品名称优先级"""
        raw = {
            "code": "123456",
            "product_name_zh": "胶原蛋白肽口服液",
            "product_name_en": "Collagen Peptide Drink",
            "product_name": "Produit Collagene",
            "brands": "BrandX",
            "categories_tags": [],
            "nutriments": {},
        }
        result = mapper.map_product(raw)
        assert result is not None
        assert result["product_name"] == "胶原蛋白肽口服液"

    def test_map_empty_product_returns_none(self, mapper):
        """测试空产品返回 None"""
        assert mapper.map_product({}) is None
        assert mapper.map_product(None) is None

    def test_parse_quantity_ml(self, mapper):
        """测试容量解析"""
        from app.services.data_sources.openfoodfacts.mapper import _parse_quantity
        value, unit = _parse_quantity("500 ml")
        assert value == 500.0
        assert unit == "ml"

    def test_parse_quantity_kg_to_g(self, mapper):
        """测试千克转克"""
        from app.services.data_sources.openfoodfacts.mapper import _parse_quantity
        value, unit = _parse_quantity("1.5 kg")
        assert value == 1500.0
        assert unit == "g"
```

- [ ] **Step 2: 运行测试**

运行: `cd backend && python -m pytest tests/test_off_mapper_integration.py -v`
Expected: 全部 PASS

- [ ] **Step 3: 启动后端服务验证 API**

运行: `cd backend && uvicorn app.main:create_app --factory --reload --port 8000`

然后测试搜索端点:
```bash
curl -X POST http://localhost:8000/api/v1/databases/openfoodfacts/search \
  -H "Content-Type: application/json" \
  -d '{"query": "collagene", "page": 1, "page_size": 5, "realtime": true}'
```

Expected: 返回 JSON 数组，包含产品数据

---

## 完成标准

- [ ] `OFFMapper` 可以正确映射 OFF API 响应到 RMFOORM 格式
- [ ] `OFFConfig` 提供所有必要的配置常量
- [ ] `OFFDataService` 可以正常实例化（无 ImportError）
- [ ] 所有单元测试通过
- [ ] 后端 `/databases/openfoodfacts/search` 端点可以返回真实数据
- [ ] 前端 `RetailProductSearchPanel` 可以显示搜索结果

---

## 后续工作（Phase 2+3）

Phase 1 完成后，零售产品搜索功能即可正常工作。后续可按需继续：
- Phase 2: 实现零售产品 CRUD API 端点
- Phase 3: 前端组件增强（分页、营养详情面板、收藏对比）
