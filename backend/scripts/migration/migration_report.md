# SQLite → PostgreSQL 数据迁移报告

> 生成时间: 2026-06-03 14:30:06

## 迁移概览

| 项目 | 值 |
|------|-----|
| 源数据库 | `d:\RMFOOD配方平台\backend\rmfood.db` |
| 目标数据库 | `postgresql://localhost:5432/rmfood_platform` |
| 总表数 | 65 |
| 成功迁移 | 65 |
| 源总行数 | 8,663 |
| 目标总行数 | 8,663 |
| 总耗时 | 0.00 秒 |
| 错误数量 | 0 |

## 各表详情

| 表名 | 源行数 | 目标行数 | 状态 |
|------|--------|----------|------|
| ai_suggestions | 0 | 0 | ✅ completed |
| attachments | 0 | 0 | ✅ completed |
| audit_logs | 0 | 0 | ✅ completed |
| bioactive_peptides | 7,540 | 7540 | ✅ completed |
| categories | 0 | 0 | ✅ completed |
| change_events | 2 | 2 | ✅ completed |
| chat_messages | 0 | 0 | ✅ completed |
| chat_sessions | 0 | 0 | ✅ completed |
| comment_likes | 0 | 0 | ✅ completed |
| comments | 0 | 0 | ✅ completed |
| compatibility_reports | 0 | 0 | ✅ completed |
| data_snapshots | 0 | 0 | ✅ completed |
| data_source_health | 0 | 0 | ✅ completed |
| effect_predictions | 0 | 0 | ✅ completed |
| experiment_data | 0 | 0 | ✅ completed |
| experiments | 0 | 0 | ✅ completed |
| formula_categories | 0 | 0 | ✅ completed |
| formula_generation_history | 0 | 0 | ✅ completed |
| formula_ingredients | 0 | 0 | ✅ completed |
| formula_peptides | 0 | 0 | ✅ completed |
| formula_tags | 0 | 0 | ✅ completed |
| formula_versions | 0 | 0 | ✅ completed |
| formulas | 0 | 0 | ✅ completed |
| ingredients | 0 | 0 | ✅ completed |
| kg_edges | 0 | 0 | ✅ completed |
| kg_nodes | 0 | 0 | ✅ completed |
| knowledge_graph_nodes | 0 | 0 | ✅ completed |
| lab_validation_data | 0 | 0 | ✅ completed |
| notifications | 0 | 0 | ✅ completed |
| optimization_results | 0 | 0 | ✅ completed |
| peptide_activities | 0 | 0 | ✅ completed |
| peptide_analyses | 0 | 0 | ✅ completed |
| peptide_analysis_details | 0 | 0 | ✅ completed |
| peptide_design_candidates | 0 | 0 | ✅ completed |
| peptide_designs | 0 | 0 | ✅ completed |
| peptide_enzyme_links | 0 | 0 | ✅ completed |
| peptide_enzymes | 0 | 0 | ✅ completed |
| peptide_source_proteins | 0 | 0 | ✅ completed |
| peptides | 0 | 0 | ✅ completed |
| prompt_templates | 0 | 0 | ✅ completed |
| prompt_versions | 0 | 0 | ✅ completed |
| safety_alert_logs | 0 | 0 | ✅ completed |
| safety_threshold_change_log | 0 | 0 | ✅ completed |
| sync_logs | 0 | 0 | ✅ completed |
| synergy_records | 0 | 0 | ✅ completed |
| tags | 0 | 0 | ✅ completed |
| tcm_compound_targets | 0 | 0 | ✅ completed |
| tcm_compounds | 0 | 0 | ✅ completed |
| tcm_diseases | 0 | 0 | ✅ completed |
| tcm_herb_compounds | 0 | 0 | ✅ completed |
| tcm_herbs | 47 | 47 | ✅ completed |
| tcm_target_diseases | 0 | 0 | ✅ completed |
| tcm_targets | 0 | 0 | ✅ completed |
| team_members | 0 | 0 | ✅ completed |
| teams | 0 | 0 | ✅ completed |
| term_categories | 26 | 26 | ✅ completed |
| term_normalization_rules | 9 | 9 | ✅ completed |
| term_statistics | 0 | 0 | ✅ completed |
| term_validations | 12 | 12 | ✅ completed |
| term_variants | 0 | 0 | ✅ completed |
| terms | 1,026 | 1026 | ✅ completed |
| user_devices | 0 | 0 | ✅ completed |
| users | 1 | 1 | ✅ completed |
| workflow_tasks | 0 | 0 | ✅ completed |
| workflows | 0 | 0 | ✅ completed |

## 验证结果

- ✅ **ai_suggestions**: 
  - 行数: 源=0, 目标=0

- ✅ **attachments**: 
  - 行数: 源=0, 目标=0

- ✅ **audit_logs**: 
  - 行数: 源=0, 目标=0

