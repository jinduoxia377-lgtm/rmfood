/**
 * RMFOOD 主题系统 - 持久化存储管理
 * 支持 localStorage 和自定义存储策略
 */

import type { ThemeConfig } from '../types/theme.types';
import { logger } from '@/utils/safeLogger';


const STORAGE_KEYS = {
  THEME_STATE: 'rmfood-theme-state',
  CUSTOM_THEMES: 'rmfood-custom-themes',
  USER_PREFERENCES: 'rmfood-theme-preferences',
  THEME_VERSIONS: 'rmfood-theme-versions',
};

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
// 主题版本历史记录
// ============================================================================

export interface ThemeVersion {
  id: string;
  timestamp: number;
  summary: string;
  /** 快照为 themeState 的简化颜色摘要 */
  snapshot: ThemeStateSnapshot;
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
   * 保存主题状态快照
   */
  saveThemeState(state: ThemeStateSnapshot): void {
    try {
      const data: StorageData<ThemeStateSnapshot> = {
        version: 2,
        data: state,
        timestamp: Date.now(),
      };
      this.storage.setItem(STORAGE_KEYS.THEME_STATE, JSON.stringify(data));
      logger.info('💾 [Theme Storage] State saved');
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to save state:', error);
    }
  }

  /**
   * 加载主题状态快照
   */
  loadThemeState(): ThemeStateSnapshot | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.THEME_STATE);
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
   * 保存自定义主题列表
   */
  saveCustomThemes(themes: ThemeConfig[]): void {
    try {
      const data: StorageData<ThemeConfig[]> = {
        version: 1,
        data: themes,
        timestamp: Date.now(),
      };
      this.storage.setItem(STORAGE_KEYS.CUSTOM_THEMES, JSON.stringify(data));
      logger.info(`💾 [Theme Storage] ${themes.length} custom theme(s) saved`);
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to save custom themes:', error);
    }
  }

  /**
   * 加载自定义主题列表
   */
  loadCustomThemes(): ThemeConfig[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.CUSTOM_THEMES);
      if (!raw) return [];

      const parsed: StorageData<ThemeConfig[]> = JSON.parse(raw);
      return parsed.data || [];
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to load custom themes:', error);
      return [];
    }
  }

  /**
   * 删除所有主题相关数据（重置）
   */
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.storage.removeItem(key);
    });
    logger.info('🗑️ [Theme Storage] All data cleared');
  }

  /**
   * 获取存储使用情况
   */
  getStorageUsage(): { used: number; total: number; percentage: number } {
    let used = 0;

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith('rmfood-')) {
        const value = this.storage.getItem(key);
        if (value) {
          used += value.length * 2; // UTF-16 encoding
        }
      }
    }

    // localStorage 通常限制为 5MB
    const total = 5 * 1024 * 1024;

    return {
      used,
      total,
      percentage: Math.round((used / total) * 10000) / 100,
    };
  }

  // ============================================================================
  // 私有方法：版本迁移
  // ============================================================================
  // 版本历史记录
  // ============================================================================

  private getVersions(): ThemeVersion[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.THEME_VERSIONS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveVersions(versions: ThemeVersion[]): void {
    try {
      this.storage.setItem(STORAGE_KEYS.THEME_VERSIONS, JSON.stringify(versions));
    } catch (error) {
      logger.error('❌ [Theme Storage] Failed to save versions:', error);
    }
  }

  createVersion(summary = '手动保存'): ThemeVersion | null {
    const state = this.loadThemeState();
    if (!state) return null;
    const versions = this.getVersions();
    const version: ThemeVersion = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      summary,
      snapshot: {
        activeThemeId: state.activeThemeId || 'light-default',
        mode: state.mode || 'light',
        accessibilityMode: state.accessibilityMode || 'normal',
        transitionType: state.transitionType || 'smooth',
        colors: { primary: state.activeThemeId || 'light-default' },
      },
    };
    versions.unshift(version);
    const MAX = 10;
    if (versions.length > MAX) versions.splice(MAX);
    this.saveVersions(versions);
    return version;
  }

  getVersionHistory(): ThemeVersion[] {
    return this.getVersions();
  }

  clearVersionHistory(): void {
    this.storage.removeItem(STORAGE_KEYS.THEME_VERSIONS);
  }

  rollbackVersion(versionId: string): ThemeVersion | null {
    const versions = this.getVersions();
    const version = versions.find((v) => v.id === versionId);
    return version ?? null;
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

    // 保存迁移后的数据
    this.saveThemeState(migrated);

    return migrated;
  }
}

export const themeStorage = new ThemeStorage();
