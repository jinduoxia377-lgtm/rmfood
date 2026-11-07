-- 迁移 022：food_materials / retail_products 启用真·中文全文检索
-- （应用侧 jieba 预分词 + 触发器按分词 token 重建 search_vector）
--
-- ── 问题 ─────────────────────────────────────────────────────────
-- 此前 search_vector 由**未分词原文** + regconfig='simple' 构建。
-- 'simple' 不分词，整串中文当一个 token：如 effects="活血化瘀" 存成
-- 单个 token「活血化瘀」，搜「活血」(to_tsquery('simple','活血')) 匹配不到
-- → 中文召回缺失。
-- DB 侧 pg_jieba 扩展不可用（pg_available_extensions 无），故改为
-- **应用侧 jieba 预分词**：新增 search_tokens_{a..d} 存 jieba 分好的
-- 空格分隔 token 串，触发器改用 to_tsvector('simple', tokens) 重建
-- search_vector。分词逻辑统一在 app/services/search/chinese_nlp.py
-- （build_food_search_tokens / build_retail_search_tokens），与查询侧
-- extract_keywords 用同一套 jieba 词典 + TCM_SYNONYMS，保证索引/查询一致。
--
-- ── 设计取舍（与「单列」建议的偏差，已与 Lead 说明）──────────────
-- 用 4 个 token 列（按 A/B/C/D 权重组）而非 1 列：触发器对每组分别
-- setweight，**同时保留分词召回与原有字段权重**（ts_rank 依赖 A/B/C/D）。
-- 单列会把全部 token 压成同一权重 D，静默劣化 name_cn^A 的排序精度。
--
-- ── 非破坏性 ─────────────────────────────────────────────────────
-- 触发器对 search_tokens 全空(NULL/空串)的行走**回退分支**：仍用原文
-- 按权重构建 search_vector（即迁移 020 的旧行为）。因此未回填/未迁移的
-- 应用写入行不会变成不可搜索，只是退化为整词匹配。回填后即走分词分支。
-- search_vector 列本身、GIN 索引均不变。
--
-- 回滚见文件末尾（含迁移前两触发器函数的**原文**，可精确还原）。

BEGIN;

-- ═══ 1) 新增 token 列 ═══════════════════════════════════════════
ALTER TABLE food_materials ADD COLUMN IF NOT EXISTS search_tokens_a text;
ALTER TABLE food_materials ADD COLUMN IF NOT EXISTS search_tokens_b text;
ALTER TABLE food_materials ADD COLUMN IF NOT EXISTS search_tokens_c text;
ALTER TABLE food_materials ADD COLUMN IF NOT EXISTS search_tokens_d text;

ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_tokens_a text;
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_tokens_b text;
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_tokens_c text;
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS search_tokens_d text;

-- ═══ 2) food_materials 触发器函数（分词优先 + 原文回退）═══════
CREATE OR REPLACE FUNCTION fn_food_materials_search_vector() RETURNS trigger AS $$
BEGIN
    IF coalesce(NEW.search_tokens_a,'') <> ''
        OR coalesce(NEW.search_tokens_b,'') <> ''
        OR coalesce(NEW.search_tokens_c,'') <> ''
        OR coalesce(NEW.search_tokens_d,'') <> '' THEN
        -- 应用侧 jieba 预分词路径：token 列已是空格分隔的词，'simple' 直接建索引
        NEW.search_vector :=
            setweight(to_tsvector('simple', coalesce(NEW.search_tokens_a,'')), 'A')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_b,'')), 'B')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_c,'')), 'C')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_d,'')), 'D');
    ELSE
        -- 回退：token 列全空（存量未回填 / 未迁移的应用写入）→ 用原文按权重构建，
        -- 保持迁移 020 旧行为，避免行不可搜索。
        NEW.search_vector :=
            setweight(to_tsvector('simple', coalesce(NEW.name_cn,'')), 'A')
         || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.aliases,' '),'')), 'B')
         || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.effects,' '),'')), 'C')
         || setweight(to_tsvector('simple', coalesce(NEW.indications,'')), 'C')
         || setweight(to_tsvector('simple', coalesce(NEW.category,'')), 'D')
         || setweight(to_tsvector('simple', coalesce(NEW.sub_category,'')), 'D')
         || setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'D');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══ 3) retail_products 触发器函数（分词优先 + 原文回退）═══════
