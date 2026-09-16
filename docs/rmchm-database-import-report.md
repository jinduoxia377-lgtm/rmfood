# RMCHM 数据库导入完成报告

**执行日期**：2026-09-08  
**版本**：v3.11  
**数据库**：PostgreSQL 18.4  
**状态**：✅ 完成

---

## 一、导入结果

| 指标 | 数值 |
|------|------|
| **总药材数** | **714 条** |
| **药食同源标记** | **127 条** |
| 成功率 | **100%** |
| 失败数 | 0 |

---

## 二、数据库结构

### 2.1 主表：rmchm_herbs

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| rmchm_id | VARCHAR(8) | RMCHM唯一标识 |
| rmchm_code | VARCHAR(20) | 编码（RMCHM-XXXXXXXX）|
| name_cn | VARCHAR(200) | 中文名 |
| name_pinyin | VARCHAR(200) | 拼音 |
| name_latin | VARCHAR(300) | 拉丁名 |
| nature_cn | VARCHAR(1000) | 四气 |
| meridians_cn | VARCHAR(1000) | 归经 |
| category_cn | VARCHAR(100) | 分类 |
| is_food_homology | BOOLEAN | 药食同源标记 |
| tcmsp_id | INTEGER | TCMSP ID |
| symmap_id | INTEGER | SymMap ID |
| compounds_count | INTEGER | 化合物数量 |
| targets_count | INTEGER | 靶点数量 |
| diseases_count | INTEGER | 疾病数量 |
| image_path | VARCHAR(500) | 图片路径 |
| data_quality_score | DECIMAL(3,2) | 质量评分 |

### 2.2 关联表

| 表名 | 说明 |
|------|------|
| rmchm_herb_compounds | 药材-化合物关联 |
| rmchm_herb_targets | 药材-靶点关联 |
| rmchm_herb_diseases | 药材-疾病关联 |

### 2.3 索引

- idx_rmchm_name_cn：中文名索引
- idx_rmchm_pinyin：拼音索引
- idx_rmchm_latin：拉丁名索引
- idx_rmchm_homology：药食同源标记索引
- idx_rmchm_quality：质量评分索引

---

## 三、数据验证

### 3.1 药食同源统计

```sql
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN is_food_homology THEN 1 END) as homology
FROM rmchm_herbs;
```

**结果**：
- 总药材数：714
- 药食同源：127（17.8%）

### 3.2 示例数据

| 名称 | 四气 | 归经 | 药食同源 |
|------|------|------|---------|
| 矮地茶 | 辛,微苦,平 | 肺,肝 | 否 |
| 艾叶 | 辛,苦,温,有小毒 | 肝,脾,肾 | 否 |
| 八角茴香 | 辛,温 | 肝,肾,脾,胃 | ✓ |
| 白扁豆 | 甘,微温 | 脾,胃 | ✓ |
| 代代花 | 辛,苦,温 | 肝,胃 | ✓ |

---

## 四、已交付文件

| 文件 | 路径 | 说明 |
|------|------|------|
| Schema | `data/rmchm/rmchm_schema.sql` | PostgreSQL建表脚本 |
| 合并数据 | `data/rmchm/rmchm_merged_herbs_v311.json` | 714条完整药材数据 |
| 图片映射 | `data/rmchm/rmchm_image_mapping_v32.json` | 107条图片映射 |
| 导入脚本 | `backend/scripts/import_rmchm_final.py` | 数据导入脚本 |

---

## 五、下一步任务

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | 小程序开发 | 基于微信官方文档开发 |
| 🟡 中 | TCMSP数据更新 | 获取最新583条数据 |
| 🟢 低 | 补充药理学数据 | 代代花、白扁豆花等 |

---

**导入完成！**
