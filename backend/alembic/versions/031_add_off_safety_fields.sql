-- ============================================================
-- 零售产品 API 审查修复 — 数据库迁移
-- Revision: 031_add_off_safety_fields
-- ============================================================
-- 执行方式:
--   psql -U postgres -d rmfood -f 031_add_off_safety_fields.sql
-- 或:
--   docker exec -i <postgres_container> psql -U <user> -d <dbname> -f 031_add_off_safety_fields.sql
-- ============================================================

BEGIN;

-- 1. 新增 5 个食品安全列
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS allergens_tags TEXT[];
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS additives_tags TEXT[];
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS ecoscore_grade VARCHAR(20);
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS traces_tags TEXT[];
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS contaminants TEXT[];

-- 2. 为过敏原和添加剂数组创建 GIN 索引（支持 && 查询）
CREATE INDEX IF NOT EXISTS gin_rp_allergens ON retail_products USING gin(allergens_tags);
CREATE INDEX IF NOT EXISTS gin_rp_additives ON retail_products USING gin(additives_tags);

COMMIT;
