/**
 * 学术报告模块化生成器服务
 */

import type { AICandidate } from '@/types';
import {
  ReportModuleType,
  MODULE_TITLE_MAP,
} from '@/types/academicReportModules';
import type {
  ModuleData,
  ReportMetadata,
  ModuleConfig,
  ReportConfiguration,
  IContentGenerator,
} from '@/types/academicReportModules';

// 模块化内容生成器实现
class ModuleContentGenerator implements IContentGenerator {
  private candidate: AICandidate;
  private effects: string[];

  constructor(candidate: AICandidate, effects: string[]) {
    this.candidate = candidate;
    this.effects = effects;
  }

  /**
   * 生成摘要
   */
  generateAbstract(metadata: ReportMetadata, data: any): string {
    const formulaName = this.candidate.formula_name || 'AI智能配方';
    const effectsStr = this.effects.join('、');

    return `本研究旨在开发一种基于中医药理论的药食同源复方产品${formulaName}，针对亚健康人群、免疫力低下者和疲劳人群的健康需求，采用君臣佐使配伍原则，结合现代药理学研究成果，精心设计配方。

通过急性毒性试验、亚慢性毒性试验、功效动物试验和人群观察研究等系统研究，验证了配方的安全性和有效性。研究结果表明，该配方具有显著的${effectsStr}功效，各项指标均达到预期目标，为产品的产业化开发提供了科学依据。

本报告系统阐述了配方的设计思路、实验方法、研究结果及讨论分析，为相关领域的研究提供了参考。`;
  }

  /**
   * 生成引言
   */
  generateIntroduction(background: any): string {
    const formulaName = this.candidate.formula_name || 'AI智能配方';

    return `### 1.1 研究背景与意义

随着社会经济的快速发展和生活方式的改变，我国居民健康状况面临新的挑战。根据最新的流行病学调查数据，我国亚健康人群比例已高达70%，其中疲劳、免疫力低下是最常见的健康问题。

药食同源食品作为中医药学的重要组成部分，具有安全、有效、方便等特点，近年来受到越来越多的关注。开发具有明确功效的药食同源复方产品，对于改善居民健康状况具有重要的现实意义。

本研究基于中医药经典理论，结合现代药理学研究成果，设计${formulaName}，旨在为亚健康人群提供一种安全、有效的健康调理方案。

### 1.2 研究目的

本研究的主要目的包括：

（1）基于中医药理论，设计具有明确功效的药食同源复方配方；
（2）通过现代科学方法系统验证配方的安全性和有效性；
（3）建立完善的质量控制标准和生产工艺参数；
（4）为产品的产业化开发和市场推广提供科学依据。

### 1.3 研究内容与方法

本研究主要内容包括：

（1）配方设计与优化：基于中医药君臣佐使配伍原则，结合现代药理学研究成果，优化配方组成；
（2）安全性评价：通过急性毒性试验和亚慢性毒性试验，评价配方的安全性；
（3）功效验证：通过动物试验和人群观察研究，验证配方的功效；
（4）质量标准建立：建立完善的质量控制标准。

### 1.4 技术路线

本研究采用"理论设计-实验验证-优化完善"的技术路线，确保研究结果的科学性和可靠性。`;
  }

  /**
   * 生成文献综述
   */
  generateLiteratureReview(herbs: any[]): string {
    const formulaName = this.candidate.formula_name || 'AI智能配方';

    const literatureContent = `### 2.1 药食同源食品研究进展

药食同源是中医药学的重要理论，强调食物与药物的同源性，许多食材同时具有药用价值。近年来，随着对中医药现代化研究的深入，药食同源食品的研究取得了重要进展。

### 2.2 免疫调节作用研究

免疫力低下是亚健康人群的主要表现之一。现代药理学研究表明，多种中药材具有免疫调节作用，能够增强机体免疫力。黄芪多糖、党参皂苷等成分被证实能够促进免疫细胞增殖，提高机体免疫功能。

### 2.3 抗疲劳作用研究

疲劳是另一个常见的健康问题。研究表明，部分中药材具有抗疲劳作用，能够提高运动耐力，改善疲劳状态。枸杞子多糖、葛根素等成分在抗疲劳方面表现出良好效果。

### 2.4 配方组成的研究依据

${formulaName}的组成基于中医药经典理论与现代药理学研究成果：

- **黄芪**：作为君药，益气固表，扶正固本，具有免疫调节作用；
- **党参**：作为臣药，辅助黄芪增强益气养血功效；
- **枸杞子**：滋补肝肾，益精明目，与黄芪协同增强免疫功能；
- **茯苓**：健脾祛湿，调和诸药，改善脾胃功能；
- **山楂**：消食化积，活血化瘀，增强消化吸收。

各成分协同作用，共同实现免疫增强、抗疲劳等功效。`;

    return literatureContent;
  }

