/**
 * M5 历史记录 — localStorage 持久化（仅本地，不上传）
 *
 * 保存最近 20 条核查输入与结果，支持复查 / 单条删除 / 清空。
 * 隐私：数据只存在用户浏览器 localStorage，绝不发往后端或第三方。
 */
import { useCallback, useEffect, useState } from 'react';
import type { LabelCheckResult } from '@/api/labelCheck';

const STORAGE_KEY = 'rmfoodfp.labelCheck.history.v2';
const MAX_ENTRIES = 20;

/** 核查输入来源 */
export type HistoryInputType = 'text' | 'ocr';

export interface LabelCheckHistoryEntry {
  /** 唯一 id（时间戳 + 随机） */
  id: string;
  /** 输入的配料表文本（OCR 时为识别文本） */
  input: string;
  /** 输入来源 */
  input_type: HistoryInputType;
  /** 核查时间（ISO） */
  created_at: string;
  /** 完整核查结果 */
  result: LabelCheckResult;
}

/** 读取全部历史（旧数据 / 损坏数据安全兜底为空数组） */
function loadHistory(): LabelCheckHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LabelCheckHistoryEntry[];
  } catch {
    return [];
  }
}

/** 持久化并广播变更（同页多个监听者同步） */
function persist(entries: LabelCheckHistoryEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 存储满 / 隐私模式：静默失败，不影响主流程
  }
  window.dispatchEvent(new CustomEvent('labelCheckHistoryChanged'));
}

export function useLabelCheckHistory() {
  const [history, setHistory] = useState<LabelCheckHistoryEntry[]>(() => loadHistory());

  // 跨组件（含本组件自身广播）同步
  useEffect(() => {
    const onChange = () => setHistory(loadHistory());
    window.addEventListener('labelCheckHistoryChanged', onChange);
    // 跨标签页同步
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('labelCheckHistoryChanged', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  /** 新增一条（置于队首，超出上限淘汰最旧） */
  const addEntry = useCallback(
    (input: string, inputType: HistoryInputType, result: LabelCheckResult) => {
      const entry: LabelCheckHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        input,
        input_type: inputType,
        created_at: new Date().toISOString(),
        result,
      };
      const next = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
      persist(next);
    },
    [],
  );

  /** 删除单条 */
  const removeEntry = useCallback((id: string) => {
    persist(loadHistory().filter(e => e.id !== id));
  }, []);

  /** 清空全部 */
  const clearAll = useCallback(() => {
    persist([]);
  }, []);

  return { history, addEntry, removeEntry, clearAll, maxEntries: MAX_ENTRIES };
}
