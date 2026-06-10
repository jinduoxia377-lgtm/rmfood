/**
 * 单元格编辑管理 Hook
 *
 * 提供完整的行内数据编辑功能：
 * - 编辑模式管理 (单单元格/批量/添加行)
 * - 撤销/重做栈 (最多50步)
 * - 行选择与批量操作
 * - 变更追踪与持久化
 * - 数据校验集成
 */

import { useReducer, useCallback, useRef } from 'react';
import type {
  EditingState,
  EditingAction,
  CellEditState,
  CellChangeRecord,
  UndoRedoItem,
  FieldEditorConfig,
  UseCellEditorReturn,
} from '@/types/editing.types';
import { EditMode } from '@/types/editing.types';

/** 最大撤销/重做步数 */
const MAX_UNDO_STACK_SIZE = 50;

/**
 * 创建空的编辑状态
 */
function createInitialState(data: Record<string, any>[]): EditingState {
  return {
    mode: EditMode.NONE,
    editingCell: null,
    selectedRows: new Set(),
    changes: [],
    undoStack: [],
    redoStack: [],
    currentData: JSON.parse(JSON.stringify(data)),
    originalData: JSON.parse(JSON.stringify(data)),
  };
}

/**
 * 生成变更ID
 */
function generateChangeId(): string {
  return `change-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 生成快照ID
 */
function generateSnapshotId(): string {
  return `snapshot-${Date.now().toString(36)}`;
}

/**
 * 创建快照 (用于撤销)
 */
function createSnapshot(
  data: Record<string, any>[],
  description: string,
  changes?: CellChangeRecord[],
): UndoRedoItem {
  return {
    snapshotId: generateSnapshotId(),
    timestamp: Date.now(),
    description,
    data: JSON.parse(JSON.stringify(data)),
    changes,
  };
}

/**
 * 编辑状态 Reducer
 */
function editingReducer(state: EditingState, action: EditingAction): EditingState {
  switch (action.type) {
    // ====== 进入编辑模式 ======
    case 'ENTER_EDIT_MODE':
      // 如果已有编辑中的单元格，先保存它（隐式确认）
      if (state.editingCell && state.editingCell.isModified) {
        const change = createChangeFromCell(
          state.editingCell,
          state.currentData,
          'edit',
        );

        const updatedData = [...state.currentData];
        if (state.editingCell.rowIndex < updatedData.length) {
          updatedData[state.editingCell.rowIndex] = {
            ...updatedData[state.editingCell.rowIndex],
            [state.editingCell.columnKey]: state.editingCell.currentValue,
          };
        }

        const snapshot = createSnapshot(updatedData, `编辑单元格 [${state.editingCell.columnKey}]`, [change]);

        return {
          ...state,
          mode: EditMode.CELL,
          editingCell: action.cell,
          changes: [...state.changes, change],
          currentData: updatedData,
          undoStack: [...state.undoStack, snapshot],
          redoStack: [],  // 新操作清空重做栈
        };
      }

      return {
        ...state,
        mode: EditMode.CELL,
        editingCell: action.cell,
        redoStack: [],
      };

    // ====== 退出编辑模式 ======
    case 'EXIT_EDIT_MODE':
      if (action.save && state.editingCell?.isModified) {
        // 保存当前编辑的值
        const change = createChangeFromCell(
          state.editingCell,
          state.currentData,
          'edit',
        );

        const updatedData = [...state.currentData];
        if (state.editingCell.rowIndex < updatedData.length) {
          updatedData[state.editingCell.rowIndex] = {
            ...updatedData[state.editingCell.rowIndex],
            [state.editingCell.columnKey]: state.editingCell.currentValue,
          };
        }

        const snapshot = createSnapshot(updatedData, '退出并保存', [change]);

        return {
          ...state,
          mode: EditMode.NONE,
          editingCell: null,
          changes: [...state.changes, change],
          currentData: updatedData,
          undoStack: [...state.undoStack, snapshot],
          redoStack: [],
        };
      }

      // 不保存，直接退出
      return {
        ...state,
        mode: EditMode.NONE,
        editingCell: null,
        redoStack: [],
      };

    // ====== 更新单元格值 ======
    case 'UPDATE_CELL_VALUE':
      if (!state.editingCell) return state;

      const isModified = state.editingCell.originalValue !== action.value;

      return {
        ...state,
        editingCell: {
          ...state.editingCell,
          currentValue: action.value,
          isModified,
        },
      };

    // ====== 行选择操作 ======
    case 'SELECT_ROWS': {
      const newSelection = new Set(state.selectedRows);
      const rowArray = Array.isArray(action.rows)
        ? action.rows
        : [...(action.rows)];

      for (const row of rowArray) {
        if (action.toggle) {
          if (newSelection.has(row)) {
            newSelection.delete(row);
          } else {
            newSelection.add(row);
          }
        } else {
          newSelection.add(row);
        }
      }

      return { ...state, selectedRows: newSelection };
    }

    case 'DESELECT_ALL':
      return { ...state, selectedRows: new Set() };

    // ====== 批量编辑模式 ======
    case 'ENTER_BATCH_MODE':
      return {
        ...state,
        mode: EditMode.BATCH,
        editingCell: null,
        redoStack: [],
      };

    case 'EXIT_BATCH_MODE':
      return {
        ...state,
        mode: EditMode.NONE,
        redoStack: [],
      };

    // ====== 应用批量修改 ======
    case 'APPLY_BATCH_CHANGE': {
      const { columnKey, value } = action;
      const affectedRows = Array.from(state.selectedRows).sort((a, b) => a - b);

      const changes: CellChangeRecord[] = [];
      const updatedData = [...state.currentData];

      for (const rowIndex of affectedRows) {
        if (rowIndex < updatedData.length) {
          const oldValue = updatedData[rowIndex]?.[columnKey];

          changes.push({
            id: generateChangeId(),
            rowId: rowIndex,
            columnKey,
            columnLabel: columnKey,
            oldValue,
            newValue: value,
            timestamp: Date.now(),
            actionType: 'batch_edit',
            isSaved: false,
          });

          updatedData[rowIndex] = {
            ...updatedData[rowIndex],
            [columnKey]: value,
          };
        }
      }

      const snapshot = createSnapshot(
        updatedData,
        `批量修改 ${columnKey} (${affectedRows.length}行)`,
        changes,
      );

      return {
        ...state,
        mode: EditMode.NONE,
        changes: [...state.changes, ...changes],
        currentData: updatedData,
        selectedRows: new Set(),  // 批量操作后清除选择
        undoStack: [...state.undoStack, snapshot],
        redoStack: [],
      };
    }

    // ====== 保存所有变更 ======
    case 'SAVE_CHANGES':
      // 标记所有变更为已保存
      const savedChanges = state.changes.map(c => ({ ...c, isSaved: true }));

      return {
        ...state,
        changes: savedChanges,
        undoStack: [],  // 保存后清空撤销栈（可选）
        redoStack: [],
      };

    // ====== 放弃所有变更 ======
    case 'DISCARD_CHANGES':
      if (state.undoStack.length > 0) {
        // 恢复到最近的快照（通常是原始状态或上次保存点）
        const lastSnapshot = state.undoStack[state.undoStack.length - 1]
        return {
          ...state,
          mode: EditMode.NONE,
          editingCell: null,
          changes: [],
          currentData: JSON.parse(JSON.stringify(lastSnapshot.data)),
          selectedRows: new Set(),
          redoStack: [],
        };
      }

      // 无历史记录，恢复到原始数据
      return {
        ...createInitialState(state.originalData),
        mode: EditMode.NONE,
      };

    // ====== 撤销 ======
    case 'UNDO':
      if (state.undoStack.length === 0) return state;

      // 弹出当前状态的快照到重做栈
      const undoCurrentSnapshot = createSnapshot(
        state.currentData,
        '撤销前状态',
        state.changes.slice(-10),  // 只保留最近10条变更记录
      );

      // 弹出上一个快照
      const newUndoStack = [...state.undoStack];
      const previousSnapshot = newUndoStack.pop()!

      return {
        ...state,
        currentData: previousSnapshot.data,
        changes: previousSnapshot.changes || [],
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, undoCurrentSnapshot].slice(-MAX_UNDO_STACK_SIZE),
        mode: EditMode.NONE,
        editingCell: null,
        selectedRows: new Set(),
      };

    // ====== 重做 ======
    case 'REDO':
      if (state.redoStack.length === 0) return state;

      // 弹出重做栈顶部的快照
      const newRedoStack = [...state.redoStack];
      const redoSnapshot = newRedoStack.pop()!

      // 将当前状态压入撤销栈
      const redoCurrentSnapshot = createSnapshot(
        state.currentData,
        '重做前状态',
        state.changes.slice(-10),
      )

      return {
        ...state,
        currentData: redoSnapshot.data,
        changes: redoSnapshot.changes || [],
        undoStack: [...state.undoStack, redoCurrentSnapshot].slice(-MAX_UNDO_STACK_SIZE),
        redoStack: newRedoStack,
        mode: EditMode.NONE,
        editingCell: null,
        selectedRows: new Set(),
      };

    // ====== 重置为原始数据 ======
    case 'RESET_DATA':
      return createInitialState(state.originalData);

    // ====== 设置新数据 ======
    case 'SET_DATA':
      return {
        ...state,
        currentData: action.data,
        originalData: action.data,
        changes: [],
        undoStack: [],
        redoStack: [],
        mode: EditMode.NONE,
        editingCell: null,
        selectedRows: new Set(),
      };

    default:
      return state;
  }
}

/**
 * 从 CellEditState 创建 ChangeRecord
 */
function createChangeFromCell(
  cell: CellEditState,
  _data: Record<string, any>[],
  actionType: CellChangeRecord['actionType'],
): CellChangeRecord {

  return {
    id: generateChangeId(),
    rowId: cell.rowIndex,
    columnKey: cell.columnKey,
    columnLabel: cell.columnKey,
    oldValue: cell.originalValue,
    newValue: cell.currentValue,
    timestamp: Date.now(),
    actionType,
    isSaved: false,
  };
}

/**
 * 列视图管理 Hook 主函数
 */
export function useCellEditor(
  initialData: Record<string, any>[],
  fieldConfigs: FieldEditorConfig[],
): UseCellEditorReturn {
  const [state, dispatch] = useReducer(editingReducer, initialData, createInitialState);

  const batchColumnKeyRef = useRef<string>('');

  // === 单元格编辑 ===

  /**
   * 开始编辑指定单元格
   */
  const startEditing = useCallback((rowIndex: number, columnKey: string, value: any) => {
    dispatch({
      type: 'ENTER_EDIT_MODE',
      cell: {
        rowIndex,
        columnKey,
        originalValue: value,
        currentValue: value,
        isModified: false,
        enteredAt: Date.now(),
      },
    });
  }, [fieldConfigs]);

  /**
   * 更新编辑中的值
   */
  const updateValue = useCallback((value: any) => {
    dispatch({ type: 'UPDATE_CELL_VALUE', value });
  }, []);

  /**
   * 确认编辑 (保存并退出)
   */
  const confirmEdit = useCallback(() => {
    dispatch({ type: 'EXIT_EDIT_MODE', save: true });
  }, []);

  /**
   * 取消编辑 (不保存并退出)
   */
  const cancelEdit = useCallback(() => {
    dispatch({ type: 'EXIT_EDIT_MODE', save: false });
  }, []);

  // === 选择操作 ===

  /**
   * 选中某行
   */
  const selectRow = useCallback((rowIndex: number) => {
    dispatch({ type: 'SELECT_ROWS', rows: [rowIndex], toggle: false });
  }, []);

  /**
   * 切换行的选中状态
   */
  const toggleRowSelection = useCallback((rowIndex: number) => {
    dispatch({ type: 'SELECT_ROWS', rows: [rowIndex], toggle: true });
  }, []);

  /**
   * 全选
   */
  const selectAll = useCallback(() => {
    const allIndices = state.currentData.map((_, idx) => idx);
    dispatch({ type: 'SELECT_ROWS', rows: allIndices, toggle: false });
  }, [state.currentData]);

  /**
   * 清除所有选择
   */
  const clearSelection = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL' });
  }, []);

  /**
   * 检查某行是否被选中
   */
  const isRowSelected = useCallback((rowIndex: number): boolean => {
    return state.selectedRows.has(rowIndex);
  }, [state.selectedRows]);

  /**
   * 获取选中行数量
   */
  const getSelectedCount = useCallback((): number => {
    return state.selectedRows.size;
  }, [state.selectedRows]);

  // === 批量操作 ===

  /**
   * 进入批量编辑模式
   */
  const enterBatchMode = useCallback((columnKey: string) => {
    if (state.selectedRows.size === 0) {
      console.warn('[useCellEditor] 请先选择要修改的行');
      return;
    }
    batchColumnKeyRef.current = columnKey;
    dispatch({ type: 'ENTER_BATCH_MODE' });
  }, [state.selectedRows.size]);

  /**
   * 退出批量编辑模式
   */
  const exitBatchMode = useCallback(() => {
    dispatch({ type: 'EXIT_BATCH_MODE' });
  }, []);

  /**
   * 应用批量修改
   */
  const applyBatchChange = useCallback((value: any) => {
    dispatch({ type: 'APPLY_BATCH_CHANGE', columnKey: batchColumnKeyRef.current, value });
  }, []);

  // === 撤销/重做 ===

  /**
   * 撤销上一步操作
   */
  const undo = useCallback((): boolean => {
    if (!canUndo()) return false;
    dispatch({ type: 'UNDO' });
    return true;
  }, []);

  /**
   * 重做下一步操作
   */
  const redo = useCallback((): boolean => {
    if (!canRedo()) return false;
    dispatch({ type: 'REDO' });
    return true;
  }, []);

  /**
   * 是否可以撤销
   */
  const canUndo = useCallback((): boolean => {
    return state.undoStack.length > 0;
  }, [state.undoStack.length]);

  /**
   * 是否可以重做
   */
  const canRedo = useCallback((): boolean => {
    return state.redoStack.length > 0;
  }, [state.redoStack.length]);

  // === 变更追踪 ===

  /**
   * 获取所有变更记录
   */
  const getChanges = useCallback((): CellChangeRecord[] => {
    return [...state.changes];
  }, [state.changes]);

  /**
   * 获取变更数量
   */
  const getChangesCount = useCallback((): number => {
    return state.changes.length;
  }, [state.changes]);

  /**
   * 是否有未保存的变更
   */
  const hasUnsavedChanges = useCallback((): boolean => {
    return state.changes.some(c => !c.isSaved);
  }, [state.changes]);

  /**
   * 保存所有变更 (模拟调用外部API)
   */
  const saveAllChanges = useCallback(async (): Promise<boolean> => {
    try {
      // TODO: 这里应该调用后端 API 提交变更
      // await api.post('/api/v1/ai/formulas/batch-update', { changes: state.changes });

      dispatch({ type: 'SAVE_CHANGES' });
      return true;
    } catch (error) {
      console.error('[useCellEditor] 保存失败:', error);
      return false;
    }
  }, [state.changes]);

  /**
   * 放弃所有未保存的变更
   */
  const discardAllChanges = useCallback(() => {
    dispatch({ type: 'DISCARD_CHANGES' });
  }, []);

  // === 数据管理 ===

  /**
   * 更新整个数据集
   */
  const setData = useCallback((data: Record<string, any>[]) => {
    dispatch({ type: 'SET_DATA', data });
  }, []);

  /**
   * 重置为原始数据
   */
  const resetToOriginal = useCallback(() => {
    dispatch({ type: 'RESET_DATA' });
  }, []);

  /**
   * 获取当前数据副本
   */
  const getCurrentData = useCallback((): Record<string, any>[] => {
    return state.currentData.map(row => ({ ...row }));
  }, [state.currentData]);

  return {
    // 状态
    state,

    // 单元格编辑
    startEditing,
    updateValue,
    confirmEdit,
    cancelEdit,

    // 选择操作
    selectRow,
    toggleRowSelection,
    selectAll,
    clearSelection,
    isRowSelected,
    getSelectedCount,

    // 批量操作
    enterBatchMode,
    exitBatchMode,
    applyBatchChange,

    // 撤销/重做
    undo,
    redo,
    canUndo,
    canRedo,

    // 变更追踪
    getChanges,
    getChangesCount,
    hasUnsavedChanges,
    saveAllChanges,
    discardAllChanges,

    // 数据管理
    setData,
    resetToOriginal,
    getCurrentData,
  };
}

export default useCellEditor;
