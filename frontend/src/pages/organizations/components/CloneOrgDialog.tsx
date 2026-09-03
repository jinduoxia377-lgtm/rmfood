import { useState, useCallback, useEffect } from 'react';
import { X, Copy, Loader2, CheckCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface CloneOrgDialogProps {
  open: boolean;
  sourceOrg: { id: number; name: string; slug: string; plan: string } | null;
  onClone: (newName: string) => Promise<number>;
  onClose: () => void;
  onCloned?: (newId: number) => void;
}

export function CloneOrgDialog({ open, sourceOrg, onClone, onClose, onCloned }: CloneOrgDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloned, setCloned] = useState(false);

  useEffect(() => {
    if (open) {
      setName(sourceOrg ? `${sourceOrg.name} (副本)` : '');
      setError(null);
      setCloned(false);
    }
  }, [open, sourceOrg]);

  const handleClone = useCallback(async () => {
    if (!name.trim()) {
      setError('副本名称不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newId = await onClone(name.trim());
      setCloned(true);
      setTimeout(() => {
        onClose();
        onCloned?.(newId);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '克隆失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [name, onClone, onClose, onCloned]);

  return (
    <Modal open={open} onClose={onClose} title="克隆组织" size="sm">
      <div className="space-y-5">
        {sourceOrg && (
          <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900/30 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div className="w-10 h-10 bg-gradient-to-br from-secondary-500 to-accent-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {sourceOrg.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{sourceOrg.name}</p>
              <p className="text-xs text-neutral-500">@{sourceOrg.slug} · {sourceOrg.plan === 'pro' ? '专业版' : sourceOrg.plan === 'enterprise' ? '企业版' : '免费版'}</p>
            </div>
            <Copy className="w-4 h-4 text-neutral-400 ml-auto" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            副本名称 <span className="text-error-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入新组织名称..."
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleClone()}
          />
          <p className="text-xs text-neutral-400 mt-1">克隆将复制成员、团队和基础配置</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 rounded-lg px-3 py-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {cloned && (
          <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            克隆成功！即将跳转...
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleClone}
            disabled={loading || cloned || !name.trim()}
            className="px-4 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {cloned ? <><CheckCircle className="w-4 h-4" />完成</> : '开始克隆'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default CloneOrgDialog;
