/**
 * 组织权限矩阵（与后端 /permissions 真实模型对齐）
 * 后端模型：组织级权限开关（member_management / team_management / formula_access /
 * experiment_access / data_export / api_access），非角色级 RBAC 矩阵。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Save, Loader2, CheckCircle, AlertCircle, KeyRound, Users2, FlaskConical, FlaskRound, Download, Server } from 'lucide-react';
import api from '@/api/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface PermissionMatrixProps {
  organizationId: number;
}

interface OrgPermissions {
  member_management: boolean;
  team_management: boolean;
  formula_access: boolean;
  experiment_access: boolean;
  data_export: boolean;
  api_access: boolean;
}

const PERMISSION_DEFS: Array<{ key: keyof OrgPermissions; label: string; description: string; icon: typeof KeyRound }> = [
  { key: 'member_management', label: '成员管理', description: '允许成员邀请/移除成员、修改成员角色', icon: Users2 },
  { key: 'team_management', label: '团队管理', description: '允许成员创建/编辑/删除团队', icon: Shield },
  { key: 'formula_access', label: '配方访问', description: '允许成员查看与使用配方库', icon: FlaskConical },
  { key: 'experiment_access', label: '实验访问', description: '允许成员查看与录入实验数据', icon: FlaskRound },
  { key: 'data_export', label: '数据导出', description: '允许成员导出组织数据', icon: Download },
  { key: 'api_access', label: 'API 访问', description: '允许成员通过 API 访问组织数据', icon: Server },
];

const DEFAULT_PERMISSIONS: OrgPermissions = {
  member_management: true,
  team_management: true,
  formula_access: true,
  experiment_access: true,
  data_export: true,
  api_access: true,
};

function normalizePermissions(raw: Record<string, unknown>): OrgPermissions {
  const p = { ...DEFAULT_PERMISSIONS };
  for (const def of PERMISSION_DEFS) {
    if (typeof raw[def.key] === 'boolean') p[def.key] = raw[def.key] as boolean;
  }
  return p;
}

export function PermissionMatrix({ organizationId }: PermissionMatrixProps) {
  const toast = useToast();
  const toastRef = useRef(toast);
  // eslint-disable-next-line react-hooks/refs
  toastRef.current = toast;
  const [permissions, setPermissions] = useState<OrgPermissions>(DEFAULT_PERMISSIONS);
  const [myRole, setMyRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/organizations/${organizationId}/permissions`);
      setPermissions(normalizePermissions(data.permissions || {}));
      setMyRole(data.my_role || '');
    } catch {
      toastRef.current.error('加载权限矩阵失败');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const canEdit = myRole?.toLowerCase() === 'owner';

  const toggle = useCallback((key: keyof OrgPermissions) => {
    if (!canEdit) return;
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  }, [canEdit]);

  const handleSave = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.put(`/organizations/${organizationId}/permissions`, permissions);
      toast.success('权限配置已更新');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [organizationId, permissions, toast, canEdit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-secondary-text)]0" />
            权限矩阵
          </h3>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
            组织级权限开关（我的角色：{myRole ? ({ owner: '所有者', admin: '管理员', member: '成员', viewer: '访客' } as Record<string, string>)[myRole] || myRole : '未知'}）
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !canEdit}
          className="flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          保存配置
        </button>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2.5 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/15 text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">仅所有者可修改权限配置</p>
            <p className="text-xs mt-0.5">当前角色为「{myRole}」，可查看权限设置但无法切换或保存。</p>
          </div>
        </div>
      )}

      <div className="surface-card rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)] p-5">
          {PERMISSION_DEFS.map(def => {
            const Icon = def.icon;
            const checked = permissions[def.key];
            return (
              <button
                key={def.key}
                onClick={() => toggle(def.key)}
                disabled={!canEdit}
                className={cn(
                  'flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border text-left transition-all cursor-pointer',
                  checked
                    ? 'border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/15'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border-color)] dark:hover:border-neutral-600',
                  !canEdit && 'cursor-not-allowed opacity-70',
                )}
              >
                <div className={cn(
                  'shrink-0 w-9 h-9 rounded-[var(--radius-Apple-sm)] flex items-center justify-center',
                  checked ? 'bg-[var(--color-secondary-container)]0 text-white' : 'bg-[var(--bg-tertiary)] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
                )}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text-primary)]">{def.label}</span>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs font-medium',
                      checked ? 'text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
                    )}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      {checked ? '已开启' : '已关闭'}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                    {def.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-[var(--color-secondary-text)]0" />
          <span>{canEdit ? '点击卡片切换组织级权限开关' : '权限开关当前只读'}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>开关关闭后，对应操作对非所有者成员生效（仅所有者及拥有对应自定义角色权限的成员不受限）</span>
        </div>
      </div>
    </div>
  );
}

export default PermissionMatrix;