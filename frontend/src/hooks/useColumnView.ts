/**
 * 自定义列视图管理 Hook
 *
 * 提供列视图的 CRUD 操作、localStorage 持久化、导入/导出功能
 */

import { useState, useCallback, useEffect } from 'react';

import { logger } from '@/utils/safeLogger';
import { useToast } from '@/components/ui';
const { error: toastError, warning: toastWarning, success: _toastSuccess } = useToast();

import type {
  ColumnView,
  ColumnConfig,
  SerializedColumnView,
} from '@/types/columnView.types';

const STORAGE_KEY = 'rmfood_column_views';
const DEFAULT_VIEW_ID = 'default';
const MAX_VIEWS_DEFAULT = 20;
const DATA_FORMAT_VERSION = 1;

/**
 * 创建默认视图 (包含所有列，按初始顺序)
 */
function createDefaultView(columns: Omit<ColumnConfig, 'visible' | 'order'>[]): ColumnView {
  return {
    id: DEFAULT_VIEW_ID,
    name: '默认视图',
    description: '显示所有可用列的默认视图',
    columns: columns.map((col, index) => ({
      ...col,
      visible: true,
      order: index,
    })),
    isDefault: true,
    isSystem: true,
    createdAt: Date.now(),
  };
}

/**
 * 从 localStorage 加载已保存的视图列表
 */
function loadViewsFromStorage(): ColumnView[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as ColumnView[];

    // 验证数据格式
    if (!Array.isArray(parsed)) {
      logger.warn('[useColumnView] localStorage 数据格式无效，使用空数组');
      return [];
    }

    return parsed.filter(view =>
      view && view.id && view.name && Array.isArray(view.columns),
    );
  } catch (error) {
    logger.error('[useColumnView] 加载视图失败:', error);
    return [];
  }
}

/**
 * 保存视图列表到 localStorage
 */
function saveViewsToStorage(views: ColumnView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch (error) {
    logger.error('[useColumnView] 保存视图失败:', error);
    // 可能是存储空间不足
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toastError('存储空间不足，请删除部分视图后重试');
    }
  }
}

/**
 * 列视图管理 Hook
 *
 * @param initialColumns 初始列定义数组 (不含 visible/order)
 * @returns 视图管理的状态和操作方法
 */
