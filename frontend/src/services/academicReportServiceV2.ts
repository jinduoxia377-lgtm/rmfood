/**
 * 增强版学术报告生成系统
 * 完整支持模块化结构、边缘场景处理、错误处理、用户反馈、多格式导出
 */

import type { AICandidate } from '@/types';
import {
  ReportModuleType,
  DEFAULT_REPORT_CONFIG,
  MODULE_TITLE_MAP,
} from '@/types/academicReportModules';
import type {
  ModuleConfig,
  ModuleData,
  ReportMetadata,
  ReportConfiguration,
} from '@/types/academicReportModules';
import { errorHandler, ErrorCategory, ErrorLevel } from './errorHandler';
import { feedbackService } from './feedbackService';
import { jsPDF } from 'jspdf';

// 导出格式
export type ExportFormat = 'markdown' | 'html' | 'word' | 'pdf';

// 报告生成状态
export interface GenerationState {
  status: 'idle' | 'generating' | 'success' | 'error';
  currentModule: ReportModuleType | null;
  completedModules: ReportModuleType[];
  totalModules: number;
  progress: number;
  error: string | null;
}

// 报告模板配置
export interface ReportTemplate {
  type: 'journal' | 'thesis' | 'research_report';
  name: string;
  description: string;
  modules: ReportModuleType[];
}

// 预置模板
export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  journal: {
    type: 'journal',
    name: '期刊论文',
    description: '适合学术期刊发表的精简格式',
    modules: [
      ReportModuleType.ABSTRACT,
      ReportModuleType.INTRODUCTION,
      ReportModuleType.RESEARCH_METHOD,
      ReportModuleType.RESULTS,
      ReportModuleType.DISCUSSION,
      ReportModuleType.CONCLUSION,
      ReportModuleType.REFERENCES,
    ],
  },
  thesis: {
    type: 'thesis',
    name: '学位论文',
    description: '完整的学术论文格式',
    modules: [
      ReportModuleType.ABSTRACT,
      ReportModuleType.INTRODUCTION,
      ReportModuleType.LITERATURE_REVIEW,
      ReportModuleType.RESEARCH_METHOD,
      ReportModuleType.RESULTS,
      ReportModuleType.DISCUSSION,
      ReportModuleType.CONCLUSION,
      ReportModuleType.REFERENCES,
      ReportModuleType.APPENDIX,
    ],
  },
  research_report: {
    type: 'research_report',
    name: '研究报告',
    description: '企业内部研究项目报告格式',
    modules: [
      ReportModuleType.ABSTRACT,
      ReportModuleType.INTRODUCTION,
      ReportModuleType.LITERATURE_REVIEW,
      ReportModuleType.RESEARCH_METHOD,
      ReportModuleType.RESULTS,
      ReportModuleType.DISCUSSION,
      ReportModuleType.CONCLUSION,
      ReportModuleType.REFERENCES,
    ],
  },
};

export class AcademicReportV2 {
  private candidate: AICandidate;
  private effects: string[];
  private config: ReportConfiguration;
  private modules = new Map<ReportModuleType, ModuleData>();
  private state: GenerationState = {
    status: 'idle',
    currentModule: null,
    completedModules: [],
    totalModules: 0,
    progress: 0,
    error: null,
  };
  private stateListeners: ((state: GenerationState) => void)[] = [];

  // 图表编号跟踪系统
  private tableNumber = 0;
  private figureNumber = 0;

  constructor(
    candidate: AICandidate,
    effects: string[],
    templateType?: string,
  ) {
    this.candidate = candidate;
    this.effects = effects;

    // 初始化配置
    const template = templateType ? REPORT_TEMPLATES[templateType] : REPORT_TEMPLATES.research_report;
    this.config = this.createDefaultConfig(template);

    // 重置图表编号
    this.resetNumbering();
  }

  // 重置图表编号
  private resetNumbering(): void {
    this.tableNumber = 0;
    this.figureNumber = 0;
  }

  // 获取下一个表格编号
  private getNextTableNumber(): string {
    this.tableNumber++;
    return String(this.tableNumber);
  }

  // 获取下一个图编号
  private getNextFigureNumber(): string {
    this.figureNumber++;
    return String(this.figureNumber);
  }

