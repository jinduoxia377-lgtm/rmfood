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

// ── 十八反十九畏 禁忌组合（依据《中国药典》2020版）──────────────────────────
interface ContraindicatedPair {
  herbA: string
  herbB: string
  type: '十八反' | '十九畏'
  severity: 'high' | 'medium'
}

export const CONTRAINDICATED_PAIRS: ContraindicatedPair[] = [
  // 十八反（18组）
  { herbA: '甘草', herbB: '大戟', type: '十八反', severity: 'high' },
  { herbA: '甘草', herbB: '芫花', type: '十八反', severity: 'high' },
  { herbA: '甘草', herbB: '甘遂', type: '十八反', severity: 'high' },
  { herbA: '甘草', herbB: '海藻', type: '十八反', severity: 'high' },
  { herbA: '乌头', herbB: '贝母', type: '十八反', severity: 'high' },
  { herbA: '乌头', herbB: '瓜蒌', type: '十八反', severity: 'high' },
  { herbA: '乌头', herbB: '半夏', type: '十八反', severity: 'high' },
  { herbA: '乌头', herbB: '白蔹', type: '十八反', severity: 'high' },
  { herbA: '乌头', herbB: '白及', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '人参', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '沙参', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '丹参', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '玄参', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '细辛', type: '十八反', severity: 'high' },
  { herbA: '藜芦', herbB: '芍药', type: '十八反', severity: 'high' },
  { herbA: '川乌', herbB: '贝母', type: '十八反', severity: 'high' },
  { herbA: '川乌', herbB: '瓜蒌', type: '十八反', severity: 'high' },
  { herbA: '川乌', herbB: '半夏', type: '十八反', severity: 'high' },
  { herbA: '川乌', herbB: '白蔹', type: '十八反', severity: 'high' },
  { herbA: '川乌', herbB: '白及', type: '十八反', severity: 'high' },
  { herbA: '草乌', herbB: '贝母', type: '十八反', severity: 'high' },
  { herbA: '草乌', herbB: '瓜蒌', type: '十八反', severity: 'high' },
  { herbA: '草乌', herbB: '半夏', type: '十八反', severity: 'high' },
  { herbA: '草乌', herbB: '白蔹', type: '十八反', severity: 'high' },
  { herbA: '草乌', herbB: '白及', type: '十八反', severity: 'high' },
  // 十九畏（19组）
  { herbA: '硫黄', herbB: '朴硝', type: '十九畏', severity: 'high' },
  { herbA: '水银', herbB: '砒霜', type: '十九畏', severity: 'high' },
  { herbA: '砒霜', herbB: '水银', type: '十九畏', severity: 'high' },
  { herbA: '狼毒', herbB: '密陀僧', type: '十九畏', severity: 'high' },
  { herbA: '丁香', herbB: '郁金', type: '十九畏', severity: 'high' },
  { herbA: '牙硝', herbB: '三棱', type: '十九畏', severity: 'high' },
  { herbA: '川乌', herbB: '犀角', type: '十九畏', severity: 'high' },
  { herbA: '官桂', herbB: '石脂', type: '十九畏', severity: 'medium' },
  { herbA: '牵牛', herbB: '大黄', type: '十九畏', severity: 'medium' },
  { herbA: '赤石脂', herbB: '肉桂', type: '十九畏', severity: 'medium' },
]

/** 快速查询：给定药材名，返回所有禁忌配伍 */
export function getContraindications(herbName: string): ContraindicatedPair[] {
  return CONTRAINDICATED_PAIRS.filter(
    p => p.herbA === herbName || p.herbB === herbName,
  )
}

