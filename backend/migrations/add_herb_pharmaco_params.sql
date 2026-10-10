-- 药材 PK/PD/稳定性 真实参数表（幂等）
-- 数据来源：DB 已有真实分子描述子（tcm_compounds.logp/tpsa/hba/hbd）
--          + TCMSP 实测 ob_percent + extra_knowledge.efficacy_scores
--          + 经典 PK/PD/稳定性推导公式（每项均标注 source，非占位伪造）

-- 1. 药代动力学参数表
CREATE TABLE IF NOT EXISTS tcm_herbs_pk (
    id BIGSERIAL PRIMARY KEY,
    herb_id BIGINT NOT NULL REFERENCES tcm_herbs(id) ON DELETE CASCADE,
    herb_name_cn VARCHAR(100) NOT NULL,
    F FLOAT,
    F_source VARCHAR(80) DEFAULT 'tcm_herbs.ob_percent',
    ka FLOAT,
    Vd FLOAT,
    CL FLOAT,
    t_lag FLOAT,
    derived_from TEXT,
    source VARCHAR(50) DEFAULT 'model_derived',
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT ck_pk_f_range CHECK (F IS NULL OR (F >= 0 AND F <= 1)),
    CONSTRAINT ck_pk_ka_positive CHECK (ka IS NULL OR ka > 0),
    CONSTRAINT ck_pk_vd_positive CHECK (Vd IS NULL OR Vd > 0),
    CONSTRAINT ck_pk_cl_positive CHECK (CL IS NULL OR CL > 0),
    CONSTRAINT ck_pk_tlag_nonneg CHECK (t_lag IS NULL OR t_lag >= 0)
);
CREATE INDEX IF NOT EXISTS ix_tcm_herbs_pk_herb_name ON tcm_herbs_pk(herb_name_cn);
CREATE INDEX IF NOT EXISTS ix_tcm_herbs_pk_herb_id ON tcm_herbs_pk(herb_id);

-- 2. 药效动力学参数表
CREATE TABLE IF NOT EXISTS tcm_herbs_pd (
    id BIGSERIAL PRIMARY KEY,
    herb_id BIGINT NOT NULL REFERENCES tcm_herbs(id) ON DELETE CASCADE,
    herb_name_cn VARCHAR(100) NOT NULL,
    E_max FLOAT,
    E_max_source VARCHAR(80) DEFAULT 'tcm_herbs.extra_knowledge.efficacy_scores',
    EC50 FLOAT,
    Hill FLOAT,
    efficacy_scores JSONB,
    derived_from TEXT,
    source VARCHAR(50) DEFAULT 'model_derived',
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT ck_pd_emax_range CHECK (E_max IS NULL OR (E_max >= 0 AND E_max <= 1)),
    CONSTRAINT ck_pd_ec50_positive CHECK (EC50 IS NULL OR EC50 > 0),
    CONSTRAINT ck_pd_hill_positive CHECK (Hill IS NULL OR Hill > 0)
);
CREATE INDEX IF NOT EXISTS ix_tcm_herbs_pd_herb_name ON tcm_herbs_pd(herb_name_cn);
CREATE INDEX IF NOT EXISTS ix_tcm_herbs_pd_herb_id ON tcm_herbs_pd(herb_id);

-- 3. 稳定性参数表
CREATE TABLE IF NOT EXISTS stability_data (
    id BIGSERIAL PRIMARY KEY,
    herb_id BIGINT NOT NULL REFERENCES tcm_herbs(id) ON DELETE CASCADE,
    herb_name_cn VARCHAR(100) NOT NULL,
    degradation_rate FLOAT,
    shelf_life_months FLOAT,
    logp_max FLOAT,
    logp_avg FLOAT,
    tpsa_avg FLOAT,
    compounds_analyzed INTEGER DEFAULT 0,
    derived_from TEXT,
    source VARCHAR(50) DEFAULT 'model_derived',
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT ck_stab_dr_nonneg CHECK (degradation_rate IS NULL OR degradation_rate >= 0),
    CONSTRAINT ck_stab_shelf_positive CHECK (shelf_life_months IS NULL OR shelf_life_months > 0)
);
CREATE INDEX IF NOT EXISTS ix_stability_herb_name ON stability_data(herb_name_cn);
CREATE INDEX IF NOT EXISTS ix_stability_herb_id ON stability_data(herb_id);

-- 4. 协同系数表（seed_data.py 已定义模型，可能已存在；幂等建表）
CREATE TABLE IF NOT EXISTS synergy_interactions (
    id BIGSERIAL PRIMARY KEY,
    ingredient_a VARCHAR(200) NOT NULL,
    ingredient_b VARCHAR(200) NOT NULL,
    mechanism_type VARCHAR(100) NOT NULL,
    synergy_coefficient FLOAT NOT NULL,
    confidence_score FLOAT DEFAULT 0.8,
    source_reference TEXT,
    research_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT ck_synergy_coef_range CHECK (synergy_coefficient BETWEEN -1 AND 1),
    CONSTRAINT ck_synergy_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1)
);
CREATE INDEX IF NOT EXISTS ix_synergy_a ON synergy_interactions(ingredient_a);
CREATE INDEX IF NOT EXISTS ix_synergy_b ON synergy_interactions(ingredient_b);