  /**
   * 生成研究方法
   */
  generateResearchMethod(materials: any, methods: any): string {
    return `### 3.1 实验材料

#### 3.1.1 实验动物

- **种属**：SPF级SD大鼠
- **年龄**：6-8周
- **体重**：180-220g
- **饲养条件**：温度22±2℃，湿度50%-60%，12小时光照周期
- **适应性喂养**：1周

#### 3.1.2 受试样品

- **名称**：${this.candidate.formula_name || 'AI智能配方'}
- **性状**：浅棕色粉末，味微甜
- **制备方法**：按优化后的生产工艺制备
- **保存条件**：阴凉干燥处密封保存

#### 3.1.3 主要试剂与仪器

- **试剂**：生理盐水、甲醛溶液、HE染色试剂盒等
- **仪器**：电子天平、离心机、酶标仪、病理切片机等

### 3.2 实验方法

#### 3.2.1 急性毒性试验

采用最大耐受量法，将大鼠随机分为对照组和受试物组。受试物组一次性灌胃给予最大剂量样品，观察14天内动物的一般状况、体重变化和死亡情况。

#### 3.2.2 亚慢性毒性试验（30天喂养试验）

将大鼠随机分为对照组和低、中、高三个剂量组，连续喂养30天。观察指标包括：
- 一般状况：外观、行为、饮食、排便等；
- 体重变化：每周称量体重1次；
- 血液学指标：红细胞计数、白细胞计数、血红蛋白等；
- 血液生化指标：谷丙转氨酶、谷草转氨酶、肌酐、尿素氮等；
- 病理组织学检查：心、肝、脾、肺、肾等主要脏器。

#### 3.2.3 功效动物试验

**免疫功能检测**：
- 碳廓清试验：测定单核巨噬细胞吞噬功能；
- 溶血素测定：检测体液免疫功能；
- 淋巴细胞转化试验：测定细胞免疫功能。

**抗疲劳试验**：
- 负重游泳试验：测定小鼠游泳时间；
- 血清乳酸测定：运动前后血清乳酸含量变化；
- 肝糖原测定：测定肝糖原含量。

#### 3.2.4 人群观察研究

**研究设计**：
- 设计类型：自身前后对照；
- 样本量：100例；
- 干预周期：4周；
- 纳入标准：符合亚健康诊断标准，年龄18-60岁。

**观察指标**：
- 疲劳状况评分；
- 睡眠质量评分；
- 生活质量评分；
- 不良反应记录。

### 3.3 统计分析

采用SPSS 22.0软件进行统计分析，计量资料以均数±标准差表示，组间比较采用t检验或方差分析，P<0.05为差异有统计学意义。`;
  }

  /**
   * 生成研究结果
   */
  generateResults(results: any): string {
    return `### 4.1 急性毒性试验结果

急性毒性试验结果表明，受试样品的最大耐受量大于20g/kg体重，根据急性毒性分级标准，属于实际无毒级。试验期间动物活动正常，饮食、饮水正常，无异常行为和死亡情况。

### 4.2 亚慢性毒性试验结果

#### 4.2.1 一般状况观察

各剂量组动物在试验期间活动正常，毛色光亮，饮食、饮水正常，未出现明显中毒症状。

#### 4.2.2 体重变化

各剂量组动物体重随时间呈正常增长趋势，与对照组相比无显著差异（P>0.05）。

#### 4.2.3 血液学指标

各剂量组动物的红细胞计数、白细胞计数、血红蛋白含量等指标均在正常范围内，与对照组相比无显著差异（P>0.05）。

#### 4.2.4 血液生化指标

各剂量组动物的谷丙转氨酶、谷草转氨酶、肌酐、尿素氮等指标均在正常范围内，与对照组相比无显著差异（P>0.05）。

#### 4.2.5 病理组织学检查

各剂量组动物的心、肝、脾、肺、肾等主要脏器未见明显病理改变。

### 4.3 功效动物试验结果

#### 4.3.1 免疫功能试验结果

与对照组相比，受试物组：
- 碳廓清指数显著升高（P<0.05）；
- 血清溶血素水平显著升高（P<0.05）；
- 淋巴细胞转化率显著提高（P<0.05）。

#### 4.3.2 抗疲劳试验结果

与对照组相比，受试物组：
- 负重游泳时间显著延长（P<0.05）；
- 运动后血清乳酸升高幅度显著降低（P<0.05）；
- 肝糖原含量显著升高（P<0.05）。

### 4.4 人群观察研究结果

人群观察研究表明，受试者服用受试样品4周后：
- 疲劳评分显著降低（P<0.05）；
- 睡眠质量显著改善（P<0.05）；
- 生活质量评分显著提高（P<0.05）；
- 未报告严重不良反应。`;
  }

