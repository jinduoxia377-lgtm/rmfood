/**
 * 学术报告模块化系统类型定义
 */

// 报告模块类型
export enum ReportModuleType {
  ABSTRACT = 'abstract',         // 摘要
  INTRODUCTION = 'introduction', // 引言
  LITERATURE_REVIEW = 'literature_review', // 文献综述
  RESEARCH_METHOD = 'research_method', // 研究方法
  RESULTS = 'results',          // 结果
  DISCUSSION = 'discussion',    // 讨论
  CONCLUSION = 'conclusion',    // 结论
  REFERENCES = 'references',    // 参考文献
  APPENDIX = 'appendix'         // 附录
}

// 模块配置接口
export interface ModuleConfig {
  enabled: boolean;              // 是否启用
  title: string;                // 模块标题
  priority: number;             // 优先级
  customContent?: string;       // 自定义内容
}

// 模块数据接口
export interface ModuleData {
  title: string;
  content: string;
  tables?: {
    title: string;
    headers: string[];
    rows: string[][];
  }[];
  figures?: {
    title: string;
    description: string;
  }[];
}

// 报告元数据接口
export interface ReportMetadata {
  title: string;
  authors: string[];
  institution: string;
  date: string;
  abstract: string;
  keywords: string[];
  reportType: 'journal' | 'thesis' | 'research_report';
  version: string;
}

// 报告配置接口
export interface ReportConfiguration {
  metadata: ReportMetadata;
  modules: Partial<Record<ReportModuleType, ModuleConfig>>;
  formatOptions: {
    fontFamily: 'SimSun' | 'Times New Roman' | 'Microsoft YaHei';
    fontSize: number;
    lineSpacing: number;
    pageMargins: { top: number; right: number; bottom: number; left: number };
  };
  customSettings?: Record<string, any>;
}

// 格式化选项
export interface FormatOptions {
  includeTitlePage?: boolean;
  includeTOC?: boolean;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  tableStyle?: 'grid' | 'bordered' | 'minimal';
  figureNumbering?: boolean;
  referenceFormat?: 'numbered' | 'author-date';
}

// 报告模块生成器接口
export interface IModuleGenerator {
  moduleType: ReportModuleType;
  generate(data: any): ModuleData;
  validate(data: any): boolean;
}

// 生成进度状态
export interface GenerationProgress {
  status: 'idle' | 'generating' | 'completed' | 'error';
  currentModule: ReportModuleType | null;
  completedModules: ReportModuleType[];
  totalModules: number;
  error?: string;
}

// 模块内容生成器接口
export interface IContentGenerator {
  generateAbstract(metadata: ReportMetadata, data: any): string;
  generateIntroduction(background: any): string;
  generateLiteratureReview(herbs: any[]): string;
  generateResearchMethod(materials: any, methods: any): string;
  generateResults(results: any): string;
  generateDiscussion(results: any, background: any): string;
  generateConclusion(summary: any): string;
  generateReferences(references: any[]): string;
}

// 学术报告生成事件接口
export interface ReportGenerationEvent {
  type: 'start' | 'module_start' | 'module_complete' | 'complete' | 'error';
  moduleType?: ReportModuleType;
  data?: any;
  error?: string;
}

// 默认报告配置
export const DEFAULT_REPORT_CONFIG: ReportConfiguration = {
  metadata: {
    title: '配方研发学术报告',
    authors: ['配方研发项目组'],
    institution: '莱茵分子生物科技有限公司',
    date: new Date().toLocaleDateString('zh-CN'),
    abstract: '',
    keywords: ['药食同源', '复方', '免疫增强'],
    reportType: 'research_report',
    version: '1.0',
  },
  modules: {
    [ReportModuleType.ABSTRACT]: { enabled: true, title: '摘要', priority: 1 },
    [ReportModuleType.INTRODUCTION]: { enabled: true, title: '1. 引言', priority: 2 },
    [ReportModuleType.LITERATURE_REVIEW]: { enabled: true, title: '2. 文献综述', priority: 3 },
    [ReportModuleType.RESEARCH_METHOD]: { enabled: true, title: '3. 研究方法', priority: 4 },
    [ReportModuleType.RESULTS]: { enabled: true, title: '4. 研究结果', priority: 5 },
    [ReportModuleType.DISCUSSION]: { enabled: true, title: '5. 讨论', priority: 6 },
    [ReportModuleType.CONCLUSION]: { enabled: true, title: '6. 结论', priority: 7 },
    [ReportModuleType.REFERENCES]: { enabled: true, title: '参考文献', priority: 8 },
    [ReportModuleType.APPENDIX]: { enabled: false, title: '附录', priority: 9 },
  },
  formatOptions: {
    fontFamily: 'SimSun',
    fontSize: 12,
    lineSpacing: 1.6,
    pageMargins: { top: 2.5, right: 2.5, bottom: 2.5, left: 3.0 },
  },
};

// 模块标题映射
export const MODULE_TITLE_MAP: Record<ReportModuleType, string> = {
  [ReportModuleType.ABSTRACT]: '摘要',
  [ReportModuleType.INTRODUCTION]: '1. 引言',
  [ReportModuleType.LITERATURE_REVIEW]: '2. 文献综述',
  [ReportModuleType.RESEARCH_METHOD]: '3. 研究方法',
  [ReportModuleType.RESULTS]: '4. 研究结果',
  [ReportModuleType.DISCUSSION]: '5. 讨论',
  [ReportModuleType.CONCLUSION]: '6. 结论',
  [ReportModuleType.REFERENCES]: '参考文献',
  [ReportModuleType.APPENDIX]: '附录',
};

// 报告类型配置
export const REPORT_TYPE_CONFIG = {
  journal: {
    name: '期刊论文',
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
    name: '学位论文',
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
    name: '研究报告',
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