- ❌ **bioactive_peptides**: 
  - 行数: 源=7,540, 目标=7,540
  - 样本 ID=2831, 列 created_at 不匹配: 源='2026-06-03 05:35:59.822085', 目标=datetime.datetime(2026, 6, 3, 5, 35, 59, 822085, t
  - 样本 ID=1540, 列 created_at 不匹配: 源='2026-06-03 05:35:59.821164', 目标=datetime.datetime(2026, 6, 3, 5, 35, 59, 821164, t
  - 样本 ID=2478, 列 created_at 不匹配: 源='2026-06-03 05:35:59.821836', 目标=datetime.datetime(2026, 6, 3, 5, 35, 59, 821836, t
  - 样本 ID=1318, 列 created_at 不匹配: 源='2026-06-03 05:35:59.821008', 目标=datetime.datetime(2026, 6, 3, 5, 35, 59, 821008, t
  - 样本 ID=3562, 列 created_at 不匹配: 源='2026-06-03 05:35:59.822618', 目标=datetime.datetime(2026, 6, 3, 5, 35, 59, 822618, t
  - activity_type 分布一致 (10 个类别)

- ✅ **categories**: 
  - 行数: 源=0, 目标=0

- ❌ **change_events**: 
  - 行数: 源=2, 目标=2
  - 样本 ID=2, 列 created_at 不匹配: 源='2026-06-03 03:00:54.768640', 目标=datetime.datetime(2026, 6, 3, 3, 0, 54, 768640, tz
  - 样本 ID=1, 列 created_at 不匹配: 源='2026-06-03 03:00:46.628980', 目标=datetime.datetime(2026, 6, 3, 3, 0, 46, 628980, tz

- ✅ **chat_messages**: 
  - 行数: 源=0, 目标=0

- ✅ **chat_sessions**: 
  - 行数: 源=0, 目标=0

- ✅ **comment_likes**: 
  - 行数: 源=0, 目标=0

- ✅ **comments**: 
  - 行数: 源=0, 目标=0

- ✅ **compatibility_reports**: 
  - 行数: 源=0, 目标=0

- ✅ **data_snapshots**: 
  - 行数: 源=0, 目标=0

- ✅ **data_source_health**: 
  - 行数: 源=0, 目标=0

- ✅ **effect_predictions**: 
  - 行数: 源=0, 目标=0

- ✅ **experiment_data**: 
  - 行数: 源=0, 目标=0

- ✅ **experiments**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_categories**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_generation_history**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_ingredients**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_peptides**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_tags**: 
  - 行数: 源=0, 目标=0

- ✅ **formula_versions**: 
  - 行数: 源=0, 目标=0

- ✅ **formulas**: 
  - 行数: 源=0, 目标=0

- ✅ **ingredients**: 
  - 行数: 源=0, 目标=0

- ✅ **kg_edges**: 
  - 行数: 源=0, 目标=0

- ✅ **kg_nodes**: 
  - 行数: 源=0, 目标=0

- ✅ **knowledge_graph_nodes**: 
  - 行数: 源=0, 目标=0

- ✅ **lab_validation_data**: 
  - 行数: 源=0, 目标=0

- ✅ **notifications**: 
  - 行数: 源=0, 目标=0

- ✅ **optimization_results**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_activities**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_analyses**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_analysis_details**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_design_candidates**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_designs**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_enzyme_links**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_enzymes**: 
  - 行数: 源=0, 目标=0

- ✅ **peptide_source_proteins**: 
  - 行数: 源=0, 目标=0

- ✅ **peptides**: 
  - 行数: 源=0, 目标=0

- ✅ **prompt_templates**: 
  - 行数: 源=0, 目标=0

- ✅ **prompt_versions**: 
  - 行数: 源=0, 目标=0

- ✅ **safety_alert_logs**: 
  - 行数: 源=0, 目标=0

- ✅ **safety_threshold_change_log**: 
  - 行数: 源=0, 目标=0

- ✅ **sync_logs**: 
  - 行数: 源=0, 目标=0

- ✅ **synergy_records**: 
  - 行数: 源=0, 目标=0

- ✅ **tags**: 
  - 行数: 源=0, 目标=0

- ✅ **tcm_compound_targets**: 
  - 行数: 源=0, 目标=0

- ✅ **tcm_compounds**: 
  - 行数: 源=0, 目标=0

- ✅ **tcm_diseases**: 
  - 行数: 源=0, 目标=0

- ✅ **tcm_herb_compounds**: 
  - 行数: 源=0, 目标=0

- ❌ **tcm_herbs**: 
  - 行数: 源=47, 目标=47
  - 样本 ID=39, 列 created_at 不匹配: 源='2026-06-03 05:35:58.391092', 目标=datetime.datetime(2026, 6, 3, 5, 35, 58, 391092, t
  - 样本 ID=7, 列 created_at 不匹配: 源='2026-06-03 05:35:58.391068', 目标=datetime.datetime(2026, 6, 3, 5, 35, 58, 391068, t
  - 样本 ID=31, 列 created_at 不匹配: 源='2026-06-03 05:35:58.391086', 目标=datetime.datetime(2026, 6, 3, 5, 35, 58, 391086, t
  - 样本 ID=29, 列 created_at 不匹配: 源='2026-06-03 05:35:58.391085', 目标=datetime.datetime(2026, 6, 3, 5, 35, 58, 391085, t
  - 样本 ID=23, 列 created_at 不匹配: 源='2026-06-03 05:35:58.391080', 目标=datetime.datetime(2026, 6, 3, 5, 35, 58, 391080, t
  - 分布不匹配: 补血药: 源=1, 目标=0; 理气药: 源=0, 目标=1

- ✅ **tcm_target_diseases**: 
  - 行数: 源=0, 目标=0

- ✅ **tcm_targets**: 
  - 行数: 源=0, 目标=0

- ✅ **team_members**: 
  - 行数: 源=0, 目标=0

- ✅ **teams**: 
  - 行数: 源=0, 目标=0

- ❌ **term_categories**: 
  - 行数: 源=26, 目标=26
  - 样本 ID=1, 列 created_at 不匹配: 源='2026-05-17 16:46:54.868874', 目标=datetime.datetime(2026, 5, 17, 16, 46, 54, 868874,
  - 样本 ID=15, 列 created_at 不匹配: 源='2026-05-17 16:46:54.904487', 目标=datetime.datetime(2026, 5, 17, 16, 46, 54, 904487,
  - 样本 ID=2, 列 created_at 不匹配: 源='2026-05-17 16:46:54.887073', 目标=datetime.datetime(2026, 5, 17, 16, 46, 54, 887073,
  - 样本 ID=25, 列 created_at 不匹配: 源='2026-05-17 16:46:54.916496', 目标=datetime.datetime(2026, 5, 17, 16, 46, 54, 916496,
  - 样本 ID=11, 列 created_at 不匹配: 源='2026-05-17 16:46:54.900151', 目标=datetime.datetime(2026, 5, 17, 16, 46, 54, 900151,

- ❌ **term_normalization_rules**: 
  - 行数: 源=9, 目标=9
  - 样本 ID=4, 列 created_at 不匹配: 源='2026-05-17 16:46:59.324006', 目标=datetime.datetime(2026, 5, 17, 16, 46, 59, 324006,
  - 样本 ID=6, 列 created_at 不匹配: 源='2026-05-17 16:46:59.324010', 目标=datetime.datetime(2026, 5, 17, 16, 46, 59, 324010,
  - 样本 ID=1, 列 created_at 不匹配: 源='2026-05-17 16:46:59.323997', 目标=datetime.datetime(2026, 5, 17, 16, 46, 59, 323997,
  - 样本 ID=9, 列 created_at 不匹配: 源='2026-05-17 16:46:59.324015', 目标=datetime.datetime(2026, 5, 17, 16, 46, 59, 324015,
  - 样本 ID=3, 列 created_at 不匹配: 源='2026-05-17 16:46:59.324005', 目标=datetime.datetime(2026, 5, 17, 16, 46, 59, 324005,

- ✅ **term_statistics**: 
  - 行数: 源=0, 目标=0

- ❌ **term_validations**: 
  - 行数: 源=12, 目标=12
  - 样本 ID=12, 列 created_at 不匹配: 源='2026-05-17 16:47:27.083782', 目标=datetime.datetime(2026, 5, 17, 16, 47, 27, 83782, 
  - 样本 ID=11, 列 created_at 不匹配: 源='2026-05-17 16:47:25.792073', 目标=datetime.datetime(2026, 5, 17, 16, 47, 25, 792073,
  - 样本 ID=6, 列 created_at 不匹配: 源='2026-05-17 16:47:23.027877', 目标=datetime.datetime(2026, 5, 17, 16, 47, 23, 27877, 
  - 样本 ID=2, 列 created_at 不匹配: 源='2026-05-17 16:47:21.337275', 目标=datetime.datetime(2026, 5, 17, 16, 47, 21, 337275,
  - 样本 ID=3, 列 created_at 不匹配: 源='2026-05-17 16:47:21.715777', 目标=datetime.datetime(2026, 5, 17, 16, 47, 21, 715777,

- ✅ **term_variants**: 
  - 行数: 源=0, 目标=0

- ❌ **terms**: 
  - 行数: 源=1,026, 目标=1,026
  - 样本 ID=987, 列 examples 不匹配: 源='null', 目标=None
  - 样本 ID=325, 列 examples 不匹配: 源='null', 目标=None
  - 样本 ID=510, 列 examples 不匹配: 源='null', 目标=None
  - 样本 ID=439, 列 examples 不匹配: 源='null', 目标=None
  - 样本 ID=407, 列 examples 不匹配: 源='null', 目标=None

- ✅ **user_devices**: 
  - 行数: 源=0, 目标=0

- ❌ **users**: 
  - 行数: 源=1, 目标=1
  - 样本 ID=1, 列 last_login 不匹配: 源='2026-06-03 03:00:54.464914', 目标=datetime.datetime(2026, 6, 3, 3, 0, 54, 464914, tz

- ✅ **workflow_tasks**: 
  - 行数: 源=0, 目标=0

- ✅ **workflows**: 
  - 行数: 源=0, 目标=0

---
*由 RMFOOD 迁移工具自动生成*
