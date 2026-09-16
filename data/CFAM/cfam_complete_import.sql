-- CFAM 药食同源完整数据导入脚本
-- 数据来源: 国家卫健委官方公告汇总 (截止2026年05月24日)
-- 总数: 106 种药材
-- 生成时间: 2026-09-10

-- ============================================
-- 1. 创建 CFAM 主表
-- ============================================
CREATE TABLE IF NOT EXISTS cfam_herbs (
    id BIGSERIAL PRIMARY KEY,
    name_cn VARCHAR(100) NOT NULL UNIQUE,
    name_latin VARCHAR(200),
    nature VARCHAR(50),
    flavor VARCHAR(100),
    announcement_id VARCHAR(20),
    announcement_source VARCHAR(200),
    usage_restriction TEXT,
    special_notice TEXT,
    image_path VARCHAR(500),
    is_food_homology BOOLEAN DEFAULT true,
    pdf_page INTEGER DEFAULT 8,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cfam_name ON cfam_herbs(name_cn);
CREATE INDEX IF NOT EXISTS idx_cfam_announcement ON cfam_herbs(announcement_id);
CREATE INDEX IF NOT EXISTS idx_cfam_homology ON cfam_herbs(is_food_homology);

-- ============================================
-- 2. 插入106种药食同源药材
-- ============================================

-- 2.1 卫法监发[2002]51号 (87种)
INSERT INTO cfam_herbs (name_cn, announcement_id, announcement_source) VALUES
('丁香', 'ann_2002_51', '卫法监发[2002]51号'),
('八角茴香', 'ann_2002_51', '卫法监发[2002]51号'),
('刀豆', 'ann_2002_51', '卫法监发[2002]51号'),
('小茴香', 'ann_2002_51', '卫法监发[2002]51号'),
('小蓟', 'ann_2002_51', '卫法监发[2002]51号'),
('山药', 'ann_2002_51', '卫法监发[2002]51号'),
('山楂', 'ann_2002_51', '卫法监发[2002]51号'),
('马齿苋', 'ann_2002_51', '卫法监发[2002]51号'),
('乌梢蛇', 'ann_2002_51', '卫法监发[2002]51号'),
('乌梅', 'ann_2002_51', '卫法监发[2002]51号'),
('木瓜', 'ann_2002_51', '卫法监发[2002]51号'),
('火麻仁', 'ann_2002_51', '卫法监发[2002]51号'),
('代代花', 'ann_2002_51', '卫法监发[2002]51号'),
('玉竹', 'ann_2002_51', '卫法监发[2002]51号'),
('甘草', 'ann_2002_51', '卫法监发[2002]51号'),
('白芷', 'ann_2002_51', '卫法监发[2002]51号'),
('白果', 'ann_2002_51', '卫法监发[2002]51号'),
('白扁豆', 'ann_2002_51', '卫法监发[2002]51号'),
('白扁豆花', 'ann_2002_51', '卫法监发[2002]51号'),
('龙眼肉（桂圆）', 'ann_2002_51', '卫法监发[2002]51号'),
('决明子', 'ann_2002_51', '卫法监发[2002]51号'),
('百合', 'ann_2002_51', '卫法监发[2002]51号'),
('肉豆蔻', 'ann_2002_51', '卫法监发[2002]51号'),
('肉桂', 'ann_2002_51', '卫法监发[2002]51号'),
('余甘子', 'ann_2002_51', '卫法监发[2002]51号'),
('佛手', 'ann_2002_51', '卫法监发[2002]51号'),
('杏仁（甜、苦）', 'ann_2002_51', '卫法监发[2002]51号'),
('沙棘', 'ann_2002_51', '卫法监发[2002]51号'),
('牡蛎', 'ann_2002_51', '卫法监发[2002]51号'),
('芡实', 'ann_2002_51', '卫法监发[2002]51号'),
('花椒', 'ann_2002_51', '卫法监发[2002]51号'),
('赤小豆', 'ann_2002_51', '卫法监发[2002]51号'),
('阿胶', 'ann_2002_51', '卫法监发[2002]51号'),
('鸡内金', 'ann_2002_51', '卫法监发[2002]51号'),
('麦芽', 'ann_2002_51', '卫法监发[2002]51号'),
('昆布', 'ann_2002_51', '卫法监发[2002]51号'),
('枣（大枣、酸枣、黑枣）', 'ann_2002_51', '卫法监发[2002]51号'),
('罗汉果', 'ann_2002_51', '卫法监发[2002]51号'),
('郁李仁', 'ann_2002_51', '卫法监发[2002]51号'),
('金银花', 'ann_2002_51', '卫法监发[2002]51号'),
('青果', 'ann_2002_51', '卫法监发[2002]51号'),
('鱼腥草', 'ann_2002_51', '卫法监发[2002]51号'),
('姜（生姜、干姜）', 'ann_2002_51', '卫法监发[2002]51号'),
('枳椇子', 'ann_2002_51', '卫法监发[2002]51号'),
('枸杞子', 'ann_2002_51', '卫法监发[2002]51号'),
('栀子', 'ann_2002_51', '卫法监发[2002]51号'),
('砂仁', 'ann_2002_51', '卫法监发[2002]51号'),
('胖大海', 'ann_2002_51', '卫法监发[2002]51号'),
('茯苓', 'ann_2002_51', '卫法监发[2002]51号'),
('香橼', 'ann_2002_51', '卫法监发[2002]51号'),
('香薷', 'ann_2002_51', '卫法监发[2002]51号'),
('桃仁', 'ann_2002_51', '卫法监发[2002]51号'),
('桑叶', 'ann_2002_51', '卫法监发[2002]51号'),
('桑椹', 'ann_2002_51', '卫法监发[2002]51号'),
('桔红', 'ann_2002_51', '卫法监发[2002]51号'),
('桔梗', 'ann_2002_51', '卫法监发[2002]51号'),
('益智仁', 'ann_2002_51', '卫法监发[2002]51号'),
('荷叶', 'ann_2002_51', '卫法监发[2002]51号'),
('莱菔子', 'ann_2002_51', '卫法监发[2002]51号'),
('莲子', 'ann_2002_51', '卫法监发[2002]51号'),
('高良姜', 'ann_2002_51', '卫法监发[2002]51号'),
('淡竹叶', 'ann_2002_51', '卫法监发[2002]51号'),
('淡豆豉', 'ann_2002_51', '卫法监发[2002]51号'),
('菊花', 'ann_2002_51', '卫法监发[2002]51号'),
('菊苣', 'ann_2002_51', '卫法监发[2002]51号'),
('黄芥子', 'ann_2002_51', '卫法监发[2002]51号'),
('黄精', 'ann_2002_51', '卫法监发[2002]51号'),
('紫苏', 'ann_2002_51', '卫法监发[2002]51号'),
('紫苏籽', 'ann_2002_51', '卫法监发[2002]51号'),
('葛根', 'ann_2002_51', '卫法监发[2002]51号'),
('黑芝麻', 'ann_2002_51', '卫法监发[2002]51号'),
('黑胡椒', 'ann_2002_51', '卫法监发[2002]51号'),
('槐米', 'ann_2002_51', '卫法监发[2002]51号'),
('槐花', 'ann_2002_51', '卫法监发[2002]51号'),
('蒲公英', 'ann_2002_51', '卫法监发[2002]51号'),
('蜂蜜', 'ann_2002_51', '卫法监发[2002]51号'),
('榧子', 'ann_2002_51', '卫法监发[2002]51号'),
('酸枣仁', 'ann_2002_51', '卫法监发[2002]51号'),
('鲜白茅根', 'ann_2002_51', '卫法监发[2002]51号'),
('鲜芦根', 'ann_2002_51', '卫法监发[2002]51号'),
('蝮蛇', 'ann_2002_51', '卫法监发[2002]51号'),
('橘皮', 'ann_2002_51', '卫法监发[2002]51号'),
('薄荷', 'ann_2002_51', '卫法监发[2002]51号'),
('薏苡仁', 'ann_2002_51', '卫法监发[2002]51号'),
('薤白', 'ann_2002_51', '卫法监发[2002]51号'),
('覆盆子', 'ann_2002_51', '卫法监发[2002]51号'),
('藿香', 'ann_2002_51', '卫法监发[2002]51号')
ON CONFLICT (name_cn) DO UPDATE SET updated_at = NOW();

-- 2.2 卫健委公告2019年第8号 (6种) - 仅作为香辛料和调味品使用
INSERT INTO cfam_herbs (name_cn, announcement_id, announcement_source, usage_restriction) VALUES
('当归', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用'),
('山柰', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用'),
('西红花', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用'),
('草果', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用'),
('姜黄', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用'),
('荜茇', 'ann_2019_8', '卫健委公告2019年第8号', '仅作为香辛料和调味品使用')
ON CONFLICT (name_cn) DO UPDATE SET updated_at = NOW();

-- 2.3 卫健委公告2023年第9号 (9种)
INSERT INTO cfam_herbs (name_cn, announcement_id, announcement_source, special_notice) VALUES
('党参', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('肉苁蓉（荒漠）', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('铁皮石斛', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('西洋参', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('黄芪', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('灵芝', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('山茱萸', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('天麻', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('杜仲叶', 'ann_2023_9', '卫健委公告2023年第9号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用')
ON CONFLICT (name_cn) DO UPDATE SET updated_at = NOW();

-- 2.4 卫健委公告2024年第4号 (4种)
INSERT INTO cfam_herbs (name_cn, announcement_id, announcement_source, special_notice) VALUES
('地黄', 'ann_2024_4', '卫健委公告2024年第4号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('麦冬', 'ann_2024_4', '卫健委公告2024年第4号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('天冬', 'ann_2024_4', '卫健委公告2024年第4号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用'),
('化橘红', 'ann_2024_4', '卫健委公告2024年第4号', '建议按照传统方式适量食用，孕妇、哺乳期妇女及婴幼儿等特殊人群不推荐食用')
ON CONFLICT (name_cn) DO UPDATE SET updated_at = NOW();

-- ============================================
-- 3. 更新拉丁名和四气五味属性
-- ============================================
UPDATE cfam_herbs SET
    name_latin = CASE name_cn
        WHEN '丁香' THEN 'Caryophylli Flos'
        WHEN '八角茴香' THEN 'Anisi Stellati Fructus'
        WHEN '刀豆' THEN 'Canavaliae Semen'
        WHEN '小茴香' THEN 'Foeniculi Fructus'
        WHEN '小蓟' THEN 'Cirsii Japonici Herba'
        WHEN '山药' THEN 'Dioscoreae Rhizoma'
        WHEN '山楂' THEN 'Crataegi Fructus'
        WHEN '马齿苋' THEN 'Portulacae Herba'
        WHEN '乌梢蛇' THEN 'Zaocys'
        WHEN '乌梅' THEN 'Mume Fructus'
        WHEN '木瓜' THEN 'Chaenomeles Fructus'
        WHEN '火麻仁' THEN 'Hemp Seed'
        WHEN '代代花' THEN 'Aurantii Negunti Flos'
        WHEN '玉竹' THEN 'Polygonati Odorati Rhizoma'
        WHEN '甘草' THEN 'Glycyrrhizae Radix'
        WHEN '白芷' THEN 'Angelicae Dahuricae Radix'
        WHEN '白果' THEN 'Ginkgo Seed'
        WHEN '白扁豆' THEN 'Phaseoli Radiatus Semen'
        WHEN '白扁豆花' THEN 'Phaseoli Radiati Flos'
        WHEN '龙眼肉（桂圆）' THEN 'Longan Arillus'
        WHEN '决明子' THEN 'Cassiae Semen'
        WHEN '百合' THEN 'Lilii Bulbus'
        WHEN '肉豆蔻' THEN 'Myristicae Semen'
        WHEN '肉桂' THEN 'Cinnami Cortex'
        WHEN '余甘子' THEN 'Phyllanthi Fructus'
        WHEN '佛手' THEN 'Citri Sarcodactylis Fructus'
        WHEN '杏仁（甜、苦）' THEN 'Armeniacae Semen'
        WHEN '沙棘' THEN 'Hippophae Fructus'
        WHEN '牡蛎' THEN 'Ostrea'
        WHEN '芡实' THEN 'Euryales Semen'
        WHEN '花椒' THEN 'Zanthoxyli Pericarpium'
        WHEN '赤小豆' THEN 'Adzukii Semen'
        WHEN '阿胶' THEN 'Asini Corii Colla'
        WHEN '鸡内金' THEN 'Galli Garden Extractum'
        WHEN '麦芽' THEN 'Hordei Fructus Germinatus'
        WHEN '昆布' THEN 'Kelp'
        WHEN '枣（大枣、酸枣、黑枣）' THEN 'Jujubae Fructus'
        WHEN '罗汉果' THEN 'Luo Guo'
        WHEN '郁李仁' THEN 'Prunus Sedens Seed'
        WHEN '金银花' THEN 'Lonicerae Japonicae Flos'
        WHEN '青果' THEN 'Canarium Fructus'
        WHEN '鱼腥草' THEN 'Houttuyniae Herba'
        WHEN '姜（生姜、干姜）' THEN 'Zingiberis Rhizoma'
        WHEN '枳椇子' THEN 'Hoveniae Semen'
        WHEN '枸杞子' THEN 'Lycii Fructus'
        WHEN '栀子' THEN 'Gardeniae Fructus'
        WHEN '砂仁' THEN 'Amomi Fructus'
        WHEN '胖大海' THEN 'Sterculiae Lychnophorae Semen'
        WHEN '茯苓' THEN 'Poria'
        WHEN '香橼' THEN 'Citri Reticulatae Fructus'
        WHEN '香薷' THEN 'Elsholtziae Herba'
        WHEN '桃仁' THEN 'Persicae Semen'
        WHEN '桑叶' THEN 'Mori Folium'
        WHEN '桑椹' THEN 'Mori Fructus'
        WHEN '桔红' THEN 'Citri Reticulatae Pericarpium'
        WHEN '桔梗' THEN 'Platycconi Radix'
        WHEN '益智仁' THEN 'Alpiniae Oxyphyllae Fructus'
        WHEN '荷叶' THEN 'Nelumbinis Folium'
        WHEN '莱菔子' THEN 'Raphani Semen'
        WHEN '莲子' THEN 'Nelumbinis Semen'
        WHEN '高良姜' THEN 'Galangal Rhizome'
        WHEN '淡竹叶' THEN 'Lophatheri Herba'
        WHEN '淡豆豉' THEN 'Sojae Preparata'
        WHEN '菊花' THEN 'Chrysanthemi Flos'
        WHEN '菊苣' THEN 'Cichorii Radix'
        WHEN '黄芥子' THEN 'Sinapis Semen'
        WHEN '黄精' THEN 'Polygonati Rhizoma'
        WHEN '紫苏' THEN 'Perillae Folium'
        WHEN '紫苏籽' THEN 'Perillae Semen'
        WHEN '葛根' THEN 'Puerariae Lobatae Radix'
        WHEN '黑芝麻' THEN 'Sesami Nigris Semen'
        WHEN '黑胡椒' THEN 'Piperis Nigris Fructus'
        WHEN '槐米' THEN 'Sophorae Flos'
        WHEN '槐花' THEN 'Sophorae Flos'
        WHEN '蒲公英' THEN 'Taraxaci Herba'
        WHEN '蜂蜜' THEN 'Mel'
        WHEN '榧子' THEN 'Torreya Seed'
        WHEN '酸枣仁' THEN 'Ziziphi Spinosae Semen'
        WHEN '鲜白茅根' THEN 'Imperatae Rhizoma'
        WHEN '鲜芦根' THEN 'Phragmitis Rhizoma'
        WHEN '蝮蛇' THEN 'Agkistrodon'
        WHEN '橘皮' THEN 'Citri Reticulatae Pericarpium'
        WHEN '薄荷' THEN 'Menthae Haplocalyx'
        WHEN '薏苡仁' THEN 'Coicis Semen'
        WHEN '薤白' THEN 'Allii Macrostemonis Bulbus'
        WHEN '覆盆子' THEN 'Rubis Fructus'
        WHEN '藿香' THEN 'Pogostemonis Herba'
        WHEN '当归' THEN 'Angelicae Sinensis Radix'
        WHEN '山柰' THEN 'Kaempferiae Rhizoma'
        WHEN '西红花' THEN 'Crocus Stylus'
        WHEN '草果' THEN 'Tsaoko Fructus'
        WHEN '姜黄' THEN 'Curcumae Longae Rhizoma'
        WHEN '荜茇' THEN 'Piperis Longi Fructus'
        WHEN '党参' THEN 'Codonopsis Radix'
        WHEN '肉苁蓉（荒漠）' THEN 'Cistanche Deserticola'
        WHEN '铁皮石斛' THEN 'Dendrobii Officinalis Caulis'
        WHEN '西洋参' THEN 'American Ginseng'
        WHEN '黄芪' THEN 'Astragali Radix'
        WHEN '灵芝' THEN 'Ganoderma Lucidum'
        WHEN '山茱萸' THEN 'Corni Fructus'
        WHEN '天麻' THEN 'Gastrodiae Rhizoma'
        WHEN '杜仲叶' THEN 'Eucommiae Folium'
        WHEN '地黄' THEN 'Rehmanniae Radix'
        WHEN '麦冬' THEN 'Ophiopogonis Radix'
        WHEN '天冬' THEN 'Asparagi Radix'
        WHEN '化橘红' THEN 'Citri Grandis Exocarpium'
        ELSE name_latin
    END,
    nature = CASE name_cn
        WHEN '丁香' THEN '温' WHEN '八角茴香' THEN '温' WHEN '小茴香' THEN '温'
        WHEN '山药' THEN '平' WHEN '山楂' THEN '微温' WHEN '乌梅' THEN '平'
        WHEN '木瓜' THEN '温' WHEN '火麻仁' THEN '平' WHEN '玉竹' THEN '微寒'
        WHEN '甘草' THEN '平' WHEN '白芷' THEN '温' WHEN '白果' THEN '平'
        WHEN '白扁豆' THEN '微温' WHEN '龙眼肉（桂圆）' THEN '温'
        WHEN '决明子' THEN '微寒' WHEN '百合' THEN '微寒'
        WHEN '肉豆蔻' THEN '温' WHEN '肉桂' THEN '热' WHEN '余甘子' THEN '凉'
        WHEN '佛手' THEN '温' WHEN '杏仁（甜、苦）' THEN '温'
        WHEN '沙棘' THEN '温' WHEN '牡蛎' THEN '微寒'
        WHEN '芡实' THEN '平' WHEN '花椒' THEN '热' WHEN '赤小豆' THEN '平'
        WHEN '阿胶' THEN '平' WHEN '鸡内金' THEN '平' WHEN '麦芽' THEN '温'
        WHEN '昆布' THEN '寒' WHEN '枣（大枣、酸枣、黑枣）' THEN '温'
        WHEN '罗汉果' THEN '凉' WHEN '郁李仁' THEN '平'
        WHEN '金银花' THEN '寒' WHEN '青果' THEN '凉' WHEN '鱼腥草' THEN '微寒'
        WHEN '姜（生姜、干姜）' THEN '温' WHEN '枳椇子' THEN '平'
        WHEN '枸杞子' THEN '平' WHEN '栀子' THEN '寒' WHEN '砂仁' THEN '温'
        WHEN '胖大海' THEN '凉' WHEN '茯苓' THEN '平'
        WHEN '香橼' THEN '温' WHEN '香薷' THEN '微温'
        WHEN '桃仁' THEN '平' WHEN '桑叶' THEN '寒' WHEN '桑椹' THEN '寒'
        WHEN '桔红' THEN '温' WHEN '桔梗' THEN '平'
        WHEN '益智仁' THEN '温' WHEN '荷叶' THEN '平'
        WHEN '莱菔子' THEN '平' WHEN '莲子' THEN '平'
        WHEN '高良姜' THEN '热' WHEN '淡竹叶' THEN '寒'
        WHEN '淡豆豉' THEN '凉' WHEN '菊花' THEN '微寒'
        WHEN '菊苣' THEN '寒' WHEN '黄芥子' THEN '温'
        WHEN '黄精' THEN '平' WHEN '紫苏' THEN '温'
        WHEN '紫苏籽' THEN '温' WHEN '葛根' THEN '凉'
        WHEN '黑芝麻' THEN '平' WHEN '黑胡椒' THEN '热'
        WHEN '槐米' THEN '凉' WHEN '槐花' THEN '凉'
        WHEN '蒲公英' THEN '寒' WHEN '蜂蜜' THEN '平'
        WHEN '榧子' THEN '平' WHEN '酸枣仁' THEN '平'
        WHEN '鲜白茅根' THEN '寒' WHEN '鲜芦根' THEN '寒'
        WHEN '蝮蛇' THEN '温' WHEN '橘皮' THEN '温'
        WHEN '薄荷' THEN '凉' WHEN '薏苡仁' THEN '凉'
        WHEN '薤白' THEN '温' WHEN '覆盆子' THEN '温'
        WHEN '藿香' THEN '微温'
        WHEN '当归' THEN '温' WHEN '山柰' THEN '温'
        WHEN '西红花' THEN '寒' WHEN '草果' THEN '温'
        WHEN '姜黄' THEN '温' WHEN '荜茇' THEN '热'
        WHEN '党参' THEN '平' WHEN '肉苁蓉（荒漠）' THEN '温'
        WHEN '铁皮石斛' THEN '微寒' WHEN '西洋参' THEN '凉'
        WHEN '黄芪' THEN '微温' WHEN '灵芝' THEN '平'
        WHEN '山茱萸' THEN '微温' WHEN '天麻' THEN '平'
        WHEN '杜仲叶' THEN '温'
        WHEN '地黄' THEN '寒' WHEN '麦冬' THEN '微寒'
        WHEN '天冬' THEN '寒' WHEN '化橘红' THEN '温'
        ELSE nature
    END,
    flavor = CASE name_cn
        WHEN '丁香' THEN '辛' WHEN '八角茴香' THEN '辛' WHEN '小茴香' THEN '辛'
        WHEN '山药' THEN '甘' WHEN '山楂' THEN '酸、甘' WHEN '乌梅' THEN '酸、涩'
        WHEN '木瓜' THEN '酸' WHEN '火麻仁' THEN '甘' WHEN '玉竹' THEN '甘'
        WHEN '甘草' THEN '甘' WHEN '白芷' THEN '辛' WHEN '白果' THEN '甘、苦'
        WHEN '白扁豆' THEN '甘' WHEN '龙眼肉（桂圆）' THEN '甘'
        WHEN '决明子' THEN '甘、苦' WHEN '百合' THEN '甘'
        WHEN '肉豆蔻' THEN '辛' WHEN '肉桂' THEN '辛、甘' WHEN '余甘子' THEN '甘、酸'
        WHEN '佛手' THEN '辛、苦' WHEN '杏仁（甜、苦）' THEN '苦'
        WHEN '沙棘' THEN '酸' WHEN '牡蛎' THEN '咸'
        WHEN '芡实' THEN '甘、涩' WHEN '花椒' THEN '辛' WHEN '赤小豆' THEN '甘、酸'
        WHEN '阿胶' THEN '甘' WHEN '鸡内金' THEN '甘' WHEN '麦芽' THEN '甘'
        WHEN '昆布' THEN '咸' WHEN '枣（大枣、酸枣、黑枣）' THEN '甘'
        WHEN '罗汉果' THEN '甘' WHEN '郁李仁' THEN '甘'
        WHEN '金银花' THEN '甘' WHEN '青果' THEN '甘、酸' WHEN '鱼腥草' THEN '辛'
        WHEN '姜（生姜、干姜）' THEN '辛' WHEN '枳椇子' THEN '甘'
        WHEN '枸杞子' THEN '甘' WHEN '栀子' THEN '苦' WHEN '砂仁' THEN '辛'
        WHEN '胖大海' THEN '甘' WHEN '茯苓' THEN '甘、淡'
        WHEN '香橼' THEN '辛、苦' WHEN '香薷' THEN '辛'
        WHEN '桃仁' THEN '苦' WHEN '桑叶' THEN '甘、苦' WHEN '桑椹' THEN '甘、酸'
        WHEN '桔红' THEN '辛、苦' WHEN '桔梗' THEN '苦、辛'
        WHEN '益智仁' THEN '辛' WHEN '荷叶' THEN '苦'
        WHEN '莱菔子' THEN '辛、甘' WHEN '莲子' THEN '甘、涩'
        WHEN '高良姜' THEN '辛' WHEN '淡竹叶' THEN '甘、淡'
        WHEN '淡豆豉' THEN '辛、甘' WHEN '菊花' THEN '甘、苦'
        WHEN '菊苣' THEN '苦' WHEN '黄芥子' THEN '辛'
        WHEN '黄精' THEN '甘' WHEN '紫苏' THEN '辛'
        WHEN '紫苏籽' THEN '辛' WHEN '葛根' THEN '甘、辛'
        WHEN '黑芝麻' THEN '甘' WHEN '黑胡椒' THEN '辛'
        WHEN '槐米' THEN '苦' WHEN '槐花' THEN '苦'
        WHEN '蒲公英' THEN '苦' WHEN '蜂蜜' THEN '甘'
        WHEN '榧子' THEN '甘' WHEN '酸枣仁' THEN '甘、酸'
        WHEN '鲜白茅根' THEN '甘' WHEN '鲜芦根' THEN '甘'
        WHEN '蝮蛇' THEN '甘' WHEN '橘皮' THEN '辛、苦'
        WHEN '薄荷' THEN '辛' WHEN '薏苡仁' THEN '甘、淡'
        WHEN '薤白' THEN '辛' WHEN '覆盆子' THEN '甘、酸'
        WHEN '藿香' THEN '辛'
        WHEN '当归' THEN '辛、甘' WHEN '山柰' THEN '辛'
        WHEN '西红花' THEN '甘' WHEN '草果' THEN '辛'
        WHEN '姜黄' THEN '辛、苦' WHEN '荜茇' THEN '辛'
        WHEN '党参' THEN '甘' WHEN '肉苁蓉（荒漠）' THEN '甘'
        WHEN '铁皮石斛' THEN '甘' WHEN '西洋参' THEN '甘、微苦'
        WHEN '黄芪' THEN '甘' WHEN '灵芝' THEN '甘'
        WHEN '山茱萸' THEN '酸、涩' WHEN '天麻' THEN '甘'
        WHEN '杜仲叶' THEN '甘'
        WHEN '地黄' THEN '甘' WHEN '麦冬' THEN '甘、微苦'
        WHEN '天冬' THEN '甘、苦' WHEN '化橘红' THEN '辛、苦'
        ELSE flavor
    END
WHERE nature IS NULL OR flavor IS NULL;

-- ============================================
-- 4. 与现有数据库关联
-- ============================================
-- 将 cfam_herbs 与 herb_food_herbs 建立关联
-- 通过 name_cn 匹配

-- 更新 cfam_herbs 中的数据库关联ID
UPDATE cfam_herbs ch
SET source_id = hfh.id
FROM herb_food_herbs hfh
WHERE ch.name_cn = hfh.name_cn
  AND ch.source_id IS NULL;

-- ============================================
-- 5. 验证数据完整性
-- ============================================
-- 统计各公告来源数量
SELECT
    announcement_id,
    announcement_source,
    COUNT(*) as herb_count,
    SUM(CASE WHEN nature IS NOT NULL THEN 1 ELSE 0 END) as with_nature,
    SUM(CASE WHEN flavor IS NOT NULL THEN 1 ELSE 0 END) as with_flavor,
    SUM(CASE WHEN name_latin IS NOT NULL THEN 1 ELSE 0 END) as with_latin
FROM cfam_herbs
GROUP BY announcement_id, announcement_source
ORDER BY announcement_id;

-- 总记录数验证
SELECT COUNT(*) as total_herbs FROM cfam_herbs;
