/**
 * 学术报告联动映射工具（配方生成报告 → 学术报告页）
 *
 * 纯函数层：在 `AcademicReportV2` 的模块化报告数据模型与学术报告库/编辑器的
 * `ReportItem` / `ReportDocument` 之间做双向映射，供组件、页面、Store 复用。
 *
 * 详见设计文档：reports/formula-report-academic-linkage-design.md 第 3 章。
 */
import type {
  Chapter,
  HeaderConfig,
  ReportDocument,
  ReportType,
} from '@/types/academicReport';
import type {
  ModuleData,
  ReportMetadata,
} from '@/types/academicReportModules';
import { ReportModuleType } from '@/types/academicReportModules';
import type { AICandidate } from '@/types';
import type { ReportItem } from '@/stores/academicReportStore';

/**
 * 复用 `createNewDocument` 的默认页眉页脚配置（见 reportTemplates.ts）。
 */
export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  showHeader: true,
  headerText: { left: '', center: 'chapter', right: 'page' },
  showFooter: true,
  footerText: { left: '', center: '', right: '' },
};

/**
 * 模板 ID 归一化：`'research_report' → 'research'`，`journal`/`thesis` 直通，
 * 其余类型统一回退为 `'research'`。
 */
export function normalizeReportType(templateId?: string): ReportType {
  if (templateId === 'research_report') return 'research';
  if (templateId === 'journal' || templateId === 'thesis') return templateId;
  return 'research';
}

/**
 * 将 V2 模块数据映射为编辑器章节 `Chapter[]`。
 *
 * - 模块类型 → 章节类型：`abstract → 'abstract'`，`appendix → 'appendix'`，其余 `'normal'`；
 * - 表格/图题原样保留（`tables[].title → tables[].caption`、`figures[].description → figures[].data`）；
 * - V2 的子标题保留在 Markdown 正文中，不拆分为子章节。
 */
export function moduleDataToChapters(
  modules: { type: ReportModuleType; data: ModuleData }[],
  now: number = Date.now(),
): Chapter[] {
  return modules.map(({ type, data }, idx) => ({
    id: `ch-${now}-${type}-${idx}`,
    title: data.title,
    content: data.content,
    level: 1,
    order: idx + 1,
    type:
      type === ReportModuleType.ABSTRACT
        ? 'abstract'
        : type === ReportModuleType.APPENDIX
          ? 'appendix'
          : 'normal',
    children: [],
    tables: data.tables?.map((t, i) => ({
      id: `tbl-${now}-${type}-${i}`,
      caption: t.title,
      headers: t.headers,
      rows: t.rows,
    })),
    figures: data.figures?.map((f, i) => ({
      id: `fig-${now}-${type}-${i}`,
      caption: f.title,
      data: f.description,
    })),
  }));
}

/**
 * 从 REFERENCES 模块的 Markdown 文本中按 `^\[\d+\]` 逐条切分参考文献。
 * 无编号行时整段保真返回；空内容返回空数组。
 */
export function parseReferences(content: string): string[] {
  const lines = content
    .split('\n')
    .map((s) => s.trim())
    .filter((l) => /^\[\d+\]/.test(l));
  // 无编号行时整段保真返回；纯空白视为空内容返回空数组
  return lines.length > 0 ? lines : content.trim() ? [content] : [];
}

/**
 * 将 V2 报告（元数据 + 已生成模块 + 配方候选）映射为可写入学术报告库的
 * `ReportItem` 数据（不含 id / 时间戳，由 `syncReport` 生成）。
 */
export function v2ReportToReportItemData(params: {
  metadata: ReportMetadata;
  modules: { type: ReportModuleType; data: ModuleData }[];
  candidate: AICandidate;
  templateId: string;
}): Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt'> {
  const { metadata, modules, candidate, templateId } = params;
  const abstractModule = modules.find(
    (m) => m.type === ReportModuleType.ABSTRACT,
  )?.data;
  const referencesModule = modules.find(
    (m) => m.type === ReportModuleType.REFERENCES,
  )?.data;

  return {
    title: metadata.title,
    abstract: metadata.abstract || abstractModule?.content || '',
    authors: metadata.authors,
    keywords: metadata.keywords,
    chapters: moduleDataToChapters(modules),
    references: parseReferences(referencesModule?.content ?? ''),
    templateId,
    version: metadata.version || '1.0',
    status: 'draft',
    formulaId: candidate.id || candidate.candidateId,
    formulaName: candidate.formula_name || candidate.name,
  };
}

/**
 * 将学术报告库中的 `ReportItem` 转为编辑器使用的 `ReportDocument`。
 * 模板类型经 `normalizeReportType` 归一化（`research_report → research`）。
 */
export function reportItemToReportDocument(report: ReportItem): ReportDocument {
  return {
    id: report.id,
    title: report.title,
    type: normalizeReportType(report.templateId),
    templateId: report.templateId || normalizeReportType(report.templateId),
    authors: report.authors,
    institution: '',
    date: new Date().toISOString().split('T')[0],
    abstractChinese: report.abstract || '',
    abstractEnglish: '',
    keywords: report.keywords,
    chapters: report.chapters,
    citations: [],
    citationStyle: 'gbt7714',
    headerConfig: DEFAULT_HEADER_CONFIG,
    createdAt:
      report.createdAt instanceof Date
        ? report.createdAt.toISOString()
        : String(report.createdAt),
    updatedAt:
      report.updatedAt instanceof Date
        ? report.updatedAt.toISOString()
        : String(report.updatedAt),
  };
}

/**
 * 编辑后保存回写：将 `ReportDocument` 转为 `ReportItem` 数据。
 *
 * - `references`：若文档存在「参考文献」章节则重新 `parseReferences`，否则保留 `keepMeta.references`；
 * - `version` / `status` / `formulaId` / `formulaName` 保留原值（编辑不改变配方关联与状态）。
 */
export function reportDocumentToReportItemData(
  doc: ReportDocument,
  keepMeta?: Partial<ReportItem> | ReportItem | null,
): Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt'> {
  const referencesChapter = doc.chapters.find(
    (ch) => ch.title.trim() === '参考文献' || ch.title.includes('参考文献'),
  );

  return {
    title: doc.title,
    abstract: doc.abstractChinese || doc.abstractEnglish || '',
    authors: doc.authors || [],
    keywords: doc.keywords || [],
    chapters: doc.chapters,
    references: referencesChapter
      ? parseReferences(referencesChapter.content)
      : keepMeta?.references ?? [],
    templateId: doc.templateId || doc.type,
    version: keepMeta?.version || '1.0',
    status: keepMeta?.status || 'draft',
    formulaId: keepMeta?.formulaId,
    formulaName: keepMeta?.formulaName,
  };
}