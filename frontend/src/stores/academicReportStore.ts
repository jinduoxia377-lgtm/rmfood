import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Chapter } from '@/types/academicReport';
import { createNewDocument } from '@/data/reportTemplates';
import { logger } from '@/utils/safeLogger';


export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface ReportItem {
  id: string;
  title: string;
  abstract?: string;
  authors: string[];
  keywords: string[];
  chapters: Chapter[];
  references: unknown[];
  templateId?: string;
  version: string;
  status: 'draft' | 'in_review' | 'published';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  formulaId?: string;
  formulaName?: string;
}

interface AcademicReportState {
  currentReport: ReportItem | null;
  reports: ReportItem[];
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  lastSyncVersion: number;
  conflictData: {
    id: string;
    title: string;
    chapters: Chapter[];
  } | null;
  retryCount: number;
  maxRetries: number;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  loadReport: (id: string) => void;
  createReport: (templateId: string) => void;
  duplicateReport: (id: string) => string | undefined;
  updateReport: (id: string, updates: Partial<ReportItem>) => void;
  deleteReport: (id: string) => void;
  saveReport: () => Promise<boolean>;
  applyTemplate: (templateId: string) => void;
  updateContent: (content: string) => void;
  addChapter: (chapterId: string) => void;
  removeChapter: (chapterId: string) => void;
  getReportById: (id: string) => ReportItem | undefined;
  setSaveStatus: (status: SaveStatus) => void;
  resolveConflict: (useLocal: boolean) => void;
  enableAutoSave: (interval?: number) => void;
  disableAutoSave: () => void;
  resetRetryCount: () => void;
  importChapters: (chapters: Chapter[]) => void;
  batchDeleteChapters: (ids: string[]) => void;
  batchMoveChapters: (ids: string[], targetId: string | null) => void;
  fetchReports: () => Promise<void>;
  syncReport: (report: Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
}

const DEFAULT_AUTO_SAVE_INTERVAL = 30000;
const MAX_RETRY_COUNT = 3;

/**
 * 生成全局唯一的报告 id。优先使用 crypto.randomUUID()（浏览器/现代 Node 均支持），
 * 避免同一毫秒内连续创建报告时 `report-${Date.now()}` 产生 id 冲突；
 * 环境不支持时回退为时间戳 + 随机串（与 duplicateReport 的 id 模式一致）。
 */
function generateReportId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `report-${crypto.randomUUID()}`;
  }
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAcademicReportStore = create<AcademicReportState>()(
  persist(
    (set, get) => ({
      currentReport: null,
      reports: [],
      isLoading: false,
      error: null,
      saveStatus: 'idle',
      lastSavedAt: null,
      lastSyncVersion: 0,
      conflictData: null,
      retryCount: 0,
      maxRetries: MAX_RETRY_COUNT,
      autoSaveEnabled: false,
      autoSaveInterval: DEFAULT_AUTO_SAVE_INTERVAL,

      loadReport: (id: string) => {
        set({ isLoading: true, error: null });
        const report = get().reports.find((r) => r.id === id);
        set({ currentReport: report || null, isLoading: false });
      },

      createReport: (templateId: string) => {
        const newReport: ReportItem = {
          id: generateReportId(),
          title: '新建报告',
          abstract: '',
          authors: [] as string[],
          keywords: [] as string[],
          chapters: [] as Chapter[],
          references: [],
          templateId,
          version: '1.0',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        // 新建报告直接套用模板章节，保证进入编辑器即可编辑（P0-3 新建流程闭环）
        try {
          const templateDoc = createNewDocument(templateId);
          newReport.chapters = templateDoc.chapters;
          newReport.title = templateDoc.title;
        } catch {
          // 未知模板类型时保留空章节，由编辑器默认模板兜底
        }
        set((state) => ({
          reports: [...state.reports, newReport],
          currentReport: newReport,
          saveStatus: 'saved',
          lastSavedAt: new Date().toISOString(),
        }));
      },

      duplicateReport: (id: string) => {
        const source = get().reports.find((r) => r.id === id);
        if (!source) return undefined;

        const now = Date.now();
        // 深拷贝章节（含子章节/图表），并为副本生成全新章节 id，保证副本完全独立
        const cloneChapters = (chapters: Chapter[], prefix: string): Chapter[] =>
          chapters.map((ch, idx) => ({
            ...ch,
            id: `${prefix}-${idx}`,
            children: ch.children ? cloneChapters(ch.children, `${prefix}-${idx}`) : [],
            figures: ch.figures ? (JSON.parse(JSON.stringify(ch.figures)) as Chapter['figures']) : undefined,
            tables: ch.tables ? (JSON.parse(JSON.stringify(ch.tables)) as Chapter['tables']) : undefined,
          }));

        const newReport: ReportItem = {
          ...source,
          id: `report-${now}-${Math.random().toString(36).slice(2, 8)}`,
          title: `${source.title}（副本）`,
          abstract: source.abstract,
          authors: [...source.authors],
          keywords: [...source.keywords],
          chapters: cloneChapters(source.chapters, `ch-${now}`),
          references: JSON.parse(JSON.stringify(source.references)) as unknown[],
          templateId: source.templateId,
          version: source.version,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: undefined,
          formulaId: source.formulaId,
          formulaName: source.formulaName,
        };

        set((state) => ({
          reports: [...state.reports, newReport],
          currentReport: newReport,
        }));

        return newReport.id;
      },

      updateReport: (id: string, updates) => {
        set((state) => {
          const updatedReports = state.reports.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r,
          );
          const updatedCurrent = state.currentReport?.id === id
            ? { ...state.currentReport, ...updates, updatedAt: new Date() }
            : state.currentReport;
          return { reports: updatedReports, currentReport: updatedCurrent };
        });
      },

      deleteReport: (id: string) => {
        set((state) => ({
          reports: state.reports.filter((r) => r.id !== id),
          currentReport: state.currentReport?.id === id ? null : state.currentReport,
        }));
      },

      saveReport: async () => {
        const { currentReport, retryCount, maxRetries } = get();
        if (!currentReport) return false;

        set({ saveStatus: 'saving', error: null });

        try {
          const storedReports = localStorage.getItem('academic-report-storage');
          if (!storedReports) {
            throw new Error('无法读取存储数据');
          }

          const parsed = JSON.parse(storedReports);
          const existingReportIndex = parsed.state.reports.findIndex(
            (r: { id: string }) => r.id === currentReport.id,
          );

          if (existingReportIndex >= 0) {
            parsed.state.reports[existingReportIndex] = {
              ...currentReport,
              updatedAt: new Date().toISOString(),
            };
          } else {
            parsed.state.reports.push({
              ...currentReport,
              updatedAt: new Date().toISOString(),
            });
          }

          localStorage.setItem('academic-report-storage', JSON.stringify(parsed));

          set({
            saveStatus: 'saved',
            lastSavedAt: new Date().toISOString(),
            lastSyncVersion: get().lastSyncVersion + 1,
            retryCount: 0,
          });

          return true;
        } catch (error) {
          logger.error('Save failed:', error);

          if (retryCount < maxRetries) {
            set({ retryCount: retryCount + 1, saveStatus: 'error' });
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return get().saveReport();
          }

          set({
            saveStatus: 'error',
            error: error instanceof Error ? error.message : '保存失败',
          });
          return false;
        }
      },

      applyTemplate: (templateId: string) => {
        set((state) => {
          if (!state.currentReport) return state;
          return {
            currentReport: { ...state.currentReport, templateId, updatedAt: new Date() },
          };
        });
      },

      updateContent: (content: string) => {
        set((state) => {
          if (!state.currentReport) return state;
          return {
            currentReport: { ...state.currentReport, abstract: content, updatedAt: new Date() },
          };
        });
      },

      addChapter: (chapterId: string) => {
        set((state) => {
          if (!state.currentReport) return state;
          const chapterCount = state.currentReport.chapters.length;
          const newChapter: Chapter = {
            id: chapterId,
            title: '新章节',
            content: '',
            level: 1,
            order: chapterCount + 1,
            children: [],
          };
          const updatedReport = {
            ...state.currentReport,
            chapters: [...state.currentReport.chapters, newChapter],
            updatedAt: new Date(),
          };
          return { currentReport: updatedReport };
        });
      },

      removeChapter: (chapterId: string) => {
        set((state) => {
          if (!state.currentReport) return state;
          const updatedReport = {
            ...state.currentReport,
            chapters: state.currentReport.chapters.filter((c) => c.id !== chapterId),
            updatedAt: new Date(),
          };
          return { currentReport: updatedReport };
        });
      },

      getReportById: (id: string) => {
        return get().reports.find((r) => r.id === id);
      },

      setSaveStatus: (status: SaveStatus) => {
        set({ saveStatus: status });
      },

      resolveConflict: (_useLocal: boolean) => {
        const { conflictData } = get();
        if (!conflictData) return;

        // 历史实现中 useLocal 的两个分支行为完全相同（均以 conflictData 覆盖当前报告），
        // 因此合并为一个分支。保留 _useLocal 参数仅为兼容调用方契约，不再区分来源。
        set({
          currentReport: conflictData as AcademicReportState['currentReport'],
          conflictData: null,
          saveStatus: 'saved',
          lastSavedAt: new Date().toISOString(),
        });
      },

      enableAutoSave: (interval?: number) => {
        set({
          autoSaveEnabled: true,
          autoSaveInterval: interval || DEFAULT_AUTO_SAVE_INTERVAL,
        });
      },

      disableAutoSave: () => {
        set({ autoSaveEnabled: false });
      },

      resetRetryCount: () => {
        set({ retryCount: 0 });
      },

      importChapters: (chapters: Chapter[]) => {
        set((state) => {
          if (!state.currentReport) return state;
          const existingChapters = state.currentReport.chapters;
          const mergedChapters = [...existingChapters, ...chapters].map((ch, idx) => ({
            ...ch,
            order: idx + 1,
          }));
          return {
            currentReport: {
              ...state.currentReport,
              chapters: mergedChapters,
              updatedAt: new Date(),
            },
          };
        });
      },

      batchDeleteChapters: (ids: string[]) => {
        set((state) => {
          if (!state.currentReport) return state;
          const idSet = new Set(ids);

          const filterChapters = (chs: Chapter[]): Chapter[] => {
            return chs
              .filter(ch => !idSet.has(ch.id))
              .map(ch => ({
                ...ch,
                children: ch.children ? filterChapters(ch.children) : [],
              }));
          };

          return {
            currentReport: {
              ...state.currentReport,
              chapters: filterChapters(state.currentReport.chapters),
              updatedAt: new Date(),
            },
          };
        });
      },

      batchMoveChapters: (ids: string[], targetId: string | null) => {
        set((state) => {
          if (!state.currentReport) return state;
          const idSet = new Set(ids);
          const movedChapters: Chapter[] = [];

          const categorizeChapters = (chs: Chapter[]): Chapter[] => {
            return chs.filter(ch => {
              if (idSet.has(ch.id)) {
                movedChapters.push(ch);
                return false;
              }
              return true;
            }).map(ch => ({
              ...ch,
              children: ch.children ? categorizeChapters(ch.children) : [],
            }));
          };

          const filtered = categorizeChapters(state.currentReport.chapters);

          let updatedChapters: Chapter[];
          if (targetId === null) {
            updatedChapters = [...filtered, ...movedChapters].map((ch, idx) => ({
              ...ch,
              order: idx + 1,
            }));
          } else {
            const addToTarget = (chs: Chapter[]): Chapter[] => {
              return chs.map(ch => {
                if (ch.id === targetId) {
                  return {
                    ...ch,
                    children: [...(ch.children || []), ...movedChapters],
                  };
                }
                if (ch.children) {
                  return {
                    ...ch,
                    children: addToTarget(ch.children),
                  };
                }
                return ch;
              });
            };
            updatedChapters = addToTarget(filtered);
          }

          return {
            currentReport: {
              ...state.currentReport,
              chapters: updatedChapters,
              updatedAt: new Date(),
            },
          };
        });
      },

      fetchReports: async () => {
        set({ isLoading: true, error: null });
        // Academic reports are stored locally (no dedicated backend endpoint yet)
        try {
          const stored = localStorage.getItem('academic-report-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            set({ reports: parsed.state?.reports || [], isLoading: false });
          } else {
            set({ reports: get().reports || [], isLoading: false });
          }
        } catch {
          set({ reports: get().reports || [], isLoading: false, error: null });
        }
      },

      syncReport: async (reportData) => {
        const newReport: ReportItem = {
          ...reportData,
          id: generateReportId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // zustand persist 中间件负责写入 localStorage（key: academic-report-storage），
        // 此处只更新内存状态，避免手动 push 导致同一报告重复写入。
        set((state) => ({
          reports: [...state.reports, newReport],
          currentReport: newReport,
        }));

        return newReport.id;
      },
    }),
    {
      name: 'academic-report-storage',
      partialize: (state) => ({
        reports: state.reports,
        currentReport: state.currentReport,
      }),
    },
  ),
);
