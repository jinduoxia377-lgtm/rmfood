import { useState, useCallback, useEffect } from 'react';
import { X, Copy, Loader2, CheckCircle } from 'lucide-react';
import { Modal } from '@/components/ui';

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <div className="flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] bg-[var(--bg-tertiary)] dark:bg-[var(--bg-secondary)]/30 rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-md)] flex items-center justify-center text-white font-bold text-lg">
              {sourceOrg.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">{sourceOrg.name}</p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">@{sourceOrg.slug} · {sourceOrg.plan === 'pro' ? '专业版' : sourceOrg.plan === 'enterprise' ? '企业版' : '免费版'}</p>
            </div>
            <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            副本名称 <span className="text-[var(--color-error-text)]0">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入新组织名称..."
            className="w-full px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleClone()}
          />
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">克隆将复制成员、团队和基础配置</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] bg-[var(--color-error-container)] rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {cloned && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-text)] bg-[var(--color-success-container)] rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            克隆成功！即将跳转...
          </div>
        )}

        <div className="flex justify-end gap-[var(--space-apple-sm)] pt-2">
          <button onClick={onClose} disabled={loading} className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors">
            取消
          </button>
          <button
            onClick={handleClone}
            disabled={loading || cloned || !name.trim()}
            className="px-[var(--space-apple-md)] py-2 text-sm bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container disabled:opacity-50 transition-colors flex items-center gap-2"
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
