import React, { useState, useEffect, useCallback } from 'react';
import { Button, Textarea, Badge } from '@/components/ui';
import {
  FileText,
  Save,
  FolderOpen,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Beaker,
  Shield,
  Activity,
} from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useFormulaAnalysis } from '@/hooks/useFormulaAnalysis';
import { RadarMiniChart } from './charts/RadarMiniChart';
import type { AICandidate } from '@/types';

// 默认配方模板
const DEFAULT_FORMULA_TEMPLATE = `# 配方组成
- 黄芪: 15g (补气升阳)
- 党参: 10g (健脾益肺)
- 茯苓: 8g (利水渗湿)
- 山药: 12g (补脾养胃)

# 目标功效
增强免疫力、抗疲劳、改善睡眠

# 注意事项
孕妇慎用、不宜长期服用`;

interface RecentFormula {
  id: string;
  content: string;
  name: string;
  savedAt: number;
}

interface FormulaInputWindowProps {
  onClose: () => void;
  onSubmit: (candidate: AICandidate) => void;
}

export function FormulaInputWindow({ onClose, onSubmit }: FormulaInputWindowProps) {
  const [formulaContent, setFormulaContent] = useState(DEFAULT_FORMULA_TEMPLATE);
  const [formulaName, setFormulaName] = useState('');
  const [recentFormulas, setRecentFormulas] = usePersistentState<RecentFormula[]>('rmfood_recent_formulas', []);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { result, progress, analyzeFormula, cancelAnalysis, resetResult } = useFormulaAnalysis();

  // 自动提取配方名称
  useEffect(() => {
    const match = /【配方名称】(.+)/.exec(formulaContent);
    if (match) {
      const name = match[1].trim();
      if (name && !name.includes('请输入')) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormulaName(name);
      }
    }
  }, [formulaContent]);

  // 实时验证
  useEffect(() => {
    if (!formulaContent || formulaContent.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidationErrors(['配方内容不能为空']);
    } else {
       
      setValidationErrors([]);
    }
  }, [formulaContent]);

  const handleContentChange = useCallback(
    (value: string) => {
      setFormulaContent(value);
      if (result.candidate) {
        resetResult();
      }
    },
    [result.candidate, resetResult],
  );

  const handleAnalyze = useCallback(async () => {
    const candidate = await analyzeFormula(formulaContent);
    if (candidate) {
      setShowPreview(true);
    }
  }, [analyzeFormula, formulaContent]);

  const handleSubmit = useCallback(() => {
    if (result.candidate) {
      onSubmit(result.candidate);
      onClose();
    }
  }, [result.candidate, onSubmit, onClose]);

  const handleSaveFormula = useCallback(async () => {
    if (!formulaContent || formulaContent.trim().length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const newFormula: RecentFormula = {
        id: `formula_${Date.now()}`,
        content: formulaContent,
        name: formulaName || '未命名配方',
        savedAt: Date.now(),
      };

      setRecentFormulas((prev) => {
        const filtered = prev.filter((f) => f.content !== newFormula.content);
        return [newFormula, ...filtered].slice(0, 10);
      });
    } finally {
      setIsSaving(false);
    }
  }, [formulaContent, formulaName, setRecentFormulas]);

  const handleLoadFormula = useCallback(
    (formula: RecentFormula) => {
      setFormulaContent(formula.content);
      resetResult();
      setShowPreview(false);
    },
    [resetResult],
  );

  const handleDeleteFormula = useCallback(
    (formulaId: string) => {
      setRecentFormulas((prev) => prev.filter((f) => f.id !== formulaId));
    },
    [setRecentFormulas],
  );

  const handleResetTemplate = useCallback(() => {
    setFormulaContent(DEFAULT_FORMULA_TEMPLATE);
    resetResult();
    setShowPreview(false);
  }, [resetResult]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 进度条颜色
  const getProgressColor = () => {
    switch (progress.stage) {
      case 'parsing':
        return 'bg-secondary-500';
      case 'safety':
        return 'bg-success-500';
      case 'synergy':
        return 'bg-accent-500';
      case 'taste':
        return 'bg-warning-500';
      case 'stability':
        return 'bg-warning-500';
      case 'complete':
        return 'bg-primary-500';
      case 'error':
        return 'bg-error-500';
      default:
        return 'bg-neutral-300';
    }
  };

  // 进度图标
  const getProgressIcon = () => {
    switch (progress.stage) {
      case 'parsing':
        return <FileText className="w-4 h-4" />;
      case 'safety':
        return <Shield className="w-4 h-4" />;
      case 'synergy':
        return <Sparkles className="w-4 h-4" />;
      case 'taste':
        return <Activity className="w-4 h-4" />;
      case 'stability':
        return <Beaker className="w-4 h-4" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-300/25 rounded-lg">
            <FileText className="w-5 h-5 text-primary-700 dark:text-primary-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">手动输入配方</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">输入配方内容，获取AI智能分析报告</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          disabled={result.isLoading}
        >
          <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      {/* 快捷操作按钮 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Button
          variant="primary"
          size="md"
          icon={<Save className="w-4 h-4" />}
          onClick={handleSaveFormula}
          disabled={isSaving || validationErrors.length > 0}
          loading={isSaving}
          className="gap-2 min-w-[140px] px-5 transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.98]"
        >
          保存配方
        </Button>
        <Button
          variant="secondary"
          size="md"
          icon={<FileText className="w-4 h-4" />}
          onClick={handleResetTemplate}
          disabled={result.isLoading}
          className="gap-2 min-w-[120px] px-5 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
        >
          重置模板
        </Button>
      </div>

      {/* 验证错误提示 */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-warning-50 dark:bg-warning-300/20 border border-warning-200 dark:border-warning-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-500 mt-0.5 shrink-0" />
            <div className="text-sm text-warning-700 dark:text-warning-700">
              <p className="font-medium mb-1">请完善以下内容：</p>
              <ul className="list-disc list-inside space-y-0.5">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 分析错误提示 */}
      {result.error && (
        <div className="mb-4 p-3 bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 rounded-lg">
          <div className="flex items-center gap-2 text-error-600 dark:text-error-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {result.error}
          </div>
        </div>
      )}

      {/* 配方名称输入 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">配方名称</label>
        <input
          type="text"
          value={formulaName}
          onChange={(e) => setFormulaName(e.target.value)}
          placeholder="请输入配方名称"
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
      </div>

      {/* 配方内容输入区 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">配方内容</label>
        <div className="relative">
          <Textarea
            value={formulaContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="请输入配方内容..."
            className="min-h-[280px] font-mono text-sm resize-none"
            disabled={result.isLoading}
          />
          {result.isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{progress.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 分析进度条 */}
      {result.isLoading && (
        <div className="mb-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              {getProgressIcon()}
              <span>{progress.message}</span>
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{progress.percent}%</span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 分析结果预览 */}
      {showPreview && result.candidate && (
        <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-300/20 border border-success-200 dark:border-success-800 rounded-lg animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-primary-500" />
            <h4 className="font-medium text-primary-800 dark:text-primary-700">分析完成</h4>
          </div>

          {/* 雷达图 */}
          <div className="flex justify-center mb-4">
            <div className="w-48 h-48">
              <RadarMiniChart
                synergy={result.candidate.synergy_score || 0}
                taste={result.candidate.taste_score || 0.6}
                stability={result.candidate.stability_score || 0.7}
                safety={result.candidate.safety_passed ? 0.85 : 0.6}
                overall={result.candidate.overall_score || 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">协同评分</p>
              <p className="text-lg font-bold text-accent-600">
                {((result.candidate.synergy_score || 0) * 100).toFixed(0)}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">口感评分</p>
              <p className="text-lg font-bold text-warning-600">
                {((result.candidate.taste_score || 0) * 100).toFixed(0)}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">稳定性</p>
              <p className="text-lg font-bold text-secondary-600">
                {((result.candidate.stability_score || 0) * 100).toFixed(0)}
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">综合评分</p>
              <p className="text-lg font-bold text-primary-700">
                {((result.candidate.overall_score || 0) * 100).toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 最近使用配方 */}
      {recentFormulas.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">最近使用配方</span>
            <Badge variant="neutral">{recentFormulas.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {recentFormulas.map((formula) => (
              <div
                key={formula.id}
                className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors group"
              >
                <button
                  onClick={() => handleLoadFormula(formula)}
                  className="flex-1 text-left"
                  disabled={result.isLoading}
                >
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formula.name}</div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formatTime(formula.savedAt)}</div>
                </button>
                <button
                  onClick={() => handleDeleteFormula(formula.id)}
                  disabled={result.isLoading}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-error-100 dark:hover:bg-error-900/30 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-error-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-700">
        {result.isLoading ? (
          <Button
            variant="secondary"
            size="md"
            onClick={cancelAnalysis}
            className="w-full sm:w-auto min-w-[140px] px-5 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
          >
            取消分析
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="w-full sm:w-auto min-w-[120px] px-5 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            >
              取消
            </Button>
            {showPreview && result.candidate ? (
              <Button
                variant="primary"
                size="md"
                icon={<CheckCircle className="w-4 h-4" />}
                onClick={handleSubmit}
                className="w-full sm:w-auto min-w-[140px] px-5 gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.98]"
              >
                确认提交
              </Button>
            ) : (
              <Button
                variant="ai"
                size="md"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={handleAnalyze}
                disabled={validationErrors.length > 0}
                loading={result.isLoading}
                className="w-full sm:w-auto min-w-[160px] px-5 gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-accent-500/20 active:scale-[0.98]"
              >
                智能分析
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
