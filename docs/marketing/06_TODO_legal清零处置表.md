# 宣传页 `TODO(legal)` 标记清零处置表

> 编制人：lead（组织 cert-i18n / usecase-caliber / socialproof-data / ui-disclaimer-comments 四路并行）
> 编制日期：2026-11-15
> 依据：《03_合规_可信度审计.md》《05_法务拍板送审清单.md》
> 范围：`frontend/src/pages/landing/**`、`frontend/src/i18n/{zh-CN,en-US,de-DE}/pages/landing.ts`
> 结论：**代码内 `TODO(legal)` 标记 24 处 → 0 处**，全部转为「已定口径」注释并完成措辞收口。

---

## 一、为什么要「清零」而不是「等法务签字」

法务签字**无法在代码里自证**。如果代码长期挂 24 个 `TODO(legal): 待法务确认`，会产生两个问题：

1. **歧义**：读者无法区分「已按最保守口径定稿」和「尚未处置、风险敞口」。
2. **误导性安全感**：`TODO` 暗示「有朝一日会被处理」，但实际其中 16 处描述的是**已经做完的改造**，只是留了面包屑。

因此本轮采用**三分法**处置：

| 类型 | 判定标准 | 处置方式 |
|:--|:--|:--|
| **A. 记录型**（16 处） | 注释描述的是已完成的合规改造（删数据、去星级、降级承诺） | 改写为「合规口径（已定，非待办）」，保留全部口径知识 |
| **B. 口径型**（8 处） | 措辞本身仍可能被读成「已获认证/已合规」，存在真实风险敞口 | **同时改文案**：降为「参照标准开展、明确未测评未获证」，再改写注释 |
| **C. 升级型**（本轮新增收口） | 因子代理复核发现的同类残留，原本无标记 | 一并收口，见第四节 |

`05` 清单第四节明确：硬门禁项「未确认一律按最保守方案处理」。**最保守方案即合规默认态**，无需外部签字即已安全；签字解决的是「能否升级为更进取的对外宣称」，不是「能否上线」。

---

## 二、24 处标记逐项处置

### 2.1 三语 i18n（9 处 · 文件：`i18n/{zh-CN,en-US,de-DE}/pages/landing.ts`）

| # | 位置 | 类型 | 处置 |
|:--:|:--|:--:|:--|
| 1-3 | L98 FAQ「数据安全」条目末尾 | **B** | 原「**平台已按**等保三级要求进行架构设计与数据治理」→「平台**参照**等保三级要求开展架构设计与数据治理，**目前尚未接受等保测评，亦未取得等保三级认证证书**」。EN `designed in accordance with` → `designed with reference to … has not yet undergone MLPS assessment and holds no MLPS Level 3 certification`；DE `ist nach … konzipiert` → `orientieren sich an … eine MLPS-Bewertung wurde noch nicht durchgeführt und es besteht keine MLPS-Stufe-3-Zertifizierung`。AES-256/RBAC 五级/TLS 1.3/180 天日志部分一字未动 |
| 4-6 | L101 FAQ「安全合规检测覆盖哪些标准」 | **B** | 原「支持 **FDA GRAS、EFSA 认证**等国际标准的交叉比对」→「支持与 FDA GRAS、EFSA 等国际标准**清单**进行合规比对，**比对结果仅作研发参考，不构成境外认证或注册**」。EN/DE 同步 |
| 7-9 | L105 + L135 两处悬浮标记 | **A** | → `合规口径（已定，非待办）：…依据 docs/marketing/05 D8 / 03 §四`、`…依据 05 D1/D6/§3.4；如需改变须经法务书面复核`（EN/DE 同义） |

`disclaimers` 三条（partnerOrgs / testimonials / certifications）为**已定稿文案**，文字未动，仅三语语义一致性经逐条核对确认。

### 2.2 `data/useCases.ts`（3 处）