/** 检查两味药材是否存在禁忌关系 */
export function hasContraindication(herbA: string, herbB: string): ContraindicatedPair | null {
  return CONTRAINDICATED_PAIRS.find(
    p => (p.herbA === herbA && p.herbB === herbB) ||
         (p.herbA === herbB && p.herbB === herbA),
  ) ?? null
}

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
    const warnings: { a: string; b: string; type: string; severity: string }[] = [];
    inputHerbs.forEach((h1) => {
      CONTRAINDICATED_PAIRS.forEach(({ herbA, herbB, type, severity }) => {
        if (h1 === herbA && inputHerbs.includes(herbB)) {
          warnings.push({ a: herbA, b: herbB, type, severity });
        } else if (h1 === herbB && inputHerbs.includes(herbA)) {
          warnings.push({ a: herbB, b: herbA, type, severity });
        }
      });
    });
    // 去重
    const seen = new Set<string>();
    return warnings.filter(w => {
      const key = [w.a, w.b].sort().join('-');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{t('ai.synergy.synergyTab.inputDescription')}</p>
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
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
            <Star className="w-3 h-3" /> 快速添加：
          </span>
          {SUGGESTED_HERBS.flat().slice(0, 8).map((herb) => (
            <button
              key={herb}
              onClick={() => handleAddHerb(herb)}
              className="px-2 py-1 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {herb}
            </button>
          ))}
        </div>

        {/* 禁忌警告 */}
        {contraindicationWarnings.length > 0 && (
          <div className="bg-warning-50 dark:bg-warning-300/20 border border-warning-300 dark:border-warning-700/50 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning-700 dark:text-warning-700 text-sm">
                发现十八反禁忌组合
              </p>
              <ul className="mt-2 space-y-1 text-sm text-warning-600 dark:text-warning-700">
                {contraindicationWarnings.map((w, i) => (
                  <li key={i}>⚠ {w.a} + {w.b}：{w.type}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl p-5 text-sm text-danger-600 dark:text-danger-600">
            {t('ai.synergy.synergyTab.analyzeFailed')}
          </div>
        )}
      </Card>

      {/* ── 结果区域 ── */}
      {synergyResult && matrixData && (
        <div className="space-y-5 animate-fade-in">
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-4 bg-primary-50/50 dark:bg-primary-300/15">
              <div className="text-2xl font-bold text-primary-700">{synergyResult.score ?? 0}</div>
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">综合协同评分</div>
            </div>
            <div className="border border-success-200 dark:border-success-800 rounded-xl p-4 bg-success-50/50 dark:bg-success-300/15">
              <div className="text-2xl font-bold text-success-600">
                {synergyResult.synergy_pairs?.length ?? 0}
              </div>
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">协同配对</div>
            </div>
            <div className="border border-danger-200 dark:border-danger-800 rounded-xl p-4 bg-danger-50/50 dark:bg-danger-500/10">
              <div className="text-2xl font-bold text-danger-600">
                {synergyResult.antagonism_warnings?.length ?? 0}
              </div>
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">配伍禁忌</div>
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
                        let textColor = 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]';
                        let content = '—';
                        if (h1 === h2) {
                          bgClass = 'bg-neutral-100 dark:bg-neutral-700/50';
                          content = '·';
                        } else if (cell.type === 'synergy') {
                          const intensity = Math.min(cell.value, 1);
                          // 修复 D-55 同源动态类 bug：原 `bg-primary-${Math.round(intensity*200)}00`
                          // 生成 000/010/020... 等不存在档位（Tailwind 色阶为 50-950），JIT 0 生成 →
                          // 热力图整行无背景。改为映射到真实色阶档位（100-500）+ 暗色不反转的 /alpha。
                          const step = Math.min(5, Math.max(1, Math.round(intensity * 5)));
                          const tier = [100, 200, 300, 400, 500][step - 1];
                          bgClass = `bg-primary-${tier}/15 dark:bg-primary-${tier}/30`;
                          textColor = 'text-primary-700 dark:text-primary-700';
                          content = cell.value.toFixed(2);
                        } else if (cell.type === 'antagonism') {
                          bgClass = 'bg-danger-100 dark:bg-danger-500/20';
                          textColor = 'text-danger-700 dark:text-danger-600';
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
                <div className="mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  {cell.type === 'synergy'
                    ? `✓ ${h1} + ${h2}：协同评分 ${cell.value.toFixed(2)}`
                    : `⚠ ${h1} + ${h2}：存在配伍禁忌`
                  }
                </div>
              );
            })()}
            <div className="flex gap-4 mt-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
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
            <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-5 bg-primary-50/30 dark:bg-primary-300/15">
              <h4 className="font-semibold text-primary-700 dark:text-primary-700 mb-3">
                协同配对列表
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {synergyResult.synergy_pairs.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-primary-100 dark:border-primary-900/30">
                    <span className="text-primary-500 font-medium">+</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm flex-1">{p.a}</span>
                    <span className="text-primary-500 font-medium">+</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm flex-1">{p.b}</span>
                    <span className="text-xs font-mono text-primary-700 bg-primary-50 dark:bg-primary-300/25 px-2 py-1 rounded">
                      {p.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 配伍禁忌详情 */}
          {synergyResult.antagonism_warnings && synergyResult.antagonism_warnings.length > 0 && (
            <div className="border border-danger-200 dark:border-danger-800 rounded-xl p-5 bg-danger-50/30 dark:bg-danger-300/15">
              <h4 className="font-semibold text-danger-700 dark:text-danger-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                配伍禁忌警告
              </h4>
              <div className="space-y-2">
                {synergyResult.antagonism_warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-danger-100 dark:border-danger-900/30">
                    <span className="text-danger-500 font-medium">!</span>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm">{w.a}</span>
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+</span>
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
          className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"
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
                    {entry.herbs.length > 3 && <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">…(+{entry.herbs.length - 3})</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
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
