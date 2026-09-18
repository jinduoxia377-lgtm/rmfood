import { useState, useEffect, useCallback, memo } from 'react';
import { Shield, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { useOrganizations } from '@/hooks/useOrganizations';

interface PermissionMatrixProps {
  organizationId: number;
}

interface PermissionRow {
  role: string;
  permissions: { resourceId: string; resourceType: string; actions: string[] }[];
  isCustomizable?: boolean;
}



interface PermissionMatrixData {
  role: string
  permissions: Record<string, boolean>
}

const RESOURCE_TYPES = ['organization', 'team', 'formula', 'experiment', 'data', 'member', 'settings'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'admin'];

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  read: '读取',
  update: '更新',
  delete: '删除',
  admin: '管理',
};

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  viewer: '访客',
};

const PermissionCell = memo(({ checked, onChange, readonly }: {
  checked: boolean; onChange: () => void; readonly?: boolean;
}) => (
  <button
    onClick={onChange}
    disabled={readonly}
    className={cn(
      'w-6 h-6 rounded flex items-center justify-center transition-all',
      checked
        ? 'bg-secondary-500 text-white'
        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700',
      readonly && 'opacity-40 cursor-not-allowed',
    )}
  >
    {checked && <CheckCircle className="w-3.5 h-3.5" />}
  </button>
));

export function PermissionMatrix({ organizationId }: PermissionMatrixProps) {
  const toast = useToast();
  const { getPermissionMatrix } = useOrganizations({ autoFetch: false });
  const [data, setData] = useState<PermissionMatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPerms, setLocalPerms] = useState<Record<string, Record<string, Set<string>>>>({ owner: {}, admin: {}, member: {}, viewer: {} });

  useEffect(() => {
    setLoading(true);
    getPermissionMatrix(organizationId)
      .then(result => {
        setData(result as any);
        // Initialize local permissions from backend data
        const init: Record<string, Record<string, Set<string>>> = {};
        (result.roles || []).forEach((role: any) => {
          init[role.role] = {};
          (role.permissions || []).forEach((perm: any) => {
            init[role.role][perm.resourceId] = new Set(perm.actions || []);
          });
        });
        setLocalPerms(init);
      })
      .catch(() => toast.error('加载权限矩阵失败'))
      .finally(() => setLoading(false));
  }, [organizationId, getPermissionMatrix, toast]);

  const togglePermission = useCallback((role: string, resource: string, action: string) => {
    setLocalPerms(prev => {
      const rolePerms = prev[role] || {};
      const resourceActions = new Set(rolePerms[resource] || new Set());
      if (resourceActions.has(action)) {
        resourceActions.delete(action);
      } else {
        resourceActions.add(action);
      }
      return {
        ...prev,
        [role]: { ...rolePerms, [resource]: resourceActions },
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Send each role's permissions
      for (const [role, rolePerms] of Object.entries(localPerms)) {
        const permissions = Object.entries(rolePerms).map(([resource, actions]) => ({
          resourceId: resource,
          resourceType: resource,
          actions: Array.from(actions),
        }));
        await fetch(`/api/v1/organizations/${organizationId}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ roleId: role, permissions }),
        });
      }
      toast.success('权限配置已更新');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [localPerms, organizationId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-secondary-500" />
            权限矩阵
          </h3>
          <p className="text-sm text-neutral-500 mt-0.5">管理不同角色在各资源上的操作权限</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          保存配置
        </button>
      </div>

      <div className="surface-card rounded-xl border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400 w-24">角色</th>
              {RESOURCE_TYPES.map(rt => (
                <th key={rt} className="px-3 py-3 text-center font-medium text-neutral-500 dark:text-neutral-400">{rt}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['owner', 'admin', 'member', 'viewer'] as const).map(role => (
              <tr key={role} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    role === 'owner' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    role === 'admin' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400' :
                    role === 'member' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                    'bg-neutral-100 text-neutral-600',
                  )}>
                    {ROLE_LABELS[role]}
                  </span>
                </td>
                {RESOURCE_TYPES.map(rt => (
                  <td key={`${role}-${rt}`} className="px-3 py-3 text-center">
                    <div className="flex flex-col gap-1">
                      {ACTIONS.map(action => (
                        <PermissionCell
                          key={`${rt}-${action}`}
                          checked={(localPerms[role]?.[rt] || new Set()).has(action)}
                          onChange={() => togglePermission(role, rt, action)}
                          readonly={role !== 'owner' && role !== 'admin' && role !== 'member' && role !== 'viewer'}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-neutral-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-secondary-500 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
          <span>已授权</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <span>未授权</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>系统角色权限不可修改</span>
        </div>
      </div>
    </div>
  );
}

export default PermissionMatrix;
