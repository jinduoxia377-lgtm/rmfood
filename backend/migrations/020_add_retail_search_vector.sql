# 迁移 020：retail_products 增加 search_vector tsvector 列（触发器维护 + GIN 索引）
-- 使零售产品 BM25 全文检索真正生效，不再恒回退 ILIKE。对齐 food_materials 的同名做法
-- （fn_food_materials_search_vector / trg_food_materials_search_vector / GIN 索引）。
-- regconfig 用 'simple'（与后端 OFFConfig.FTS_REGCONFIG 及 food_materials 一致）。
-- 权重：A=product_name/brand  B=category/sub_category
--       C=effects/target_population/full_ingredients  D=formulation_type/key_ingredients
-- 回滚见文件末尾注释。

BEGIN;

-- 1) tsvector 列（普通列 + 触发器维护；to_tsvector 带显式 regconfig 非 IMMUTABLE，
--    不能用 STORED 生成列，故与 food_materials 一致用触发器）
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2) 触发器函数
CREATE OR REPLACE FUNCTION fn_retail_products_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.product_name,'')), 'A')
     || setweight(to_tsvector('simple', coalesce(NEW.brand,'')), 'A')
     || setweight(to_tsvector('simple', coalesce(NEW.category,'')), 'B')
     || setweight(to_tsvector('simple', coalesce(NEW.sub_category,'')), 'B')
     || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.effects,' '),'')), 'C')
     || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.target_population,' '),'')), 'C')
     || setweight(to_tsvector('simple', coalesce(NEW.full_ingredients,'')), 'C')
     || setweight(to_tsvector('simple', coalesce(NEW.formulation_type,'')), 'D')
     || setweight(to_tsvector('simple', coalesce(NEW.key_ingredients::text,'')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) 触发器（任意 INSERT/UPDATE 触发，避免漏更新导致 search_vector 过期）
DROP TRIGGER IF EXISTS trg_retail_products_search_vector ON retail_products;
CREATE TRIGGER trg_retail_products_search_vector
BEFORE INSERT OR UPDATE ON retail_products
FOR EACH ROW EXECUTE FUNCTION fn_retail_products_search_vector();

-- 4) 回填存量行（fire trigger）
UPDATE retail_products SET search_vector = search_vector WHERE id IS NOT NULL;

-- 5) GIN 索引
CREATE INDEX IF NOT EXISTS idx_retail_products_search_vector ON retail_products USING gin (search_vector);

COMMIT;

-- ===== 回滚 =====
-- DROP INDEX IF EXISTS idx_retail_products_search_vector;
-- DROP TRIGGER IF EXISTS trg_retail_products_search_vector ON retail_products;
-- DROP FUNCTION IF EXISTS fn_retail_products_search_vector();
-- ALTER TABLE retail_products DROP COLUMN IF EXISTS search_vector;