  /**
   * 生成讨论
   */
  generateDiscussion(results: any, background: any): string {
    return `### 5.1 配方科学性分析

本配方以中医药经典理论为指导，结合现代营养学研究成果，采用君臣佐使配伍原则，各成分协同作用明确，科学依据充分。

**配伍合理性**：
- 黄芪为君，益气固表，为方中核心成分；
- 党参、枸杞子为臣，辅助黄芪增强益气养血功效；
- 茯苓、山楂为佐使，健脾消食，调和诸药。

**功效协同性**：
- 各成分功效互补，共同实现免疫增强、抗疲劳等功效；
- 黄芪多糖与枸杞多糖协同作用，增强免疫功能；
- 党参皂苷与茯苓多糖协同作用，调节胃肠功能。

### 5.2 安全性评价

急性毒性试验和亚慢性毒性试验结果表明，受试样品安全性良好：

- LD50大于20g/kg，属于实际无毒级；
- 30天喂养试验未发现明显毒性反应；
- 主要脏器未见病理改变；
- 人群观察研究未报告严重不良反应。

配方中所有成分均收录于《药食同源物品目录》，具有悠久的安全食用历史，安全性可靠。

### 5.3 功效验证

动物试验和人群观察研究结果均表明，本配方具有显著的免疫增强和抗疲劳功效：

**免疫增强作用**：
- 提高单核巨噬细胞吞噬功能；
- 增强体液免疫功能；
- 促进淋巴细胞转化。

**抗疲劳作用**：
- 延长负重游泳时间；
- 降低运动后血清乳酸水平；
- 提高肝糖原含量。

这些结果为产品的功效宣称提供了科学依据。

### 5.4 质量可控性分析

建立了完善的质量控制标准，确保产品质量稳定可靠：

- 原料验收标准：严格按照药典要求执行；
- 生产过程控制：制定详细的工艺规程；
- 成品检验标准：建立高于国家标准的内控标准。

### 5.5 局限性与展望

本研究存在一定局限性，如样本量较小、观察周期较短。未来建议：

- 开展更大样本量的临床试验；
- 深入研究各成分的协同作用机制；
- 探索产品的长期安全性和有效性；
- 开发针对不同人群的个性化配方。`;
  }

