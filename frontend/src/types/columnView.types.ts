/**
 * 自定义列视图 - 类型定义
 *
 * 为 FormulaTable 提供灵活的列配置管理功能
 * 包括：显示/隐藏、拖拽排序、宽度调整、视图持久化
 */

/**
 * 单个列的配置
 */
export interface ColumnConfig {
  key: string;           // 列的数据字段key (对应 data[item].xxx)
  label: string;         // 列标题显示文本
  visible: boolean;      // 是否可见 (控制列的显示/隐藏)
  width: number | null;  // 列宽 (像素数, null 表示自动宽度)
  order: number;         // 显示顺序索引 (从0开始, 越小越靠左)
  fixed?: 'left' | 'right' | null;  // 固定列位置 (锁定不随水平滚动移动)
  sortable?: boolean;    // 该列是否可排序
  resizable?: boolean;   // 该列是否可拖拽调整宽度
  minWidth?: number;     // 最小宽度限制 (px)
  maxWidth?: number;     // 最大宽度限制 (px)
}

/**
 * 列视图定义 (一组列配置的集合)
 */
export interface ColumnView {
  id: string;            // 视图唯一标识符
  name: string;          // 视图名称 (如 "研发视图", "生产视图", "法规视图")
  description?: string;  // 视图描述/用途说明
  columns: ColumnConfig[];  // 列配置数组 (按 order 排序)
  isDefault?: boolean;   // 是否为默认视图 (系统启动时自动加载)
  isSystem?: boolean;    // 是否为系统内置视图 (不可删除/重命名)
  createdAt: number;     // 创建时间戳 (Date.now())
  updatedAt?: number;    // 最后更新时间戳
}

/**
 * 视图管理器组件 Props
 */
export interface ViewManagerProps {
  /** 所有可用列的定义 (不含 visible/order 等运行时属性) */
  availableColumns: Omit<ColumnConfig, 'visible' | 'order'>[];

  /** 当前激活的视图 */
  currentView: ColumnView;

  /** 视图变更回调 (用户点击"应用"时触发) */
  onViewChange: (view: ColumnView) => void;

  /** 已保存的视图列表 (用于展示和管理) */
  savedViews?: ColumnView[];

  /** 保存新视图回调 */
  onSaveView?: (view: ColumnView) => void;

  /** 删除视图回调 */
  onDeleteView?: (id: string) => void;

  /** 设为默认视图回调 */
  onSetAsDefault?: (id: string) => void;

  /** 最大允许保存的视图数量 (防止 localStorage 膨胀) */
  maxViews?: number;

  /** 自定义 CSS 类名 */
  className?: string;
}

/**
 * 列可见性切换事件
 */
export interface ColumnVisibilityChange {
  key: string;
  visible: boolean;
}

/**
 * 列顺序变更事件
 */
export interface ColumnOrderChange {
  columns: ColumnConfig[];  // 新的列顺序数组
  movedKey: string;        // 被移动的列 key
  oldIndex: number;
  newIndex: number;
}

/**
 * 列宽调整事件
 */
export interface ColumnWidthChange {
  key: string;
  width: number | null;  // null 表示恢复自动宽度
}

/**
 * 导入/导出的视图数据格式 (JSON 序列化版本)
 */
export interface SerializedColumnView {
  version: number;           // 数据格式版本 (当前为 1)
  exportTime: number;       // 导出时间戳
  view: Omit<ColumnView, 'id'>;  // 视图数据 (不含ID, 导入时会重新生成)
}
