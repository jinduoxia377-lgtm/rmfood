/**
 * 行内数据编辑系统 - 类型定义
 *
 * 为 FormulaTable 提供企业级的单元格编辑功能
 * 包括：编辑状态管理、撤销/重做、数据校验、批量操作、变更追踪
 */

/**
 * 编辑模式枚举
 */
export enum EditMode {
  /** 未进入编辑 */
  NONE = 'none',
  /** 正在编辑单个单元格 */
  CELL = 'cell',
  /** 正在进行批量修改 */
  BATCH = 'batch',
  /** 正在添加新行 */
  ADD_ROW = 'add_row'
}

/**
 * 单元格编辑状态
 */
export interface CellEditState {
  /** 被编辑的行索引 (在数据数组中的位置) */
  rowIndex: number;
  /** 被编辑的列字段key */
  columnKey: string;
  /** 原始值 (用于取消/对比) */
  originalValue: any;
  /** 当前编辑中的值 */
  currentValue: any;
  /** 是否已修改 */
  isModified: boolean;
  /** 校验结果 (如果有) */
  validation?: ValidationResult;
  /** 进入编辑的时间戳 */
  enteredAt: number;
}

/**
 * 校验结果
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
  /** 校验的规则名称 */
  ruleName?: string;
}

/**
 * 校验规则定义
 */
export interface ValidationRule {
  /** 规则唯一标识 */
  id: string;
  /** 规则显示名称 */
  name: string;
  /** 规则类型 */
  type: 'required' | 'pattern' | 'min' | 'max' | 'custom';
  /** 是否必填 */
  required?: boolean;
  /** 最小值 (数字类型) */
  min?: number;
  /** 最大值 (数字类型) */
  max?: number;
  /** 正则表达式 (字符串类型) */
  pattern?: RegExp | string;
  /** 自定义校验函数 */
  customValidator?: (value: any, allValues?: Record<string, any>) => boolean | string;
  /** 错误提示消息模板 */
  message?: string;
  /** 警告提示消息模板 */
  warningMessage?: string;
  /** 优先级 (多个规则时，高优先级先执行) */
  priority?: number;
}

/**
 * 字段级编辑配置
 */
export interface FieldEditorConfig {
  key: string;
  label: string;
  /** 编辑器类型 */
  editorType: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'toggle';
  /** 下拉选项 (editorType=select时) */
  options?: { label: string; value: any }[];
  /** 占位文本 */
  placeholder?: string;
  /** 单位显示 (如 "g", "mg", "%") */
  unit?: string;
  /** 步进值 (数字输入时) */
  step?: number;
  /** 精度 (小数位数) */
  precision?: number;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 是否可编辑 */
  editable?: boolean;
  /** 校验规则列表 */
  rules?: ValidationRule[];
  /** 自定义渲染器 (高级用法) */
  customRenderer?: (props: CellEditorProps) => React.ReactNode;
}

/**
 * 单个变更记录
 */
export interface CellChangeRecord {
  /** 变更ID */
  id: string;
  /** 行唯一标识符 (通常是数据的id或index) */
  rowId: string | number;
  /** 列字段key */
  columnKey: string;
  /** 列显示名 */
  columnLabel: string;
  /** 修改前的值 */
  oldValue: any;
  /** 修改后的值 */
  newValue: any;
  /** 变更时间戳 */
  timestamp: number;
  /** 操作类型 */
  actionType: 'edit' | 'batch_edit' | 'add' | 'delete';
  /** 是否已保存到后端 */
  isSaved: boolean;
}

/**
 * 撤销/重做栈项
 */
export interface UndoRedoItem {
  /** 快照ID */
  snapshotId: string;
  /** 时间戳 */
  timestamp: number;
  /** 描述信息 */
  description: string;
  /** 完整的数据快照 (深拷贝) */
  data: Record<string, any>[];
  /** 变更记录 (可选，用于显示变更详情) */
  changes?: CellChangeRecord[];
}

/**
 * 编辑状态 (useReducer 的 state)
 */
export interface EditingState {
  /** 当前编辑模式 */
  mode: EditMode;
  /** 当前正在编辑的单元格状态 */
  editingCell: CellEditState | null;
  /** 选中的行索引集合 (用于批量操作) */
  selectedRows: Set<number>;
  /** 所有未保存的变更记录 */
  changes: CellChangeRecord[];
  /** 撤销栈 */
  undoStack: UndoRedoItem[];
  /** 重做栈 */
  redoStack: UndoRedoItem[];
  /** 数据快照 (当前完整数据) */
  currentData: Record<string, any>[];
  /** 原始数据 (用于重置) */
  originalData: Record<string, any>[];
}

