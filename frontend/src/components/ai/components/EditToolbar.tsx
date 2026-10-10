import React from 'react';

interface EditToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  selectedCount: number;
  changesCount: number;
  isSaving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onAddRow: () => void;
  onDeleteSelected: () => void;
}

const EditToolbar: React.FC<EditToolbarProps> = ({
  canUndo,
  canRedo,
  hasUnsavedChanges,
  selectedCount,
  changesCount,
  isSaving,
  onUndo,
  onRedo,
  onSave,
  onDiscard,
  onAddRow,
  onDeleteSelected,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200">
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-white dark:bg-neutral-800 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700 p-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="撤销 (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="重做 (Ctrl+Y)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>

          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-1" />

          <button
            onClick={onAddRow}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded"
            title="添加行"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {selectedCount > 0 && (
            <>
              <button
                onClick={() => {}}
                className="p-1.5 text-secondary-600 hover:text-secondary-800 hover:bg-secondary-50 rounded"
                title="批量编辑选中行"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={onDeleteSelected}
                className="p-1.5 text-error-600 hover:text-error-800 hover:bg-error-50 rounded"
                title={`删除选中行 (${selectedCount})`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {hasUnsavedChanges && (
          <span className="text-sm text-warning-600 flex items-center">
            <span className="w-2 h-2 bg-warning-500 rounded-full mr-2 animate-pulse" />
            有 {changesCount} 处未保存更改
          </span>
        )}

        {selectedCount > 0 && (
          <span className="text-sm text-neutral-600">
            已选 {selectedCount} 行
          </span>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={onDiscard}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white dark:bg-neutral-900 border border-neutral-300 rounded-md hover:bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            放弃更改
          </button>
          <button
            onClick={onSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1.5 text-sm font-medium text-secondary-main bg-secondary-container border border-transparent rounded-md hover:bg-secondary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存更改
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditToolbar;
