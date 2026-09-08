-- RMCHM 莱茵中药材数据库 Schema
-- 生成日期: 2026-09-08
-- 合并来源: TCMSP (502条) + SymMap (698条)

CREATE TABLE IF NOT EXISTS rmchm_herbs (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) UNIQUE NOT NULL,
    rmchm_code VARCHAR(20) UNIQUE NOT NULL,

    -- 基础名称
    name_cn VARCHAR(100) NOT NULL,
    name_pinyin VARCHAR(100),
    name_latin VARCHAR(300),
    name_eng VARCHAR(300),

    -- 传统中医属性
    nature_cn VARCHAR(200),
    nature_eng VARCHAR(200),
    meridians_cn VARCHAR(200),
    meridians_eng VARCHAR(200),
    category_cn VARCHAR(100),
    category_eng VARCHAR(100),
    use_part VARCHAR(100),
    alias TEXT,
    function_cn TEXT,
    function_en TEXT,

    -- 现代药理学
    ob_percent DECIMAL(5,2),
    dl_value DECIMAL(5,2),
    is_food_homology BOOLEAN DEFAULT FALSE,
    is_toxic BOOLEAN DEFAULT FALSE,

    -- 关联数据（简化存储，详细数据存储在关联表）
    tcmsp_id INTEGER,
    symmap_id INTEGER,
    compounds_count INTEGER DEFAULT 0,
    targets_count INTEGER DEFAULT 0,
    diseases_count INTEGER DEFAULT 0,

    -- 图片资源
    image_path VARCHAR(500),
    image_source VARCHAR(50),

    -- 元数据
    data_quality_score DECIMAL(3,2),
    source_versions JSONB,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_rmchm_name_cn ON rmchm_herbs(name_cn);
CREATE INDEX idx_rmchm_pinyin ON rmchm_herbs(name_pinyin);
CREATE INDEX idx_rmchm_latin ON rmchm_herbs(name_latin);
CREATE INDEX idx_rmchm_category ON rmchm_herbs(category_cn);
CREATE INDEX idx_rmchm_homology ON rmchm_herbs(is_food_homology);
CREATE INDEX idx_rmchm_image ON rmchm_herbs(image_source) WHERE image_path IS NOT NULL;
CREATE INDEX idx_rmchm_quality ON rmchm_herbs(data_quality_score DESC);

-- 药材-化合物关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_compounds (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    compound_name VARCHAR(200),
    mol_id VARCHAR(50),
    mw DECIMAL(10,2),
    ob DECIMAL(5,2),
    dl DECIMAL(5,2),
    hdon INTEGER,
    hacc INTEGER,
    alogp DECIMAL(5,2),
    caco2 DECIMAL(5,2),
    bbb DECIMAL(5,2),
    tpsa DECIMAL(5,2)
);

-- 药材-靶点关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_targets (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    target_name VARCHAR(200),
    tar_id VARCHAR(50),
    drugbank_id VARCHAR(50),
    kegg VARCHAR(50)
);

-- 药材-疾病关联表
CREATE TABLE IF NOT EXISTS rmchm_herb_diseases (
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) REFERENCES rmchm_herbs(rmchm_id),
    disease_name VARCHAR(200),
    dis_id VARCHAR(50),
    icd9 VARCHAR(50),
    icd10 VARCHAR(50)
);
