/**
 * 学术报告管理服务 - 完整的报告生成系统
 */

import type { AICandidate } from '@/types';
import {
  ReportModuleType,
} from '@/types/academicReportModules';
import type {
  ReportConfiguration,
  ReportMetadata,
  ModuleConfig,
  FormatOptions,
} from '@/types/academicReportModules';
import { AcademicReportModuleGenerator } from './academicReportModuleGenerator';
import { AcademicReportFormatter } from './academicReportFormatter';

// 报告生成状态
export interface ReportGenerationState {
  isGenerating: boolean;
  progress: number;
  currentModule: ReportModuleType | null;
  completedModules: ReportModuleType[];
  error: string | null;
  result: any;
}

// 导出功能接口
export interface ExportFunction {
  markdown: () => void;
  html: () => void;
  word: () => void;
  pdf: () => void;
}

/**
 * 学术报告管理类 - 完整的报告生成系统
 */
export class AcademicReportManager {
  private candidate: AICandidate;
  private effects: string[];
  private config: ReportConfiguration;
  private generator: AcademicReportModuleGenerator | null = null;
  private formatter: AcademicReportFormatter | null = null;
  private state: ReportGenerationState;
  private eventListeners: ((state: ReportGenerationState) => void)[] = [];

  constructor(candidate: AICandidate, effects: string[], config?: Partial<ReportConfiguration>) {
    this.candidate = candidate;
    this.effects = effects;
    this.config = this.mergeWithDefaultConfig(config || {});
    this.state = {
      isGenerating: false,
      progress: 0,
      currentModule: null,
      completedModules: [],
      error: null,
      result: null,
    };
  }

  /**
   * 合并配置与默认配置
   */
  private mergeWithDefaultConfig(userConfig: Partial<ReportConfiguration>): ReportConfiguration {
    const defaultModules: Partial<Record<ReportModuleType, ModuleConfig>> = {
      [ReportModuleType.ABSTRACT]: { enabled: true, title: '摘要', priority: 1 },
      [ReportModuleType.INTRODUCTION]: { enabled: true, title: '引言', priority: 2 },
      [ReportModuleType.LITERATURE_REVIEW]: { enabled: true, title: '文献综述', priority: 3 },
      [ReportModuleType.RESEARCH_METHOD]: { enabled: true, title: '研究方法', priority: 4 },
      [ReportModuleType.RESULTS]: { enabled: true, title: '研究结果', priority: 5 },
      [ReportModuleType.DISCUSSION]: { enabled: true, title: '讨论', priority: 6 },
      [ReportModuleType.CONCLUSION]: { enabled: true, title: '结论', priority: 7 },
      [ReportModuleType.REFERENCES]: { enabled: true, title: '参考文献', priority: 8 },
      [ReportModuleType.APPENDIX]: { enabled: false, title: '附录', priority: 9 },
    };

    return {
      metadata: {
        title: '配方研发学术报告',
        authors: ['配方研发项目组'],
        institution: '莱茵分子生物科技有限公司',
        date: new Date().toLocaleDateString('zh-CN'),
        abstract: '',
        keywords: ['药食同源', '复方', '免疫增强', '抗疲劳', '亚健康'],
        reportType: 'research_report',
        version: '1.0',
        ...userConfig.metadata,
      },
      modules: {
        ...defaultModules,
        ...userConfig.modules,
      },
      formatOptions: {
        fontFamily: 'SimSun',
        fontSize: 12,
        lineSpacing: 1.6,
        pageMargins: { top: 2.5, right: 2.5, bottom: 2.5, left: 3.0 },
        ...userConfig.formatOptions,
      },
      customSettings: userConfig.customSettings,
    };
  }

