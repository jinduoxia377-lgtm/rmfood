import { X, Check, Edit2, FileText, Save } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import type { AICandidate } from '@/api/ai';

interface ActionButtonsProps {
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isAlreadySaved: boolean;
  candidate: AICandidate;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onSaveEdit: () => void;
  onViewReport?: (candidate: AICandidate) => void;
  onSaveToManager: () => void;
}

export function ActionButtons({
  isEditing,
  hasUnsavedChanges,
  isSaving,
  isAlreadySaved,
  candidate,
  onEnterEdit,
  onExitEdit,
  onSaveEdit,
  onViewReport,
  onSaveToManager,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
      {isEditing ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-11 gap-2"
            onClick={onExitEdit}
            icon={<X className="w-4 h-4" />}
          >
            取消编辑
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 h-11 gap-2"
            onClick={onSaveEdit}
            disabled={!hasUnsavedChanges}
            icon={<Check className="w-4 h-4" />}
          >
            保存修改
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 gap-2"
            onClick={onEnterEdit}
            icon={<Edit2 className="w-4 h-4" />}
          >
            编辑配方
          </Button>
          {onViewReport && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-11 gap-2"
              onClick={() => onViewReport(candidate)}
              icon={<FileText className="w-4 h-4" />}
            >
              学术报告
            </Button>
          )}
          {!isAlreadySaved ? (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 h-11 gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/25"
              onClick={onSaveToManager}
              loading={isSaving}
              icon={isSaving ? undefined : <Save className="w-4 h-4" />}
            >
              {isSaving ? '保存中...' : '保存配方'}
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-500/10 dark:bg-primary-500/16">
              <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">已保存</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ActionButtons;