/**
 * 编辑动作 (useReducer 的 action)
 */
export type EditingAction =
  | { type: 'ENTER_EDIT_MODE'; cell: CellEditState }
  | { type: 'EXIT_EDIT_MODE'; save?: boolean }
  | { type: 'UPDATE_CELL_VALUE'; value: any }
  | { type: 'SELECT_ROWS'; rows: number[] | Set<number>; toggle?: boolean }
  | { type: 'DESELECT_ALL' }
  | { type: 'ENTER_BATCH_MODE' }
  | { type: 'EXIT_BATCH_MODE' }
  | { type: 'APPLY_BATCH_CHANGE'; columnKey: string; value: any }
  | { type: 'SAVE_CHANGES' }
  | { type: 'DISCARD_CHANGES' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET_DATA' }
  | { type: 'SET_DATA'; data: Record<string, any>[] };

/**
 * CellEditor 组件 Props
 */
export interface CellEditorProps {
  /** 字段配置 */
  config: FieldEditorConfig;
  /** 当前值 */
  value: any;
  /** 值变更回调 */
  onChange: (value: any) => void;
  /** 确认回调 (Enter键或失焦时) */
  onConfirm?: () => void;
  /** 取消回调 (Esc键) */
  onCancel?: () => void;
  /** 校验结果 */
  validation?: ValidationResult;
  /** 是否只读 */
  readOnly?: boolean;
  /** 自定义CSS类名 */
  className?: string;
  /** 容器宽度 (px) */
  width?: number | 'full';
}

/**
 * BatchEditDialog 组件 Props
 */
export interface BatchEditDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 目标列配置 */
  targetColumn: FieldEditorConfig;
  /** 已选中的行数 */
  selectedRowCount: number;
  /** 当前值预览 */
  previewValues: any[];
  /** 确认批量修改 */
  onConfirm: (newValue: any) => void;
  /** 取消 */
  onCancel: () => void;
  /** 关闭 */
  onClose: () => void;
}

/**
 * useCellEditor Hook 返回值
 */
export interface UseCellEditorReturn {
  /** 当前编辑状态 */
  state: EditingState;

  // === 单元格编辑 ===
  /** 开始编辑单元格 */
  startEditing: (rowIndex: number, columnKey: string, value: any) => void;
  /** 更新编辑中的值 */
  updateValue: (value: any) => void;
  /** 确认编辑 (退出并保存) */
  confirmEdit: () => void;
  /** 取消编辑 (退出不保存) */
  cancelEdit: () => void;

  // === 选择操作 ===
  /** 选中行 */
  selectRow: (rowIndex: number) => void;
  /** 切换行选中状态 */
  toggleRowSelection: (rowIndex: number) => void;
  /** 全选 */
  selectAll: () => void;
  /** 清除所有选择 */
  clearSelection: () => void;
  /** 是否选中某行 */
  isRowSelected: (rowIndex: number) => boolean;
  /** 获取选中行数量 */
  getSelectedCount: () => number;

  // === 批量操作 ===
  /** 进入批量编辑模式 */
  enterBatchMode: (columnKey: string) => void;
  /** 退出批量编辑模式 */
  exitBatchMode: () => void;
  /** 应用批量修改 */
  applyBatchChange: (value: any) => void;

  // === 撤销/重做 ===
  /** 撤销 */
  undo: () => boolean;
  /** 重做 */
  redo: () => boolean;
  /** 是否可以撤销 */
  canUndo: () => boolean;
  /** 是否可以重做 */
  canRedo: () => boolean;

  // === 变更追踪 ===
  /** 获取所有变更记录 */
  getChanges: () => CellChangeRecord[];
  /** 获取变更数量 */
  getChangesCount: () => number;
  /** 是否有未保存的变更 */
  hasUnsavedChanges: () => boolean;
  /** 保存所有变更 (调用外部API) */
  saveAllChanges: () => Promise<boolean>;
  /** 放弃所有变更 */
  discardAllChanges: () => void;

  // === 数据管理 ===
  /** 更新整个数据集 */
  setData: (data: Record<string, any>[]) => void;
  /** 重置为原始数据 */
  resetToOriginal: () => void;
  /** 获取当前数据 */
  getCurrentData: () => Record<string, any>[];
}