  /**
   * 添加状态监听器
   */
  addStateListener(callback: (state: ReportGenerationState) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * 移除状态监听器
   */
  removeStateListener(callback: (state: ReportGenerationState) => void): void {
    const index = this.eventListeners.indexOf(callback);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 更新状态
   */
  private updateState(partial: Partial<ReportGenerationState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyStateListeners();
  }

  /**
   * 通知状态监听器
   */
  private notifyStateListeners(): void {
    this.eventListeners.forEach(callback => callback(this.state));
  }

  /**
   * 获取当前状态
   */
  getState(): ReportGenerationState {
    return this.state;
  }

  /**
   * 获取报告配置
   */
  getConfig(): ReportConfiguration {
    return this.config;
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata: Partial<ReportMetadata>): void {
    this.config.metadata = { ...this.config.metadata, ...metadata };
  }

  /**
   * 更新模块配置
   */
  updateModuleConfig(type: ReportModuleType, config: Partial<ModuleConfig>): void {
    const currentConfig = this.config.modules[type];
    if (currentConfig) {
      this.config.modules[type] = { ...currentConfig, ...config };
    }
  }

  /**
   * 设置自定义内容
   */
  setModuleCustomContent(type: ReportModuleType, content: string): void {
    this.updateModuleConfig(type, { customContent: content });
  }

  /**
   * 启用/禁用模块
   */
  toggleModule(type: ReportModuleType, enabled: boolean): void {
    this.updateModuleConfig(type, { enabled });
  }

  /**
   * 更新格式选项
   */
  updateFormatOptions(options: Partial<ReportConfiguration['formatOptions']>): void {
    this.config.formatOptions = { ...this.config.formatOptions, ...options };
  }

  /**
   * 生成完整报告
   */
  async generateReport(): Promise<void> {
    this.updateState({
      isGenerating: true,
      progress: 0,
      currentModule: null,
      completedModules: [],
      error: null,
      result: null,
    });

    try {
      // 创建生成器
      this.generator = new AcademicReportModuleGenerator(
        this.candidate,
        this.effects,
        this.config,
      );

      // 添加进度监听
      this.generator.addEventListener((event) => {
        this.handleGeneratorEvent(event);
      });

      // 生成报告
      const result = this.generator.generateCompleteReport();

      // 创建格式化器
      this.formatter = new AcademicReportFormatter(
        result.metadata,
        result.modules,
        this.config,
      );

      this.updateState({
        isGenerating: false,
        progress: 100,
        result,
      });

    } catch (error) {
      this.updateState({
        isGenerating: false,
        error: String(error),
      });
    }
  }

  /**
   * 处理生成器事件
   */
  private handleGeneratorEvent(event: any): void {
    switch (event.type) {
      case 'start':
        this.updateState({ progress: 0, currentModule: null });
        break;

      case 'module_start':
        this.updateState({ currentModule: event.moduleType });
        break;

      case 'module_complete':
        if (event.moduleType) {
          const completedModules = [...this.state.completedModules, event.moduleType];
          const enabledModules = this.generator?.getEnabledModules() || [];
          const progress = (completedModules.length / enabledModules.length) * 100;

          this.updateState({
            completedModules,
            currentModule: null,
            progress: Math.round(progress),
          });
        }
        break;

      case 'complete':
        this.updateState({ progress: 100, currentModule: null });
        break;

      case 'error':
        this.updateState({ error: event.error });
        break;
    }
  }

  /**
   * 导出为Markdown
   */
  exportMarkdown(): void {
    if (!this.formatter) {
      throw new Error('请先生成报告');
    }

    const content = this.formatter.formatToMarkdown();
    const filename = `${this.candidate.formula_name || 'academic-report'}.md`;
    this.downloadFile(content, filename, 'text/markdown');
  }

  /**
   * 导出为HTML
   */
  exportHtml(): void {
    if (!this.formatter) {
      throw new Error('请先生成报告');
    }

    const content = this.formatter.formatToHtml('html');
    const filename = `${this.candidate.formula_name || 'academic-report'}.html`;
    this.downloadFile(content, filename, 'text/html');
  }

  /**
   * 导出为Word
   */
  exportWord(): void {
    if (!this.formatter) {
      throw new Error('请先生成报告');
    }

    const content = this.formatter.formatToWord();
    const filename = `${this.candidate.formula_name || 'academic-report'}.doc`;
    this.downloadFile(content, filename, 'application/msword');
  }

  /**
   * 导出为PDF
   */
  exportPdf(): void {
    if (!this.formatter) {
      throw new Error('请先生成报告');
    }

    const content = this.formatter.formatToPdf();

    // 创建临时窗口并打印
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();

      // 等待内容加载完成后打印
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      // 如果无法打开新窗口，下载HTML文件
      const filename = `${this.candidate.formula_name || 'academic-report'}.pdf-ready.html`;
      this.downloadFile(content, filename, 'text/html');
      alert('请在浏览器中打开文件并使用打印功能导出为PDF');
    }
  }

  /**
   * 下载文件
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * 获取预览HTML
   */
  getPreviewHtml(): string {
    if (!this.formatter) {
      return '';
    }
    return this.formatter.formatToHtml('html');
  }

  /**
   * 重置配置
   */
  resetConfig(): void {
    this.config = this.mergeWithDefaultConfig({});
    this.generator = null;
    this.formatter = null;
    this.state = {
      isGenerating: false,
      progress: 0,
      currentModule: null,
      completedModules: [],
      error: null,
      result: null,
    };
  }

  /**
   * 获取可用的报告类型
   */
  static getReportTypes(): { type: string; name: string; description: string }[] {
    return [
      {
        type: 'journal',
        name: '期刊论文',
        description: '适合期刊发表的学术论文格式',
      },
      {
        type: 'thesis',
        name: '学位论文',
        description: '适合学位论文的完整格式',
      },
      {
        type: 'research_report',
        name: '研究报告',
        description: '适合企业内部研究和项目报告',
      },
    ];
  }

  /**
   * 获取所有可用的模块类型
   */
  static getModuleTypes(): { type: ReportModuleType; name: string; description: string }[] {
    return [
      {
        type: ReportModuleType.ABSTRACT,
        name: '摘要',
        description: '研究目的、方法、结果、结论的简要概述',
      },
      {
        type: ReportModuleType.INTRODUCTION,
        name: '引言',
        description: '研究背景、目的、内容和方法',
      },
      {
        type: ReportModuleType.LITERATURE_REVIEW,
        name: '文献综述',
        description: '相关研究的总结和分析',
      },
      {
        type: ReportModuleType.RESEARCH_METHOD,
        name: '研究方法',
        description: '实验材料、方法和统计分析',
      },
      {
        type: ReportModuleType.RESULTS,
        name: '研究结果',
        description: '实验和研究结果',
      },
      {
        type: ReportModuleType.DISCUSSION,
        name: '讨论',
        description: '结果分析、意义和局限性',
      },
      {
        type: ReportModuleType.CONCLUSION,
        name: '结论',
        description: '总结和建议',
      },
      {
        type: ReportModuleType.REFERENCES,
        name: '参考文献',
        description: '参考文献列表',
      },
      {
        type: ReportModuleType.APPENDIX,
        name: '附录',
        description: '补充材料和资料',
      },
    ];
  }
}

export default AcademicReportManager;