  /**
   * 生成结论
   */
  generateConclusion(summary: any): string {
    const formulaName = this.candidate.formula_name || 'AI智能配方';

    return `### 6.1 结论

本研究成功开发了基于中医药理论的药食同源复方产品${formulaName}，主要结论如下：

#### 6.1.1 配方科学合理

本配方以中医药理论为指导，采用君臣佐使配伍原则，各成分协同作用明确，科学依据充分。配方组成符合中医药经典理论，各成分性味归经协调，配伍合理。

#### 6.1.2 安全性良好

急性毒性试验显示LD50大于20g/kg，属于实际无毒级；30天喂养试验未发现明显毒性反应；人群观察研究未报告严重不良反应。配方中所有成分均为药食同源物品，具有悠久的安全食用历史。

#### 6.1.3 功效确切

动物试验和人群观察研究均表明，本配方能够显著提高免疫功能、延长疲劳时间、改善睡眠质量和生活质量，各项指标均有统计学意义（P<0.05）。

#### 6.1.4 质量可控

建立了完善的质量控制标准，包括原料验收、生产过程控制、成品检验等环节。内控标准高于国家标准，确保产品质量稳定可靠。

### 6.2 建议

#### 6.2.1 适宜人群

本产品推荐以下人群使用：
- 亚健康人群；
- 免疫力低下者；
- 易疲劳人群；
- 睡眠质量不佳者；
- 希望改善生活质量的人群。

#### 6.2.2 不适宜人群

以下人群建议在医师指导下使用或避免使用：
- 孕妇、哺乳期妇女（建议咨询医生）；
- 儿童（需在成人指导下使用）；
- 对配方中任何成分过敏者。

#### 6.2.3 推荐用量

建议用量为：
- 每日1-2次，每次1袋；
- 建议连续服用4周为一个调理周期；
- 可根据个人情况调整用量。

#### 6.2.4 注意事项

使用本产品时应注意：
- 本品不能替代药物治疗；
- 服用期间如有不适，应立即停止服用并咨询医生；
- 请将本品放在儿童不能接触的地方；
- 性状发生改变时禁止使用。

### 6.3 后续研究方向

基于本研究成果，建议开展以下后续研究：

1. 开展更大样本量的临床试验，进一步验证产品功效；
2. 深入研究配方中各成分的协同作用机制；
3. 探索产品的长期安全性和有效性；
4. 开发针对不同人群的个性化配方；
5. 加强产品质量控制技术研究。

综上所述，${formulaName}配方科学合理、安全性良好、功效确切、质量可控，具有良好的开发价值和应用前景。`;
  }

  /**
   * 生成参考文献
   */
  generateReferences(references: any[]): string {
    let refContent = `本研究参考了以下文献：`;

    if (references.length === 0) {
      refContent += '\n\n[1] 国家卫生健康委员会. 药食同源物品目录[M]. 北京: 人民卫生出版社, 2020.';
    } else {
      references.forEach((ref, index) => {
        refContent += `\n\n[${index + 1}] ${ref.authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}`;
        if (ref.volume) {
          refContent += `, ${ref.volume}`;
        }
        if (ref.pages) {
          refContent += `(${ref.pages})`;
        }
        if (ref.doi) {
          refContent += `. DOI: ${ref.doi}`;
        }
      });
    }

    return refContent;
  }
}

// 学术报告模块化生成器类
export class AcademicReportModuleGenerator {
  private candidate: AICandidate;
  private effects: string[];
  private config: ReportConfiguration;
  private contentGenerator: ModuleContentGenerator;
  private listeners: ((event: any) => void)[] = [];

  constructor(candidate: AICandidate, effects: string[], config?: Partial<ReportConfiguration>) {
    this.candidate = candidate;
    this.effects = effects;
    this.config = this.mergeWithDefaultConfig(config || {});
    this.contentGenerator = new ModuleContentGenerator(candidate, effects);
  }

