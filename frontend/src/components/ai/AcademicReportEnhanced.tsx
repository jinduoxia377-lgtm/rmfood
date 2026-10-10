/**
 * 增强版学术报告组件
 * 完整支持模块化结构、模板切换、多格式导出、进度反馈
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AICandidate as APIAICandidate } from '@/api/ai';
import type { AICandidate as TypesAICandidate } from '@/types';
import type { ModuleConfig, ReportMetadata } from '@/types/academicReportModules';
import { ReportModuleType, MODULE_TITLE_MAP } from '@/types/academicReportModules';
import AcademicReportV2, { REPORT_TEMPLATES } from '@/services/academicReportServiceV2';
import type { ExportFormat } from '@/services/academicReportServiceV2';
import { errorHandler, ErrorCategory } from '@/services/errorHandler';
import { feedbackService } from '@/services/feedbackService';

import {
  FileDown,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';

interface AcademicReportEnhancedProps {
  candidate: APIAICandidate;
  effects: string[];
  onClose?: () => void;
}

// 导出选项
const EXPORT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'markdown', label: 'Markdown', icon: <FileDown className="w-4 h-4" /> },
  { value: 'html', label: 'HTML', icon: <FileDown className="w-4 h-4" /> },
  { value: 'word', label: 'Word', icon: <FileDown className="w-4 h-4" /> },
  { value: 'pdf', label: 'PDF', icon: <FileDown className="w-4 h-4" /> },
];

export const AcademicReportEnhanced: React.FC<AcademicReportEnhancedProps> = ({ candidate, effects, onClose }) => {
  const reportRef = useRef<AcademicReportV2 | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState('research_report');
  const [reportGenerated, setReportGenerated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [enabledModules, setEnabledModules] = useState<ReportModuleType[]>([]);
  const [moduleConfigs, setModuleConfigs] = useState<Partial<Record<ReportModuleType, ModuleConfig>>>({});
  const [metadata, setMetadata] = useState<Partial<ReportMetadata>>({});
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 初始化报告
  const initializeReport = useCallback(() => {
    try {
      if (!candidate) {
        errorHandler.validationError('配方数据无效');
        return undefined;
      }

      // 创建报告实例
      const report = new AcademicReportV2(candidate as TypesAICandidate, effects, currentTemplate);
      reportRef.current = report;

      // 获取默认配置
      const config = report.getConfig();
      setMetadata({ ...config.metadata });
      setModuleConfigs({ ...config.modules });
      setEnabledModules(report.getEnabledModules());

      // 监听状态变化
      const removeListener = report.addStateListener((state) => {
        setProgress(state.progress);
        if (state.currentModule) {
          setCurrentStage(MODULE_TITLE_MAP[state.currentModule]);
        }
        if (state.status === 'success') {
          setReportGenerated(true);
          setEnabledModules(report.getEnabledModules());
        }
      });

      return () => removeListener();
    } catch (error: any) {
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'initializeReport' },
      });
      return undefined;
    }
  }, [candidate, effects, currentTemplate]);

  // 初始化报告
  useEffect(() => {
    return initializeReport();
  }, [candidate, effects, initializeReport]);

  // 生成报告
  const handleGenerateReport = useCallback(async () => {
    if (!reportRef.current || isGenerating) return;

    setIsGenerating(true);
    try {
      // 更新元数据和模块配置
      const report = reportRef.current;
      if (Object.keys(metadata).length > 0) {
        report.updateMetadata(metadata);
      }
      Object.entries(moduleConfigs).forEach(([type, config]) => {
        if (config) {
          report.updateModuleConfig(type as ReportModuleType, config);
        }
      });

      const success = await report.generateReport();
      if (success) {
        feedbackService.showSuccess('报告生成成功', '学术报告已成功生成');
      }
    } catch (error: any) {
      errorHandler.handleError(error as Error, {
        category: ErrorCategory.RUNTIME,
        context: { operation: 'generateReport' },
        userFriendlyMessage: '报告生成失败，请重试',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, metadata, moduleConfigs]);

  // 导出报告
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!reportRef.current || isExporting) return;

      setIsExporting(true);
      try {
        const success = await reportRef.current.exportReport(format);
        if (!success) {
          feedbackService.showError('导出失败', '报告导出失败，请重试');
        }
      } catch (error: any) {
        errorHandler.handleError(error as Error, {
          category: ErrorCategory.RUNTIME,
          context: { operation: 'exportReport', format },
          userFriendlyMessage: '报告导出失败，请重试',
        });
      } finally {
        setIsExporting(false);
        setShowExportMenu(false);
      }
    },
    [isExporting],
  );

  // 切换模板
  const handleSwitchTemplate = useCallback(
    (templateType: string) => {
      if (templateType === currentTemplate) return;

      setCurrentTemplate(templateType);
      setReportGenerated(false);

      if (reportRef.current) {
        reportRef.current.switchTemplate(templateType);
        const config = reportRef.current.getConfig();
        setMetadata({ ...config.metadata });
        setModuleConfigs({ ...config.modules });
        setEnabledModules(reportRef.current.getEnabledModules());
        feedbackService.showInfo('模板已切换', `已切换到 ${REPORT_TEMPLATES[templateType]?.name}`);
      }
    },
    [currentTemplate],
  );

  // 切换模块启用状态
  const toggleModule = useCallback(
    (type: ReportModuleType) => {
      setModuleConfigs((prev) => {
        const config = prev[type];
        return {
          ...prev,
          [type]: {
            ...config,
            enabled: !config?.enabled,
          },
        };
      });

      if (reportRef.current) {
        const currentConfig = moduleConfigs[type];
        reportRef.current.updateModuleConfig(type, {
          enabled: !currentConfig?.enabled,
        });
      }
    },
    [moduleConfigs],
  );

  // 更新元数据
  const updateMetadataField = useCallback((field: keyof ReportMetadata, value: string | string[]) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // 渲染设置面板
  const renderSettingsPanel = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-700" />
            报告设置
          </h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-5 h-5 rotate-90" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 元数据设置 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-neutral-800 dark:text-neutral-200">报告信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">报告标题</label>
                <input
                  type="text"
                  value={metadata.title || ''}
                  onChange={(e) => updateMetadataField('title', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600"
        aria-label="报告标题"
      />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">作者</label>
                <input
                  type="text"
                  value={Array.isArray(metadata.authors) ? metadata.authors.join('、') : metadata.authors || ''}
                  onChange={(e) => updateMetadataField('authors', e.target.value.split('、'))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600"
        aria-label="作者"
      />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">单位</label>
                <input
                  type="text"
                  value={metadata.institution || ''}
                  onChange={(e) => updateMetadataField('institution', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600"
        aria-label="单位"
      />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">关键词</label>
                <input
                  type="text"
                  value={Array.isArray(metadata.keywords) ? metadata.keywords.join('、') : metadata.keywords || ''}
                  onChange={(e) => updateMetadataField('keywords', e.target.value.split('、'))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:border-neutral-600"
        aria-label="关键词"
      />
              </div>
            </div>
          </section>

          {/* 模板选择 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-neutral-800 dark:text-neutral-200">报告模板</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleSwitchTemplate(key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    currentTemplate === key
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-neutral-600'
                  }`}
                >
                  <div className="font-semibold mb-1">{template.name}</div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">{template.description}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{template.modules.length} 个章节</div>
                </button>
              ))}
            </div>
          </section>

          {/* 模块设置 */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-neutral-800 dark:text-neutral-200">章节管理</h3>
            <div className="space-y-2">
              {Object.values(ReportModuleType).map((type) => {
                const config = moduleConfigs[type];
                const isEnabled = config?.enabled !== false;
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleModule(type)}
                        className="w-4 h-4 text-primary-700 rounded focus:ring-primary-500"
                      />
                      <span className="font-medium">{MODULE_TITLE_MAP[type]}</span>
                    </div>
                    <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{config?.priority || '-'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
          <button
            onClick={() => setShowSettings(false)}
            className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => {
              if (reportRef.current) {
                const report = reportRef.current;
                report.updateMetadata(metadata);
                Object.entries(moduleConfigs).forEach(([type, config]) => {
                  if (config) {
                    report.updateModuleConfig(type as ReportModuleType, config);
                  }
                });
              }
              setShowSettings(false);
              feedbackService.showSuccess('设置已保存', '报告设置已保存');
            }}
            className="px-4 py-2 bg-primary-container text-primary-main rounded-lg hover:bg-primary-container transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染进度指示器
  const renderProgressIndicator = () => (
    <div className="bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-700" />
          正在生成报告...
        </h3>
        <span className="text-2xl font-bold text-primary-700">{progress}%</span>
      </div>
      <div className="w-full bg-neutral-200 rounded-full h-2 mb-3">
        <div
          className="bg-gradient-to-r from-primary-600 to-accent-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {currentStage && (
        <div className="flex items-center gap-2 text-primary-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>当前：{currentStage}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-[var(--color-primary-surface)] via-[var(--color-primary-surface)] to-[var(--color-accent-surface-deep)] p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">学术报告生成器</h1>
            <p className="text-primary-100">配方：{candidate?.name || 'AI智能配方'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900/20 hover:bg-white dark:bg-neutral-900/30 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              设置
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 bg-white dark:bg-neutral-900/20 hover:bg-white dark:bg-neutral-900/30 rounded-lg transition-colors">
                <ArrowLeftRight className="w-5 h-5 rotate-90" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* 重新生成 */}
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating || isExporting}
              className="flex items-center gap-2 px-6 py-3 bg-primary-container text-primary-main rounded-xl hover:bg-primary-container disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在生成...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  {reportGenerated ? '重新生成' : '生成报告'}
                </>
              )}
            </button>

            {/* 导出菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!reportGenerated || isGenerating || isExporting}
                className="flex items-center gap-2 px-6 py-3 bg-success-600 text-white rounded-xl hover:bg-success-700 disabled:opacity-50 transition-all"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    正在导出...
                  </>
                ) : (
                  <>
                    <FileDown className="w-5 h-5" />
                    导出报告
                  </>
                )}
              </button>

              {showExportMenu && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-neutral-700 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-600 z-40">
                  {EXPORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleExport(option.value)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-600 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 状态指示 */}
          <div className="flex items-center gap-2">
            {reportGenerated && (
              <span className="flex items-center gap-1 text-success-600 bg-success-50 px-3 py-1 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                已生成
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 进度显示 */}
      {isGenerating && renderProgressIndicator()}

      {/* 报告预览 */}
      <div className="p-6">
        {!reportGenerated ? (
          <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-700 rounded-xl">
            <AlertCircle className="w-16 h-16 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">报告未生成</h3>
            <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-4">点击"生成报告"开始生成学术报告</p>
            <button
              onClick={handleGenerateReport}
              className="px-6 py-3 bg-primary-container text-primary-main rounded-lg hover:bg-primary-container transition-colors"
            >
              立即生成
            </button>
          </div>
        ) : (
          <div className="bg-neutral-50 dark:bg-neutral-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-neutral-800 dark:text-neutral-200">报告预览</h3>
            <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <FileDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>报告已生成，请使用"导出报告"功能下载完整报告</p>
              <p className="text-sm mt-2">已启用章节：{enabledModules.map((m) => MODULE_TITLE_MAP[m]).join('、')}</p>
            </div>
          </div>
        )}
      </div>

      {/* 设置面板 */}
      {showSettings && renderSettingsPanel()}
    </div>
  );
};

export default AcademicReportEnhanced;
