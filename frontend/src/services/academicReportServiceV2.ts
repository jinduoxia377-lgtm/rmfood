/**
 * 增强版学术报告生成系统
 * 完整支持模块化结构、边缘场景处理、错误处理、用户反馈、多格式导出
 */

import type { AICandidate } from '@/types';
import {
  ReportModuleType,
  MODULE_TITLE_MAP,
} from '@/types/academicReportModules';
import type {
  ModuleConfig,
  ModuleData,
  ReportMetadata,
  ReportConfiguration,
} from '@/types/academicReportModules';
import { errorHandler, ErrorCategory } from './errorHandler';
import { feedbackService } from './feedbackService';
import {
  LITERATURE_DATABASE,
  TCM_DATABASE,
  PHARMACOLOGY_DATABASE,
  getComplianceInfo,
} from './academicReportService';
import type { HerbName } from './academicReportService';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';

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

    // 初始化模块配置：模板包含的模块启用，模板外的模块显式禁用
    const templateModuleSet = new Set(template.modules);
    Object.values(ReportModuleType).forEach((type, index) => {
      config.modules[type] = {
        enabled: templateModuleSet.has(type),
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
    this.resetNumbering();
    // 切换模板后重置生成状态，避免旧报告数据残留
    this.updateState({
      status: 'idle',
      progress: 0,
      currentModule: null,
      completedModules: [],
      error: null,
    });
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

        // 进度节流（非模拟生成）：模块同步生成可能瞬间完成，若不加节流则进度条
        // 从 0 直接跳到 100，用户感知不到分模块进度。此处仅用 100ms 让出事件循环
        // 让进度反馈可感知，真实进度仍由上方 generateModule 实际产出驱动，未伪造完成。
        await new Promise(resolve => setTimeout(resolve, 100));
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

  // 获取启用的模块（未配置 = 禁用，仅 enabled === true 的模块被启用）
  public getEnabledModules(): ReportModuleType[] {
    return Object.values(ReportModuleType).filter(
      type => this.config.modules[type]?.enabled === true,
    ).sort(
      (a, b) => (this.config.modules[a]?.priority || 999) - (this.config.modules[b]?.priority || 999),
    );
  }

  // 获取已生成的模块数据（按启用顺序返回只读副本）
  public getGeneratedModules(): { type: ReportModuleType; data: ModuleData }[] {
    return this.getEnabledModules()
      .filter(type => this.modules.has(type))
      .map(type => {
        const data = this.modules.get(type);
        if (!data) return null;
        const copy: ModuleData = {
          title: data.title,
          content: data.content,
          tables: data.tables ? data.tables.map(t => ({ ...t, rows: t.rows.map(r => [...r]) })) : undefined,
          figures: data.figures ? data.figures.map(f => ({ ...f })) : undefined,
        };
        return { type, data: copy };
      })
      .filter((m): m is { type: ReportModuleType; data: ModuleData } => m !== null);
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
    const herbs = this.getHerbs();

    switch (type) {
      case ReportModuleType.ABSTRACT:
        return {
          title: '摘要',
          content: this.generateAbstract(formulaName, effectsStr, herbs),
        };
      case ReportModuleType.INTRODUCTION:
        return {
          title: '1 引言',
          content: this.generateIntroduction(herbs),
        };
      case ReportModuleType.LITERATURE_REVIEW:
        return {
          title: '2 文献综述',
          content: this.generateLiteratureReview(herbs),
        };
      case ReportModuleType.RESEARCH_METHOD:
        return {
          title: '3 研究方法',
          content: this.generateResearchMethod(herbs),
        };
      case ReportModuleType.RESULTS:
        return {
          title: '4 研究结果',
          content: this.generateResults(herbs),
          tables: this.generateResultTables(herbs),
        };
      case ReportModuleType.DISCUSSION:
        return {
          title: '5 讨论',
          content: this.generateDiscussion(herbs),
        };
      case ReportModuleType.CONCLUSION:
        return {
          title: '6 结论',
          content: this.generateConclusion(formulaName, herbs),
        };
      case ReportModuleType.REFERENCES:
        return {
          title: '参考文献',
          content: this.generateReferences(herbs),
        };
      case ReportModuleType.APPENDIX:
        return {
          title: '附录',
          content: this.generateAppendix(formulaName, herbs),
        };
      default:
        return { title: MODULE_TITLE_MAP[type], content: '' };
    }
  }

  // 获取候选配方真实成分
  private getHerbs(): { name: string; role: string; dosage: string }[] {
    return (this.candidate?.herb_combination || []).map(h => ({
      name: typeof h.name === 'string' ? h.name : '',
      role: typeof h.role === 'string' ? h.role : '',
      dosage: typeof h.dosage === 'string' ? h.dosage : String(h.dosage ?? ''),
    }));
  }

  // 生成摘要
  private generateAbstract(
    formulaName: string,
    effectsStr: string,
    herbs: { name: string; role: string; dosage: string }[],
  ): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '（配方成分待补充）';
    return `本研究旨在开发一种基于中医药理论的药食同源复方产品 ${formulaName}，针对亚健康人群、免疫力低下者和疲劳人群的健康需求，采用君臣佐使配伍原则，结合现代药理学研究成果，精心设计配方。

本报告基于候选配方的真实组成数据（${herbNames}）与平台评分（协同作用、口感、稳定性、安全性）进行理论设计与文献评估。依据文献报道，配方中的药食同源成分可能具有 ${effectsStr} 等健康功效潜力；配方的安全性基于各成分的长期食用历史与现行法规目录进行理论评估。

需要特别说明的是：本报告为理论评估与文献综述阶段的研究文档，尚未开展急性毒性、30天喂养、动物功效及人群观察等实验验证，所有实验数据均待后续规范实验补充。`;
  }

  // 生成引言
  private generateIntroduction(herbs: { name: string; role: string; dosage: string }[]): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '待补充';
    return `### 1.1 研究背景与意义

随着社会经济的快速发展和生活方式的改变，我国居民健康状况面临新的挑战。亚健康人群中疲劳、免疫力低下等问题较为普遍（依据公开文献的定性描述，具体比例需以权威调查数据为准）。

药食同源食品作为中医药学的重要组成部分，具有安全、方便等特点，近年来受到越来越多的关注。开发具有明确功效的药食同源复方产品，对于改善居民健康状况具有重要的现实意义。

### 1.2 研究目的

本研究的主要目的包括：

（1）基于中医药理论，设计具有明确功效的药食同源复方配方；

（2）通过文献与法规目录对配方的安全性和功效潜力进行理论评估；

（3）建立质量控制标准草案和生产工艺路线；

（4）为后续实验验证和产业化开发提供参考。

### 1.3 研究内容与方法

本研究主要内容包括：

（1）配方设计与优化：基于中医药君臣佐使配伍原则，结合现代药理学研究成果，优化配方组成（本候选配方主要成分：${herbNames}）；

（2）安全性理论评估：依据药食同源目录、药典及公开毒理学文献进行评估；

（3）功效潜力分析：基于文献报道的活性成分与药理作用进行分析；

（4）质量标准草案建立。

### 1.4 技术路线

本研究采用"理论设计-文献评估-实验验证（计划）"的技术路线。当前报告处于理论设计与文献评估阶段。`;
  }

  // 生成文献综述
  private generateLiteratureReview(herbs: { name: string; role: string; dosage: string }[]): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean);
    const herbList = herbNames.join('、') || '待补充';
    const herbRefs = herbNames.slice(0, 5).map((name) => {
      const papers = LITERATURE_DATABASE[name as HerbName] || [];
      return papers.length > 0
        ? `${name}：${papers.slice(0, 2).map(p => `${p.title}（${p.journal}, ${p.year}）`).join('；')}`
        : `${name}：暂无内置文献条目，需人工补充。`;
    }).join('\n\n');

    return `### 2.1 药食同源食品研究进展

药食同源是中医药学的重要理论，强调食物与药物的同源性，许多食材同时具有药用价值。近年来，随着对中医药现代化研究的深入，药食同源食品的研究取得了重要进展。

### 2.2 本配方成分的文献研究概况

本候选配方主要成分：${herbList}。相关文献报道如下：

${herbRefs}

### 2.3 免疫调节与抗疲劳作用研究

现代药理学文献报道，部分药食同源成分（如多糖、皂苷、黄酮类）具有免疫调节、抗氧化、抗疲劳等潜在生物学活性。需要注意的是，这些结论多来自体外或动物模型研究，其在人体中的功效仍需规范的临床研究证实。

### 2.4 配方组成的研究依据

${this.candidate?.formula_name || '本配方'} 的组成基于中医药经典理论与现代药理学研究成果，配方各成分的协同作用评分、口感评分、稳定性评分等由平台计算给出，具体实验验证留待后续开展。`;
  }

  // 生成研究方法
  private generateResearchMethod(herbs: { name: string; role: string; dosage: string }[]): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '待补充';
    const synergy = this.candidate?.synergy_score ?? 0;
    const stability = this.candidate?.stability_score ?? 0;
    return `### 3.1 评估对象

#### 3.1.1 候选配方

名称：${this.candidate?.formula_name || 'AI智能配方'}
组成：${herbNames}
协同作用评分：${(synergy * 100).toFixed(1)}分
稳定性评分：${(stability * 100).toFixed(1)}分

#### 3.1.2 评估依据

- 《按照传统既是食品又是中药材的物质目录》（药食同源目录）
- 《中华人民共和国药典（2020版）》
- GB 15193 系列食品安全性毒理学评价程序
- 平台内置文献数据库（TCMSP/PubMed 等公开文献条目）

### 3.2 安全性评估方法（理论评估）

#### 3.2.1 急性毒性评估

依据各成分的文献毒性数据与长期食用历史进行理论评估；急性经口毒性试验（LD50）需按 GB 15193.3 开展后方可确认。

#### 3.2.2 亚慢性毒性评估（30天喂养试验）

30天喂养试验需按 GB 15193.13 开展，观察动物一般状况、体重、血液学、血液生化及病理组织学变化。

### 3.3 功效学验证计划

**免疫功能检测（计划）：** 碳廓清试验、溶血素测定、淋巴细胞转化试验

**抗疲劳试验（计划）：** 负重游泳试验、血清乳酸测定、肝糖原测定

### 3.4 数据统计分析计划

计划采用 SPSS 等统计软件进行分析，计量资料以均数±标准差表示，组间比较采用 t 检验或方差分析，P<0.05 为差异有统计学意义。当前尚未产生实测数据。`;
  }

  // 生成研究结果
  private generateResults(herbs: { name: string; role: string; dosage: string }[]): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '待补充';
    const safetyPassed = this.candidate?.safety_passed ? '通过' : '需关注';
    return `### 4.1 配方组成评估

本候选配方主要成分：${herbNames}。配方组成由算法基于君臣佐使配伍原则优化确定，各成分用量参照药典/法规建议范围。

### 4.2 安全性理论评估

配方安全性评估：${safetyPassed}。本配方成分均选自药食同源目录（或目录试点品种），具有长期食用历史；依据文献报道，各成分在常规食用剂量下安全性良好。但本配方尚未开展急性毒性试验、30天喂养试验等毒理学实验，LD50 与毒性分级待实验验证。

### 4.3 功效潜力理论分析

依据文献报道，配方中的活性成分（如多糖、皂苷、黄酮等）可能具有免疫调节、抗氧化等潜力。具体功效数据需通过规范的动物试验与人群研究验证。

### 4.4 实验验证状态

本报告当前为理论评估阶段，所有实验数据均为「待实验验证」状态。以下表格列出计划开展的验证项目，具体数值需在实验完成后填写。`;
  }

  // 生成结果表格
  private generateResultTables(herbs: { name: string; role: string; dosage: string }[]): ModuleData['tables'] {
    const herbRows = herbs.map((h, i) => [
      String(i + 1),
      h.name || '未命名',
      h.role || '辅助',
      typeof h.dosage === 'string' ? h.dosage : String(h.dosage ?? '-'),
      '待实验验证',
    ]);
    return [
      {
        title: `表${this.getNextTableNumber()} 配方组成（真实候选数据）`,
        headers: ['序号', '成分', '角色', '用量', '实验状态'],
        rows: herbRows.length > 0 ? herbRows : [['1', '待补充', '-', '-', '待实验验证']],
      },
      {
        title: `表${this.getNextTableNumber()} 安全性验证计划`,
        headers: ['试验项目', '参考标准', '状态', '结果'],
        rows: [
          ['急性经口毒性试验(LD50)', 'GB 15193.3', '待实验验证', '—'],
          ['30天喂养试验', 'GB 15193.13', '待实验验证', '—'],
        ],
      },
    ];
  }

  // 生成讨论
  private generateDiscussion(herbs: { name: string; role: string; dosage: string }[]): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '待补充';
    const synergy = (this.candidate?.synergy_score ?? 0) * 100;
    const taste = (this.candidate?.taste_score ?? 0) * 100;
    const stability = (this.candidate?.stability_score ?? 0) * 100;
    return `### 5.1 配方科学性分析

本配方以中医药经典理论为指导，结合现代营养学研究成果，采用君臣佐使配伍原则。候选配方主要成分：${herbNames}。

平台计算得分：
- 协同作用评分：${synergy.toFixed(1)}分
- 口感风味评分：${taste.toFixed(1)}分
- 稳定性评分：${stability.toFixed(1)}分
- 安全性评估：${this.candidate?.safety_passed ? '通过' : '需关注'}

### 5.2 安全性评价

本配方成分均选自药食同源目录（或试点品种），具有长期食用历史；急性毒性（LD50）、30天喂养试验等数据待实验验证。当前安全性结论为基于文献与法规目录的理论评估。

### 5.3 功效验证

依据文献报道，本配方成分可能具有${this.effects.join('、')}等功效潜力。动物试验与人群观察研究结果待实验验证，相关功效宣称需在获得实验数据后审慎提出。

### 5.4 质量可控性分析

建立了质量控制标准草案，包括原料验收标准、生产过程控制、成品检验标准等，需通过中试生产验证。

### 5.5 局限性与展望

本报告为理论评估阶段文档，存在以下局限：尚未开展毒理学与功效学实验、缺乏人群数据、文献覆盖有限。未来建议：

- 开展规范的急性毒性、30天喂养及功效学实验；
- 开展更大样本量的人群观察研究；
- 深入研究各成分的协同作用机制；
- 开发针对不同人群的个性化配方。`;
  }

  // 生成结论
  private generateConclusion(
    formulaName: string,
    herbs: { name: string; role: string; dosage: string }[],
  ): string {
    const herbNames = herbs.map(h => h.name).filter(Boolean).join('、') || '待补充';
    return `### 6.1 结论

本研究完成了基于中医药理论的药食同源复方产品 ${formulaName} 的理论设计与文献评估，主要结论如下：

#### 6.1.1 配方科学合理

本配方以中医药理论为指导，采用君臣佐使配伍原则，各成分（${herbNames}）协同作用明确，理论依据充分。

#### 6.1.2 安全性需实验验证

配方成分均属于药食同源目录（或试点品种），具有长期食用历史；急性毒性试验、30天喂养试验等毒理学数据待实验验证。

#### 6.1.3 功效潜力基于文献

依据文献报道，配方成分可能具有免疫调节、抗疲劳等潜力；具体功效需通过规范的动物试验和人群研究确认。

#### 6.1.4 质量可控性需中试验证

建立了质量控制标准草案，需通过中试生产与成品检验验证。

### 6.2 建议

#### 6.2.1 适宜人群

本产品候选适宜人群：

- 亚健康人群
- 免疫力低下者
- 易疲劳人群
- 睡眠质量不佳者

#### 6.2.2 不适宜人群

以下人群建议在医师指导下使用或避免使用：

- 孕妇、哺乳期妇女（建议咨询医生）
- 儿童（需在成人指导下使用）
- 对配方中任何成分过敏者

#### 6.2.3 推荐用量

建议用量为：

- 每日1-2次，每次1袋（具体以产品规格为准）
- 建议连续服用4周为一个调理周期
- 可根据个人情况调整用量

#### 6.2.4 注意事项

使用本产品时应注意：

- 本品不能替代药物治疗
- 服用期间如有不适，应立即停止服用并咨询医生
- 请将本品放在儿童不能接触的地方
- 性状发生改变时禁止使用

### 6.3 后续研究方向

基于本报告，建议开展以下后续研究：

（1）开展急性毒性、30天喂养等安全性实验；

（2）开展规范的动物功效学实验与人群研究；

（3）深入研究配方中各成分的协同作用机制；

（4）探索产品的长期安全性和有效性；

（5）开发针对不同人群的个性化配方。

综上所述，${formulaName} 配方理论依据充分，安全性基于药食同源目录与文献评估良好，功效潜力有待实验验证。`;
  }

  // 生成参考文献
  private generateReferences(herbs: { name: string; role: string; dosage: string }[]): string {
    const refs: string[] = [];
    let refIndex = 1;
    const seenDOIs = new Set<string>();
    const herbNames = herbs.map(h => h.name).filter(Boolean) as HerbName[];

    for (const herb of herbNames) {
      const papers = LITERATURE_DATABASE[herb] || [];
      for (const paper of papers) {
        if (paper.doi && !seenDOIs.has(paper.doi)) {
          seenDOIs.add(paper.doi);
          refs.push(`[${refIndex}] ${paper.authors}. ${paper.title}[J]. ${paper.journal}, ${paper.year}, ${paper.volume}(${paper.pages}). DOI: ${paper.doi}`);
          refIndex++;
        }
      }
    }

    refs.push(`[${refIndex}] 国家药典委员会. 中华人民共和国药典(一部)[M]. 北京: 中国医药科技出版社, 2020.`);
    refIndex++;
    refs.push(`[${refIndex}] 国家卫生健康委员会. 药食同源物品目录[S]. 北京: 人民卫生出版社, 2023.`);

    return `本研究参考了以下文献：\n\n${refs.join('\n\n')}`;
  }

  // 生成附录
  private generateAppendix(
    formulaName: string,
    herbs: { name: string; role: string; dosage: string }[],
  ): string {
    const herbRows = herbs.map((h, i) => {
      const name = h.name || '未命名';
      const tcm = TCM_DATABASE[name] || { flavor: '-', channel: '-', effects: '-', meridian: '-' };
      const compliance = getComplianceInfo(name);
      return [
        String(i + 1),
        name,
        `${tcm.flavor}${tcm.channel}`,
        tcm.meridian,
        typeof h.dosage === 'string' ? h.dosage : String(h.dosage ?? '-'),
        h.role || '辅助',
        compliance.foodHomology,
      ];
    });

    const appendixRows = herbRows.length > 0
      ? herbRows
      : [['1', '待补充', '-', '-', '-', '-', '未收录']];

    return `### 附录A 配方组成及用量（基于真实候选数据）

${formulaName} 配方组成如下：

| 序号 | 药材名称 | 性味 | 归经 | 用量（g） | 角色 | 药食同源 |
|------|----------|------|------|----------|------|----------|
${appendixRows.map(row => `| ${row.join(' | ')} |`).join('\n')}

### 附录B 生产工艺流程图（草案）

原料验收 → 配料 → 粉碎 → 混合 → 制粒 → 干燥 → 整粒 → 包装 → 成品检验 → 入库

### 附录C 检验标准（草案）

#### C.1 感官指标

- 性状：浅棕色颗粒，气微香，味微甜（待中试验证）
- 粒度：过10目筛

#### C.2 理化指标

- 水分：≤8.0%（待实验验证）
- 灰分：≤5.0%（待实验验证）

#### C.3 微生物指标

- 菌落总数：≤10^4 CFU/g（待实验验证）
- 霉菌酵母菌：≤100 CFU/g（待实验验证）
- 致病菌：不得检出

### 附录D 缩略语表

| 缩略语 | 全称 |
|--------|------|
| LD50 | Lethal Dose 50，半数致死量 |
| SPSS | Statistical Package for Social Sciences |`;
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
      .report-title { font-size: 24pt; font-weight: bold; color: #003E87; margin-bottom: 1.5em; line-height: 1.4; }
      .metadata-info { margin-top: 2em; }
      .toc-section { margin: 2em 0; padding: 1.5em 2em; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; }
      .toc-title { font-size: 16pt; font-weight: bold; color: #003E87; margin-bottom: 1em; text-align: center; }
      .toc-list { list-style: none; margin: 0; padding: 0; }
      .toc-level-1 { margin: 0.5em 0; font-weight: bold; }
      .toc-level-2 { margin: 0.3em 0 0.3em 2em; font-size: 0.95em; }
      .toc-list a { color: #003E87; text-decoration: none; }
      .toc-list a:hover { text-decoration: underline; }
      .abstract-section { margin: 2em 0; padding: 1.5em 2em; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
      .abstract-title { font-size: 14pt; font-weight: bold; text-align: center; color: #003E87; margin-bottom: 1em; padding-bottom: 0.5em; border-bottom: 1px dashed #e5e7eb; }
      .keywords { text-align: right; color: #4B5563; margin-top: 1em; }
      .module-section { margin: 2em 0; page-break-inside: avoid; }
      .module-title { font-size: 18pt; font-weight: bold; color: #003E87; margin: 1.5em 0 1em; padding-bottom: 0.5em; border-bottom: 2px solid #003E87; }
      .module-content h3 { font-size: 14pt; font-weight: bold; color: #4B5563; margin: 1.5em 0 0.8em; padding-left: 0.5em; border-left: 4px solid #0ea5e9; }
      .module-content h4 { font-size: 13pt; font-weight: bold; color: #4B5563; margin: 1.2em 0 0.6em; font-style: italic; }
      .module-content p { text-indent: 2em; text-align: justify; margin-bottom: 1em; }
      .table-container { margin: 1.5em 0; overflow-x: auto; }
      .table-title { font-size: 11pt; font-weight: bold; text-align: center; color: #4B5563; margin-bottom: 0.5em; }
      .data-table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); border-radius: 8px; overflow: hidden; }
      .data-table th { background: linear-gradient(180deg, #003E87 0%, #4B5563 100%); color: white; font-weight: bold; padding: 0.75em 1em; text-align: center; vertical-align: middle; }
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

  // 通过浏览器打印导出 PDF（中文无乱码，由用户选择“另存为 PDF”）
  private exportPdfDirect(): void {
    const formulaName = this.candidate?.formula_name || 'academic-report';
    try {
      const html = this.exportHtml('pdf');
      const printWindow = window.open('', '_blank', 'width=860,height=1100');
      if (!printWindow) {
        feedbackService.showError('导出失败', '浏览器阻止了打印窗口，请允许弹出窗口后重试');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      // 等待渲染完成后调用打印（用户可在打印对话框中选择“另存为 PDF”）
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (printError: any) {
          feedbackService.showError('导出失败', '调用系统打印失败，请手动使用浏览器打印功能');
        }
      }, 300);
      feedbackService.showSuccess('导出成功', 'PDF 打印窗口已打开，请在打印对话框中选择“另存为 PDF”');
    } catch (error: any) {
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'exportPdfDirect' },
        userFriendlyMessage: 'PDF 导出失败，请重试',
      });
      feedbackService.showError('导出失败', 'PDF 导出失败，请重试');
    }
    void formulaName;
  }

  // 使用 docx 库生成真实 Word 文档（.docx）
  public async exportWord(): Promise<boolean> {
    const formulaName = this.candidate?.formula_name || 'academic-report';
    try {
      const children: any[] = [];

      // 标题
      children.push(
        new Paragraph({
          children: [new TextRun({ text: this.config.metadata.title, bold: true, size: 36, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );

      // 元数据
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `作者：${this.config.metadata.authors.join('、')}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `单位：${this.config.metadata.institution}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `日期：${this.config.metadata.date}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      );

      // 各模块内容
      const enabledModules = this.getEnabledModules();
      for (const moduleType of enabledModules) {
        const moduleData = this.modules.get(moduleType);
        if (!moduleData) continue;

        children.push(
          new Paragraph({
            children: [new TextRun({ text: moduleData.title, bold: true, size: 32, font: 'SimSun' })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          }),
        );

        // 将 Markdown 内容按行拆分为段落（去除 Markdown 标记符号）
        const lines = moduleData.content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const plain = this.markdownToPlainText(trimmed);
          children.push(
            new Paragraph({
              children: [new TextRun({ text: plain, size: 24, font: 'SimSun' })],
              spacing: { after: 100 },
            }),
          );
        }

        // 表格
        if (moduleData.tables) {
          for (const table of moduleData.tables) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: table.title, bold: true, size: 24, font: 'SimSun' })],
                spacing: { before: 200, after: 100 },
              }),
            );
            const headerCells = table.headers.map(h =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'SimSun' })] })],
              }),
            );
            const headerRow = new TableRow({ tableHeader: true, children: headerCells });
            const bodyRows = table.rows.map(row =>
              new TableRow({
                children: row.map(c => new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: c, font: 'SimSun' })] })],
                })),
              }),
            );
            children.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [headerRow, ...bodyRows],
              }),
            );
          }
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `${formulaName}.docx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      feedbackService.showSuccess('导出成功', `Word 文档 ${filename} 已成功导出`);
      return true;
    } catch (error: any) {
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'exportWord' },
        userFriendlyMessage: 'Word 导出失败，请重试',
      });
      feedbackService.showError('导出失败', 'Word 导出失败，请重试');
      return false;
    }
  }

  // 将 Markdown 文本转为纯文本（去除常用标记符号）
  private markdownToPlainText(text: string): string {
    return text
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\s*[-*+]\s+/, '• ')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\|/g, ' ')
      .trim();
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
        // 使用 docx 库生成真实 .docx 文档
        void this.exportWord();
        return;
      case 'pdf':
        // 通过浏览器打印导出 PDF（中文无乱码）
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
          content = this.exportHtml();
          this.downloadFile(content, 'html');
          break;
        case 'word':
          return await this.exportWord();
        case 'pdf':
          this.downloadFile('', 'pdf');
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
