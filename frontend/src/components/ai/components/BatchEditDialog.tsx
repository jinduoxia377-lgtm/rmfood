import React, { useState, useCallback } from 'react';
import type {
  FieldEditorConfig,
} from '../../../types/editing.types';

interface BatchEditDialogProps {
  isOpen: boolean;
  columnLabel: string;
  config: FieldEditorConfig;
  selectedCount: number;
  onApply: (value: any) => void;
  onCancel: () => void;
}

const BatchEditDialog: React.FC<BatchEditDialogProps> = ({
  isOpen,
  columnLabel,
  config,
  selectedCount,
  onApply,
  onCancel,
}) => {
  const [value, setValue] = useState<any>('');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleValueChange = useCallback((newValue: any) => {
    setValue(newValue);

    if (config.editorType === 'select' && config.options) {
      const option = config.options.find(opt => opt.value === newValue);
      setPreviewData([{
        field: columnLabel,
        newValue: option?.label || newValue,
        affectedRows: selectedCount,
      }]);
    } else {
      setPreviewData([{
        field: columnLabel,
        newValue,
        affectedRows: selectedCount,
      }]);
    }
  }, [columnLabel, config.editorType, config.options, selectedCount]);

  const handleApply = useCallback(() => {
    onApply(value);
    setValue('');
    setPreviewData([]);
  }, [value, onApply]);

  const handleCancel = useCallback(() => {
    onCancel();
    setValue('');
    setPreviewData([]);
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">批量编辑</h3>
          <p className="mt-1 text-sm text-gray-600">
            将修改 {selectedCount} 行数据的「{columnLabel}」字段
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              新值
            </label>
            {renderBatchInput(config, value, handleValueChange)}
          </div>

          {previewData.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">预览</h4>
              <div className="space-y-1">
                {previewData.map((preview, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-blue-700">{preview.field}</span>
                    <span className="font-medium text-blue-900">{String(preview.newValue)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-blue-600">
                将影响 {selectedCount} 行数据
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={!value && value !== false}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            应用更改
          </button>
        </div>
      </div>
    </div>
  );
};

function renderBatchInput(
  config: FieldEditorConfig,
  value: any,
  onChange: (value: any) => void,
): React.ReactNode {
  const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  switch (config.editorType) {
    case 'select':
      return (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClasses} bg-white`}
        >
          <option value="">请选择...</option>
          {config.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          className={baseClasses}
          step={config.step || 'any'}
          min={config.min}
          max={config.max}
          placeholder={`输入数字${config.min !== undefined ? ` (最小: ${config.min})` : ''}`}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value ? new Date(value).toISOString().split('T')[0] : ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
        />
      );

    case 'toggle':
      return (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            {value ? '是' : '否'}
          </span>
        </div>
      );

    case 'textarea':
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClasses} resize-none`}
          rows={3}
          placeholder={config.placeholder || '输入内容...'}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          placeholder={config.placeholder || '输入新值...'}
        />
      );
  }
}

export default BatchEditDialog;
