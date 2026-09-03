/**
 * 最近使用组织追踪 Hook
 * 使用 localStorage 持久化，最多记录 10 个最近访问的组织
 */
import { useState, useCallback, useEffect } from 'react';

const RECENT_KEY = 'org_recent_visited';
const MAX_RECENT = 10;

interface RecentEntry {
  id: number;
  name: string;
  slug: string;
  visitedAt: string;
}

export function useRecentOrganizations() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const addRecent = useCallback((id: number, name: string, slug: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      const updated = [{ id, name, slug, visitedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      } catch { /* quota exceeded */ }
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
  }, []);

  return { recent, addRecent, clearRecent };
}

export default useRecentOrganizations;