export function useColumnView(
  initialColumns: Omit<ColumnConfig, 'visible' | 'order'>[],
) {
  // 当前激活的视图
  const [currentView, setCurrentView] = useState<ColumnView>(() =>
    createDefaultView(initialColumns),
  );

  // 已保存的视图列表
  const [savedViews, setSavedViews] = useState<ColumnView[]>(() =>
    loadViewsFromStorage(),
  );

  // 初始化时加载默认视图或最近使用的视图
  useEffect(() => {
    const loaded = loadViewsFromStorage();

    if (loaded.length > 0) {
      setSavedViews(loaded);

      // 查找标记为默认的视图
      const defaultView = loaded.find(v => v.isDefault);

      // 如果有默认视图且有效，使用它；否则保持系统默认视图
      if (defaultView?.columns && defaultView.columns.length > 0) {
        setCurrentView(defaultView);
      }
    }
  }, []);

  /**
   * 更新当前视图的列配置
   */
  const updateColumns = useCallback((updater: (cols: ColumnConfig[]) => ColumnConfig[]) => {
    setCurrentView(prev => ({
      ...prev,
      columns: updater(prev.columns),
      updatedAt: Date.now(),
    }));
  }, []);

  /**
   * 切换单个列的可见性
   */
  const toggleColumnVisibility = useCallback((key: string, visible?: boolean) => {
    updateColumns(cols => cols.map(col =>
      col.key === key
        ? { ...col, visible: visible !== undefined ? visible : !col.visible }
        : col,
    ));
  }, [updateColumns]);

  /**
   * 调整列顺序 (拖拽排序后调用)
   */
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    updateColumns(cols => {
      const newCols = [...cols];
      const [moved] = newCols.splice(fromIndex, 1);
			newCols.splice(toIndex, 0, moved);

      // 更新 order 属性
      return newCols.map((col, idx) => ({ ...col, order: idx }));
    });
  }, [updateColumns]);

  /**
   * 调整单个列的宽度
   */
  const resizeColumn = useCallback((key: string, width: number | null) => {
    updateColumns(cols => cols.map(col =>
      col.key === key ? { ...col, width } : col,
    ));
  }, [updateColumns]);

  /**
   * 重置为默认视图 (显示所有列)
   */
  const resetToDefault = useCallback(() => {
    const defaultView = createDefaultView(initialColumns);
    setCurrentView(defaultView);
  }, [initialColumns]);

  /**
   * 保存当前视图为新方案
   *
   * @param name 视图名称
   * @param description 可选描述
   * @param maxViews 最大允许数量 (默认20)
   * @returns 是否保存成功
   */
  const saveCurrentView = useCallback((
    name: string,
    description?: string,
    maxViews: number = MAX_VIEWS_DEFAULT,
  ): boolean => {
    if (!name?.trim()) {
      logger.warn('[useColumnView] 视图名称不能为空');
      return false;
    }

    const trimmedName = name.trim();

    // 检查是否超出最大数量限制
    const existingNonSystem = savedViews.filter(v => !v.isSystem);
    if (existingNonSystem.length >= maxViews && !savedViews.find(v => v.name === trimmedName)) {
      logger.warn(`[useColumnView] 已达到最大视图数限制 (${maxViews})`);
      toastWarning(`最多只能保存 ${maxViews} 个自定义视图`);
      return false;
    }

    const newView: ColumnView = {
      id: `view-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
      name: trimmedName,
      description,
      columns: currentView.columns,
      isDefault: false,
      createdAt: Date.now(),
    };

    // 如果同名视图已存在，更新它；否则添加新视图
    let updatedViews: ColumnView[];
    const existingIndex = savedViews.findIndex(v => v.name === trimmedName && !v.isSystem);

    if (existingIndex >= 0) {
      updatedViews = [...savedViews];
      updatedViews[existingIndex] = {
        ...newView,
        id: savedViews[existingIndex].id,  // 保持原有ID
					createdAt: savedViews[existingIndex].createdAt,  // 保持创建时间
        updatedAt: Date.now(),
      };
    } else {
      updatedViews = [...savedViews, newView];
    }

    setSavedViews(updatedViews);
    saveViewsToStorage(updatedViews);

    return true;
  }, [currentView, savedViews]);

  /**
   * 删除指定ID的视图
   */
  const deleteView = useCallback((id: string): boolean => {
    // 不允许删除系统内置视图
    const target = savedViews.find(v => v.id === id);
    if (target?.isSystem) {
      logger.warn('[useColumnView] 不能删除系统内置视图');
      return false;
    }

    const updatedViews = savedViews.filter(v => v.id !== id);
    setSavedViews(updatedViews);
    saveViewsToStorage(updatedViews);

    // 如果删除的是当前正在使用的视图，切换回默认视图
    if (currentView.id === id) {
      resetToDefault();
    }

    return true;
  }, [savedViews, currentView.id, resetToDefault]);

  /**
   * 设为默认视图
   */
  const setAsDefault = useCallback((id: string): boolean => {
    const target = savedViews.find(v => v.id === id);
    if (!target || target.isSystem) {
      return false;
    }

    // 取消其他视图的默认标记
    const updatedViews = savedViews.map(v => ({
      ...v,
      isDefault: v.id === id,
    }));

    setSavedViews(updatedViews);
    saveViewsToStorage(updatedViews);

    // 同时切换到该视图
    setCurrentView(target);

    return true;
  }, [savedViews]);

  /**
   * 加载指定的视图
   */
  const loadView = useCallback((view: ColumnView): void => {
    setCurrentView(view);
  }, []);

  /**
   * 导出视图为 JSON 字符串 (用于分享/备份)
   */
  const exportView = useCallback((view?: ColumnView): string => {
    const target = view || currentView;

    const serialized: SerializedColumnView = {
      version: DATA_FORMAT_VERSION,
      exportTime: Date.now(),
      view: {
        name: target.name,
        description: target.description,
        columns: target.columns,
        isDefault: target.isDefault,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      },
    };

    return JSON.stringify(serialized, null, 2);
  }, [currentView]);

  /**
   * 从 JSON 字符串导入视图
   *
   * @param jsonString JSON 格式的视图数据
   * @returns 导入成功返回新视图对象，失败返回 null
   */
  const importView = useCallback((jsonString: string): ColumnView | null => {
    try {
      const parsed = JSON.parse(jsonString) as SerializedColumnView;

      // 验证基本结构
      if (parsed?.version === undefined || !parsed.view) {
        throw new Error('无效的视图数据格式');
      }

      const { view } = parsed;

      // 验证必要字段
      if (!view.name || !Array.isArray(view.columns) || view.columns.length === 0) {
        throw new Error('视图数据缺少必要字段');
      }

      // 验证每列的结构
      for (const col of view.columns) {
        if (!col.key || typeof col.visible !== 'boolean' || typeof col.order !== 'number') {
          throw new Error(`列配置 "${col.key}" 格式无效`);
        }
      }

      // 创建新视图 (生成新的 ID)
      const importedView: ColumnView = {
        ...view,
        id: `imported-${Date.now().toString(36)}`,
        name: `${view.name} (导入)`,
        isDefault: false,
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 自动保存到本地
      const updatedViews = [...savedViews, importedView];
      setSavedViews(updatedViews);
      saveViewsToStorage(updatedViews);

      return importedView;

    } catch (error) {
      logger.error('[useColumnView] 导入视图失败:', error);
      toastError(`导入失败: ${error instanceof Error ? error.message : '数据格式错误'}`);
      return null;
    }
  }, [savedViews]);

  /**
   * 获取可见列列表 (按 order 排序)
   */
  const getVisibleColumns = useCallback((): ColumnConfig[] => {
    return currentView.columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [currentView]);

  /**
   * 获取所有列列表 (按 order 排序)
   */
  const getAllColumns = useCallback((): ColumnConfig[] => {
    return [...currentView.columns].sort((a, b) => a.order - b.order);
  }, [currentView]);

  return {
    // 状态
    currentView,
    savedViews,

    // 视图操作
    setCurrentView,
    saveCurrentView,
    deleteView,
    setAsDefault,
    loadView,
    resetToDefault,

    // 列操作
    updateColumns,
    toggleColumnVisibility,
    reorderColumns,
    resizeColumn,

    // 辅助方法
    getVisibleColumns,
    getAllColumns,
    exportView,
    importView,
  };
}

export default useColumnView;
