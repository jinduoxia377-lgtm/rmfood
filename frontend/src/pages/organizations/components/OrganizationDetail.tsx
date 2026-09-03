import { useEffect, useMemo, useState, useCallback, Suspense, lazy } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  GitBranch,
  HardDrive,
  Settings,
  Plug,
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  Share2,
  Copy,
  CheckCircle,
  Crown,
  Shield,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/client';
import { useOrganizationDetail, type Member, type Team, type Role } from '@/hooks/useOrganizationDetail';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, CardSkeleton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

const OverviewTab = lazy(() => import('./detail/OverviewTab'));
const MembersTab = lazy(() => import('./detail/MembersTab'));
const TeamsTab = lazy(() => import('./detail/TeamsTab'));
const ResourcesTab = lazy(() => import('./detail/ResourcesTab'));
const SettingsTab = lazy(() => import('./detail/SettingsTab'));
const IntegrationsTab = lazy(() => import('./detail/IntegrationsTab'));

interface OrganizationDetailPageProps {
  organizationId?: number;
}

type TabId = 'overview' | 'members' | 'teams' | 'resources' | 'settings' | 'integrations';

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: '概览', icon: LayoutDashboard },
  { id: 'members', label: '成员', icon: Users },
  { id: 'teams', label: '团队', icon: GitBranch },
  { id: 'resources', label: '资源', icon: HardDrive },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'integrations', label: '集成', icon: Plug },
];

