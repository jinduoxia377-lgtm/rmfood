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
import { useAuthStore } from '@/stores/auth';
import { useOrganizationDetail, type Member, type Team } from '@/hooks/useOrganizationDetail';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, CardSkeleton } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

const OverviewTab = lazy(() => import('./detail/OverviewTab'));
const MembersTab = lazy(() => import('./detail/MembersTab'));
const TeamsTab = lazy(() => import('./detail/TeamsTab'));
const ResourcesTab = lazy(() => import('./detail/ResourcesTab'));
interface CommonTabProps {
  organizationId: number
  members: Member[]
  organization?: { name?: string; slug?: string; plan?: string; is_active?: boolean; storageUsed?: number; storageLimit?: number; apiUsage?: number }
  memberCount: number
  teamCount: number
  teams: unknown[]
  onInvite: () => void
  onRemoveMember: (id: number) => void
  onUpdateRole: (id: number, role: string) => void
  onCreateTeam: () => void
  onUpdateTeam: (id: number, data: unknown) => void
  onDeleteTeam: (id: number) => void
  onRefresh: () => void
}

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
    free: { label: '免费版', className: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]' },
    pro: { label: '专业版', className: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]' },
    enterprise: {
      label: '企业版',
      className: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
    },
  };
  return configs[plan] || configs.free;
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; className: string }> = {
    active: { label: '正常运营', className: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]' },
    suspended: {
      label: '已暂停',
      className: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
    },
    archived: { label: '已归档', className: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]' },
  };
  return configs[status] || configs.active;
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'owner':
      return <Crown className="w-4 h-4 text-[var(--color-warning-text)]0" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-[var(--color-secondary-text)]0" />;
    default:
      return <Users className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />;
  }
}

