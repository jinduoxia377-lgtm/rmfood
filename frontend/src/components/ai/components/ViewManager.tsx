/**
 * 列视图管理器 UI 组件
 *
 * 提供可视化的列配置界面：
 * - 列可见性控制 (Checkbox)
 * - 拖拽排序 (使用 @dnd-kit 或 fallback 方案)
 * - 列宽调整
 * - 视图 CRUD (创建/重命名/删除)
 * - 导入/导出 JSON
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  ViewManagerProps,
  ColumnConfig,
  ColumnView,
} from '@/types/columnView.types';
import { useToast } from '@/components/ui'

/**
 * 简单的拖拽排序实现 (不依赖 @dnd-kit 的 fallback 版本)
 */
function SortableList({
  items,
  onChange,
}: {
  items: ColumnConfig[];
  onChange: (newItems: ColumnConfig[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const newItems = [...items];
    const [removed] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, removed);

    // 更新 order 属性
    const reordered = newItems.map((col, idx) => ({ ...col, order: idx }));
    onChange(reordered);
    setDragIndex(index);
  }, [items, dragIndex, onChange]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <div
          key={item.key}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-slate-750 border rounded cursor-move transition-all ${
            dragIndex === index
              ? 'opacity-50 border-blue-400 shadow-lg scale-[1.02]'
              : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
          }`}
        >
          {/* 拖拽手柄 */}
          <span className="cursor-grab text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
            ⠿
          </span>

          {/* 列名 */}
          <span className={`flex-1 text-sm truncate ${!item.visible ? 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-through' : ''}`}>
            {item.label}
            {!item.visible && <span className="ml-1 text-xs">(隐藏)</span>}
          </span>

          {/* 宽度显示 */}
          <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16 text-right">
            {item.width ? `${item.width}px` : '自动'}
          </span>

          {/* 排序指示 */}
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-4 text-center">
            #{index + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 主视图管理器组件
 */
export function ViewManager({
  availableColumns,
  currentView,
  onViewChange,
  savedViews = [],
  onSaveView,
  onDeleteView,
  onSetAsDefault,
  maxViews = 20,
  className = '',
}: ViewManagerProps) {
  const { error: toastError, warning: toastWarning, success: toastSuccess } = useToast();
  // 内部状态
  const [viewName, setViewName] = useState('');
  const [viewDesc, setViewDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'saved'>('edit');

  // 编辑中的列配置副本
  const [editingColumns, setEditingColumns] = useState<ColumnConfig[]>(
    () => currentView.columns.map(col => ({ ...col })),
  );

  // 处理列可见性切换
  const handleVisibilityToggle = useCallback((key: string) => {
    setEditingColumns(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col,
    ));
  }, []);

  // 处理列顺序变更
  const handleOrderChange = useCallback((newColumns: ColumnConfig[]) => {
    setEditingColumns(newColumns);
  }, []);

  // 处理列宽调整
  const handleWidthChange = useCallback((key: string, width: number | null) => {
    setEditingColumns(prev => prev.map(col =>
      col.key === key ? { ...col, width } : col,
    ));
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback((visible: boolean) => {
    setEditingColumns(prev => prev.map(col => ({ ...col, visible })));
  }, []);

  // 应用当前编辑结果到视图
  const handleApply = useCallback(() => {
    onViewChange({
      ...currentView,
      columns: editingColumns,
      updatedAt: Date.now(),
    });
  }, [currentView, editingColumns, onViewChange]);

  // 保存为新视图
  const handleSaveAsNew = useCallback(() => {
    if (!viewName.trim()) {
      toastError('请输入视图名称');
      return;
    }

    if (onSaveView) {
      onSaveView({
        id: `new-${Date.now()}`,
        name: viewName.trim(),
        description: viewDesc.trim() || undefined,
        columns: editingColumns,
        isDefault: false,
        createdAt: Date.now(),
      });

      setViewName('');
      setViewDesc('');
    }
  }, [viewName, viewDesc, editingColumns, onSaveView]);

  // 导出当前视图
  const handleExport = useCallback(() => {
    const data = {
      version: 1,
      exportTime: new Date().toISOString(),
      view: {
        name: currentView.name,
        columns: editingColumns,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentView.name.replace(/\s+/g, '_')}_view.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentView.name, editingColumns]);

  // 重置为初始状态
  const handleReset = useCallback(() => {
    setEditingColumns(currentView.columns.map(col => ({ ...col })));
  }, [currentView]);

  // 统计信息
  const stats = useMemo(() => {
    const total = editingColumns.length;
    const visible = editingColumns.filter(c => c.visible).length;
    return { total, visible, hidden: total - visible };
  }, [editingColumns]);

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
          📊 列视图管理
        </h3>

        <button
          onClick={() => {} /* 关闭由父组件处理 */}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 标签页切换 */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 px-5">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-blue-500 text-secondary-600 dark:text-secondary-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          ✏️ 编辑视图
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'saved'
              ? 'border-blue-500 text-secondary-600 dark:text-secondary-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          💾 已保存 ({savedViews.length})
          {savedViews.length > 0 && (
            <span className="absolute -top-1 -right-2 w-4 h-4 bg-secondary-container text-secondary-main text-xs rounded-full flex items-center justify-center">
              {savedViews.length}
            </span>
          )}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {activeTab === 'edit' ? (
          /* ====== 编辑标签页 ====== */
          <div className="space-y-5">
            {/* 快速操作栏 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="px-3 py-1.5 text-xs font-medium text-success-600 bg-success-50 hover:bg-success-100 rounded-md transition-colors"
                >
                  全部显示
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="px-3 py-1.5 text-xs font-medium text-error-600 bg-error-50 hover:bg-error-100 rounded-md transition-colors"
                >
                  全部隐藏
                </button>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  显示 {stats.visible}/{stats.total} 列
                </span>
              </div>

              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 rounded-md transition-colors"
              >
                ↺ 重置
              </button>
            </div>

            {/* 列可见性列表 */}
            <div className="space-y-1">
              {availableColumns.map(col => {
                const editingCol = editingColumns.find(c => c.key === col.key);
                const isVisible = editingCol?.visible ?? true;

                return (
                  <div
                    key={col.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      isVisible
                        ? 'bg-secondary-50/30 dark:bg-secondary-900/10 border-blue-200 dark:border-blue-800'
                        : 'bg-slate-50 dark:bg-slate-750 border-neutral-200 dark:border-neutral-600 opacity-60'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleVisibilityToggle(col.key)}
                      className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
                    />

                    {/* 列名 */}
                    <span className={`flex-1 text-sm font-medium ${
                      isVisible ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 line-through'
                    }`}>
                      {col.label}
                    </span>

                    {/* 列宽输入 */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingCol?.width || ''}
                        onChange={(e) => handleWidthChange(
                          col.key,
                          e.target.value ? parseInt(e.target.value) : null,
                        )}
                        placeholder="自动"
                        min={col.minWidth || 40}
                        max={col.maxWidth || 1000}
                        className="w-20 px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700"
                      />
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">px</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 拖拽排序预览区 */}
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-750 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">
                  列顺序 (拖拽调整)
                </span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  提示：上下拖拽行来调整列的显示顺序
                </span>
              </div>

              <SortableList
                items={editingColumns.sort((a, b) => a.order - b.order)}
                onChange={handleOrderChange}
              />
            </div>

            {/* 保存新视图表单 */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  placeholder="新视图名称..."
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="描述 (可选)"
                  value={viewDesc}
                  onChange={(e) => setViewDesc(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ====== 已保存标签页 ====== */
          <div className="space-y-2">
            {savedViews.length === 0 ? (
              <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">暂无已保存的视图</p>
                <p className="text-xs mt-1">在"编辑视图"中配置并保存自定义视图</p>
              </div>
            ) : (
              savedViews.map(view => (
                <div
                  key={view.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors group ${
                    view.id === currentView.id
                      ? 'bg-secondary-50 dark:bg-secondary-900/20 border-blue-300 dark:border-blue-700'
                      : 'bg-white dark:bg-slate-750 border-neutral-200 dark:border-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate">
                        📋 {view.name}
                      </span>

                      {view.isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                          默认
                        </span>
                      )}

                      {view.id === currentView.id && (
                        <span className="px-1.5 py-0.5 text-xs bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-600 rounded">
                          当前
                        </span>
                      )}
                    </div>

                    {view.description && (
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 truncate">{view.description}</p>
                    )}

                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      {view.columns.filter(c => c.visible).length}/{view.columns.length} 列 ·
                      更新于 {new Date(view.updatedAt || view.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => onViewChange(view)}
                      className="px-2.5 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-50 hover:bg-secondary-100 dark:bg-secondary-900/20 dark:hover:bg-secondary-900/40 rounded-md transition-colors"
                    >
                      加载
                    </button>

                    {!view.isSystem && onSetAsDefault && (
                      <button
                        onClick={() => onSetAsDefault(view.id)}
                        className="px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors"
                        title="设为默认视图"
                      >
                        ⭐
                      </button>
                    )}

                    {!view.isSystem && onDeleteView && (
                      <button
                        onClick={() => onDeleteView(view.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-all"
                        title="删除此视图"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-750/50 border-t border-neutral-200 dark:border-neutral-700 rounded-b-lg">
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-medium text-neutral-600 bg-white hover:bg-neutral-100 dark:bg-neutral-700 dark:hover:bg-neutral-600 border border-neutral-300 dark:border-neutral-600 rounded-lg transition-colors"
        >
          📤 导出JSON
        </button>

        <button
          onClick={handleApply}
          className="px-5 py-2 text-sm font-medium text-secondary-main bg-secondary-container hover:bg-secondary-container rounded-lg shadow-sm transition-colors"
        >
          ✓ 应用更改
        </button>

        {activeTab === 'edit' && viewName.trim() && (
          <button
            onClick={handleSaveAsNew}
            className="px-4 py-2 text-sm font-medium text-success-600 bg-success-50 hover:bg-success-100 dark:bg-success-900/20 dark:hover:bg-success-900/40 rounded-lg transition-colors"
          >
            💾 另存为新视图
          </button>
        )}
      </div>
    </div>
  );
}

export default ViewManager;
