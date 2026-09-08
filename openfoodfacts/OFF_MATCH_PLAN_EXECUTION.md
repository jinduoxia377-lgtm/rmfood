# OFF 数据匹配方案 — 执行完成记录

**日期**: 2026-09-01  
**方案**: 策略 A（仅导入元数据，营养数据按需实时补全）

## 已完成修改

### 后端 (4 个文件)

1. **`mapper.py`** — 增强版数据映射器
   - 新增 `infer_formulation_type()` 函数：从产品名称/标签推断剂型
     - 规则：名称关键词（口服液、powder、capsule、softgel、liquid、bar...）→ 剂型
   - 新增 `infer_effects()` 函数：从标签推导功效/特征标签
     - 映射 20+ 常见标签（no-added-sugar、vegan、gluten-free、organic...）
   - 新增 `NOVA_GROUPS` 中文名映射
   - 新增 `CATEGORY_NAME_MAP` 扩展（~80 个高频分类中英对照）
   - 修复 `dict[int, str]` 类型注解（Python 3.11+ 语法兼容问题）

2. **`off_api.py`** — 增强版 API 客户端
   - `search_by_keyword()` 新增参数：
     - `brands: list[str]` — 多品牌过滤
     - `tags_contains: str` — 标签过滤（如 organic）
     - `min_nutrients: dict` — 营养值过滤
     - `fields` — 完整字段请求（含 nutriments）
   - 新增 `search_multi_brand()` — 多品牌批量搜索
   - 新增 `get_categories_tree()` — 获取分类树（用于前端下拉）

3. **`openfoodfacts_client.py`** — 服务层增强
   - `search_products()` 新增参数：
     - `brands: list[str]` — 多品牌列表过滤
     - `nova_group: Optional[int]` — NOVA 分组过滤
     - `min_completeness: Optional[float]` — 最低数据完整度
     - `sort_by: str` — 排序方式（relevance|name|date|quality|nova）
   - `_db_search()` 支持新过滤条件和排序
   - `_realtime_search()` 支持多品牌和 NOVA 内存过滤

4. **`openfoodfacts.py`** (API 路由) — 请求参数同步
   - `RetailProductSearchRequest` schema 已更新（brands 替代 brand）
   - 端点 `/openfoodfacts/search` 传递新参数

5. **`retail_product.py`** (schema) — 请求模型更新
   - 新增 `nova_group`, `min_completeness`, `sort_by` 字段
   - `brand` → `brands: list[str]`（支持多品牌）

### 前端 (2 个文件)

6. **`searchNew.ts`** — API 接口扩展
   - `OFFSearchRequest` 新增：
     - `brands?: string[]` — 多品牌
     - `nova_group?: number` — NOVA 分组
     - `min_completeness?: number` — 完整度下限
     - `sort_by?: string` — 排序方式

7. **`RetailProductSearchPanel.tsx`** — 搜索面板增强
   - 新增 NOVA 分组筛选下拉（全部/1/2/3/4）
   - 新增数据完整度输入框（0.0-1.0）
   - 新增排序方式下拉（相关度/完整度/名称/日期/NOVA分组）
   - 搜索请求传递新参数

### 已有但未修改的导入脚本

- `import_openfoodfacts_csv.py` — 已有 Tab 分隔符支持 ✅
- `import_off_direct.py` — 已从 REST API 导入（Phase B）
- `quick_off_import.py` — 快速样本导入

## 关键发现

### CSV 源数据问题
- **分隔符**: Tab（\t），211 列，60,041 行 ✅ 已适配
- **营养字段填充率**: ~0%（全部为空）— 符合策略 A 设计
- **品牌覆盖率**: ~80% 有值
- **分类标签**: 约 15-20% 有值
- **无中文数据**: 全部英文产品名

### 现有架构能力
- DB 搜索: FTS (simple 分词) + ILIKE 回退
- OFF 实时 API: search_simple 模式（不含营养数据）
- 三级回退: DB → OFF API → 内置 80 条分类词表

## 下一步建议

1. **验证导入**: 运行 `python scripts/import_openfoodfacts_csv.py --test-limit 50 --dry-run`
2. **检查数据库**: 确认 retail_products 表结构与新字段兼容
3. **API 测试**: `POST /databases/openfoodfacts/search` 验证新参数
4. **前端联调**: 刷新浏览器验证新增筛选器

## 技术备注

- 剂型推断规则覆盖 20+ 关键词模式
- 功效标签映射覆盖 20+ 常见 OFF 标签
- 分类树最多解析两级（第一级→category，第二级→sub_category）
- NOVA 分组过滤：DB 查询通过 `key_ingredients->>'nova_group'` JSONB 提取，实时搜索在内存中过滤