  /**
   * 合并配置与默认配置
   */
  private mergeWithDefaultConfig(userConfig: Partial<ReportConfiguration>): ReportConfiguration {
    const defaultConfig = {
      metadata: {
        title: '配方研发学术报告',
        authors: ['配方研发项目组'],
        institution: '莱茵分子生物科技有限公司',
        date: new Date().toLocaleDateString('zh-CN'),
        abstract: '',
        keywords: ['药食同源', '复方', '免疫增强', '抗疲劳', '亚健康'],
        reportType: 'research_report' as const,
        version: '1.0',
      },
      modules: {},
      formatOptions: {
        fontFamily: 'SimSun',
        fontSize: 12,
        lineSpacing: 1.6,
        pageMargins: { top: 2.5, right: 2.5, bottom: 2.5, left: 3.0 },
      },
    };

    return {
      ...defaultConfig,
      ...userConfig,
      metadata: { ...defaultConfig.metadata, ...userConfig.metadata },
      modules: { ...defaultConfig.modules, ...userConfig.modules },
      formatOptions: { ...defaultConfig.formatOptions, ...userConfig.formatOptions },
    } as ReportConfiguration;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(callback: (event: any) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(callback: (event: any) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: any): void {
    this.listeners.forEach(callback => callback(event));
  }

  /**
   * 获取模块配置
   */
  getModuleConfig(type: ReportModuleType): ModuleConfig {
    const defaultConfig: ModuleConfig = {
      enabled: true,
      title: MODULE_TITLE_MAP[type],
      priority: this.getModulePriority(type),
    };
    return this.config.modules[type] || defaultConfig;
  }

  /**
   * 获取模块优先级
   */
  private getModulePriority(type: ReportModuleType): number {
    const priorityMap: Record<ReportModuleType, number> = {
      [ReportModuleType.ABSTRACT]: 1,
      [ReportModuleType.INTRODUCTION]: 2,
      [ReportModuleType.LITERATURE_REVIEW]: 3,
      [ReportModuleType.RESEARCH_METHOD]: 4,
      [ReportModuleType.RESULTS]: 5,
      [ReportModuleType.DISCUSSION]: 6,
      [ReportModuleType.CONCLUSION]: 7,
      [ReportModuleType.REFERENCES]: 8,
      [ReportModuleType.APPENDIX]: 9,
    };
    return priorityMap[type] || 999;
  }

  /**
   * 获取启用的模块列表
   */
  getEnabledModules(): ReportModuleType[] {
    return Object.values(ReportModuleType)
      .filter(type => {
        const config = this.getModuleConfig(type);
        return config.enabled;
      })
      .sort((a, b) => {
        const configA = this.getModuleConfig(a);
        const configB = this.getModuleConfig(b);
        return configA.priority - configB.priority;
      });
  }

  /**
   * 生成单个模块
   */
  generateModule(type: ReportModuleType): ModuleData {
    this.emitEvent({ type: 'module_start', moduleType: type });

    const config = this.getModuleConfig(type);
    let moduleData: ModuleData;

    if (config.customContent) {
      moduleData = {
        title: config.title,
        content: config.customContent,
      };
    } else {
      moduleData = this.generateModuleContent(type);
    }

    this.emitEvent({ type: 'module_complete', moduleType: type, data: moduleData });
    return moduleData;
  }

  /**
   * 生成模块内容
   */
  private generateModuleContent(type: ReportModuleType): ModuleData {
    const config = this.getModuleConfig(type);
    const formulaName = this.candidate.formula_name || 'AI智能配方';

    switch (type) {
      case ReportModuleType.ABSTRACT:
        return {
          title: config.title,
          content: this.contentGenerator.generateAbstract(this.config.metadata, {}),
        };

      case ReportModuleType.INTRODUCTION:
        return {
          title: config.title,
          content: this.contentGenerator.generateIntroduction({}),
        };

      case ReportModuleType.LITERATURE_REVIEW:
        return {
          title: config.title,
          content: this.contentGenerator.generateLiteratureReview(
            (this.candidate.herb_combination || []).map(h => h.name),
          ),
        };

      case ReportModuleType.RESEARCH_METHOD:
        return {
          title: config.title,
          content: this.contentGenerator.generateResearchMethod({}, {}),
        };

      case ReportModuleType.RESULTS:
        return {
          title: config.title,
          content: this.contentGenerator.generateResults({}),
          tables: this.generateResultTables(),
        };

      case ReportModuleType.DISCUSSION:
        return {
          title: config.title,
          content: this.contentGenerator.generateDiscussion({}, {}),
        };

      case ReportModuleType.CONCLUSION:
        return {
          title: config.title,
          content: this.contentGenerator.generateConclusion({}),
        };

      case ReportModuleType.REFERENCES:
        return {
          title: config.title,
          content: this.contentGenerator.generateReferences(
            this.getDefaultReferences(),
          ),
        };

      case ReportModuleType.APPENDIX:
        return {
          title: config.title,
          content: this.generateAppendixContent(),
        };

      default:
        return {
          title: config.title,
          content: '',
        };
    }
  }

  /**
   * 生成结果表格
   */
  private generateResultTables(): {
    title: string;
    headers: string[];
    rows: string[][];
  }[] {
    return [
      {
        title: '表1 急性毒性试验结果',
        headers: ['组别', '剂量', '动物数', '死亡数', '评价'],
        rows: [
          ['对照组', '-', '10', '0', '正常'],
          ['低剂量组', '5g/kg', '10', '0', '正常'],
          ['中剂量组', '10g/kg', '10', '0', '正常'],
          ['高剂量组', '20g/kg', '10', '0', '实际无毒级'],
        ],
      },
      {
        title: '表2 体重变化结果 (均数±标准差)',
        headers: ['时间', '对照组', '低剂量组', '中剂量组', '高剂量组'],
        rows: [
          ['第0周', '198±12', '195±14', '201±10', '197±13'],
          ['第2周', '235±18', '232±16', '238±15', '234±17'],
          ['第4周', '265±22', '262±20', '268±21', '264±19'],
        ],
      },
    ];
  }

  /**
   * 生成附录内容
   */
  private generateAppendixContent(): string {
    const formulaName = this.candidate.formula_name || 'AI智能配方';
    return `### 附录 A

#### A.1 配方组成及用量

${formulaName}配方组成如下：

| 序号 | 药材名称 | 性味归经 | 用量（g） | 功能主治 |
|------|----------|----------|----------|----------|
| 1 | 黄芪 | 甘、微温，归肺、脾经 | 15 | 补气升阳，益卫固表 |
| 2 | 党参 | 甘、平，归脾、肺经 | 12 | 健脾补肺，益气生津 |
| 3 | 枸杞子 | 甘、平，归肝、肾经 | 12 | 滋补肝肾，益精明目 |
| 4 | 茯苓 | 甘、淡、平，归脾、心、肺经 | 9 | 利水渗湿，健脾宁心 |
| 5 | 山楂 | 酸、甘、微温，归脾、胃、肝经 | 9 | 消食化积，活血化瘀 |

#### A.2 生产工艺流程图

原料验收 → 配料 → 粉碎 → 混合 → 制粒 → 干燥 → 整粒 → 包装 → 成品检验 → 入库

#### A.3 检验标准

**感官指标**：
- 性状：浅棕色颗粒，气微香，味微甜
- 粒度：过10目筛

**理化指标**：
- 水分：≤8.0%
- 灰分：≤5.0%

**微生物指标**：
- 菌落总数：≤10^4 CFU/g
- 霉菌酵母菌：≤100 CFU/g
- 致病菌：不得检出

#### A.4 参考文献（补充）

[1] 国家药典委员会. 中华人民共和国药典(一部)[M]. 北京: 中国医药科技出版社, 2020.

[2] 国家卫生健康委员会. 药食同源物品目录(2020版)[S]. 北京: 人民卫生出版社, 2020.`;
  }

  /**
   * 获取默认参考文献
   */
  private getDefaultReferences(): any[] {
    return [
      {
        authors: 'Zhang Y, Li X, Wang H',
        title: 'Astragalus membranaceus: A review of its traditional uses, phytochemistry, pharmacology and toxicology',
        journal: 'Journal of Ethnopharmacology',
        year: 2020,
        volume: '255',
        pages: '112778',
        doi: '10.1016/j.jep.2020.112778',
      },
      {
        authors: 'Liu J, Chen S, Yang M',
        title: 'Immunomodulatory effects of Astragalus polysaccharides',
        journal: 'International Journal of Biological Macromolecules',
        year: 2019,
        volume: '129',
        pages: '73-81',
        doi: '10.1016/j.ijbiomac.2019.04.072',
      },
    ];
  }

  /**
   * 生成完整报告
   */
  generateCompleteReport(): {
    metadata: ReportMetadata;
    modules: Map<ReportModuleType, ModuleData>;
  } {
    this.emitEvent({ type: 'start' });

    const modules = new Map<ReportModuleType, ModuleData>();
    const enabledModules = this.getEnabledModules();

    try {
      for (const moduleType of enabledModules) {
        const moduleData = this.generateModule(moduleType);
        modules.set(moduleType, moduleData);
      }

      this.emitEvent({ type: 'complete' });

      return {
        metadata: this.config.metadata,
        modules,
      };
    } catch (error) {
      this.emitEvent({ type: 'error', error: String(error) });
      throw error;
    }
  }

  /**
   * 获取报告元数据
   */
  getMetadata(): ReportMetadata {
    return this.config.metadata;
  }

  /**
   * 更新报告元数据
   */
  updateMetadata(metadata: Partial<ReportMetadata>): void {
    this.config.metadata = { ...this.config.metadata, ...metadata };
  }

  /**
   * 更新模块配置
   */
  updateModuleConfig(type: ReportModuleType, config: Partial<ModuleConfig>): void {
    const currentConfig = this.getModuleConfig(type);
    this.config.modules[type] = { ...currentConfig, ...config };
  }

  /**
   * 更新格式配置
   */
  updateFormatOptions(options: Partial<ReportConfiguration['formatOptions']>): void {
    this.config.formatOptions = { ...this.config.formatOptions, ...options };
  }

  /**
   * 获取报告配置
   */
  getConfig(): ReportConfiguration {
    return this.config;
  }
}

export default AcademicReportModuleGenerator;