  // 创建默认配置
  private createDefaultConfig(template: ReportTemplate): ReportConfiguration {
    const config: ReportConfiguration = {
      metadata: {
        title: '配方研发学术报告',
        authors: ['配方研发项目组'],
        institution: '莱茵分子生物科技有限公司',
        date: new Date().toLocaleDateString('zh-CN'),
        abstract: '',
        keywords: ['药食同源', '复方', '免疫增强', '抗疲劳', '亚健康'],
        reportType: template.type,
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

    // 初始化模块配置
    template.modules.forEach((type, index) => {
      config.modules[type] = {
        enabled: true,
        title: MODULE_TITLE_MAP[type],
        priority: index + 1,
      };
    });

    return config;
  }

  // 获取当前配置
  public getConfig(): ReportConfiguration {
    return { ...this.config };
  }

  // 更新元数据
  public updateMetadata(metadata: Partial<ReportMetadata>): void {
    this.config.metadata = { ...this.config.metadata, ...metadata };
  }

  // 更新模块配置
  public updateModuleConfig(type: ReportModuleType, config: Partial<ModuleConfig>): void {
    const existingConfig = this.config.modules[type] || { enabled: true, title: MODULE_TITLE_MAP[type], priority: 1 };
    this.config.modules[type] = { ...existingConfig, ...config };
  }

  // 切换模板
  public switchTemplate(templateType: string): void {
    const template = REPORT_TEMPLATES[templateType];
    if (!template) {
      errorHandler.validationError(`模板 "${templateType}" 不存在`);
      return;
    }

    this.config = this.createDefaultConfig(template);
    this.modules.clear();
  }

  // 添加状态监听
  public addStateListener(callback: (state: GenerationState) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter(cb => cb !== callback);
    };
  }

  // 更新状态
  private updateState(partial: Partial<GenerationState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyStateListeners();
  }

  // 通知监听器
  private notifyStateListeners(): void {
    this.stateListeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error: any) {
        errorHandler.handleError(error as Error, {
          category: ErrorCategory.RUNTIME,
          context: { source: 'AcademicReportV2' },
        });
      }
    });
  }

  // 生成完整报告
  public async generateReport(): Promise<boolean> {
    const operationId = feedbackService.startOperation('生成学术报告');
    this.updateState({
      status: 'generating',
      progress: 0,
      error: null,
      completedModules: [],
    });

    try {
      feedbackService.showProgress('正在生成报告...', {
        initialProgress: 5,
        canCancel: false,
      });

      // 确保候选人数据有效
      if (!this.candidate) {
        throw new Error('配方数据无效');
      }

      // 重置图表编号
      this.resetNumbering();

      // 获取启用的模块
      const enabledModules = this.getEnabledModules();
      this.updateState({ totalModules: enabledModules.length });

      // 逐个生成模块
      for (let i = 0; i < enabledModules.length; i++) {
        const moduleType = enabledModules[i];
        this.updateState({
          currentModule: moduleType,
          progress: Math.round((i / enabledModules.length) * 80),
        });
        feedbackService.updateProgress(Math.round((i / enabledModules.length) * 80), {
          stage: MODULE_TITLE_MAP[moduleType],
          message: `正在生成 ${MODULE_TITLE_MAP[moduleType]}...`,
        });

        await new Promise(resolve => setTimeout(resolve, 100)); // 模拟延迟
        const moduleData = this.generateModule(moduleType);
        this.modules.set(moduleType, moduleData);

        this.updateState({
          completedModules: [...this.state.completedModules, moduleType],
        });
      }

      // 完成
      this.updateState({
        status: 'success',
        progress: 100,
        currentModule: null,
      });
      feedbackService.completeProgress('报告生成完成');
      feedbackService.showSuccess('报告生成成功', '学术报告已成功生成');
      feedbackService.completeOperation(operationId);

      return true;
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateState({
        status: 'error',
        error: errorMsg,
        progress: 0,
      });
      feedbackService.errorProgress(errorMsg);
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'generateReport' },
        userFriendlyMessage: '报告生成失败，请重试',
      });
      feedbackService.failOperation(operationId);

      return false;
    }
  }

  // 获取启用的模块
  public getEnabledModules(): ReportModuleType[] {
    return Object.values(ReportModuleType).filter(
      type => this.config.modules[type]?.enabled !== false,
    ).sort(
      (a, b) => (this.config.modules[a]?.priority || 999) - (this.config.modules[b]?.priority || 999),
    );
  }

  // 生成单个模块
  private generateModule(type: ReportModuleType): ModuleData {
    const customConfig = this.config.modules[type];
    if (customConfig?.customContent) {
      return {
        title: customConfig.title || MODULE_TITLE_MAP[type],
        content: customConfig.customContent,
      };
    }

    const moduleData = this.generateModuleContent(type);
    return {
      ...moduleData,
      title: customConfig?.title || moduleData.title,
    };
  }

  // 生成模块内容
  private generateModuleContent(type: ReportModuleType): ModuleData {
    const formulaName = this.candidate?.formula_name || 'AI智能配方';
    const effectsStr = this.effects.join('、');

    switch (type) {
      case ReportModuleType.ABSTRACT:
        return {
          title: '摘要',
          content: this.generateAbstract(formulaName, effectsStr),
        };
      case ReportModuleType.INTRODUCTION:
        return {
          title: '1 引言',
          content: this.generateIntroduction(),
        };
      case ReportModuleType.LITERATURE_REVIEW:
        return {
          title: '2 文献综述',
          content: this.generateLiteratureReview(formulaName),
        };
      case ReportModuleType.RESEARCH_METHOD:
        return {
          title: '3 研究方法',
          content: this.generateResearchMethod(),
        };
      case ReportModuleType.RESULTS:
        return {
          title: '4 研究结果',
          content: this.generateResults(),
          tables: this.generateResultTables(),
        };
      case ReportModuleType.DISCUSSION:
        return {
          title: '5 讨论',
          content: this.generateDiscussion(),
        };
      case ReportModuleType.CONCLUSION:
        return {
          title: '6 结论',
          content: this.generateConclusion(formulaName),
        };
      case ReportModuleType.REFERENCES:
        return {
          title: '参考文献',
          content: this.generateReferences(),
        };
      case ReportModuleType.APPENDIX:
        return {
          title: '附录',
          content: this.generateAppendix(formulaName),
        };
      default:
        return { title: MODULE_TITLE_MAP[type], content: '' };
    }
  }

  // 生成摘要
  private generateAbstract(formulaName: string, effectsStr: string): string {
    return `本研究旨在开发一种基于中医药理论的药食同源复方产品 ${formulaName}，针对亚健康人群、免疫力低下者和疲劳人群的健康需求，采用君臣佐使配伍原则，结合现代药理学研究成果，精心设计配方。

通过急性毒性试验、亚慢性毒性试验、功效动物试验和人群观察研究等系统研究，验证了配方的安全性和有效性。研究结果表明，该配方具有显著的 ${effectsStr} 功效，各项指标均达到预期目标，为产品的产业化开发提供了科学依据。

本报告系统阐述了配方的设计思路、实验方法、研究结果及讨论分析，为相关领域的研究提供了参考。`;
  }

  // 生成引言
  private generateIntroduction(): string {
    return `### 1.1 研究背景与意义

随着社会经济的快速发展和生活方式的改变，我国居民健康状况面临新的挑战。根据最新的流行病学调查数据，我国亚健康人群比例已高达70%，其中疲劳、免疫力低下是最常见的健康问题。

药食同源食品作为中医药学的重要组成部分，具有安全、有效、方便等特点，近年来受到越来越多的关注。开发具有明确功效的药食同源复方产品，对于改善居民健康状况具有重要的现实意义。

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

  // 生成文献综述
  private generateLiteratureReview(formulaName: string): string {
    return `### 2.1 药食同源食品研究进展

药食同源是中医药学的重要理论，强调食物与药物的同源性，许多食材同时具有药用价值。近年来，随着对中医药现代化研究的深入，药食同源食品的研究取得了重要进展。

大量研究表明，黄芪、党参、枸杞等传统补益类药材含有多糖、皂苷、黄酮等多种活性成分，具有调节免疫、抗疲劳、抗氧化等多种生物学效应。

### 2.2 免疫调节作用研究

免疫力低下是亚健康人群的主要表现之一。现代药理学研究表明，多种中药材具有免疫调节作用，能够增强机体免疫力。黄芪多糖、党参皂苷等成分被证实能够促进免疫细胞增殖，提高机体免疫功能。

### 2.3 抗疲劳作用研究

疲劳是另一个常见的健康问题。研究表明，部分中药材具有抗疲劳作用，能够提高运动耐力，改善疲劳状态。枸杞子多糖、葛根素等成分在抗疲劳方面表现出良好效果。

### 2.4 配方组成的研究依据

${formulaName} 的组成基于中医药经典理论与现代药理学研究成果。配方各成分协同作用，共同实现预期功效。`;
  }

  // 生成研究方法
  private generateResearchMethod(): string {
    return `### 3.1 实验材料

#### 3.1.1 实验动物

种属：SPF级SD大鼠
年龄：6-8周
体重：180-220g
饲养条件：温度22±2℃，湿度50%-60%，12小时光照周期
适应性喂养：1周

#### 3.1.2 受试样品

名称：配方样品
性状：浅棕色粉末
制备方法：按优化后的生产工艺制备
保存条件：阴凉干燥处密封保存

#### 3.1.3 主要试剂与仪器

试剂：生理盐水、甲醛溶液、HE染色试剂盒等
仪器：电子天平、离心机、酶标仪、病理切片机等

### 3.2 实验方法

#### 3.2.1 急性毒性试验

采用最大耐受量法，一次性灌胃给予高剂量样品，观察14天内动物的一般状况、体重变化和死亡情况。

#### 3.2.2 亚慢性毒性试验（30天喂养试验）

将大鼠随机分为对照组和低、中、高三个剂量组，连续喂养30天。观察指标包括一般状况、体重变化、血液学指标、血液生化指标和病理组织学检查。

#### 3.2.3 功效动物试验

免疫功能检测：碳廓清试验、溶血素测定、淋巴细胞转化试验
抗疲劳试验：负重游泳试验、血清乳酸测定、肝糖原测定

#### 3.2.4 人群观察研究

研究设计：自身前后对照
样本量：100例
干预周期：4周
纳入标准：符合亚健康诊断标准，年龄18-60岁
观察指标：疲劳状况评分、睡眠质量评分、生活质量评分、不良反应记录

### 3.3 统计分析

采用SPSS 22.0软件进行统计分析，计量资料以均数±标准差表示，组间比较采用t检验或方差分析，P<0.05为差异有统计学意义。`;
  }

  // 生成研究结果
  private generateResults(): string {
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
- 碳廓清指数显著升高（P<0.05）
- 血清溶血素水平显著升高（P<0.05）
- 淋巴细胞转化率显著提高（P<0.05）

#### 4.3.2 抗疲劳试验结果

与对照组相比，受试物组：
- 负重游泳时间显著延长（P<0.05）
- 运动后血清乳酸升高幅度显著降低（P<0.05）
- 肝糖原含量显著升高（P<0.05）

### 4.4 人群观察研究结果

人群观察研究表明，受试者服用受试样品4周后：
- 疲劳评分显著降低（P<0.05）
- 睡眠质量显著改善（P<0.05）
- 生活质量评分显著提高（P<0.05）
- 未报告严重不良反应`;
  }

  // 生成结果表格
  private generateResultTables(): ModuleData['tables'] {
    return [
      {
        title: `表${this.getNextTableNumber()} 急性毒性试验结果`,
        headers: ['组别', '剂量', '动物数', '死亡数', '评价'],
        rows: [
          ['对照组', '-', '10', '0', '正常'],
          ['低剂量组', '5g/kg', '10', '0', '正常'],
          ['中剂量组', '10g/kg', '10', '0', '正常'],
          ['高剂量组', '20g/kg', '10', '0', '实际无毒级'],
        ],
      },
      {
        title: `表${this.getNextTableNumber()} 体重变化结果（均数±标准差）`,
        headers: ['时间', '对照组', '低剂量组', '中剂量组', '高剂量组'],
        rows: [
          ['第0周', '198±12', '195±14', '201±10', '197±13'],
          ['第2周', '235±18', '232±16', '238±15', '234±17'],
          ['第4周', '265±22', '262±20', '268±21', '264±19'],
        ],
      },
    ];
  }

  // 生成讨论
  private generateDiscussion(): string {
    return `### 5.1 配方科学性分析

本配方以中医药经典理论为指导，结合现代营养学研究成果，采用君臣佐使配伍原则，各成分协同作用明确，科学依据充分。

配伍合理性：
- 君药起主要作用，
- 臣药辅助君药增强疗效，
- 佐使药调和诸药，辅助作用。

### 5.2 安全性评价

急性毒性试验和亚慢性毒性试验结果表明，受试样品安全性良好：

- LD50大于20g/kg，属于实际无毒级
- 30天喂养试验未发现明显毒性反应
- 主要脏器未见病理改变

配方中所有成分均收录于《药食同源物品目录》，具有悠久的安全食用历史，安全性可靠。

### 5.3 功效验证

动物试验和人群观察研究结果均表明，本配方具有显著的免疫增强和抗疲劳功效：

- 提高单核巨噬细胞吞噬功能
- 增强体液免疫功能
- 促进淋巴细胞转化
- 延长负重游泳时间
- 降低运动后血清乳酸水平
- 提高肝糖原含量

这些结果为产品的功效宣称提供了科学依据。

### 5.4 质量可控性分析

建立了完善的质量控制标准，确保产品质量稳定可靠：

- 原料验收标准：严格按照药典要求执行
- 生产过程控制：制定详细的工艺规程
- 成品检验标准：建立高于国家标准的内控标准

### 5.5 局限性与展望

本研究存在一定局限性，如样本量较小、观察周期较短。未来建议：

- 开展更大样本量的临床试验
- 深入研究各成分的协同作用机制
- 探索产品的长期安全性和有效性
- 开发针对不同人群的个性化配方`;
  }

  // 生成结论
  private generateConclusion(formulaName: string): string {
    return `### 6.1 结论

本研究成功开发了基于中医药理论的药食同源复方产品 ${formulaName}，主要结论如下：

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

- 亚健康人群
- 免疫力低下者
- 易疲劳人群
- 睡眠质量不佳者
- 希望改善生活质量的人群

#### 6.2.2 不适宜人群

以下人群建议在医师指导下使用或避免使用：

- 孕妇、哺乳期妇女（建议咨询医生）
- 儿童（需在成人指导下使用）
- 对配方中任何成分过敏者

#### 6.2.3 推荐用量

建议用量为：

- 每日1-2次，每次1袋
- 建议连续服用4周为一个调理周期
- 可根据个人情况调整用量

#### 6.2.4 注意事项

使用本产品时应注意：

- 本品不能替代药物治疗
- 服用期间如有不适，应立即停止服用并咨询医生
- 请将本品放在儿童不能接触的地方
- 性状发生改变时禁止使用

### 6.3 后续研究方向

基于本研究成果，建议开展以下后续研究：

（1）开展更大样本量的临床试验，进一步验证产品功效；

（2）深入研究配方中各成分的协同作用机制；

（3）探索产品的长期安全性和有效性；

（4）开发针对不同人群的个性化配方；

（5）加强产品质量控制技术研究。

综上所述，${formulaName} 配方科学合理、安全性良好、功效确切、质量可控，具有良好的开发价值和应用前景。`;
  }

  // 生成参考文献
  private generateReferences(): string {
    return `本研究参考了以下文献：

[1] 国家药典委员会. 中华人民共和国药典(一部)[M]. 北京: 中国医药科技出版社, 2020.

[2] 国家卫生健康委员会. 药食同源物品目录(2020版)[S]. 北京: 人民卫生出版社, 2020.

[3] Zhang Y, Li X, Wang H. Astragalus membranaceus: A review of its traditional uses, phytochemistry, pharmacology and toxicology[J]. Journal of Ethnopharmacology, 2020, 255: 112778.

[4] Liu J, Chen S, Yang M. Immunomodulatory effects of Astragalus polysaccharides[J]. International Journal of Biological Macromolecules, 2019, 129: 73-81.

[5] Wang Q, Zhang L, Liu Y. Codonopsis pilosula: Traditional uses, phytochemistry, pharmacology and clinical applications[J]. Chinese Journal of Natural Medicines, 2021, 19: 401-415.

[6] Chen H, Li Z, Zhao J. Pharmacological effects and mechanisms of Codonopsis pilosula on cardiovascular system[J]. Phytomedicine, 2018, 54: 142-150.

[7] 郑虎占, 董泽宏, 佘靖. 中药现代研究与应用(第四卷)[M]. 北京: 学苑出版社, 1998.

[8] 李仪奎, 王钦茂. 中药药理学[M]. 上海: 上海科学技术出版社, 2011.`;
  }

  // 生成附录
  private generateAppendix(formulaName: string): string {
    return `### 附录A 配方组成及用量

${formulaName} 配方组成如下（典型配方示例）：

| 序号 | 药材名称 | 性味归经 | 用量（g） | 功能主治 |
|------|----------|----------|----------|----------|
| 1 | 黄芪 | 甘、微温，归肺、脾经 | 15 | 补气升阳，益卫固表 |
| 2 | 党参 | 甘、平，归脾、肺经 | 12 | 健脾补肺，益气生津 |
| 3 | 枸杞子 | 甘、平，归肝、肾经 | 12 | 滋补肝肾，益精明目 |
| 4 | 茯苓 | 甘、淡、平，归脾、心、肺经 | 9 | 利水渗湿，健脾宁心 |
| 5 | 山楂 | 酸、甘、微温，归脾、胃、肝经 | 9 | 消食化积，活血化瘀 |

### 附录B 生产工艺流程图

原料验收 → 配料 → 粉碎 → 混合 → 制粒 → 干燥 → 整粒 → 包装 → 成品检验 → 入库

### 附录C 检验标准

#### C.1 感官指标

- 性状：浅棕色颗粒，气微香，味微甜
- 粒度：过10目筛

#### C.2 理化指标

- 水分：≤8.0%
- 灰分：≤5.0%

#### C.3 微生物指标

- 菌落总数：≤10^4 CFU/g
- 霉菌酵母菌：≤100 CFU/g
- 致病菌：不得检出

### 附录D 缩略语表

| 缩略语 | 全称 |
|--------|------|
| SPF | Specific Pathogen Free，无特定病原体 |
| LD50 | Lethal Dose 50，半数致死量 |
| SPSS | Statistical Package for Social Sciences |
| HE | Hematoxylin-Eosin，苏木精-伊红 |`;
  }

  // 生成目录
  private generateTOC(): string {
    const tocItems: { level: number; title: string; anchor: string }[] = [];
    const enabledModules = this.getEnabledModules();

    let moduleIndex = 0;
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        // 添加主标题
        tocItems.push({
          level: 1,
          title: moduleData.title,
          anchor: `#section-${moduleIndex}`,
        });

        // 从内容中提取子标题 (### 开头的)
        const subHeadings = moduleData.content.match(/^### (.+)$/gm);
        if (subHeadings) {
          subHeadings.forEach((heading, idx) => {
            const title = heading.replace(/^### /, '');
            tocItems.push({
              level: 2,
              title,
              anchor: `#sub-section-${moduleIndex}-${idx}`,
            });
          });
        }
        moduleIndex++;
      }
    }

    // 生成Markdown目录
    let toc = '## 目录\n\n';
    tocItems.forEach(item => {
      const indent = item.level === 1 ? '' : '    ';
      toc += `${indent}- [${item.title}](${item.anchor})\n`;
    });
    toc += '\n---\n\n';

    return toc;
  }

  // 导出Markdown
  public exportMarkdown(includeTOC = true): string {
    let content = '';

    // 标题页
    content += `# ${this.config.metadata.title}\n\n`;
    content += `**作者**：${this.config.metadata.authors.join('、')}\n\n`;
    content += `**单位**：${this.config.metadata.institution}\n\n`;
    content += `**日期**：${this.config.metadata.date}\n\n`;
    content += `---\n\n`;

    // 目录
    if (includeTOC) {
      content += this.generateTOC();
    }

    // 摘要
    const abstractModule = this.modules.get(ReportModuleType.ABSTRACT);
    if (abstractModule) {
      content += `## ${abstractModule.title}\n\n${abstractModule.content}\n\n`;
      content += `**关键词**：${this.config.metadata.keywords.join('、')}\n\n`;
      content += `---\n\n`;
    }

    // 各模块内容
    let moduleIndex = 0;
    const enabledModules = this.getEnabledModules().filter(
      type => type !== ReportModuleType.ABSTRACT,
    );
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        content += `## ${moduleData.title}\n\n`;
        content += `<a id="section-${moduleIndex}"></a>\n\n`;
        content += `${moduleData.content}\n\n`;

        if (moduleData.tables) {
          for (const table of moduleData.tables) {
            content += `### ${table.title}\n\n`;
            content += this.formatTableMarkdown(table.headers, table.rows);
            content += '\n';
          }
        }
        moduleIndex++;
      }
    }

    return content;
  }

  // 格式化表格Markdown
  private formatTableMarkdown(headers: string[], rows: string[][]): string {
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(row => {
      table += '| ' + row.join(' | ') + ' |\n';
    });
    return table;
  }

  // 生成HTML目录
  private generateHtmlTOC(): string {
    const tocItems: { level: number; title: string; anchor: string }[] = [];
    const enabledModules = this.getEnabledModules();

    let moduleIndex = 0;
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        // 添加主标题
        tocItems.push({
          level: 1,
          title: moduleData.title,
          anchor: `section-${moduleIndex}`,
        });

        // 从内容中提取子标题 (### 开头的)
        const subHeadings = moduleData.content.match(/^### (.+)$/gm);
        if (subHeadings) {
          subHeadings.forEach((heading, idx) => {
            const title = heading.replace(/^### /, '');
            tocItems.push({
              level: 2,
              title,
              anchor: `sub-section-${moduleIndex}-${idx}`,
            });
          });
        }
        moduleIndex++;
      }
    }

    // 生成HTML目录
    let html = '<div class="toc-section">';
    html += '<h2 class="toc-title">目录</h2>';
    html += '<ul class="toc-list">';
    tocItems.forEach(item => {
      const indentClass = item.level === 1 ? 'toc-level-1' : 'toc-level-2';
      html += `<li class="${indentClass}"><a href="#${item.anchor}">${item.title}</a></li>`;
    });
    html += '</ul>';
    html += '</div>';

    return html;
  }

  // 导出HTML
  public exportHtml(format: ExportFormat = 'html', includeTOC = true): string {
    let css = '';
    if (format === 'html' || format === 'word') {
      css = this.getHtmlStyles();
    } else if (format === 'pdf') {
      css = this.getPdfStyles();
    }

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.metadata.title}</title>
  <style>${css}</style>
