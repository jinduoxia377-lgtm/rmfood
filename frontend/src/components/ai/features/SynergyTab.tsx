/**
 * SynergyTab — 协同分析模块（深度增强版 v2.0）
 *
 * 新增功能：
 * - 协同矩阵交互式热力图（悬浮显示分值详情）
 * - 十八反十九畏禁忌药材预置高亮
 * - 本地分析历史记录（localStorage 持久化）
 * - 快速推荐药材列表（常见配伍组合）
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import type { SynergyResult } from '@/types';
import { Input, Button, Card } from '@/components/ui';
import { logger } from '@/utils/safeLogger';
import { GitMerge, History, Trash2, AlertTriangle, Star, Plus } from 'lucide-react';

// ── 类型定义 ──────────────────────────────────────────────────────────────────

interface SynergyHistoryEntry {
  id: string;
  timestamp: number;
  herbs: string[];
  score: number;
  synergyCount: number;
  antagonismCount: number;
}

// ── 十八反十九畏 禁忌组合（药典标准）──────────────────────────────────────────
const CONTRAINDICATED_PAIRS: Record<string, string[]> = {
  '甘草': ['大戟', '芫花', '甘遂', '海藻'],
  '乌头': ['贝母', '瓜蒌', '半夏', '白蔹', '白及'],
  '藜芦': ['参类', '沙参', '丹参', '玄参', '细辛', '芍药'],
};

// ── localStorage 键 ───────────────────────────────────────────────────────────
const HISTORY_STORAGE_KEY = 'synergy_analysis_history';
const MAX_HISTORY_ITEMS = 10;

function loadHistory(): SynergyHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: SynergyHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // localStorage full — ignore
  }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
}

// ── 推荐药材（常见配伍场景）────────────────────────────────────────────────────
const SUGGESTED_HERBS = [
  ['黄芪', '当归'], ['枸杞子', '菊花'], ['人参', '五味子'],
  ['丹参', '川芎'], ['金银花', '连翘'], ['黄芩', '黄连'],
  ['白术', '茯苓'], ['陈皮', '半夏'], ['薄荷', '连翘'],
];

// ── 主组件 ─────────────────────────────────────────────────────────────────────

export function SynergyTab() {
  const { t } = useTranslation();
  const [synergyInput, setSynergyInput] = useState('');
  const [synergyResult, setSynergyResult] = useState<SynergyResult | null>(null);
  const [history, setHistory] = useState<SynergyHistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // 加载历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const mutation = useMutation({
    mutationFn: (names: string[]) => aiApi.synergyAnalysis(names),
    onSuccess: (data) => {
      setSynergyResult(data);
      // 保存历史记录
      const entry: SynergyHistoryEntry = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        herbs: data.synergy_pairs?.map((p) => p.a).filter(Boolean) || [],
        score: data.score ?? 0,
        synergyCount: data.synergy_pairs?.length ?? 0,
        antagonismCount: data.antagonism_warnings?.length ?? 0,
      };
      // 去重：相同药材组合不重复记录
      const key = [...entry.herbs].sort().join(',');
      setHistory((prev) => {
        const filtered = prev.filter((h) => [...h.herbs].sort().join(',') !== key);
        const next = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        saveHistory(next);
        return next;
      });
    },
    onError: (error: unknown) => {
      logger.error('协同分析失败:', error);
    },
  });

  const handleAnalysis = useCallback(() => {
    const names = synergyInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length < 2) return;
    mutation.mutate(names);
  }, [synergyInput, mutation]);

  // ── 矩阵数据计算 ────────────────────────────────────────────────────────────
  const matrixData = useMemo(() => {
    if (!synergyResult) return null;
    const herbSet = new Set<string>();
    synergyResult.synergy_pairs?.forEach((p) => { herbSet.add(p.a); herbSet.add(p.b); });
    synergyResult.antagonism_warnings?.forEach((w) => { herbSet.add(w.a); herbSet.add(w.b); });
    const herbs = Array.from(herbSet);
    if (herbs.length === 0) return null;

    const matrix: Record<string, Record<string, { value: number; type: 'synergy' | 'antagonism' | 'none' }>> = {};
    herbs.forEach((h) => { matrix[h] = {}; });
    herbs.forEach((h1) => {
      herbs.forEach((h2) => {
        if (h1 === h2) { matrix[h1][h2] = { value: 0, type: 'none' }; return; }
        const synPair = synergyResult.synergy_pairs?.find(
          (p) => (p.a === h1 && p.b === h2) || (p.a === h2 && p.b === h1),
        );
        const antPair = synergyResult.antagonism_warnings?.find(
          (w) => (w.a === h1 && w.b === h2) || (w.a === h2 && w.b === h1),
        );
        if (synPair) matrix[h1][h2] = { value: synPair.score, type: 'synergy' };
        else if (antPair) matrix[h1][h2] = { value: -1, type: 'antagonism' };
        else matrix[h1][h2] = { value: 0, type: 'none' };
      });
    });
    return { herbs, matrix };
  }, [synergyResult]);

  // ── 禁忌高亮：检查输入药材是否在十八反十九畏中 ─────────────────────────────
  const contraindicationWarnings = useMemo(() => {
    if (!synergyInput.trim()) return [];
    const inputHerbs = synergyInput.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    const warnings: { a: string; b: string; reason: string }[] = [];
    inputHerbs.forEach((h1) => {
      Object.entries(CONTRAINDICATED_PAIRS).forEach(([herb, banned]) => {
        if (h1 === herb) {
          banned.forEach((b) => {
            if (inputHerbs.includes(b)) {
              warnings.push({ a: herb, b, reason: '十八反禁忌' });
            }
          });
        }
      });
    });
    return warnings;
  }, [synergyInput]);

  // ── 推荐添加药材（点击添加到输入框）─────────────────────────────────────────
  const handleAddHerb = useCallback((herb: string) => {
    const current = synergyInput.trim();
    const herbs = current ? current.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean) : [];
    if (!herbs.includes(herb)) {
      setSynergyInput(current ? `${current}, ${herb}` : herb);
    }
  }, [synergyInput]);

  // ── 加载历史记录 ────────────────────────────────────────────────────────────
  const handleLoadHistory = useCallback((entry: SynergyHistoryEntry) => {
    setSynergyInput(entry.herbs.join(', '));
    setShowHistory(false);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return (
    <div className="space-y-5">
      {/* ── 输入区域 ── */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary-500" />
            {t('ai.synergy.synergyTab.title')}
          </h2>
          <p className="text-sm text-neutral-500 mt-1">{t('ai.synergy.synergyTab.inputDescription')}</p>
        </div>

        <div className="flex gap-3">
          <Input
            value={synergyInput}
            onChange={(e) => setSynergyInput(e.target.value)}
            placeholder={t('ai.synergy.synergyTab.inputPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalysis()}
            className="flex-1"
          />
          <Button
            disabled={!synergyInput.trim() || mutation.isPending}
            onClick={handleAnalysis}
            loading={mutation.isPending}
            icon={<GitMerge className="w-4 h-4" />}
          >
            {t('ai.synergy.synergyTab.analyze')}
          </Button>
        </div>

        {/* 推荐药材快捷添加 */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-neutral-400 flex items-center gap-1">
            <Star className="w-3 h-3" /> 快速添加：
          </span>
          {SUGGESTED_HERBS.flat().slice(0, 8).map((herb) => (
            <button
              key={herb}
              onClick={() => handleAddHerb(herb)}
              className="px-2 py-1 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {herb}
            </button>
          ))}
        </div>

        {/* 禁忌警告 */}
        {contraindicationWarnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">
                发现十八反禁忌组合
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-500">
                {contraindicationWarnings.map((w, i) => (
                  <li key={i}>⚠ {w.a} + {w.b}：{w.reason}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl p-5 text-sm text-danger-600 dark:text-danger-400">
            {t('ai.synergy.synergyTab.analyzeFailed')}
          </div>
        )}
      </Card>

      {/* ── 结果区域 ── */}
      {synergyResult && matrixData && (
        <div className="space-y-5 animate-fade-in">
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-4 bg-primary-50/50 dark:bg-primary-900/10">
              <div className="text-2xl font-bold text-primary-600">{synergyResult.score ?? 0}</div>
              <div className="text-sm text-neutral-500">综合协同评分</div>
            </div>
            <div className="border border-success-200 dark:border-success-800 rounded-xl p-4 bg-success-50/50 dark:bg-success-900/10">
              <div className="text-2xl font-bold text-success-600">
                {synergyResult.synergy_pairs?.length ?? 0}
              </div>
              <div className="text-sm text-neutral-500">协同配对</div>
            </div>
            <div className="border border-danger-200 dark:border-danger-800 rounded-xl p-4 bg-danger-50/50 dark:bg-danger-500/10">
              <div className="text-2xl font-bold text-danger-600">
                {synergyResult.antagonism_warnings?.length ?? 0}
              </div>
              <div className="text-sm text-neutral-500">配伍禁忌</div>
            </div>
          </div>

          {/* 交互热力图 */}
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-4">
              配伍关系矩阵
            </h4>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr>
                    <th className="p-3 text-neutral-400 font-normal bg-neutral-50 dark:bg-neutral-800/50" />
                    {matrixData.herbs.map((h) => (
                      <th key={h} className="p-3 text-neutral-600 dark:text-neutral-300 font-medium whitespace-nowrap bg-neutral-50 dark:bg-neutral-800/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.herbs.map((h1) => (
                    <tr key={h1}>
                      <td className="p-3 text-neutral-600 dark:text-neutral-300 font-medium whitespace-nowrap bg-neutral-50 dark:bg-neutral-800/50 border-r border-neutral-200 dark:border-neutral-700">
                        {h1}
                      </td>
                      {matrixData.herbs.map((h2) => {
                        const cell = matrixData.matrix[h1][h2];
                        const isHovered = hoveredCell === `${h1}-${h2}`;
                        let bgClass = 'bg-neutral-50 dark:bg-neutral-800/30';
                        let textColor = 'text-neutral-400';
                        let content = '—';
                        if (h1 === h2) {
                          bgClass = 'bg-neutral-100 dark:bg-neutral-700/50';
                          content = '·';
                        } else if (cell.type === 'synergy') {
                          const intensity = Math.min(cell.value, 1);
                          bgClass = `bg-primary-${Math.round(intensity * 200)}00 dark:bg-primary-${Math.round(intensity * 300)}00/40`;
                          textColor = 'text-primary-700 dark:text-primary-400';
                          content = cell.value.toFixed(2);
                        } else if (cell.type === 'antagonism') {
                          bgClass = 'bg-danger-100 dark:bg-danger-500/20';
                          textColor = 'text-danger-700 dark:text-danger-400';
                          content = '!';
                        }
                        return (
                          <td
                            key={h2}
                            className={`p-3 text-center rounded cursor-pointer transition-all duration-150 border border-transparent ${bgClass} ${textColor} ${isHovered ? 'ring-2 ring-primary-500 scale-105' : ''}`}
                            onMouseEnter={() => setHoveredCell(`${h1}-${h2}`)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 悬浮提示 */}
            {hoveredCell && matrixData && (() => {
              const [h1, h2] = hoveredCell.split('-');
              const cell = matrixData.matrix[h1]?.[h2];
              if (!cell || cell.type === 'none') return null;
              return (
                <div className="mt-2 text-xs text-neutral-500">
                  {cell.type === 'synergy'
                    ? `✓ ${h1} + ${h2}：协同评分 ${cell.value.toFixed(2)}`
                    : `⚠ ${h1} + ${h2}：存在配伍禁忌`
                  }
                </div>
              );
            })()}
            <div className="flex gap-4 mt-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-primary-200 dark:bg-primary-800/40" /> 协同（颜色越深评分越高）
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-danger-200 dark:bg-danger-500/30" /> 配伍禁忌
              </span>
            </div>
          </div>

          {/* 协同配对详情 */}
          {synergyResult.synergy_pairs && synergyResult.synergy_pairs.length > 0 && (
            <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-5 bg-primary-50/30 dark:bg-primary-900/10">
              <h4 className="font-semibold text-primary-700 dark:text-primary-400 mb-3">
                协同配对列表
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {synergyResult.synergy_pairs.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-primary-100 dark:border-primary-900/30">
                    <span className="text-primary-500 font-medium">+</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm flex-1">{p.a}</span>
                    <span className="text-primary-500 font-medium">+</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm flex-1">{p.b}</span>
                    <span className="text-xs font-mono text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded">
                      {p.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 配伍禁忌详情 */}
          {synergyResult.antagonism_warnings && synergyResult.antagonism_warnings.length > 0 && (
            <div className="border border-danger-200 dark:border-danger-800 rounded-xl p-5 bg-danger-50/30 dark:bg-danger-900/10">
              <h4 className="font-semibold text-danger-700 dark:text-danger-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                配伍禁忌警告
              </h4>
              <div className="space-y-2">
                {synergyResult.antagonism_warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-danger-100 dark:border-danger-900/30">
                    <span className="text-danger-500 font-medium">!</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm">{w.a}</span>
                    <span className="text-neutral-400">+</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm">{w.b}</span>
                    {w.reason && (
                      <span className="text-xs text-danger-500 ml-auto">{w.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 历史记录面板 ── */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          icon={<History className="w-4 h-4" />}
          className="text-neutral-500"
        >
          分析历史 ({history.length})
        </Button>
        {showHistory && history.length > 0 && (
          <div className="absolute z-10 top-full left-0 mt-2 w-80 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">最近分析</span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-danger-500 hover:text-danger-700 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> 清空
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleLoadHistory(entry)}
                  className="w-full text-left p-3 rounded-lg border border-neutral-100 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 truncate">
                    {entry.herbs.slice(0, 3).join(' + ')}
                    {entry.herbs.length > 3 && <span className="text-neutral-400">…(+{entry.herbs.length - 3})</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                    <span>评分 {entry.score.toFixed(2)}</span>
                    <span className="text-success-500">{entry.synergyCount} 协同</span>
                    {entry.antagonismCount > 0 && (
                      <span className="text-danger-500">{entry.antagonismCount} 禁忌</span>
                    )}
                    <span className="ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
