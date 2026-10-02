/**
 * RMFOOD 主题系统 - 持久化存储管理
 * 支持 localStorage 和自定义存储策略
 */

import type { ThemeConfig } from '../types/theme.types';
import { logger } from '@/utils/safeLogger';

// ── 历史存储键（仅用于一次性迁移与清理，不再作为活跃写目标）─────────────
// D-44 / R-15：版本历史功能已删除（rollbackVersion 恒空 + 不应用状态）；
// 这些旧键保留在迁移路径中读取，确保存量用户数据不丢失。
export const LEGACY_STORAGE_KEYS = {
  THEME_STATE: 'rmfood-theme-state',
  CUSTOM_THEMES: 'rmfood-custom-themes',
  USER_PREFERENCES: 'rmfood-theme-preferences',
  THEME_VERSIONS: 'rmfood-theme-versions',
} as const;

// ============================================================================
// 存储接口
// ============================================================================

interface StorageData<T> {
  version: number;
  data: T;
  timestamp: number;
}

interface ThemeStateSnapshot {
  activeThemeId: string;
  mode: 'light' | 'dark' | 'system';
  accessibilityMode: string;
  transitionType: string;
  colors?: Record<string, string>;
}

// ============================================================================
// Theme Storage 类
// ============================================================================

export class ThemeStorage {
  private storage: Storage;

  constructor(storage?: Storage) {
    this.storage = storage || localStorage;
  }

  /**
   * 加载主题状态快照（read-only，供一次性迁移）
   */
  loadThemeState(): ThemeStateSnapshot | null {
    try {
      const raw = this.storage.getItem(LEGACY_STORAGE_KEYS.THEME_STATE);
      if (!raw) return null;

      const parsed: StorageData<ThemeStateSnapshot> = JSON.parse(raw);

      // 版本检查与迁移
      if (parsed.version < 2) {
        return this.migrateFromV1(parsed.data);
      }

      return parsed.data;
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to load state:', error);
      return null;
    }
  }

  /**
   * 加载自定义主题列表（read-only，供一次性迁移）
   */
  loadCustomThemes(): ThemeConfig[] {
    try {
      const raw = this.storage.getItem(LEGACY_STORAGE_KEYS.CUSTOM_THEMES);
      if (!raw) return [];

      const parsed: StorageData<ThemeConfig[]> = JSON.parse(raw);
      return parsed.data || [];
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to load custom themes:', error);
      return [];
    }
  }

  /**
   * 一次性清理遗留存储键（R-15）
   * 删除旧键的本地副本，确保僵尸数据不残留。
   * 调用方：themeStore 的 v4 迁移完成后。
   */
  cleanLegacyKeys(): void {
    Object.values(LEGACY_STORAGE_KEYS).forEach(key => {
      this.storage.removeItem(key);
    });
    logger.info('🗑️ [Theme Storage] Legacy keys cleaned');
  }

  // ============================================================================
  // 私有方法：版本迁移
  // ============================================================================

  private migrateFromV1(v1Data: any): ThemeStateSnapshot {
    logger.info('🔄 [Theme Storage] Migrating from v1 to v2...');

    // V1 到 V2 的迁移逻辑
    const migrated: ThemeStateSnapshot = {
      activeThemeId: v1Data.activeThemeId || v1Data.themeId || 'light-default',
      mode: v1Data.mode || 'light',
      accessibilityMode: v1Data.accessibilityMode || 'normal',
      transitionType: v1Data.transitionType || 'fade',
    };

    return migrated;
  }
}

export const themeStorage = new ThemeStorage();
