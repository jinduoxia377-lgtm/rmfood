/**
 * RBAC 权限矩阵管理组件
 *
 * 功能:
 * - 可视化展示角色-资源-操作权限矩阵
 * - 支持动态修改权限
 * - 权限变更实时预览
 * - 导出/导入权限配置
 *
 * @author RMFOOD Team
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  Check,
  X,
  UserCheck,
  UserX,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';

// ── 类型定义 ──

type RolePermissions = Record<string, Record<string, string[]>>;

// ── 预定义数据 ──

const ROLES = [
  {
    id: 'ADMIN',
    name: '超级管理员',
    icon: Shield,
    color: 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-600',
    description: '拥有系统所有权限',
  },
  {
    id: 'FORMULATOR',
    name: '配方师',
    icon: UserCheck,
    color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700',
    description: '配方全权管理',
  },
  {
    id: 'REVIEWER',
    name: '审核员',
    icon: Eye,
    color: 'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700',
    description: '审核与批准权限',
  },
  {
    id: 'RESEARCHER',
    name: '研究员',
    icon: UserCheck,
    color: 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-600',
    description: '基础读写权限',
  },
  {
    id: 'GUEST',
    name: '访客',
    icon: UserX,
    color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400',
    description: '只读访问权限',
  },
];

const RESOURCES = [
  { id: 'formula', name: '配方管理', icon: '📝' },
  { id: 'experiment', name: '实验管理', icon: '🔬' },
  { id: 'workflow', name: '工作流', icon: '🔄' },
  { id: 'user', name: '用户管理', icon: '👥' },
  { id: 'ai_generation', name: 'AI功能', icon: '🤖' },
  { id: 'database', name: '知识库', icon: '📚' },
  { id: 'system', name: '系统设置', icon: '⚙️' },
  { id: 'audit_log', name: '审计日志', icon: '📋' },
];

const ACTIONS = [
  { id: 'create', name: '创建', short: 'C' },
  { id: 'read', name: '查看', short: 'R' },
  { id: 'update', name: '编辑', short: 'U' },
  { id: 'delete', name: '删除', short: 'D' },
  { id: 'approve', name: '审批', short: 'A' },
  { id: 'export', name: '导出', short: 'E' },
  { id: 'manage', name: '管理', short: 'M' },
  { id: 'execute', name: '执行', short: 'X' },
];

// 默认权限矩阵（示例）
const DEFAULT_PERMISSIONS: RolePermissions = {
  ADMIN: {
    formula: ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage'],
    experiment: ['create', 'read', 'update', 'delete', 'manage'],
    workflow: ['create', 'read', 'execute', 'cancel', 'manage'],
    user: ['create', 'read', 'update', 'delete', 'manage'],
    ai_generation: ['create', 'read', 'configure', 'manage'],
    database: ['read', 'import', 'export', 'manage'],
    system: ['configure', 'administer', 'manage'],
    audit_log: ['read', 'export', 'manage'],
  },
  FORMULATOR: {
    formula: ['create', 'read', 'update', 'delete', 'export', 'share'],
    experiment: ['create', 'read', 'update'],
    workflow: ['create', 'read', 'execute'],
    ai_generation: ['create', 'read'],
    database: ['read'],
  },
  REVIEWER: {
    formula: ['read', 'approve', 'reject', 'comment', 'publish'],
    workflow: ['read', 'approve'],
    experiment: ['read'],
    audit_log: ['read'],
    database: ['read'],
  },
  RESEARCHER: {
    formula: ['create', 'read', 'update'],
    experiment: ['create', 'read', 'update'],
    workflow: ['read', 'execute'],
    database: ['read'],
  },
  GUEST: {
    formula: ['read'],
    database: ['read'],
  },
};

// ── 主组件 ──

interface PermissionMatrixProps {
  value?: RolePermissions;
  onChange?: (permissions: RolePermissions) => void;
  readOnly?: boolean;
  className?: string;
}

export function PermissionMatrix({
  value = DEFAULT_PERMISSIONS,
  onChange,
  readOnly = false,
  className,
}: PermissionMatrixProps) {
  const [permissions, setPermissions] = useState<RolePermissions>(value);
  const [selectedRole, setSelectedRole] = useState<string | null>('ADMIN');
  const [showLegend, setShowLegend] = useState(true);

  // 切换权限
  const togglePermission = (role: string, resource: string, action: string) => {
    if (readOnly) return;

    setPermissions((prev) => {
      const newPerms = { ...prev };
      if (!newPerms[role]) newPerms[role] = {};
      if (!newPerms[role][resource]) newPerms[role][resource] = [];

      const actionIndex = newPerms[role][resource].indexOf(action);
      if (actionIndex >= 0) {
        newPerms[role][resource] = newPerms[role][resource].filter((a) => a !== action);
      } else {
        newPerms[role][resource] = [...newPerms[role][resource], action];
      }

      onChange?.(newPerms);
      return newPerms;
    });
  };

  // 检查是否有权限
  const hasPermission = (role: string, resource: string, action: string): boolean => {
    return permissions[role]?.[resource]?.includes(action) ?? false;
  };

  // 统计信息
  const stats = useMemo(() => {
    let total = 0;
    let granted = 0;

    Object.entries(permissions).forEach(([role, resources]) => {
      Object.entries(resources).forEach(([, actions]) => {
        actions.forEach(() => {
          total++;
          if (role === 'ADMIN')
            granted++; // ADMIN默认全有
          else granted++;
        });
      });
    });

    return { total, granted, coverage: Math.round((granted / Math.max(total, 1)) * 100) };
  }, [permissions]);

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden',
        className,
      )}
    >
      {/* ── 头部工具栏 ── */}
      <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-secondary-600" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">RBAC 权限矩阵</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                基于角色的访问控制 · {stats.total} 个权限项 · 覆盖率 {stats.coverage}%
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowLegend(!showLegend)}>
                {showLegend ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPermissions(DEFAULT_PERMISSIONS)}>
                <RefreshCw size={14} className="mr-1" /> 重置
              </Button>
              <Button size="sm">
                <Download size={14} className="mr-1" /> 导出
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── 图例说明 ── */}
      {showLegend && (
        <div className="px-6 py-3 bg-secondary-50 dark:bg-secondary-300/15 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-6 text-xs">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">操作说明:</span>
            {ACTIONS.map((action) => (
              <div key={action.id} className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  {action.short}
                </span>
                <span className="text-neutral-600 dark:text-neutral-400">{action.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 权限矩阵表格 ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 w-32 sticky left-0 bg-neutral-100 dark:bg-neutral-800 z-10">
                角色 / 资源
              </th>
              {RESOURCES.map((resource) => (
                <th
                  key={resource.id}
                  colSpan={ACTIONS.length}
                  className="px-3 py-2 text-center text-xs font-semibold text-neutral-600 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700"
                >
                  <span className="mr-1">{resource.icon}</span>
                  {resource.name}
                </th>
              ))}
            </tr>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50">
              <th className="px-4 py-2 text-left text-xs text-neutral-500 dark:text-neutral-400 sticky left-0 bg-neutral-50 dark:bg-neutral-800/50 z-10"></th>
              {RESOURCES.flatMap((resource) =>
                ACTIONS.map((action) => (
                  <th
                    key={`${resource.id}-${action.id}`}
                    className="w-9 px-1 py-1 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700"
                    title={action.name}
                  >
                    {action.short}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr
                key={role.id}
                className={cn(
                  'border-b border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors',
                  selectedRole === role.id && 'bg-secondary-50 dark:bg-secondary-300/15',
                )}
                onClick={() => setSelectedRole(role.id)}
              >
                {/* 角色列 */}
                <td className="px-4 py-3 sticky left-0 bg-white dark:bg-neutral-800 z-10 border-r border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', role.color)}>
                      <role.icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{role.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{role.description}</p>
                    </div>
                  </div>
                </td>

                {/* 权限格子 */}
                {RESOURCES.flatMap((resource) =>
                  ACTIONS.map((action) => {
                    const permitted = hasPermission(role.id, resource.id, action.id);
                    const isAdmin = role.id === 'ADMIN';

                    return (
                      <td
                        key={`${role.id}-${resource.id}-${action.id}`}
                        className={cn('border-l border-neutral-100 dark:border-neutral-700/50', 'text-center p-1')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isAdmin) {
                            togglePermission(role.id, resource.id, action.id);
                          }
                        }}
                      >
                        <button
                          disabled={readOnly || isAdmin}
                          className={cn(
                            'w-7 h-7 rounded flex items-center justify-center transition-all text-xs font-bold',
                            permitted
                              ? isAdmin
                                ? 'bg-error-100 text-error-600 dark:bg-error-300/25 dark:text-error-600'
                                : 'bg-success-100 text-success-600 dark:bg-success-300/25 dark:text-success-600'
                              : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600',
                            !isAdmin && !readOnly && 'cursor-pointer hover:scale-110',
                            isAdmin && 'cursor-not-allowed',
                          )}
                          title={`${role.name} → ${resource.name}:${action.name}`}
                        >
                          {permitted ? <Check size={14} /> : <span className="opacity-30">–</span>}
                        </button>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 底部统计栏 ── */}
      <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-4">
          <span>共 {ROLES.length} 个角色</span>
          <span>·</span>
          <span>{RESOURCES.length} 种资源</span>
          <span>·</span>
          <span>{ACTIONS.length} 种操作</span>
        </div>

        <div className="flex items-center gap-2">
          <Lock size={12} />
          <span>超级管理员(ADMIN)拥有所有不可撤销的权限</span>
        </div>
      </div>
    </div>
  );
}

// ── 快速权限检查组件 ──

interface PermissionBadgeProps {
  role: string;
  resource: string;
  action: string;
  permissions?: RolePermissions;
}

export function PermissionBadge({ role, resource, action, permissions = DEFAULT_PERMISSIONS }: PermissionBadgeProps) {
  const hasPerm = permissions[role]?.[resource]?.includes(action) ?? false;

  return (
    <Badge
      variant={hasPerm ? 'success' : 'danger'}
      size="sm"
      className={cn(
        'font-mono',
        hasPerm && 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-600',
        !hasPerm && 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-600',
      )}
    >
      {hasPerm ? <Check size={12} className="mr-1" /> : <X size={12} className="mr-1" />}
      {resource}:{action}
    </Badge>
  );
}

export default PermissionMatrix;