export default function OrganizationDetail({ organizationId: propOrgId }: OrganizationDetailPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const toast = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const [orgRoles, setOrgRoles] = useState<Array<{ code: string; name: string; permissions?: string[] }>>([]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(activeTabParam);
       
      setHookActiveTab(activeTabParam);
    }
  }, [activeTabParam, setHookActiveTab]);

  // 加载组织自定义角色（用于判断当前用户是否通过自定义角色获得成员管理权限）
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    api.get(`/organizations/${orgId}/roles`)
      .then((res) => { if (!cancelled) setOrgRoles(res.data?.roles ?? []); })
      .catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  }, [orgId]);

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
      await api.put(`/organizations/${orgId}/archive`, { isActive: false });
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
      teams: teams as Team[],
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
      onNavigateTab: (tab: TabId) => handleTabChange(tab),
      canManageMembers: (() => {
        const myRole = (organization as unknown as Record<string, unknown>)?.my_role as string || '';
        if (myRole === 'owner' || myRole === 'admin') return true;
        // 自定义角色授权：拥有 members:manage 的成员也可管理成员（前后端一致）
        const myMember = members.find((m: Member) => m.userId === currentUser?.id);
        const myCodes = myMember?.customRoles ?? [];
        return orgRoles.some(r => myCodes.includes(r.code) && (r.permissions || []).includes('members:manage'));
      })(),
    } as unknown as CommonTabProps;

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...(commonProps as unknown as React.ComponentProps<typeof OverviewTab>)} />;
      case 'members':
        return <MembersTab {...(commonProps as unknown as React.ComponentProps<typeof MembersTab>)} />;
      case 'teams':
        return <TeamsTab {...(commonProps as unknown as React.ComponentProps<typeof TeamsTab>)} />;
      case 'resources':
        return <ResourcesTab {...(commonProps as unknown as React.ComponentProps<typeof ResourcesTab>)} />;
      case 'settings':
        return (
          <SettingsTab
            organizationId={orgId}
            organization={organization ? {
              name: organization.name,
              slug: organization.slug,
              description: organization.description,
              logo_url: (organization as unknown as { logo_url?: string }).logo_url,
              plan: organization.plan,
              is_active: organization.isActive,
              storageUsed: organization.storageUsed,
              storageLimit: organization.storageLimit,
              apiUsage: organization.apiUsage,
              apiCalls: organization.apiUsage,
            } : undefined}
            onArchive={handleArchive}
            onDelete={() => setShowDeleteModal(true)}
            onRefresh={refetch}
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
    currentUser,
    orgRoles,
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
        <div className="w-16 h-16 rounded-[var(--radius-pill)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25 flex items-center justify-center">
          <AlertCircle className="w-16 h-16 mx-auto text-[var(--color-error-text)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">加载失败</h2>
        <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
        <button
          onClick={() => orgId && fetchDetail(orgId)}
          className="px-[var(--space-apple-md)] py-2 bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container transition-colors"
        >
          重试
        </button>
        <button onClick={handleBack} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          返回组织列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-apple-md)] max-w-7xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-fade-in">
      {/* Detail Header — 品牌横幅（参照 dashboard 欢迎横幅设计） */}
      <div className="relative overflow-hidden rounded-[var(--radius-Apple-md)] bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-hover)] text-white shadow-sm">
        {/* 装饰圆形 */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-[var(--radius-pill)] bg-[var(--bg-secondary)]/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 w-80 h-80 rounded-[var(--radius-pill)] bg-[var(--bg-secondary)]/5" />
        {/* Header Top Bar */}
        <div className="relative px-6 py-[var(--space-apple-lg)] sm:px-8">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="mt-1 p-2 -ml-2 rounded-[var(--radius-Apple-sm)] text-white/70 hover:text-white hover:bg-[var(--bg-secondary)]/10 transition-colors"
              aria-label="返回组织列表"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar */}
            {loading ? (
              <Skeleton width={56} height={56} radius={12} />
            ) : (
              <div className="w-14 h-14 bg-[var(--bg-secondary)]/20 backdrop-blur-sm rounded-[var(--radius-Apple-md)] flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm ring-1 ring-white/30">
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
                  <div className="flex items-center gap-[var(--space-apple-sm)] flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight text-white truncate">{organization?.name}</h1>
                    <span className="inline-flex items-center text-white/80">{getRoleIcon((organization as unknown as Record<string, unknown>)?.my_role as string || '')}</span>
                  </div>

                  <div className="flex items-center gap-[var(--space-apple-sm)] mt-1.5 flex-wrap">
                    <button
                      onClick={handleCopySlug}
                      className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors"
                      title="复制 Slug"
                    >
                      @{organization?.slug}
                      {copiedSlug ? (
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--bg-secondary)]/15 text-white ring-1 ring-white/25',
                      )}
                    >
                      {getPlanConfig(organization?.plan || '').label}
                    </span>

                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-[var(--bg-secondary)]/15 text-white ring-1 ring-white/25',
                      )}
                    >
                      {getStatusConfig((organization as unknown as Record<string, unknown>)?.is_active ? 'active' : 'suspended').label}
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
                  className="p-2 rounded-[var(--radius-Apple-sm)] text-white/80 hover:text-white hover:bg-[var(--bg-secondary)]/10 transition-colors"
                  aria-label="更多操作"
                  aria-expanded={showActionsMenu}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showActionsMenu && (
                  <>
                    <div className="fixed inset-0 z-10"  role="button" tabIndex={0} onClick={() => setShowActionsMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-lg border border-[var(--border-color)] py-1.5 z-20 animate-scale-in">
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleTabChange('settings');
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        编辑信息
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleCopySlug();
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        分享组织
                      </button>
                      <div className="my-1 border-t border-[var(--border-color)] dark:border-neutral-700" />
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowArchiveModal(true);
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] hover:bg-[var(--color-warning-container)] dark:hover:bg-[var(--color-warning-container)]/10 transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        归档组织
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="flex items-center w-full gap-2.5 px-3.5 py-2 text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/10 transition-colors"
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

        {/* Quick Stats Bar — 横幅内白色半透明统计块（参照 dashboard 统计卡设计） */}
        {!loading && organization && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
            {[
              { label: '成员', value: memberCount, icon: Users },
              { label: '团队', value: teamCount, icon: GitBranch },
              {
                label: '存储',
                value: `${((organization.storageUsed || 0) / (1024 * 1024 * 1024)).toFixed(1)}GB / ${((organization.storageLimit || 0) / (1024 * 1024 * 1024)).toFixed(1)}GB`,
                icon: HardDrive,
              },
              {
                label: 'API 调用',
                value: organization.apiUsage?.toLocaleString() || '-',
                icon: Settings,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/10 backdrop-blur-sm px-[var(--space-apple-md)] py-[var(--space-apple-md)] ring-1 ring-white/15">
                <div className="w-9 h-9 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/15 flex items-center justify-center shrink-0">
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/70">{stat.label}</p>
                  <p className="text-base font-semibold text-white truncate">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Tab Navigation（主题规范：药丸式激活） */}
      <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] dark:border-neutral-800 overflow-hidden">
        <nav
          role="tablist"
          aria-label="组织详情导航"
          className="flex border-b border-[var(--border-color)] p-2 gap-1 overflow-x-auto scrollbar-hide"
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
                  'relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-[var(--radius-Apple-sm)]',
                  isActive
                    ? 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50',
                )}
              >
                <Icon className={cn('w-4 h-4', isActive && 'text-current')} />
                {tab.label}
                {showCount && count !== undefined && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-[var(--radius-pill)] font-medium',
                      isActive
                        ? 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/30 dark:text-[var(--color-secondary-text)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
                    )}
                  >
                    {count}
                  </span>
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
            <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[var(--color-secondary-text)]0 animate-spin" />
                  <span className="ml-3 text-[var(--text-muted)]">加载中...</span>
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
        <div className="space-y-[var(--space-apple-md)]">
          <p className="text-sm text-[var(--text-secondary)]">
            确定要归档组织 <strong className="text-[var(--text-primary)]">"{organization?.name}"</strong> 吗？
          </p>
          <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] p-[var(--space-apple-sm)]">
            <p className="text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
              归档后所有数据将保留但无法访问，您可以随时恢复此组织。
            </p>
          </div>
          <div className="flex justify-end gap-[var(--space-apple-sm)] pt-2">
            <button
              onClick={() => setShowArchiveModal(false)}
              className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleArchive}
              className="px-[var(--space-apple-md)] py-2 text-sm bg-[var(--color-warning-container)]0 text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-warning)] transition-colors"
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
        <div className="space-y-[var(--space-apple-md)]">
          <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] p-[var(--space-apple-sm)]">
            <p className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] font-medium flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />此操作不可逆！</p>
            <p className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mt-1">
              删除后组织的所有数据（成员、团队、配方等）将永久丢失。
            </p>
          </div>

          <div>
            <label
              htmlFor="delete-confirm"
              className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
            >
              请输入组织名称以确认
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={organization?.name}
              className="w-full px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-error)] focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-[var(--space-apple-sm)] pt-2">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteConfirmText !== organization?.name}
              className={cn(
                'px-[var(--space-apple-md)] py-2 text-sm rounded-[var(--radius-Apple-sm)] transition-colors',
                deleteConfirmText === organization?.name
                  ? 'bg-[var(--color-error)] text-white hover:bg-[var(--color-error)] cursor-pointer'
                  : 'bg-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed',
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