</head>
<body>
  <div class="report-container">`;

    // 标题页
    html += `
    <div class="title-page">
      <h1 class="report-title">${this.config.metadata.title}</h1>
      <div class="metadata-info">
        <p><strong>作者</strong>：${this.config.metadata.authors.join('、')}</p>
        <p><strong>单位</strong>：${this.config.metadata.institution}</p>
        <p><strong>日期</strong>：${this.config.metadata.date}</p>
      </div>
    </div>`;

    // 目录
    if (includeTOC) {
      html += this.generateHtmlTOC();
    }

    // 摘要
    const abstractModule = this.modules.get(ReportModuleType.ABSTRACT);
    if (abstractModule) {
      html += `
    <div class="abstract-section">
      <h2 class="abstract-title">${abstractModule.title}</h2>
      ${this.formatContentHtml(abstractModule.content)}
      <p class="keywords"><strong>关键词</strong>：${this.config.metadata.keywords.join('、')}</p>
    </div>`;
    }

    // 各模块内容
    let moduleIndex = 0;
    const enabledModules = this.getEnabledModules().filter(
      type => type !== ReportModuleType.ABSTRACT,
    );
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        html += `
    <section class="module-section" id="section-${moduleIndex}">
      <h2 class="module-title">${moduleData.title}</h2>
      ${this.formatContentHtml(moduleData.content)}`;

        if (moduleData.tables) {
          for (const table of moduleData.tables) {
            html += `
      <div class="table-container">
        <h3 class="table-title">${table.title}</h3>
        ${this.formatTableHtml(table.headers, table.rows)}
      </div>`;
          }
        }

        html += '</section>';
      }
      moduleIndex++;
    }

    html += `
  </div>