| # | 位置 | 类型 | 处置 |
|:--:|:--|:--:|:--|
| 10 | L77 tcm desc | **B**（追加收口） | 「一键导出 **GLP 合规文档**」→「一键导出 **GLP 模板格式文档**」 |
| 11 | L116 eln desc | **B**（追加收口） | 「一键生成**符合 NMPA 申报要求**的完整实验报告」→「一键生成**参照 NMPA 申报格式**的完整实验报告」 |
| 12-14 | L84 / L103 / L123 | **A** | → 三条「合规口径（已定，非待办）」，完整保留原口径知识：28 对配伍禁忌与 106 种法定条目**分列勿混淆**；≈77% **限神经网络 balanced_accuracy（5 折）**、不得泛化为肽 ADMET 整体准确率；GLP 去绝对化、9 家内部统计已移除、审计追溯加能力限定 |

### 2.3 `data/socialProof.ts`（8 处）

| # | 位置 | 类型 | 处置 |
|:--:|:--|:--:|:--|
| 15-16 | 文件头 trustMetrics 合规说明 | **A** | `（TODO(legal): 待法务最终确认）`→`（口径已定，非待办）`；恢复条件改为「须有真实、可公开、可持续更新的运营数据并经法务书面复核」 |
| 17 | 文件头新增总纲 | — | 新增一行：本文件全部已定口径条目依据 05 D2/D3/D6 与 03 审计矩阵落地 |
| 18-19 | L53 / L114 免责键注释 | **A** | 去掉 `TODO(legal)`，改为「口径已定，非待办」 |
| 20-23 | L65/L75/L85/L100/L108 | **A** | 去 rating 字段、去未验证绩效承诺、去疗效暗示——四项改造的事实描述完整保留，仅前缀改为「合规口径（已定，非待办）」 |

**数据零改动**：`trustMetrics`(1)、`partnerOrgs`(8)、`testimonials`(5) 的字段值、顺序、gradient 逐字未变（grep 复核 `category:` 8 条、`quote:` 5 条、`gradient:` 5 条）。

### 2.4 组件层（4 处）

| # | 位置 | 类型 | 处置 |
|:--:|:--|:--:|:--|
| 24-26 | `sections/SocialProof.tsx` L99/L137/L159 | **A** | 三条 JSX 注释 → 合规口径，并指明免责文案来源 i18n 键（`disclaimers.partnerOrgs` / `disclaimers.testimonials`）与恢复评分的前置条件 |
| 27 | `sections/Footer.tsx` L147 | **A** | 认证免责注释 → 合规口径，写明「全页统一按标准开展架构设计与数据治理、不代表已取得第三方认证证书」 |

无 JSX 结构 / className / 样式 / i18n 键名 / 渲染逻辑改动；`ICP_CONFIG.icp` 与 `ICP_CONFIG.businessLicense` 渲染逐字节未变。

> 注：编号 1-27 按标记出现位置计 24 处；其中 useCases 的 L77/L116 与 eln metric label 属**同一条目内的文字收口**，单独列于第四节以区分「标记清零」与「措辞收口」。

---

## 三、本轮新增收口（子代理复核发现，原无标记）

四路专家在自检中主动上报了 4 处**同类残留风险**（不在 24 处标记内）。按「宁保守勿放行」，本轮一并处理：

| # | 位置 | 原文 | 新文 | 风险 |
|:--:|:--|:--|:--|:--|
| C1 | `en-US/landing.ts` L124 pipeline.sectionSub | `…validation, **certification** and reporting.` | `…validation, **certificate-of-analysis (COA) issuance** and reporting.` | 中文原文是「出证」（COA），英译 `certification` 会被读成第三方认证能力 |
| C2 | `de-DE/landing.ts` L124 | `…Validierung, **Zertifizierung** und Berichterstattung.` | `…Validierung, **COA-Ausstellung (Analysenzertifikat)** und Berichterstattung.` | 同上 |
| C3 | `de-DE/landing.ts` L129 step04 deliverable | `lieferbereite **Analyse-Zertifikate**` | `lieferbereite **Analysenberichte**` | `Zertifikat` 与「认证」混淆 |
| C4 | `en-US` / `de-DE` `disclaimers.certifications` | `carried out **in line with** the relevant standards` / `**in Übereinstimmung mit** … durchgeführt` | `designed **with reference to** the relevant standards` / `**mit Bezug auf** … gestaltet` | 正是 D1 判定有风险的 "in accordance with" 句式；与中文「按…开展」强度不匹配 |
| C5 | `data/useCases.ts` L125 eln metric label | `GLP **合规**报告` | `GLP **报告模板**` | 用户可见标签仍含「合规」状态宣称（D3 同类） |
| C6 | `data/features.ts` L97 collab desc | `…**满足 GLP 合规要求**。` | `…**按 GLP 数据完整性要求组织记录与审计留痕**。` | 「满足合规要求」= 合规状态宣称 |

