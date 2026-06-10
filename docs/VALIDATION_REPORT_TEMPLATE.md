# RMFOOD 配方平台 - 效果验证报告模板

## 📋 报告基本信息

| 项目 | 内容 |
|------|------|
| **报告编号** | VAL-{{YEAR}}{{MONTH}}{{DAY}}-{{SEQUENCE}} |
| **配方名称** | {{FORMULA_NAME}} |
| **验证类型** | □ 实验室验证  □ 临床试验  □ 用户反馈验证  □ 文献对比验证 |
| **报告日期** | {{REPORT_DATE}} |
| **负责人** | {{LEADER_NAME}} |
| **参与人员** | {{TEAM_MEMBERS}} |
| **审核状态** | □ 草稿  □ 待审  □ 已批准  □ 需修改 |

---

## 📑 目录

1. [执行摘要](#1-执行摘要)
2. [研究背景与目的](#2-研究背景与目的)
3. [材料与方法](#3-材料与方法)
4. [实验结果](#4-实验结果)
5. [数据分析与统计](#5-数据分析与统计)
6. [讨论](#6-讨论)
7. [结论与建议](#7-结论与建议)
8. [附录](#8-附录)

---

## 1. 执行摘要

### 1.1 核心发现概览

本报告对配方 **{{FORMULA_NAME}}** 进行了系统的效果验证，主要结论如下：

#### ✅ 主要成果
- **综合功效得分**: {{EFFICACY_SCORE}}/1.0 (目标: ≥0.75)
- **安全性评估**: {{SAFETY_STATUS}} (所有指标均在安全范围内)
- **预测准确度**: R² = {{R_SQUARED}} (RMSE = {{RMSE_VALUE}}, MAE = {{MAE_VALUE}})
- **协同效应指数**: SI = {{SYNERGY_INDEX}} (显著协同: {{IS_SIGNIFICANT}})

#### ⚠️ 关键问题
{{KEY_ISSUES}}

#### 💡 改进建议
{{RECOMMENDATIONS_SUMMARY}}

### 1.2 验证矩阵

| 验证维度 | 目标值 | 实测值 | 达标状态 | 备注 |
|----------|--------|--------|----------|------|
| 功效显著性 | P < 0.05 | {{P_VALUE}} | {{EFFICACY_PASS}} | {{EFFICACY_NOTE}} |
| 安全性合规 | 100% 通过 | {{SAFETY_PASS_RATE}}% | {{SAFETY_PASS}} | {{SAFETY_NOTE}} |
| 预测准确度 R² | >0.80 | {{R_SQUARED}} | {{ACCURACY_PASS}} | {{ACCURACY_NOTE}} |
| 稳定性保持率 | >90% | {{STABILITY_RATE}}% | {{STABILITY_PASS}} | {{STABILITY_NOTE}} |
| 感官接受度 | >7.0/10 | {{SENSORY_SCORE}} | {{SENSORY_PASS}} | {{SENSORY_NOTE}} |

---

## 2. 研究背景与目的

### 2.1 配方概述

```
配方名称: {{FORMULA_NAME}}
配方编号: {{FORMULA_ID}}
创建日期: {{CREATION_DATE}}
目标功效: {{TARGET_EFFICACY}}
适用人群: {{TARGET_POPULATION}}
推荐剂量: {{RECOMMENDED_DOSE}}
服用周期: {{DURATION_CYCLE}}
```

### 2.2 配方成分组成

| 序号 | 成分名称 | 含量 (%) | 规格要求 | 来源 | 功能定位 |
|------|----------|----------|----------|------|----------|
| 1 | {{INGREDIENT_1_NAME}} | {{ING_1_RATIO}}% | {{ING_1_SPEC}} | {{ING_1_SOURCE}} | {{ING_1_FUNCTION}} |
| 2 | {{INGREDIENT_2_NAME}} | {{ING_2_RATIO}}% | {{ING_2_SPEC}} | {{ING_2_SOURCE}} | {{ING_2_FUNCTION}} |
| ... | ... | ... | ... | ... | ... |
| n | {{INGREDIENT_N_NAME}} | {{ING_N_RATIO}}% | {{ING_N_SPEC}} | {{ING_N_SOURCE}} | {{ING_N_FUNCTION}} |

**总质量**: {{TOTAL_MASS}} mg/剂 | **配比优化算法**: NSGA-III (第 {{GENERATION_COUNT}} 代收敛)

### 2.3 协同机制设计依据

本配方基于以下协同作用机制进行设计：

#### 机制 1: 药效增强协同 (Bliss Independence)
- **理论依据**: Bliss Independence 药效独立模型 + 协同系数 α
- **预期增益**: {{BLISS_EXPECTED_GAIN}}%
- **关键成分对**: {{BLISS_KEY_PAIRS}}
- **参考文献**: {{BLISS_REFERENCES}}

#### 机制 2: 药代动力学协同 (PK Interaction)
- **理论依据**: CYP450 酶抑制/诱导相互作用
- **生物利用度提升**: {{PK_BIOAVAILABILITY_BOOST}}%
- **Tmax 延迟/提前**: {{PK_TMAX_CHANGE}} 小时
- **风险控制**: {{PK_RISK_CONTROL}}

#### 机制 3: 结构稳定性协同 (Gibbs Free Energy)
- **预期 ΔG_complex**: {{GIBBS_DG_VALUE}} kJ/mol
- **稳定性评分**: {{GIBBS_STABILITY_SCORE}}/1.0
- **pH 敏感性**: {{PH_SENSITIVITY}}
- **温度范围**: {{TEMPERATURE_RANGE}}

#### 机制 4: 靶点通路协同 (Network Pharmacology)
- **核心靶点数**: {{NP_TARGET_COUNT}} 个
- **KEGG 通路富集**: {{NP_PATHWAY_COUNT}} 条 (P < 0.05)
- **Jaccard 相似系数**: {{NP_JACCARD_COEFFICIENT}}
- **网络拓扑参数**: {{NP_TOPOLOGY_PARAMS}}

#### 机制 5: 感官品质协同 (Taste Matrix)
- **苦味掩盖效率**: {{TASTE_BITTER_MASKING}}%
- **整体风味平衡度**: {{TASTE_BALANCE_SCORE}}/10
- **口感描述**: {{TASTE_DESCRIPTION}}

### 2.4 验证目标

#### 主要目标 (Primary Objectives)
1. **PO1**: 验证配方的 {{PRIMARY_OUTCOME_1}} 是否达到预设标准 ({{PO1_TARGET}})
2. **PO2**: 评估配方的安全性，确保无不良反应发生
3. **PO3**: 对比预测值与实测值的偏差，验证模型准确性

#### 次要目标 (Secondary Objectives)
1. **SO1**: 探索最佳服用时间窗口 (预测: {{SO1_PREDICTED_WINDOW}})
2. **SO2**: 评估不同人群亚组的响应差异
3. **SO3**: 分析长期服用的耐受性

---

## 3. 材料与方法

### 3.1 实验材料

#### 3.1.1 受试样品

```yaml
样品信息:
  批号: {{BATCH_NUMBER}}
  生产日期: {{PRODUCTION_DATE}}
  有效期至: {{EXPIRY_DATE}}
  储存条件: {{STORAGE_CONDITIONS}}
  外观性状: {{APPEARANCE}}
  
含量测定:
  - 大豆肽: {{ACTUAL_SOY_PEPTIDE}} mg/g (标示值: {{LABEL_SOY_PEPTIDE}} mg/g, 回收率: {{SOY_RECOVERY}}%)
  - 黄芪多糖: {{ACTUAL_ASTRAGALUS}} mg/g (标示值: {{LABEL_ASTRAGALUS}} mg/g, 回收率: {{ASTRAGALUS_RECOVERY}}%)
  - 人参皂苷: {{ACTUAL_GINSENOSIDE}} mg/g (标示值: {{LABEL_GINSENOSIDE}} mg/g, 回收率: {{GINSENOSIDE_RECOVERY}}%)
  - 其他成分: {{OTHER_INGREDIENTS_ANALYSIS}}
```

#### 3.1.2 试剂与仪器

| 类别 | 名称 | 型号/规格 | 厂家 | 校准有效期 |
|------|------|-----------|------|------------|
| HPLC | 高效液相色谱仪 | {{HPLC_MODEL}} | {{HPLC_VENDOR}} | {{HPLC_CALIBRATION_DATE}} |
| ELISA | 酶标仪 | {{ELISA_MODEL}} | {{ELISA_VENDOR}} | {{ELISA_CALIBRATION_DATE}} |
| 细胞培养箱 | CO₂ 培养箱 | {{INCUBATOR_MODEL}} | {{INCUBATOR_VENDOR}} | - |
| 流式细胞仪 | {{FLOW_CYTOMETER_MODEL}} | {{FLOW_CYTOMETER_VENDOR}} | {{FC_CALIBRATION_DATE}} |
| 试剂盒 | {{KIT_NAME}} | {{KIT_SPEC}} | {{KIT_VENDOR}} | {{KIT_LOT_NUMBER}} |

### 3.2 实验方法

#### 3.2.1 实验设计

**研究类型**: {{STUDY_TYPE}} (随机对照/开放标签/交叉设计)

**样本量计算**:
- 效应量 (Effect Size): d = {{EFFECT_SIZE}}
- α 错误概率: {{ALPHA_LEVEL}} (双侧检验)
- β 错误概率 (1-β = Power): {{POWER_LEVEL}}
- 计算样本量: N = {{CALCULATED_SAMPLE_SIZE}} (实际入组: {{ENROLLED_SUBJECTS}})
- 脱落率预估: {{DROPOUT_RATE}}%

**分组方案**:

| 组别 | 样本量 | 干预措施 | 周期 | 备注 |
|------|--------|----------|------|------|
| 实验组 | {{N_EXPERIMENTAL}} | {{EXPERIMENTAL_INTERVENTION}} | {{DURATION_WEEKS}} 周 | {{EXP_NOTES}} |
| 对照组 | {{N_CONTROL}} | {{CONTROL_INTERVENTION}} | {{DURATION_WEEKS}} 周 | {{CTRL_NOTES}} |
| 安慰剂组 | {{N_PLACEBO}} | {{PLACEBO_INTERVENTION}} | {{DURATION_WEEKS}} 周 | {{PLAC_NOTES}} |

**随机化方法**: {{RANDOMIZATION_METHOD}} (随机种子: {{RANDOM_SEED}})

**盲法实施**: {{BLINDING_METHOD}} (单盲/双盲/三盲)

#### 3.2.2 生化检测方法

##### 方法 A: 功效标志物检测

**检测指标**:
1. **{{BIOMARKER_1_NAME}}**
   - 检测方法: {{BM1_METHOD}}
   - 正常参考范围: {{BM1_REFERENCE_RANGE}}
   - 单位: {{BM1_UNIT}}
   - CV (变异系数): {{BM1_CV}}%

2. **{{BIOMARKER_2_NAME}}**
   - 检测方法: {{BM2_METHOD}}
   - 正常参考范围: {{BM2_REFERENCE_RANGE}}
   - 单位: {{BM2_UNIT}}
   - CV (变异系数): {{BM2_CV}}%

... (其他指标)

**检测时间点**:
- 基线 (Day 0): 服药前空腹采血
- 早期 (Week {{EARLY_TIMEPOINT}}): 初次评估
- 中期 (Week {{MID_TIMEPOINT}}): 中期评估
- 终点 (Week {{END_TIMEPOINT}}): 最终评估
- 随访 (Week {{FOLLOWUP_TIMEPOINT}}): 安全性随访

##### 方法 B: 安全性检测

**常规检查项目**:
- 血常规 (CBC): WBC, RBC, HGB, PLT, LYMPH%, NEUT%
- 生化全项: ALT, AST, BUN, Cr, GLU, TC, TG, LDL-C, HDL-C
- 尿常规: pH, PRO, GLU, KET, UBG, BIL
- 心电图: 12 导联 ECG

**特殊安全性监测**:
- {{SPECIFIC_SAFETY_ITEM_1}}: {{SS1_THRESHOLD}}
- {{SPECIFIC_SAFETY_ITEM_2}}: {{SS2_THRESHOLD}}

**不良事件分级标准 (CTCAE v5.0)**:
| 分级 | 定义 | 处置措施 |
|------|------|----------|
| Grade 1 | 轻度 | 继续观察，无需干预 |
| Grade 2 | 中度 | 需对症处理，可继续用药 |
| Grade 3 | 重度 | 暂停用药，积极治疗 |
| Grade 4 | 危及生命 | 立即停药，紧急救治 |
| Grade 5 | 死亡 | - |

#### 3.2.3 统计分析方法

**软件版本**:
- SPSS v{{SPSS_VERSION}} / SAS v{{SAS_VERSION}} / R v{{R_VERSION}}
- 图形绘制: GraphPad Prism v{{PRISM_VERSION}} / Python matplotlib/seaborn

**统计假设检验**:

```r
# R 代码示例
library(tidyverse)
library(effsize)
library(broom)

# 1. 描述性统计
summary_stats <- data %>%
  group_by(group) %>%
  summarise(
    n = n(),
    mean = mean(outcome, na.rm = TRUE),
    sd = sd(outcome, na.rm = TRUE),
    median = median(outcome, na.rm = TRUE),
    IQR = IQR(outcome, na.rm = TRUE)
  )

# 2. 正态性检验 (Shapiro-Wilk)
shapiro.test(data$outcome[data$group == "experimental"])

# 3. 组间比较 (t-test 或 Wilcoxon)
if (normality_p > 0.05) {
  result <- t.test(outcome ~ group, data = data, var.equal = FALSE)
} else {
  result <- wilcox.test(outcome ~ group, data = data)
}

# 4. 效应量计算 (Cohen's d)
cohen_d <- cohen.d(data$outcome[data$group == "experimental"],
                   data$outcome[data$group == "control"])
```

**多重比较校正**:
- 方法: {{MULTIPLE_COMPARISON_METHOD}} (Bonferroni/FDR/Benjamini-Hochberg)
- 校正后显著性阈值: {{ADJUSTED_ALPHA_LEVEL}}

**缺失数据处理策略**:
- 缺失比例 <5%: 使用均值插补 (Mean Imputation)
- 缺失比例 5-20%: 多重插补 (Multiple Imputation by Chained Equations, MICE)
- 缺失比例 >20%: 敏感性分析 (Sensitivity Analysis) + 完整病例分析 (Complete Case Analysis)

---

## 4. 实验结果

### 4.1 受试者基线特征

#### 4.1.1 人口统计学特征

| 特征 | 实验组 (n={{N_EXP}}) | 对照组 (n={{N_CTRL}}) | P 值 |
|------|---------------------|---------------------|------|
| 年龄 (岁) | {{AGE_MEAN_EXP}} ± {{AGE_SD_EXP}} | {{AGE_MEAN_CTRL}} ± {{AGE_SD_CTRL}} | {{AGE_P_VALUE}} |
| 性别 (男/女) | {{GENDER_EXP_M}}/{{GENDER_EXP_F}} | {{GENDER_CTRL_M}}/{{GENDER_CTRL_F}} | {{GENDER_P_VALUE}} |
| BMI (kg/m²) | {{BMI_EXP}} ± {{BMI_SD_EXP}} | {{BMI_CTRL}} ± {{BMI_SD_CTRL}} | {{BMI_P_VALUE}} |
| 病程 (月) | {{DURATION_EXP}} ± {{DURATION_SD_EXP}} | {{DURATION_CTRL}} ± {{DURATION_SD_CTRL}} | {{DUR_P_VALUE}} |
| 基线功效指标 | {{BASELINE_EXP}} ± {{BASELINE_SD_EXP}} | {{BASELINE_CTRL}} ± {{BASELINE_SD_CTRL}} | {{BASE_P_VALUE}} |

**结论**: 两组基线资料具有可比性 (P 均 > 0.05)，随机化成功。

#### 4.1.2 入组流程图 (CONSORT Diagram)

```
筛选受试者 (n={{SCREENED_TOTAL}})
        ↓
排除原因:
  - 不符合纳入标准: n={{EXCLUDED_INCLUSION}}
  - 符合排除标准: n={{EXCLUDED_EXCLUSION}}
  - 拒绝参与: n={{EXCLUDED_REFUSE}}
  - 其他: n={{EXCLUDED_OTHER}}
        ↓
随机化分组 (n={{RANDOMIZED_TOTAL}})
        ↓
┌─────────────────┬─────────────────┐
↓                 ↓                 ↓
实验组            对照组             脱落
(n={{ASSIGNED_EXP}}) (n={{ASSIGNED_CTRL}}) (n={{DROPOUT_BEFORE}})
        ↓                 ↓
完成干预           完成干预
(n={{COMPLETED_EXP}}) (n={{COMPLETED_CTRL}})
        ↓                 ↓
纳入分析           纳入分析
(n={{ANALYZED_EXP}}) (n={{ANALYZED_CTRL}})
```

### 4.2 主要结局指标结果

#### 4.2.1 功效指标变化

**表 4-1: 各时间点主要功效指标变化 (Mean ± SD)**

| 时间点 | 实验组 | 对照组 | 组间差值 (95% CI) | P 值 | 效应量 (Cohen's d) |
|--------|--------|--------|-------------------|------|-------------------|
| 基线 | {{BASE_EXP}} ± {{SD_BASE_EXP}} | {{BASE_CTRL}} ± {{SD_BASE_CTRL}} | - | - | - |
| Week {{WEEK_EARLY}} | {{EARLY_EXP}} ± {{SD_EARLY_EXP}} | {{EARLY_CTRL}} ± {{SD_EARLY_CTRL}} | {{DIFF_EARLY}} ({{CI_EARLY_LOW}}, {{CI_EARLY_HIGH}}) | {{P_EARLY}} | {{D_EARLY}} |
| Week {{WEEK_MID}} | {{MID_EXP}} ± {{SD_MID_EXP}} | {{MID_CTRL}} ± {{SD_MID_CTRL}} | {{DIFF_MID}} ({{CI_MID_LOW}}, {{CI_MID_HIGH}}) | {{P_MID}} | {{D_MID}} |
| Week {{WEEK_END}} | {{END_EXP}} ± {{SD_END_EXP}} | {{END_CTRL}} ± {{SD_END_CTRL}} | {{DIFF_END}} ({{CI_END_LOW}}, {{CI_END_HIGH}}) | {{P_END}} | {{D_END}} |

**图 4-1: 功效指标变化趋势图**

![功效趋势图](figures/efficacy_trend.png)

*注: 数据以 Mean ± SEM 表示；*P < 0.05, **P < 0.01, ***P < 0.001 vs 对照组*

#### 4.2.2 应答率分析

**定义**: 应答者 = 较基线改善 ≥{{RESPONSE_THRESHOLD}}%

| 组别 | 应答者 (n) | 总例数 (n) | 应答率 (%) | OR (95% CI) | NNT | P 值 |
|------|-----------|-----------|------------|-------------|-----|------|
| 实验组 | {{RESP_EXP_YES}} | {{RESP_EXP_TOTAL}} | {{RESP_RATE_EXP}}% | {{OR_VALUE}} ({{OR_CI_LOW}}, {{OR_CI_HIGH}}) | {{NNT_VALUE}} | {{RESP_P_VALUE}} |
| 对照组 | {{RESP_CTRL_YES}} | {{RESP_CTRL_TOTAL}} | {{RESP_RATE_CTRL}}% | - | - | - |

**Forest Plot (森林图)**:

![应答率 Forest Plot](figures/response_forest_plot.png)

### 4.3 次要结局指标结果

#### 4.3.1 生活质量评分 (QoL)

使用 {{QOL_SCALE_NAME}} 量表评估 (范围 0-100 分，分数越高越好)

| 维度 | 基线 (Exp/Ctrl) | 终点 (Exp/Ctrl) | 变化值 (Δ) Exp vs Ctrl | P 值 |
|------|------------------|------------------|-------------------------|------|
| 身体功能 | {{QOL_PF_BASE_EXP}}/{{QOL_PF_BASE_CTRL}} → {{QOL_PF_END_EXP}}/{{QOL_PF_END_CTRL}} | {{QOL_PF_DELTA_EXP}} vs {{QOL_PF_DELTA_CTRL}} | {{QOL_PF_P}} |
| 角色功能 | {{QOL_RF_BASE_EXP}}/{{QOL_RF_BASE_CTRL}} → {{QOL_RF_END_EXP}}/{{QOL_RF_END_CTRL}} | {{QOL_RF_DELTA_EXP}} vs {{QOL_RF_DELTA_CTRL}} | {{QOL_RF_P}} |
| 情绪功能 | {{QOL_EF_BASE_EXP}}/{{QOL_EF_BASE_CTRL}} → {{QOL_EF_END_EXP}}/{{QOL_EF_END_CTRL}} | {{QOL_EF_DELTA_EXP}} vs {{QOL_EF_DELTA_CTRL}} | {{QOL_EF_P}} |
| 认知功能 | {{QOL_CF_BASE_EXP}}/{{QOL_CF_BASE_CTRL}} → {{QOL_CF_END_EXP}}/{{QOL_CF_END_CTRL}} | {{QOL_CF_DELTA_EXP}} vs {{QOL_CF_DELTA_CTRL}} | {{QOL_CF_P}} |
| 社会功能 | {{QOL_SF_BASE_EXP}}/{{QOL_SF_BASE_CTRL}} → {{QOL_SF_END_EXP}}/{{QOL_SF_END_CTRL}} | {{QOL_SF_DELTA_EXP}} vs {{QOL_SF_DELTA_CTRL}} | {{QOL_SF_P}} |
| **总分** | **{{QOL_TOTAL_BASE_EXP}}/{{QOL_TOTAL_BASE_CTRL}} → {{QOL_TOTAL_END_EXP}}/{{QOL_TOTAL_END_CTRL}}** | **{{QOL_TOTAL_DELTA_EXP}} vs {{QOL_TOTAL_DELTA_CTRL}}** | **{{QOL_TOTAL_P}}** |

#### 4.3.2 亚组分析

**按年龄分层**:

| 年龄组 | 实验组效应量 | 对照组效应量 | 交互作用 P 值 |
|--------|-------------|-------------|---------------|
| <40 岁 | {{SUBGROUP_YOUNG_D_EXP}} | {{SUBGROUP_YOUNG_D_CTRL}} | {{INTERACTION_YOUNG_P}} |
| 40-60 岁 | {{SUBGROUP_MIDDLE_D_EXP}} | {{SUBGROUP_MIDDLE_D_CTRL}} | {{INTERACTION_MIDDLE_P}} |
| >60 岁 | {{SUBGROUP_OLD_D_EXP}} | {{SUBGROUP_OLD_D_CTRL}} | {{INTERACTION_OLD_P}} |

**按性别分层**:

| 性别 | 实验组 (n) | 对照组 (n) | 效应量 (95% CI) | P 值 |
|------|-----------|-----------|-----------------|------|
| 男 | {{MALE_N_EXP}} | {{MALE_N_CTRL}} | {{MALE_D}} ({{MALE_CI_LOW}}, {{MALE_CI_HIGH}}) | {{MALE_P}} |
| 女 | {{FEMALE_N_EXP}} | {{FEMALE_N_CTRL}} | {{FEMALE_D}} ({{FEMALE_CI_LOW}}, {{FEMALE_CI_HIGH}}) | {{FEMALE_P}} |

### 4.4 安全性评价结果

#### 4.4.1 不良事件 (AE) 汇总

**表 4-2: 不良事件发生率 (Safety Population, n={{SAFETY_POPULATION}})**

| 不良事件 | 实验组 n (%) | 对照组 n (%) | RR (95% CI) | P 值 | 严重程度 |
|----------|-------------|-------------|-------------|------|----------|
| 总 AE 数 | {{TOTAL_AE_EXP}} ({{AE_RATE_EXP}}%) | {{TOTAL_AE_CTRL}} ({{AE_RATE_CTRL}}%) | {{AE_RR}} ({{AE_RR_CI_LOW}}, {{AE_RR_CI_HIGH}}) | {{AE_P}} | - |
| 轻度 (Grade 1) | {{GRADE1_EXP}} ({{G1_RATE_EXP}}%) | {{GRADE1_CTRL}} ({{G1_RATE_CTRL}}%) | - | - | 无需处理 |
| 中度 (Grade 2) | {{GRADE2_EXP}} ({{G2_RATE_EXP}}%) | {{GRADE2_CTRL}} ({{G2_RATE_CTRL}}%) | - | - | 对症治疗 |
| 重度 (Grade 3+) | {{GRADE3_EXP}} ({{G3_RATE_EXP}}%) | {{GRADE3_CTRL}} ({{G3_RATE_CTRL}}%) | - | - | 停药/住院 |

**常见不良事件详情**:

| AE 名称 | 实验组 n (%) | 对照组 n (%) | 可能相关性 | 转归 |
|---------|-------------|-------------|-----------|------|
| {{AE_1_NAME}} | {{AE_1_EXP}}% | {{AE_1_CTRL}}% | {{AE_1_RELATEDNESS}} | {{AE_1_OUTCOME}} |
| {{AE_2_NAME}} | {{AE_2_EXP}}% | {{AE_2_CTRL}}% | {{AE_2_RELATEDNESS}} | {{AE_2_OUTCOME}} |
| ... | ... | ... | ... | ... |

#### 4.4.2 实验室安全性指标

**表 4-3: 终点时实验室异常值 (CTCAE 分级)**

| 指标 | 正常范围 | 实验组异常 (n/%) | 对照组异常 (n/%) | 最大 CTCAE 分级 | 临床意义 |
|------|----------|------------------|------------------|-----------------|----------|
| ALT (U/L) | {{ALT_REF}} | {{ALT_ABN_EXP}} | {{ALT_ABN_CTRL}} | {{ALT_MAX_GRADE}} | {{ALT_CLINICAL_SIG}} |
| AST (U/L) | {{AST_REF}} | {{AST_ABN_EXP}} | {{AST_ABN_CTRL}} | {{AST_MAX_GRADE}} | {{AST_CLINICAL_SIG}} |
| Cr (μmol/L) | {{CR_REF}} | {{CR_ABN_EXP}} | {{CR_ABN_CTRL}} | {{CR_MAX_GRADE}} | {{CR_CLINICAL_SIG}} |
| WBC (×10⁹/L) | {{WBC_REF}} | {{WBC_ABN_EXP}} | {{WBC_ABN_CTRL}} | {{WBC_MAX_GRADE}} | {{WBC_CLINICAL_SIG}} |
| PLT (×10⁹/L) | {{PLT_REF}} | {{PLT_ABN_EXP}} | {{PLT_ABN_CTRL}} | {{PLT_MAX_GRADE}} | {{PLT_CLINICAL_SIG}} |

**结论**: 实验组实验室安全性指标与对照组相比无统计学差异 (P > 0.05)，未发现药物相关的有临床意义的实验室异常。

---

## 5. 数据分析与统计

### 5.1 预测模型验证

#### 5.1.1 PopPK/PD 模型拟合优度

**表 5-1: 药代动力学参数估计值**

| 参数 | 符号 | 预测值 | 实测值 (±SE) | 95% CI | RE (%) | 判定 |
|------|------|--------|--------------|--------|--------|------|
| 吸收速率常数 | Ka (h⁻¹) | {{KA_PRED}} | {{KA_OBS}} ± {{KA_SE}} | ({{KA_CI_LOW}}, {{KA_CI_HIGH}}) | {{KA_RE}}% | {{KA_JUDGMENT}} |
| 清除率 | CL (L/h/kg) | {{CL_PRED}} | {{CL_OBS}} ± {{CL_SE}} | ({{CL_CI_LOW}}, {{CL_CI_HIGH}}) | {{CL_RE}}% | {{CL_JUDGMENT}} |
| 分布容积 | Vd (L/kg) | {{VD_PRED}} | {{VD_OBS}} ± {{VD_SE}} | ({{VD_CI_LOW}}, {{VD_CI_HIGH}}) | {{VD_RE}}% | {{VD_JUDGMENT}} |
| 生物利用度 | F (%) | {{F_PRED}} | {{F_OBS}} ± {{F_SE}} | ({{F_CI_LOW}}, {{F_CI_HIGH}}) | {{F_RE}}% | {{F_JUDGMENT}} |
| 达峰时间 | Tmax (h) | {{TMAX_PRED}} | {{TMAX_OBS}} ± {{TMAX_SE}} | ({{TMAX_CI_LOW}}, {{TMAX_CI_HIGH}}) | {{TMAX_RE}}% | {{TMAX_JUDGEMENT}} |
| 半衰期 | t₁/₂ (h) | {{HALFLIFE_PRED}} | {{HALFLIFE_OBS}} ± {{HALFLIFE_SE}} | ({{HL_CI_LOW}}, {{HL_CI_HIGH}}) | {{HL_RE}}% | {{HL_JUDGMENT}} |

**RE (Relative Error) = (预测值 - 实测值) / 实测值 × 100%**

判定标准: \|RE\| < 30% 为可接受范围

#### 5.1.2 时效曲线拟合

**图 5-1: 浓度-时间曲线 (C-T Curve)**

![C-T 曲线](figures/ct_curve.png)

**拟合评价指标**:
- 决定系数 R² = {{CT_R_SQUARED}}
- 均方根误差 RMSE = {{CT_RMSE}} {{CT_RMSE_UNIT}}
- 平均绝对误差 MAE = {{CT_MAE}} {{CT_MAE_UNIT}}
- AUC₀₋∞ 预测值: {{AUC_PRED}} {{AUC_UNIT}}
- AUC₀₋∞ 实测值: {{AUC_OBS}} {{AUC_UNIT}}
- AUC 偏差: {{AUC_BIAS}}%

#### 5.1.3 效应-时间曲线拟合

**图 5-2: 效应-时间曲线 (E-T Curve)**

![E-T 曲线](figures/et_curve.png)

**药效学参数**:
- Emax (最大效应) = {{EMAX_VALUE}} {{EMAX_UNIT}}
- EC₅₀ (半数有效浓度) = {{EC50_VALUE}} {{EC50_UNIT}}
- Hill 系数 (γ) = {{HILL_COEFFICIENT}}
- 效应持续时间 = {{EFFECT_DURATION}} h

### 5.2 预测准确度综合评价

#### 5.2.1 回归分析

**表 5-2: 预测值 vs 实测值回归分析**

| 指标 | 功效预测 | 安全性预测 | PK 参数预测 | PD 参数预测 |
|------|----------|------------|-------------|-------------|
| 样本量 (n) | {{N_EFFICACY}} | {{N_SAFETY}} | {{N_PK}} | {{N_PD}} |
| 斜率 (β₁) | {{SLOPE_EFF}} | {{SLOPE_SAFE}} | {{SLOPE_PK}} | {{SLOPE_PD}} |
| 截距 (β₀) | {{INTERCEPT_EFF}} | {{INTERCEPT_SAFE}} | {{INTERCEPT_PK}} | {{INTERCEPT_PD}} |
| R² | {{R2_EFF}} | {{R2_SAFE}} | {{R2_PK}} | {{R2_PD}} |
| RMSE | {{RMSE_EFF}} | {{RMSE_SAFE}} | {{RMSE_PK}} | {{RMSE_PD}} |
| MAE | {{MAE_EFF}} | {{MAE_SAFE}} | {{MAE_PK}} | {{MAE_PD}} |
| MAPE (%) | {{MAPE_EFF}}% | {{MAPE_SAFE}}% | {{MAPE_PK}}% | {{MAPE_PD}}% |

#### 5.2.2 Bland-Altman 一致性分析

**图 5-3: Bland-Altman 图 (预测值 vs 实测值)**

![Bland-Altman 图](figures/bland_altman.png)

**一致性限 (Limits of Agreement, LoA)**:
- 平均偏倚 (Bias) = {{BA_BIAS}} {{BA_UNIT}}
- LoA 上限 = {{BA_UPPER_LOA}} {{BA_UNIT}}
- LoA 下限 = {{BA_LOWER_LOA}} {{BA_UNIT}}
- 一致性范围内占比 = {{BA_WITHIN_LOA}}%

**解释**: 
- 若 95% 的数据点落在 LoA 范围内，且 Bias 接近 0，说明预测值与实测值具有良好的一致性。
- 本研究中 {{BA_CONCLUSION}}。

### 5.3 协同效应验证

#### 5.3.1 实测协同指数 vs 预测值

**表 5-3: 5 种协同机制的验证结果**

| 机制名称 | 预测 SI | 实测 SI | 偏差 (%) | P 值 | 一致性判定 |
|----------|---------|---------|----------|------|------------|
| Bliss Independence | {{BLISS_PRED_SI}} | {{BLISS_OBS_SI}} | {{BLISS_BIAS}}% | {{BLISS_P}} | {{BLISS_AGREE}} |
| PK Interaction | {{PK_PRED_SI}} | {{PK_OBS_SI}} | {{PK_BIAS}}% | {{PK_P}} | {{PK_AGREE}} |
| Gibbs Stability | {{GIBBS_PRED_SI}} | {{GIBBS_OBS_SI}} | {{GIBBS_BIAS}}% | {{GIBBS_P}} | {{GIBBS_AGREE}} |
| Network Pharmacology | {{NP_PRED_SI}} | {{NP_OBS_SI}} | {{NP_BIAS}}% | {{NP_P}} | {{NP_AGREE}} |
| Taste Matrix | {{TASTE_PRED_SI}} | {{TASTE_OBS_SI}} | {{TASTE_BIAS}}% | {{TASTE_P}} | {{TASTE_AGREE}} |
| **综合 SI** | **{{TOTAL_PRED_SI}}** | **{{TOTAL_OBS_SI}}** | **{{TOTAL_BIAS}}%** | **{{TOTAL_P}}** | **{{TOTAL_AGREE}}** |

#### 5.3.2 协同效应可视化

**图 5-4: 协同机制贡献雷达图**

![雷达图](figures/synergy_radar.png)

**图 5-5: 成分相互作用热力图**

![热力图](figures/synergy_heatmap.png)

---

## 6. 讨论

### 6.1 主要发现的解读

#### 6.1.1 功效验证结论

本研究证实了配方 **{{FORMULA_NAME}}** 在 {{TARGET_EFFICACY}} 方面具有显著疗效：

1. **主要终点达成情况**:
   - 实验组较对照组改善 {{IMPROVEMENT_PERCENT}}% (95% CI: {{CI_LOW}}-{{CI_HIGH}}%, P = {{P_VALUE}})
   - 效应量 Cohen's d = {{COHEN_D}} ({{EFFECT_SIZE_INTERPRETATION}})
   - 需治数 NNT = {{NNT_VALUE}} (95% CI: {{NNT_CI_LOW}}-{{NNT_CI_HIGH}})

2. **与历史数据对比**:
   - 较既往同类产品 ({{HISTORICAL_PRODUCT}}) 疗效提升 {{IMPROVEMENT_VS_HISTORY}}%
   - 较单一成分疗法增效倍数为 {{SYNERGY_MULTIPLIER}}x

3. **起效时间与持续时间**:
   - 起效时间: 第 {{ONSET_DAY}} 天出现统计学意义差异
   - 峰效时间: 第 {{PEAK_EFFECT_WEEK}} 周
   - 持续效应: 停药后 {{POST_TREATMENT_EFFECT_DURATION}} 周仍维持部分疗效

#### 6.1.2 协同机制验证讨论

**Bliss Independence 模型验证**:
- 预期协同增益 {{BLISS_EXPECTED}}%，实测 {{BLISS_OBSERVED}}%
- 偏差原因分析: {{BLISS_DISCREPANCY_REASON}}
- 改进方向: {{BLISS_IMPROVEMENT_DIRECTION}}

**PK 相互作用验证**:
- 生物利用度实际提升 {{PK_ACTUAL_BOOST}}% (预测: {{PK_PREDICTED_BOOST}}%)
- Tmax 变化: 从 {{ORIGINAL_TMAX}}h → {{OBSERVED_TMAX}}h
- 可能机制: {{PK_MECHANISM_HYPOTHESIS}}

**网络药理学通路验证**:
- 富集到的核心通路: {{ENRICHED_PATHWAYS}}
- 关键靶点验证: {{VALIDATED_TARGETS}}
- 与文献报道的一致性: {{CONCORDANCE_WITH_LITERATURE}}%

### 6.2 局限性分析

#### 6.2.1 研究设计局限

1. **样本量限制**:
   - 当前样本量 (N={{TOTAL_SAMPLE}}) 对于检测 {{SMALL_EFFECT_SIZE}} 的效应量可能不足
   - 亚组分析效能有限，特别是 {{UNDERPOWERED_SUBGROUP}} 亚组

2. **随访周期限制**:
   - 最长随访仅 {{MAX_FOLLOWUP}} 周，无法评估长期安全性
   - 缺乏停药后 {{LONG_TERM_FOLLOWUP_NEEDED}} 个月以上的远期疗效数据

3. **盲法实施挑战**:
   - 由于 {{BLINDING_CHALLENGE}} 导致破盲率较高 ({{UNBLINDING_RATE}}%)

#### 6.2.2 方法学局限

1. **检测方法局限性**:
   - {{BIOMARKER_LIMITATION_1}} 的检测 CV 值偏高 (>15%)
   - 缺乏 {{MISSING_BIOMARKER}} 的标准化检测方法

2. **统计模型假设**:
   - 线性混合效应模型的残差独立性假设可能因 {{VIOLATION_OF_ASSUMPTION}} 而违反
   - 多重比较校正后部分次要终点失去统计学显著性

#### 6.2.3 外推性局限

1. **人群外推性**:
   - 受试者主要为 {{POPULATION_CHARACTERISTIC}}，可能不适用于 {{GENERALIZABILITY_LIMITATION}} 人群
   - 地域局限性: 仅在 {{REGION}} 地区开展

2. **剂量外推性**:
   - 仅验证了 {{TESTED_DOSE}} 剂量的有效性和安全性
   - 其他剂量范围的效应尚未明确

### 6.3 与现有文献的对比

**表 6-1: 同类研究对比**

| 研究 | 年份 | 样本量 | 干预措施 | 疗效指标 | 效应量 | 本研究的优势 |
|------|------|--------|----------|----------|--------|-------------|
| {{REFERENCE_1}} | {{YEAR_1}} | {{N_1}} | {{INTERVENTION_1}} | {{OUTCOME_1}} | {{D_1}} | {{ADVANTAGE_VS_1}} |
| {{REFERENCE_2}} | {{YEAR_2}} | {{N_2}} | {{INTERVENTION_2}} | {{OUTCOME_2}} | {{D_2}} | {{ADVANTAGE_VS_2}} |
| {{REFERENCE_3}} | {{YEAR_3}} | {{N_3}} | {{INTERVENTION_3}} | {{OUTCOME_3}} | {{D_3}} | {{ADVANTAGE_VS_3}} |
| **本研究** | **2026** | **{{N_CURRENT}}** | **{{INTervention_CURRENT}}** | **{{OUTCOME_CURRENT}}** | **{{D_CURRENT}}** | **-** |

**创新点总结**:
1. 首次采用 {{NOVEL_APPROACH_1}} 方法进行配方优化
2. 引入了 {{NOVEL_FEATURE_2}} 维度的协同效应评估
3. 建立了 {{NOVEL_FRAMEWORK_3}} 的预测验证框架

---

## 7. 结论与建议

### 7.1 主要结论

#### 7.1.1 科学结论

基于本次系统性的效果验证研究，得出以下结论：

**结论 1 (有效性)**:
> 配方 **{{FORMULA_NAME}}** 在改善 {{PRIMARY_OUTCOME}} 方面显著优于对照 (P < 0.001, Cohen's d = {{COHEN_D}})，总有效率 {{TOTAL_RESPONSE_RATE}}%，达到预设的主要研究终点。其疗效得益于多组分间的协同作用，尤其是 {{KEY_SYNERGY_MECHANISM}} 机制发挥了关键作用。

**结论 2 (安全性)**:
> 在 {{TREATMENT_DURATION}} 周的治疗周期内，配方显示出良好的安全性和耐受性。总不良事件发生率 {{TOTAL_AE_RATE}}%，其中可能与研究相关的 AE 占 {{RELATED_AE_RATE}}%，均为轻中度 (Grade 1-2)，无严重不良事件 (SAE) 发生。实验室检查未发现有临床意义的异常。

**结论 3 (预测准确性)**:
> 基于 PopPK/PD 模型的预测值与实测值高度一致 (R² = {{OVERALL_R2}}, RMSE = {{OVERALL_RMSE}})。5 种协同机制的预测准确率均 >80%，表明建立的数学模型具有良好的外推性和可靠性。

**结论 4 (创新价值)**:
> 本研究首次实现了从分子机制到临床效果的完整验证闭环，为食源性活性肽配方的科学开发提供了新的范式。NSGA-III 多目标优化算法在保证配比合理性的同时，显著提升了研发效率 ({{EFFICIENCY_IMPROVEMENT}}%)。

### 7.2 实践建议

#### 7.2.1 对产品开发的建议

1. **配方微调建议**:
   ```yaml
   推荐调整:
     - 成分: {{INGREDIENT_TO_ADJUST}}
       当前比例: {{CURRENT_RATIO}}%
       建议调整至: {{SUGGESTED_RATIO}}%
       理由: {{ADJUSTMENT_RATIONALE}}
       
     - 新增成分: {{NEW_INGREDIENT}}
       建议添加量: {{SUGGESTED_AMOUNT}}%
       预期增益: {{EXPECTED_GAIN}}%
   ```

2. **工艺优化方向**:
   - 改善 {{PROCESS_IMPROVEMENT_AREA}} 以提高生物利用度
   - 优化 {{OPTIMIZATION_TARGET}} 以增强稳定性
   - 开发 {{NEW_FORMULATION}} 新型制剂形式

3. **质量控制要点**:
   - 关键质量控制指标 (CQA): {{CQA_LIST}}
   - 关键工艺参数 (CPP): {{CPP_LIST}}
   - 设计空间 (Design Space): {{DESIGN_SPACE_DESCRIPTION}}

#### 7.2.2 对后续研究的建议

1. **短期研究计划 (6-12 个月)**:
   - [ ] 扩大样本量至 N≥{{LARGER_SAMPLE_SIZE}} 进行多中心验证
   - [ ] 开展 {{ADDITIONAL_POPULATION}} 人群的桥接试验
   - [ ] 完成 {{REQUIRED_STUDY_TYPE}} 注册临床试验申报

2. **中期研究计划 (1-2 年)**:
   - [ ] 建立 {{BANK_TYPE}} 样本库用于生物标志物探索
   - [ ] 开展真实世界研究 (RWS) 评估长期疗效和安全性
   - [ ] 进行药物经济学评价 (HEOR) 分析成本效益

3. **长期研究方向 (3-5 年)**:
   - [ ] 深入阐明 {{MECHANISM_TO_ELUCIDATE}} 的分子机制
   - [ ] 开发 {{NEXT_GENERATION_PRODUCT}} 下一代产品
   - [ ] 构建 {{AI_PLATFORM}} AI 辅助配方设计平台

### 7.3 风险提示与注意事项

⚠️ **重要声明**:
- 本报告结论仅适用于符合纳入/排除标准的受试者群体
- 个体反应存在差异，实际效果可能因人而异
- 在推广使用前需获得相关监管部门的批准
- 特殊人群 (孕妇、哺乳期儿童、严重肝肾功能不全者) 使用前需咨询医师

---

## 8. 附录

### 附录 A: 原始数据表格

#### 表 A-1: 受试者个体数据 (脱敏)

| Subject ID | 组别 | 年龄 | 性别 | BMI | 基线值 | 终点值 | 变化值 | AE |
|------------|------|------|------|-----|--------|--------|--------|-----|
| EXP-001 | 实验组 | {{AGE_001}} | {{SEX_001}} | {{BMI_001}} | {{BASE_001}} | {{END_001}} | {{DELTA_001}} | {{AE_001}} |
| EXP-002 | 实验组 | {{AGE_002}} | {{SEX_002}} | {{BMI_002}} | {{BASE_002}} | {{END_002}} | {{DELTA_002}} | {{AE_002}} |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

*(完整数据请参见附件 Excel 文件: raw_data_{{REPORT_ID}}.xlsx)*

### 附录 B: 统计分析详细输出

#### B.1: R 语言输出日志

```r
# 完整统计分析脚本输出
# 文件: statistical_analysis_{{REPORT_ID}}.R
# 运行时间: {{ANALYSIS_TIMESTAMP}}

> library(tidyverse)
> library(effsize)
> ...

[OUTPUT TRUNCATED - See attached .Rout file]
```

#### B.2: SAS PROC MIXED 输出

```sas
/* SAS 输出 */
/* 文件: sas_mixed_model_{{REPORT_ID}}.lst */

PROC MIXED DATA=analysis_set METHOD=ML COVTEST;
  CLASS subject group timepoint;
  MODEL outcome = group timepoint group*timepoint / SOLUTION DDFM=KR;
  REPEATED timepoint / SUBJECT=subject TYPE=CS TYPE=UN;
RUN;

[OUTPUT TRUNCATED - See attached .lst file]
```

### 附录 C: 图表清单

| 图编号 | 图标题 | 文件名 | 页码 |
|--------|--------|--------|------|
| 图 4-1 | 功效指标变化趋势图 | efficacy_trend.png | {{PAGE_FIG41}} |
| 图 4-2 | 应答率 Forest Plot | response_forest_plot.png | {{PAGE_FIG42}} |
| 图 5-1 | 浓度-时间曲线 (C-T) | ct_curve.png | {{PAGE_FIG51}} |
| 图 5-2 | 效应-时间曲线 (E-T) | et_curve.png | {{PAGE_FIG52}} |
| 图 5-3 | Bland-Altman 一致性图 | bland_altman.png | {{PAGE_FIG53}} |
| 图 5-4 | 协同机制雷达图 | synergy_radar.png | {{PAGE_FIG54}} |
| 图 5-5 | 成分相互作用热力图 | synergy_heatmap.png | {{PAGE_FIG55}} |

### 附录 D: 伦理与注册信息

- **伦理批件编号**: {{IRB_APPROVAL_NUMBER}}
- **伦理委员会**: {{IRB_NAME}}
- **批准日期**: {{IRB_APPROVAL_DATE}}
- **临床试验注册号**: {{TRIAL_REGISTRY_NUMBER}} ({{REGISTRY_PLATFORM}})
- **注册日期**: {{TRIAL_REGISTRATION_DATE}}
- **方案版本**: {{PROTOCOL_VERSION}} ({{PROTOCOL_DATE}})
- **知情同意书版本**: {{ICF_VERSION}} ({{ICF_DATE}})

### 附录 E: 利益冲突声明

**作者利益冲突**:
- {{AUTHOR_1_NAME}}: {{COI_AUTHOR_1}} (无/有: {{COI_DETAILS_1}})
- {{AUTHOR_2_NAME}}: {{COI_AUTHOR_2}} (无/有: {{COI_DETAILS_2}})
- ... 

**资金来源**: 本研究的资金支持来自 {{FUNDING_SOURCE}} (资助编号: {{GRANT_NUMBER}})

**声明**: 所有作者均已阅读并理解《国际医学期刊编辑委员会 (ICMJE)》关于利益冲突披露的要求，并如实报告了所有可能影响研究客观性的关系。

### 附录 F: 数据可用性声明

**原始数据获取方式**:
- 去标识化的原始数据集可在 {{DATA_REPOSITORY}} 平台获取
- 数据访问申请邮箱: {{DATA_ACCESS_EMAIL}}
- 数据使用协议: 必须签署 {{DATA_USE_AGREEMENT}}
- 数据保留期限: 自发表之日起 {{DATA_RETENTION_PERIOD}} 年

**分析与代码共享**:
- 统计分析代码已上传至 {{CODE_REPOSITORY}} (GitHub/GitLab)
- DOI: {{CODE_DOI}}
- 许可协议: {{CODE_LICENSE}} (MIT/Apache-2.0/GPL-3.0)

---

## 📝 报告审批记录

| 角色 | 姓名 | 签名 | 日期 | 意见 |
|------|------|------|------|------|
| 报告撰写人 | {{AUTHOR_NAME}} | ____________ | {{AUTHOR_DATE}} | - |
| 数据分析师 | {{STATISTICIAN_NAME}} | ____________ | {{STATISTICIAN_DATE}} | {{STATISTICIANT_COMMENTS}} |
| 实验负责人 | {{PI_NAME}} | ____________ | {{PI_DATE}} | {{PI_COMMENTS}} |
| 质量保证 (QA) | {{QA_NAME}} | ____________ | {{QA_DATE}} | {{QA_COMMENTS}} | 
| 科学审查 (SR) | {{SR_NAME}} | ____________ | {{SR_DATE}} | {{SR_COMMENTS}} |
| 最终批准 | {{APPROVER_NAME}} | ____________ | {{APPROVER_DATE}} | {{APPROVER_COMMENTS}} |

---

**报告结束**

*本文档由 RMFOOD 配方平台自动生成*
*生成时间: {{GENERATION_TIMESTAMP}}*
*模板版本: v1.0.0*
*下次更新: {{NEXT_UPDATE_DATE}}*

---

## 📖 使用说明

### 如何填写此模板

1. **替换占位符**: 将所有 `{{VARIABLE_NAME}}` 替换为实际数值或文本
2. **删除无效章节**: 根据研究类型选择性地保留或删除某些章节
3. **插入图表**: 将生成的图片放入 `figures/` 目录并更新引用路径
4. **导出格式**: 支持 Markdown → PDF/Word/HTML 多种格式导出

### 自动填充工具

平台提供了 Python 脚本来辅助填充此模板：

```python
from scripts.validation_report_generator import ValidationReportGenerator

generator = ValidationReportGenerator(
    template_path="docs/VALIDATION_REPORT_TEMPLATE.md",
    output_path="reports/validation_{{FORMULA_ID}}_{{DATE}}.md",
    formula_id="{{FORMULA_ID}}"
)

# 从数据库加载实验数据
generator.load_experiment_data(experiment_id="{{EXPERIMENT_ID}}")

# 自动填充各章节
generator.fill_executive_summary()
generator.fill_methods_section()
generator.fill_results_section()
generator.fill_discussion_section()

# 生成最终报告
report = generator.generate()
print(f"报告已生成: {report.output_path}")
```

---

**版权所有 © 2026 RMFOOD 配方平台. 保留所有权利.**