CREATE OR REPLACE FUNCTION fn_retail_products_search_vector() RETURNS trigger AS $$
BEGIN
    IF coalesce(NEW.search_tokens_a,'') <> ''
        OR coalesce(NEW.search_tokens_b,'') <> ''
        OR coalesce(NEW.search_tokens_c,'') <> ''
        OR coalesce(NEW.search_tokens_d,'') <> '' THEN
        NEW.search_vector :=
            setweight(to_tsvector('simple', coalesce(NEW.search_tokens_a,'')), 'A')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_b,'')), 'B')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_c,'')), 'C')
         || setweight(to_tsvector('simple', coalesce(NEW.search_tokens_d,'')), 'D');
    ELSE
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══ 4) 重建触发器（INSERT/UPDATE 触发）═══════════════════════
DROP TRIGGER IF EXISTS trg_food_materials_search_vector ON food_materials;
CREATE TRIGGER trg_food_materials_search_vector
BEFORE INSERT OR UPDATE ON food_materials
FOR EACH ROW EXECUTE FUNCTION fn_food_materials_search_vector();

DROP TRIGGER IF EXISTS trg_retail_products_search_vector ON retail_products;
CREATE TRIGGER trg_retail_products_search_vector
BEFORE INSERT OR UPDATE ON retail_products
FOR EACH ROW EXECUTE FUNCTION fn_retail_products_search_vector();

-- 注：存量行的 search_vector 回填由应用侧脚本 _backfill_search_tokens.py
-- 完成（jieba 分词后 UPDATE token 列 → 触发器自动重建 search_vector）。
-- 本迁移不在此处 UPDATE，避免 plpgsql 无法调用 jieba。

COMMIT;

-- ═════════════════════════════════════════════════════════════════
-- ===== 回滚（精确还原到迁移 020 状态）=====
-- ═════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_food_materials_search_vector ON food_materials;
-- DROP TRIGGER IF EXISTS trg_retail_products_search_vector ON retail_products;
--
-- -- 还原 food_materials 触发器函数（迁移前原文）
-- CREATE OR REPLACE FUNCTION fn_food_materials_search_vector() RETURNS trigger AS $$
-- BEGIN
--     NEW.search_vector :=
--         setweight(to_tsvector('simple', coalesce(NEW.name_cn,'')), 'A')
--      || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.aliases,' '),'')), 'B')
--      || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.effects,' '),'')), 'C')
--      || setweight(to_tsvector('simple', coalesce(NEW.indications,'')), 'C')
--      || setweight(to_tsvector('simple', coalesce(NEW.category,'')), 'D')
--      || setweight(to_tsvector('simple', coalesce(NEW.sub_category,'')), 'D')
--      || setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'D');
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- -- 还原 retail_products 触发器函数（迁移前原文）
-- CREATE OR REPLACE FUNCTION fn_retail_products_search_vector() RETURNS trigger AS $$
-- BEGIN
--     NEW.search_vector :=
--         setweight(to_tsvector('simple', coalesce(NEW.product_name,'')), 'A')
--      || setweight(to_tsvector('simple', coalesce(NEW.brand,'')), 'A')
--      || setweight(to_tsvector('simple', coalesce(NEW.category,'')), 'B')
--      || setweight(to_tsvector('simple', coalesce(NEW.sub_category,'')), 'B')
--      || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.effects,' '),'')), 'C')
--      || setweight(to_tsvector('simple', coalesce(array_to_string(NEW.target_population,' '),'')), 'C')
--      || setweight(to_tsvector('simple', coalesce(NEW.full_ingredients,'')), 'C')
--      || setweight(to_tsvector('simple', coalesce(NEW.formulation_type,'')), 'D')
--      || setweight(to_tsvector('simple', coalesce(NEW.key_ingredients::text,'')), 'D');
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_food_materials_search_vector
-- BEFORE INSERT OR UPDATE ON food_materials
-- FOR EACH ROW EXECUTE FUNCTION fn_food_materials_search_vector();
-- CREATE TRIGGER trg_retail_products_search_vector
-- BEFORE INSERT OR UPDATE ON retail_products
-- FOR EACH ROW EXECUTE FUNCTION fn_retail_products_search_vector();
--
-- -- 回填存量 search_vector（走还原后的原文触发器）
-- UPDATE food_materials SET search_vector = search_vector WHERE id IS NOT NULL;
-- UPDATE retail_products SET search_vector = search_vector WHERE id IS NOT NULL;
--
-- -- 删除新增 token 列
-- ALTER TABLE food_materials DROP COLUMN IF EXISTS search_tokens_a;
-- ALTER TABLE food_materials DROP COLUMN IF EXISTS search_tokens_b;
-- ALTER TABLE food_materials DROP COLUMN IF EXISTS search_tokens_c;
-- ALTER TABLE food_materials DROP COLUMN IF EXISTS search_tokens_d;
-- ALTER TABLE retail_products DROP COLUMN IF EXISTS search_tokens_a;
-- ALTER TABLE retail_products DROP COLUMN IF EXISTS search_tokens_b;
-- ALTER TABLE retail_products DROP COLUMN IF EXISTS search_tokens_c;
-- ALTER TABLE retail_products DROP COLUMN IF EXISTS search_tokens_d;
-- COMMIT;
