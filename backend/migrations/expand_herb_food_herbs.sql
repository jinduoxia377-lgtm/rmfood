-- 扩展 herb_food_herbs 表，添加详细字段
ALTER TABLE herb_food_herbs 
ADD COLUMN IF NOT EXISTS latin_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS approval_date DATE,
ADD COLUMN IF NOT EXISTS status VARCHAR(100),
ADD COLUMN IF NOT EXISTS restrictions TEXT[],
ADD COLUMN IF NOT EXISTS usage_forms TEXT[],
ADD COLUMN IF NOT EXISTS max_dosage VARCHAR(100),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_hfh_latin_name ON herb_food_herbs(latin_name);
CREATE INDEX IF NOT EXISTS idx_hfh_category ON herb_food_herbs(category);
CREATE INDEX IF NOT EXISTS idx_hfh_name_cn ON herb_food_herbs(name_cn);