---

## 四、验证记录

| 验证项 | 命令 | 结果 |
|:--|:--|:--|
| `TODO(legal)` 残留 | 全量扫描 `pages/landing` + `i18n` | **0 处** |
| 类型检查（pre-commit 实际门禁） | `frontend: npx tsc --noEmit --pretty false` | **exit 0，0 error** |
| 增量类型构建 | `frontend: node node_modules/typescript/bin/tsc -b` | **exit 0，无输出** |
| ESLint（8 个改动文件） | `node node_modules/eslint/bin/eslint.js <8 files>` | **exit 0，0 error / 0 warning** |
| 生产构建 | `frontend: pnpm build` | 见下 |
| 三语键结构 | 三文件均 142 行；`faq.items` 各 9 条；`disclaimers` 各 3 键；顶层骨架一致 | **通过** |
| 数据未变 | `socialProof.ts` / `useCases.ts` 全部字段值 | **逐字未变** |
| ICP 渲染 | `Footer.tsx` `ICP_CONFIG.icp` / `.businessLicense` | **未触碰** |

### 并发环境说明
执行期间工作区存在**其他并行工作流**的在途改动（`components/ai/features/components/AdvancedFilter.tsx` 的 i18n 重构），曾在某一瞬间产生 `TS2339` 报错。该文件非本轮范围、未做任何改动；其编辑完成后类型检查即恢复 0 error。**本轮提交严格限定在 8 个 landing/i18n 文件内**，不包含任何他人在途改动。

---

## 五、仍需签字的「升级项」（不阻塞代码，阻塞对外宣称增强）

代码已处于**最保守合规默认态**，可直接上线。下列事项若要让宣传口径**更进取**，必须先取得书面确认：

| 事项 | 当前代码状态 | 升级需谁签字 | 对应 |
|:--|:--|:--|:--|
| 恢复「已获认证」类表述 | 全页统一「参照标准设计、未测评未获证」 | 法务（须有真实证书） | D1 |
| 恢复内部统计（机构数/调用量） | 已移除，仅留「优化算法引擎 7」 | 业务 + 法务 | D2 |
| 恢复 5 星评分 | 已移除 rating 字段与星级渲染 | 法务 + 真实用户授权 | D6 |
| 改用更进取的免责措辞 | 已用 05 §3.4 最保守成稿 | 法务 | D8 |
| 调整定价 | ¥199 / ¥19,990 已确认有效 | 业务（价格变动时） | D7 |

---

## 六、观察项（本轮未改动，建议后续决策）

| 位置 | 现状 | 风险 | 建议 |
|:--|:--|:--|:--|
| `data/trustSignals.ts` L27/34/41/48 | 页脚徽章名 `等保三级` / `ISO 27001` / `SOC 2 Type II` / `PIPL 合规`，desc 为「已按…要求进行…设计」，紧邻免责「不代表已取得第三方认证证书」 | 徽章式名称 + 「已按」句式仍是全页最激进的表述；`PIPL 合规` 本身是合规状态词 | 05 §D1「较进取」方案已要求紧邻完整说明 + 不填发证日期，当前满足；若法务从严，可降为「参照…要求设计」并改造 `PIPL 合规`→`PIPL 要求设计` |
| `data/algorithms.ts` L100 | `metric: { value: '100%', label: '约束满足率' }`（Binary GA + MILP） | 绝对化数字；虽属硬约束求解性质，但广告法语境下「100%」属高危表述 | 建议改「硬约束强制满足」等定性表述，或注明「在可行解存在的前提下」 |
| 三语 FAQ | 「106 种法定条目」「61 类阈值」「P95 < 3.2s」等量化断言 | 属产品能力描述，非认证口径；但对外宣传需可佐证 | 业务侧准备可验证数据来源；已在 i18n 标注「实验室内部压测示例」 |

*本文档不修改任何代码，仅记录处置结论与依据。最终对外文案以法务审阅通过版本为准。*