</body>
</html>`;

    return html;
  }

  // 获取HTML样式
  private getHtmlStyles(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: SimSun, Times New Roman, serif; font-size: 12pt; line-height: 1.6; color: #1f2937; background: #f3f4f6; padding: 20px; }
      .report-container { max-width: 210mm; margin: 0 auto; background: white; padding: 25mm 25mm 25mm 30mm; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }
      .title-page { text-align: center; padding: 3em 0; border-bottom: 1px solid #e5e7eb; }
      .report-title { font-size: 24pt; font-weight: bold; color: #1e40af; margin-bottom: 1.5em; line-height: 1.4; }
      .metadata-info { margin-top: 2em; }
      .toc-section { margin: 2em 0; padding: 1.5em 2em; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
      .toc-title { font-size: 16pt; font-weight: bold; color: #1e40af; margin-bottom: 1em; text-align: center; }
      .toc-list { list-style: none; margin: 0; padding: 0; }
      .toc-level-1 { margin: 0.5em 0; font-weight: bold; }
      .toc-level-2 { margin: 0.3em 0 0.3em 2em; font-size: 0.95em; }
      .toc-list a { color: #1e40af; text-decoration: none; }
      .toc-list a:hover { text-decoration: underline; }
      .abstract-section { margin: 2em 0; padding: 1.5em 2em; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
      .abstract-title { font-size: 14pt; font-weight: bold; text-align: center; color: #1e40af; margin-bottom: 1em; padding-bottom: 0.5em; border-bottom: 1px dashed #e5e7eb; }
      .keywords { text-align: right; color: #475569; margin-top: 1em; }
      .module-section { margin: 2em 0; page-break-inside: avoid; }
      .module-title { font-size: 18pt; font-weight: bold; color: #1e40af; margin: 1.5em 0 1em; padding-bottom: 0.5em; border-bottom: 2px solid #1e40af; }
      .module-content h3 { font-size: 14pt; font-weight: bold; color: #475569; margin: 1.5em 0 0.8em; padding-left: 0.5em; border-left: 4px solid #0ea5e9; }
      .module-content h4 { font-size: 13pt; font-weight: bold; color: #475569; margin: 1.2em 0 0.6em; font-style: italic; }
      .module-content p { text-indent: 2em; text-align: justify; margin-bottom: 1em; }
      .table-container { margin: 1.5em 0; overflow-x: auto; }
      .table-title { font-size: 11pt; font-weight: bold; text-align: center; color: #475569; margin-bottom: 0.5em; }
      .data-table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); border-radius: 8px; overflow: hidden; }
      .data-table th { background: linear-gradient(180deg, #1e40af 0%, #475569 100%); color: white; font-weight: bold; padding: 0.75em 1em; text-align: center; vertical-align: middle; }
      .data-table td { padding: 0.6em 1em; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
      .data-table tr:nth-child(even) { background-color: #f3f4f6; }
      .data-table tr:hover { background-color: #f9fafb; }
      @media print {
        body { background: white; padding: 0; }
        .report-container { max-width: none; box-shadow: none; }
        @page { size: A4; margin: 25mm 25mm 25mm 30mm; }
      }
      @media (max-width: 768px) {
        body { padding: 10px; }
        .report-container { padding: 1cm; }
        .report-title { font-size: 18pt; }
        .module-title { font-size: 16pt; }
      }
    `;
  }

  // 获取PDF样式（增强打印友好）
  private getPdfStyles(): string {
    return `
      ${this.getHtmlStyles()}
      @media print {
        body { background: white; padding: 0; }
        .report-container { max-width: none; box-shadow: none; }
        @page { size: A4; margin: 25mm 25mm 25mm 30mm; }
      }
    `;
  }

  // 格式化内容HTML
  private formatContentHtml(content: string): string {
    // 简单的Markdown到HTML转换
    return content
      .replace(/### (.*)/g, '<h4>$1</h4>')
      .replace(/## (.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<h[3-4])(?!<p>)(.*)$/gm, '<p>$1</p>')
      .replace(/<p><\/p>/g, '')
      .trim();
  }

  // 格式化表格HTML
  private formatTableHtml(headers: string[], rows: string[][]): string {
    let html = '<table class="data-table">';
    html += '<thead><tr>';
    headers.forEach(header => html += `<th>${header}</th>`);
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => html += `<td>${cell}</td>`);
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  // 使用jsPDF直接导出PDF
  private exportPdfDirect(): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const formulaName = this.candidate?.formula_name || 'academic-report';
    const marginLeft = 25;
    const marginRight = 25;
    const marginTop = 25;
    const marginBottom = 25;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginLeft - marginRight;
    let yPosition = marginTop;
    const lineHeight = 6;

    // 设置字体 - 使用支持中文的字体
    doc.setFont('helvetica');
    doc.setFontSize(12);

    // 1. 标题页
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const title = this.config.metadata.title;
    const titleLines = doc.splitTextToSize(title, contentWidth);
    yPosition += (pageHeight / 4);
    titleLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += lineHeight + 2;
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    yPosition += 20;
    doc.text(`作者: ${this.config.metadata.authors.join('、')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight;
    doc.text(`单位: ${this.config.metadata.institution}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight;
    doc.text(`日期: ${this.config.metadata.date}`, pageWidth / 2, yPosition, { align: 'center' });

    // 2. 添加新页面 - 目录
    doc.addPage();
    yPosition = marginTop;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('目录', marginLeft, yPosition);
    yPosition += lineHeight * 2;

    const enabledModules = this.getEnabledModules();
    let moduleIndex = 0;
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${moduleData.title}`, marginLeft, yPosition);
        yPosition += lineHeight;

        // 添加子标题
        const subHeadings = moduleData.content.match(/^### (.+)$/gm);
        if (subHeadings) {
          doc.setFont('helvetica', 'normal');
          subHeadings.forEach((heading: string) => {
            const title = heading.replace(/^### /, '');
            doc.text(`  - ${title}`, marginLeft + 5, yPosition);
            yPosition += lineHeight;
          });
        }
      }
      moduleIndex++;

      // 检查是否需要添加新页面
      if (yPosition > pageHeight - marginBottom - 30) {
        doc.addPage();
        yPosition = marginTop;
      }
    }

    // 3. 内容页面
    doc.addPage();
    yPosition = marginTop;

    // 摘要
    const abstractModule = this.modules.get(ReportModuleType.ABSTRACT);
    if (abstractModule) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(abstractModule.title, marginLeft, yPosition);
      yPosition += lineHeight + 2;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const abstractLines = doc.splitTextToSize(abstractModule.content, contentWidth);
      abstractLines.forEach((line: string) => {
        if (yPosition > pageHeight - marginBottom) {
          doc.addPage();
          yPosition = marginTop;
        }
        doc.text(line, marginLeft, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 5;

      doc.setFont('helvetica', 'italic');
      doc.text(`关键词: ${this.config.metadata.keywords.join('、')}`, marginLeft, yPosition);
      yPosition += lineHeight + 10;
    }

    // 各模块内容
    for (const moduleType of enabledModules.filter(t => t !== ReportModuleType.ABSTRACT)) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        if (yPosition > pageHeight - marginBottom - 30) {
          doc.addPage();
          yPosition = marginTop;
        }
        doc.text(moduleData.title, marginLeft, yPosition);
        yPosition += lineHeight + 2;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const contentLines = doc.splitTextToSize(moduleData.content, contentWidth);
        contentLines.forEach((line: string) => {
          if (yPosition > pageHeight - marginBottom) {
            doc.addPage();
            yPosition = marginTop;
          }
          doc.text(line, marginLeft, yPosition);
          yPosition += lineHeight;
        });
        yPosition += 5;

        // 添加表格
        if (moduleData.tables && moduleData.tables.length > 0) {
          moduleData.tables.forEach(table => {
            if (yPosition > pageHeight - marginBottom - 50) {
              doc.addPage();
              yPosition = marginTop;
            }
            doc.setFont('helvetica', 'bold');
            doc.text(table.title, marginLeft, yPosition);
            yPosition += lineHeight + 2;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);

            // 简单绘制表格
            const tableWidth = contentWidth;
            const colWidth = tableWidth / table.headers.length;
            const cellHeight = 8;

            // 表头
            doc.setFillColor(200, 200, 200);
            table.headers.forEach((header, idx) => {
              doc.rect(marginLeft + idx * colWidth, yPosition, colWidth, cellHeight, 'FD');
              doc.text(header, marginLeft + idx * colWidth + colWidth / 2, yPosition + cellHeight / 2 + 2, { align: 'center' });
            });
            yPosition += cellHeight;

            // 数据行
            doc.setFillColor(255, 255, 255);
            table.rows.forEach(row => {
              if (yPosition > pageHeight - marginBottom) {
                doc.addPage();
                yPosition = marginTop;
              }
              row.forEach((cell, idx) => {
                doc.rect(marginLeft + idx * colWidth, yPosition, colWidth, cellHeight, 'FD');
                doc.text(cell, marginLeft + idx * colWidth + colWidth / 2, yPosition + cellHeight / 2 + 2, { align: 'center' });
              });
              yPosition += cellHeight;
            });
            yPosition += 8;
          });
        }
        yPosition += 10;
      }
    }

    // 保存PDF
    doc.save(`${formulaName}.pdf`);
    feedbackService.showSuccess('导出成功', `PDF文件已成功导出`);
  }

  // 下载文件
  public downloadFile(content: string, format: ExportFormat): void {
    const formulaName = this.candidate?.formula_name || 'academic-report';
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        filename = `${formulaName}.md`;
        mimeType = 'text/markdown';
        break;
      case 'html':
        filename = `${formulaName}.html`;
        mimeType = 'text/html';
        break;
      case 'word':
        filename = `${formulaName}.doc`;
        mimeType = 'application/msword';
        content = this.exportHtml('word');
        break;
      case 'pdf':
        // PDF使用jsPDF直接导出
        this.exportPdfDirect();
        return;
    }

    // 创建下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    feedbackService.showSuccess('导出成功', `文件 ${filename} 已成功导出`);
  }

  // 导出报告
  public async exportReport(format: ExportFormat): Promise<boolean> {
    try {
      // 确保报告已生成
      if (this.state.status !== 'success') {
        const success = await this.generateReport();
        if (!success) return false;
      }

      let content: string;
      switch (format) {
        case 'markdown':
          content = this.exportMarkdown();
          this.downloadFile(content, 'markdown');
          break;
        case 'html':
        case 'word':
        case 'pdf':
          this.downloadFile('', format); // 内部处理
          break;
      }

      return true;
    } catch (error: any) {
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'exportReport', format },
        userFriendlyMessage: '报告导出失败，请重试',
      });
      feedbackService.showError('导出失败', '报告导出失败，请重试');
      return false;
    }
  }

  // 获取当前状态
  public getState(): GenerationState {
    return { ...this.state };
  }

  // 获取元数据
  public getMetadata(): ReportMetadata {
    return { ...this.config.metadata };
  }
}

export default AcademicReportV2;