function getPlanConfig(plan: string) {
  const configs: Record<string, { label: string; className: string }> = {
    free: { label: '免费版', className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
    pro: { label: '专业版', className: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400' },
    enterprise: {
      label: '企业版',
      className: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
    },
  };
  return configs[plan] || configs.free;
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; className: string }> = {
    active: { label: '正常运营', className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
    suspended: {
      label: '已暂停',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    archived: { label: '已归档', className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  };
  return configs[status] || configs.active;
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'owner':
      return <Crown className="w-4 h-4 text-yellow-500" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-secondary-500" />;
    default:
      return <Users className="w-4 h-4 text-neutral-500" />;
  }
}

export default function OrganizationDetail({ organizationId: propOrgId }: OrganizationDetailPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const toast = useToast();

  const orgId = propOrgId || Number(params.id);
  const activeTabParam = (searchParams.get('tab') as TabId) || 'overview';

  const [activeTab, setActiveTab] = useState<TabId>(activeTabParam);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [copiedSlug, setCopiedSlug] = useState(false);

  const {
    organization,
    members,
    teams,
    loading,
    error,
    fetchDetail,
    setActiveTab: setHookActiveTab,
    inviteMember,
    removeMember,
    updateMemberRole,
    createTeam,
    updateTeam,
    deleteTeam,
    memberCount,
    teamCount,
    refetch,
  } = useOrganizationDetail({ autoFetchMembers: true, autoFetchTeams: true });

  useEffect(() => {
    if (orgId) {
      fetchDetail(orgId);
    }
  }, [orgId, fetchDetail]);

  useEffect(() => {
    if (activeTabParam && TABS.some((t) => t.id === activeTabParam)) {
      setActiveTab(activeTabParam);
      setHookActiveTab(activeTabParam);
    }
  }, [activeTabParam, setHookActiveTab]);

  const handleTabChange = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      setHookActiveTab(tabId);
      setSearchParams({ tab: tabId }, { replace: true });
    },
    [setHookActiveTab, setSearchParams],
  );

  const handleBack = useCallback(() => {
    navigate('/organizations');
  }, [navigate]);

  const handleCopySlug = useCallback(async () => {
    if (!organization) return;
    try {
      await navigator.clipboard.writeText(organization.slug);
      setCopiedSlug(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedSlug(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, [organization, toast]);

  const handleArchive = useCallback(async () => {
    if (!organization) return;
    try {
      await api.patch(`/organizations/${orgId}/archive`, { isActive: false });
      setShowArchiveModal(false);
      toast.success(`组织 "${organization.name}" 已归档`);
      navigate('/organizations');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '归档操作失败');
    }
  }, [organization, orgId, toast, navigate]);

  const handleDelete = useCallback(async () => {
    if (deleteConfirmText !== organization?.name) return;
    try {
      await api.delete(`/organizations/${orgId}`);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      toast.success(`组织 "${organization.name}" 已删除`);
      navigate('/organizations');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '删除操作失败');
    }
  }, [organization, orgId, deleteConfirmText, toast, navigate]);

  const renderTabContent = useMemo(() => {
    const commonProps = {
      organizationId: orgId,
      members,
      teams,
      memberCount,
      teamCount,
      organization: organization ?? undefined,
      onInvite: inviteMember,
      onRemoveMember: removeMember,
      onUpdateRole: updateMemberRole,
      onCreateTeam: createTeam,
      onUpdateTeam: updateTeam,
      onDeleteTeam: deleteTeam,
      onRefresh: refetch,
    } as any;

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...commonProps} />;
      case 'members':
        return <MembersTab {...commonProps} />;
      case 'teams':
        return <TeamsTab {...commonProps} />;
      case 'resources':
        return <ResourcesTab {...commonProps} />;
      case 'settings':
        return (
          <SettingsTab
            organizationId={orgId}
            organization={organization ?? undefined as any}
            onArchive={handleArchive}
            onDelete={() => setShowDeleteModal(true)}
          />
        );
      case 'integrations':
        return <IntegrationsTab organizationId={orgId} />;
      default:
        return null;
    }
  }, [
    activeTab,
    orgId,
    members,
    teams,
    memberCount,
    teamCount,
    organization,
    inviteMember,
    removeMember,
    updateMemberRole,
    createTeam,
    updateTeam,
    deleteTeam,
    refetch,
    handleArchive,
  ]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
          <AlertCircle className="w-16 h-16 mx-auto text-error-400" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">加载失败</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{error.message}</p>
        <button
          onClick={() => orgId && fetchDetail(orgId)}
          className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
        >
          重试
        </button>
        <button onClick={handleBack} className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
          返回组织列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Detail Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header Top Bar */}
        <div className="px-8 py-6 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="mt-1 p-2 -ml-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="返回组织列表"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar */}
            {loading ? (
              <Skeleton width={64} height={64} radius={16} />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0 shadow-lg shadow-blue-500/20">
                {organization?.name?.charAt(0) || '?'}
              </div>
            )}

            {/* Title & Meta */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton height="1.6em" width="240px" radius={6} />
                  <Skeleton height="1em" width="140px" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton height="1.8em" width="60px" radius={12} />
                    <Skeleton height="1.8em" width="80px" radius={12} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="h1 text-neutral-900 dark:text-white truncate">{organization?.name}</h1>
                    {getRoleIcon((organization as unknown as Record<string, unknown>)?.my_role as string || '')}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <button
                      onClick={handleCopySlug}
                      className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-secondary-600 dark:hover:text-secondary-400 transition-colors"
                      title="复制 Slug"
                    >
                      @{organization?.slug}
                      {copiedSlug ? (
                        <CheckCircle className="w-3.5 h-3.5 text-success-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getPlanConfig(organization?.plan || '').className,
                      )}
                    >
                      {getPlanConfig(organization?.plan || '').label}
                    </span>

                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getStatusConfig(((organization as unknown as Record<string, unknown>).is_active as boolean) ? 'active' : 'suspended').className,
                      )}
                    >
                      {getStatusConfig(((organization as unknown as Record<string, unknown>).is_active as boolean) ? 'active' : 'suspended').label}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Actions Menu */}
            {!loading && organization && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="更多操作"
                  aria-expanded={showActionsMenu}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showActionsMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1.5 z-20 animate-scale-in">
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleTabChange('settings');
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        编辑信息
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleCopySlug();
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        分享组织
                      </button>
                      <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowArchiveModal(true);
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        归档组织
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除组织
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Bar */}
        {!loading && organization && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-neutral-100 dark:bg-neutral-800">
            {[
              { label: '成员', value: memberCount, icon: Users, color: 'text-secondary-500' },
              { label: '团队', value: teamCount, icon: GitBranch, color: 'text-primary-500' },
              {
                label: '存储',
                value: `${(organization.storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB`,
                icon: HardDrive,
                color: 'text-accent-500',
              },
              {
                label: 'API 调用',
                value: organization.apiUsage?.toLocaleString() || '-',
                icon: Settings,
                color: 'text-orange-500',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-neutral-900 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{stat.label}</span>
                </div>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <nav
          role="tablist"
          aria-label="组织详情导航"
          className="flex border-b border-neutral-100 dark:border-neutral-800 px-2 gap-0.5 overflow-x-auto scrollbar-hide"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showCount = tab.id === 'members' || tab.id === 'teams';
            const count = tab.id === 'members' ? memberCount : tab.id === 'teams' ? teamCount : undefined;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'text-secondary-600 dark:text-secondary-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800/50',
                )}
              >
                <Icon className={cn('w-4.5 h-4.5', isActive && 'text-current')} />
                {tab.label}
                {showCount && count !== undefined && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-medium',
                      isActive
                        ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-300'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                    )}
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary-600 dark:bg-secondary-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div
          role="tabpanel"
          className="min-h-[400px]"
          aria-label={`${TABS.find((t) => t.id === activeTab)?.label}内容`}
        >
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-secondary-500 animate-spin" />
                  <span className="ml-3 text-neutral-500 dark:text-neutral-400">加载中...</span>
                </div>
              }
            >
              {renderTabContent}
            </Suspense>
          )}
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="归档组织" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            确定要归档组织 <strong className="text-neutral-900 dark:text-white">"{organization?.name}"</strong> 吗？
          </p>
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              归档后所有数据将保留但无法访问，您可以随时恢复此组织。
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowArchiveModal(false)}
              className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleArchive}
              className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              确认归档
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
        }}
        title="删除组织"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-error-800 dark:text-error-200 font-medium flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />此操作不可逆！</p>
            <p className="text-sm text-error-700 dark:text-error-300 mt-1">
              删除后组织的所有数据（成员、团队、配方等）将永久丢失。
            </p>
          </div>

          <div>
            <label
              htmlFor="delete-confirm"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              请输入组织名称以确认
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={organization?.name}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteConfirmText !== organization?.name}
              className={cn(
                'px-4 py-2 text-sm rounded-lg transition-colors',
                deleteConfirmText === organization?.name
                  ? 'bg-error-600 text-white hover:bg-error-700 cursor-pointer'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed',
              )}
            >
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
