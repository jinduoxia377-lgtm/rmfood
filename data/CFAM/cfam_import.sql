-- CFAM 药食同源数据导入脚本
-- 生成时间: 2026-09-10 02:23:13
-- 总数: 106 种

-- ── 创建 CFAM 主表 ──
CREATE TABLE IF NOT EXISTS cfam_herbs (
    id BIGSERIAL PRIMARY KEY,
    name_cn VARCHAR(100) NOT NULL UNIQUE,
    name_latin VARCHAR(200),
    name_en VARCHAR(200),
    nature VARCHAR(50),    -- 四气
    flavor VARCHAR(100),   -- 五味
    category VARCHAR(100), -- 分类
    announcement_id VARCHAR(20), -- 公告ID
    announcement_source VARCHAR(200), -- 公告来源
    usage_restriction TEXT, -- 使用限制
    special_notice TEXT,    -- 特殊提示
    image_path VARCHAR(500), -- 图片路径
    is_food_homology BOOLEAN DEFAULT true,
    data_source VARCHAR(50) DEFAULT 'official_pdf',
    pdf_page INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 创建索引 ──
CREATE INDEX IF NOT EXISTS idx_cfam_name_cn ON cfam_herbs(name_cn);
CREATE INDEX IF NOT EXISTS idx_cfam_announcement ON cfam_herbs(announcement_id);
CREATE INDEX IF NOT EXISTS idx_cfam_homology ON cfam_herbs(is_food_homology);

-- ── 插入药食同源数据 ──
INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('丁香', 'Caryophylli Flos', '温', '辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('八角茴香', 'Anisi Stellati Fructus', '温', '辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('刀豆', 'Callicymbii Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('小茴香', 'Foeniculi Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('小蓟', 'Cirsii Japonici Herba', '凉', '甘、苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('山药', 'Dioscoreae Rhizoma', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p382_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('山楂', 'Crataegi Fructus', '微温', '酸、甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p204_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('马齿苋', 'Portulacae Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('乌梢蛇', 'Zaocys', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('乌梅', 'Mume Fructus', '平', '酸、涩', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('木瓜', 'Chaenomeles Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('火麻仁', 'Hemp Seed', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p246_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('代代花', 'Aurantii Negunti Flower', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('玉竹', 'Polygonati Odorati Rhizoma', '微寒', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p443_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('甘草', 'Glycyrrhizae Radix', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('白芷', 'Angelicae Dahuricae Radix', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('白果', 'Ginkgo Seed', '平', '甘、苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('白扁豆', 'Phaseoli Radiatus Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('白扁豆花', 'Phaseoli Radiati Flos', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('龙眼肉（桂圆）', 'Longan Arillus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p142_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('决明子', 'Cassiae Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p204_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('百合', 'Lilii Bulbus', '微寒', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p402_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('肉豆蔻', 'Myristicae Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('肉桂', 'Cinnami Cortex', '热', '辛、甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('余甘子', 'Phyllanthi Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('佛手', 'Citri Sarcodactylis Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('杏仁（甜、苦）', 'Armeniacae Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('沙棘', 'Hippophae Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('牡蛎', 'Ostrea Shell', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('芡实', 'Euryales Semen', '平', '甘、涩', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p386_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('花椒', 'Zanthoxyli Pericarpium', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('赤小豆', 'Adzukii Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('阿胶', 'Asini Corii Colla', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('鸡内金', 'Galli Garden Extractum', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('麦芽', 'Hordei Fructus Germinatus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('昆布', 'Kelp', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('枣（大枣、酸枣、黑枣）', 'Jujubae Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('罗汉果', 'Luo Guo', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p220_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('郁李仁', 'Prunus Sedens Seed', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('金银花', 'Lonicerae Japonicae Flos', '寒', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p208_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('青果', 'Canarium Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('鱼腥草', 'Houttuyniae Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p223_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('姜（生姜、干姜）', 'Zingiberis Rhizoma', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('枳椇子', 'Hoveniae Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('枸杞子', 'Lycii Fructus', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p505_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('栀子', 'Gardeniae Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('砂仁', 'Amomi Fructus', '温', '辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p165_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('胖大海', 'Sterculiae Lychnophorae Semen', '凉', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p223_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('茯苓', 'Poria', '平', '甘、淡', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p136_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('香橼', 'Citri Reticulatae Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('香薷', 'Elsholtziae Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('桃仁', 'Persicae Semen', '平', '苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('桑叶', 'Mori Folium', '寒', '甘、苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p239_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('桑椹', 'Mori Fructus', '寒', '甘、酸', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p495_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('桔红', 'Citri Reticulatae Pericarpium', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p168_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('桔梗', 'Platycconi Radix', '平', '苦、辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('益智仁', 'Alpiniae Oxyphyllae Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('荷叶', 'Nelumbinis Folium', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p233_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('莱菔子', 'Raphani Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('莲子', 'Nelumbinis Semen', '平', '甘、涩', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p384_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('高良姜', 'Galangal Rhizome', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('淡竹叶', 'Lophatheri Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('淡豆豉', 'Sojae Preparata', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('菊花', 'Chrysanthemi Flos', '微寒', '甘、苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p186_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('菊苣', 'Chicory Root', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('黄芥子', 'Sinapis Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('黄精', 'Polygonati Rhizoma', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p473_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('紫苏', 'Perillae Folium', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p230_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('紫苏籽', 'Perillae Semen', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p230_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('葛根', 'Puerariae Lobatae Radix', '凉', '甘、辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p241_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('黑芝麻', 'Sesami Nigris Semen', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p246_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('黑胡椒', 'Piperis Nigris Fructus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('槐米', 'Sophorae Flos', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('槐花', 'Sophorae Flos', '微寒', '苦', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('蒲公英', 'Taraxaci Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p208_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('蜂蜜', 'Honey', '平', '甘', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('榧子', 'Torreya Seed', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('酸枣仁', 'Ziziphi Spinosae Semen', '平', '甘、酸', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('鲜白茅根', 'Imperatae Rhizoma', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('鲜芦根', 'Phragmitis Rhizoma', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('蝮蛇', 'Agkistrodon', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('橘皮', 'Citri Reticulatae Pericarpium', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('薄荷', 'Menthae Haplocalyx', '凉', '辛', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p227_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('薏苡仁', 'Coicis Semen', '凉', '甘、淡', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p370_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('薤白', 'Allii Macrostemonis Bulbus', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('覆盆子', 'Rubis Fructus', '温', '甘、酸', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('藿香', 'Pogostemonis Herba', '', '', 'ann_2002_51', '卫法监发[2002]51号',
     'None', 'None', 'images/herb_p227_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('当归', 'Angelicae Sinensis Radix', '温', '辛、甘', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'images/herb_p126_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('山柰', 'Kaempferiae Rhizoma', '', '', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('西红花', 'Crocus Stylus', '', '', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('草果', 'Tsaoko Fructus', '', '', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('姜黄', 'Curcumae Longae Rhizoma', '温', '辛、苦', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('荜茇', 'Piperis Longi Fructus', '', '', 'ann_2019_8', '卫健委公告2019年第8号',
     '仅作为香辛料和调味品使用', 'None', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('党参', 'Codonopsis Radix', '平', '甘', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p143_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('肉苁蓉（荒漠）', 'Cistanche Deserticola', '', '', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('铁皮石斛', 'Dendrobii Officinalis Caulis', '', '', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('西洋参', 'American Ginseng', '', '', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p104_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('黄芪', 'Astragali Radix', '微温', '甘', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p126_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('灵芝', 'Ganoderma Lucidum', '平', '甘', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p475_1.jpeg', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('山茱萸', 'Corni Fructus', '微温', '酸、涩', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('天麻', 'Gastrodiae Rhizoma', '平', '甘', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('杜仲叶', 'Eucommiae Folium', '温', '甘', 'ann_2023_9', '卫健委公告2023年第9号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p162_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('地黄', 'Rehmanniae Radix', '', '', 'ann_2024_4', '卫健委公告2024年第4号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('麦冬', 'Ophiopogonis Radix', '微寒', '甘、微苦', 'ann_2024_4', '卫健委公告2024年第4号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p463_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('天冬', 'Asparagi Radix', '寒', '甘、苦', 'ann_2024_4', '卫健委公告2024年第4号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'images/herb_p466_1.png', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();

INSERT INTO cfam_herbs (name_cn, name_latin, nature, flavor, announcement_id, announcement_source, usage_restriction, special_notice, image_path, pdf_page) VALUES
    ('化橘红', 'Citri Grandis Exocarpium', '', '', 'ann_2024_4', '卫健委公告2024年第4号',
     'None', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用', 'None', 8)
    ON CONFLICT (name_cn) DO UPDATE SET
        name_latin = EXCLUDED.name_latin,
        nature = EXCLUDED.nature,
        flavor = EXCLUDED.flavor,
        updated_at = NOW();
