/**
 * 团队协作管理主界面 (Team Management)
 *
 * 功能:
 * - 团队CRUD（创建、查看、编辑、归档）
 * - 成员管理（邀请、移除、角色变更）
 * - 多种邀请方式（直接添加、邮件邀请、链接分享、二维码）
 * - 权限矩阵可视化
 * - 实时在线状态
 * - 团队设置与配置
 *
 * @author RMFOOD Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Settings,
  Trash2,
  Archive,
  UserPlus,
  Link,
  Mail,
  QrCode,
  Crown,
  Shield,
  UserCheck,
  UserX,
  Copy,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Modal,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import { PermissionMatrix } from '@/components/auth/PermissionMatrix';
import { TeamOnlineStatus } from '@/components/dashboard/TeamOnlineStatus';


import { logger } from '@/utils/safeLogger';
// ── 类型定义 ──

interface TeamMember {
  id: number;
  user_id: number;
  username: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joined_at: string;
  avatar_url?: string | null;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  settings: Record<string, any>;
  is_archived: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 后端 GET /teams/{id} 返回扁平的 TeamDetailResponse
 * （继承 TeamResponse：id/name/description/owner_id/settings/is_archived/
 *   member_count/created_at/updated_at，再加 members + invite_link）。
 * 不含 online_count / current_user_role / stats —— 前端按需本地推导或降级。
 */
interface TeamDetail extends Team {
  members: TeamMember[];
  invite_link: string | null;
}

interface InviteLink {
  invite_code: string;
  invite_url: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
}

type TeamRoleValue = 'owner' | 'admin' | 'member' | 'guest';

// ── 常量 ──

const ROLE_CONFIG = {
  owner: {
    label: '所有者',
    icon: Crown,
    color: 'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700',
    description: '拥有全部权限',
  },
  admin: {
    label: '管理员',
    icon: Shield,
    color: 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-600',
    description: '除删除团队外的全部权限',
  },
  member: {
    label: '成员',
    icon: UserCheck,
    color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700',
    description: '读写权限',
  },
  guest: {
    label: '访客',
    icon: UserX,
    color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400',
    description: '只读权限',
  },
};

// ── 主组件 ──

export function TeamManagement({ className }: { className?: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'settings' | 'permissions'>('members');
  const toast = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;

  // 后端详情响应不含 current_user_role，从 members 中匹配当前用户推导；
  // members 缺失时回退到 owner_id 判断，均无则视为 null（无权限）。
  const currentUserRole = useMemo<TeamRoleValue | null>(() => {
    if (!teamDetail || currentUserId == null) return null;
    const me = teamDetail.members.find((m) => m.user_id === currentUserId);
    if (me) return me.role;
    if (teamDetail.owner_id === currentUserId) return 'owner';
    return null;
  }, [teamDetail, currentUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      // eslint-disable-next-line react-hooks/immutability
      fetchTeamDetail(selectedTeamId);
    }
  }, [selectedTeamId]);

  // 获取团队列表
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/teams');
      if (response.data) {
        setTeams(response.data.teams || []);
      }
    } catch (error) {
      logger.error('获取团队列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取团队详情
  const fetchTeamDetail = async (teamId: number) => {
    try {
      const response = await api.get(`/teams/${teamId}`);
      if (response.data) {
        setTeamDetail(response.data);
      }
    } catch (error) {
      logger.error('获取团队详情失败:', error);
    }
  };

  // 筛选后的团队
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;

    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [teams, searchQuery]);

  // 创建团队
  const handleCreateTeam = async (data: { name: string; description?: string }) => {
    try {
      await api.post('/teams', data);
      setShowCreateModal(false);
      fetchTeams();
      toast.success('团队创建成功');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '创建失败');
    }
  };

  // 归档团队
  const handleArchiveTeam = async (teamId: number) => {
    if (!confirm('确定要归档此团队吗？归档后数据保留但不可操作。')) return;

    try {
      await api.delete(`/teams/${teamId}`);
      fetchTeams();
      if (selectedTeamId === teamId) setSelectedTeamId(null);
      toast.success('团队已归档');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '归档失败');
    }
  };

  // 邀请成员
  // 产品要求团队邀请只接受邮箱邀请：后端 InviteMemberRequest 认 {email, role?}，
  // 故此处仅提交 email / role（不再传 user_id）。邮箱未注册由后端返回 404 detail。
  const handleInviteMember = async (inviteData: {
    email: string;
    role: TeamRoleValue;
  }) => {
    if (!selectedTeamId) return;

    try {
      await api.post(`/teams/${selectedTeamId}/members`, inviteData);
      setShowInviteModal(false);
      fetchTeamDetail(selectedTeamId);
      toast.success('邀请已发送');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '邀请失败');
    }
  };

  // 移除成员
  const handleRemoveMember = async (memberId: number) => {
    if (!selectedTeamId || !confirm('确定要移除此成员吗？')) return;

    try {
      await api.delete(`/teams/${selectedTeamId}/members/${memberId}`);
      fetchTeamDetail(selectedTeamId);
      toast.success('成员已移除');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '移除失败');
    }
  };

  // 更新角色
  const handleUpdateRole = async (memberId: number, userId: number, newRole: string) => {
    if (!selectedTeamId) return;

    try {
      await api.put(`/teams/${selectedTeamId}/members/${memberId}`, { role: newRole, user_id: userId });
      fetchTeamDetail(selectedTeamId);
      toast.success('角色已更新');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '更新失败');
    }
  };

  // 生成邀请链接
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const handleGenerateLink = async () => {
    if (!selectedTeamId) return;

    try {
      const response = await api.post(`/teams/${selectedTeamId}/invite-link`);
      setInviteLink(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '生成失败');
    }
  };

  // 复制链接
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('链接已复制到剪贴板');
  };

  return (
    <div className={cn('flex gap-6 h-[calc(100vh-8rem)]', className)} style={{ height: 'calc(100dvh - 8rem)' }}>
      {/* 左侧：团队列表 */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">我的团队</h2>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} className="mr-1" />
              新建团队
            </Button>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索团队..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
            />
          </div>
        </div>

        {/* 团队列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] px-4">
              <Users size={48} className="mb-3 opacity-50" />
              <p className="text-sm text-center">{searchQuery ? '未找到匹配的团队' : '暂无团队'}</p>
              {!searchQuery && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreateModal(true)}>
                  创建第一个团队
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {filteredTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    'w-full p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors',
                    selectedTeamId === team.id && 'bg-secondary-50 dark:bg-secondary-300/15 border-r-2 border-secondary-500',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-white truncate">{team.name}</h3>
                      {team.description && (
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 line-clamp-2">{team.description}</p>
                      )}
                    </div>

                    {team.is_archived && (
                      <Badge size="sm" variant="neutral" className="ml-2 flex-shrink-0">
                        已归档
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {team.member_count} 人
                    </span>
                    <span>{new Date(team.updated_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：团队详情 */}
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {!selectedTeamId ? (
          <div className="flex-1 flex items-center justify-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <div className="text-center">
              <Users size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">选择一个团队</p>
              <p className="text-sm">从左侧列表中选择团队查看详情</p>
            </div>
          </div>
        ) : !teamDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 详情头部 */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{teamDetail.name}</h2>
                    <Badge className={ROLE_CONFIG[currentUserRole as keyof typeof ROLE_CONFIG]?.color}>
                      {ROLE_CONFIG[currentUserRole as keyof typeof ROLE_CONFIG]?.label}
                    </Badge>
                  </div>

                  {teamDetail.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{teamDetail.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <span>创建于 {new Date(teamDetail.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>·</span>
                    <span>{teamDetail.member_count} 位成员</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 ml-4">
                  {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setShowInviteModal(true)}>
                        <UserPlus size={14} className="mr-1" />
                        邀请成员
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowSettingsPanel(!showSettingsPanel)}>
                        <Settings size={14} />
                      </Button>
                      {currentUserRole === 'owner' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-warning-600 hover:bg-warning-50"
                          onClick={() => handleArchiveTeam(teamDetail.id)}
                        >
                          <Archive size={14} />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tab 切换 */}
            <div className="px-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex gap-1">
                {[
                  { key: 'members', label: '团队成员', icon: Users },
                  { key: 'settings', label: '团队设置', icon: Settings },
                  { key: 'permissions', label: '权限矩阵', icon: Shield },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium transition-colors relative',
                      activeTab === tab.key
                        ? 'text-secondary-600 dark:text-secondary-700'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
                    )}
                  >
                    <tab.icon size={16} className="inline mr-1.5" />
                    {tab.label}
                    {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary-500" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'members' && (
                <div className="space-y-6">
                  {/* 在线状态卡片 */}
                  <TeamOnlineStatus dashboardId={`team-${selectedTeamId}`} />

                  {/* 成员列表 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                        全部成员 ({teamDetail.members.length})
                      </h3>
                      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                        <Button size="sm" onClick={() => setShowInviteModal(true)}>
                          <UserPlus size={14} className="mr-1" />
                          添加成员
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {teamDetail.members.map((member) => {
                        const roleConfig = ROLE_CONFIG[member.role];
                        const RoleIcon = roleConfig.icon;

                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-4 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                          >
                            {/* 头像（后端 TeamMemberInfo 无 is_online，移除在线圆点） */}
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] flex items-center justify-center text-white font-medium">
                                {member.username.charAt(0).toUpperCase()}
                              </div>
                            </div>

                            {/* 信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                  {member.username}
                                </p>
                                <Badge size="sm" className={roleConfig.color}>
                                  <RoleIcon size={12} className="mr-1" />
                                  {roleConfig.label}
                                </Badge>
                              </div>
                              {/* 后端 TeamMemberInfo 不含 email，改为展示 user_id 标识 */}
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                                ID: {member.user_id}
                              </p>
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                                加入于 {new Date(member.joined_at).toLocaleDateString('zh-CN')}
                              </p>
                            </div>

                            {/* 操作按钮 */}
                            {(currentUserRole === 'owner' || currentUserRole === 'admin') &&
                              member.user_id !== teamDetail.owner_id && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleUpdateRole(member.id, member.user_id, e.target.value)}
                                    className="text-xs border rounded px-2 py-1 bg-white dark:bg-neutral-700"
                                    disabled={member.user_id === teamDetail.owner_id}
                                  >
                                    {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                                      <option key={key} value={key}>
                                        {config.label}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="p-1.5 text-error-600 hover:bg-error-50 rounded"
                                    title="移除成员"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">基本信息</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          团队名称
                        </label>
                        <Input
                          defaultValue={teamDetail.name}
                          disabled={currentUserRole === 'guest'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                          描述
                        </label>
                        <Textarea
                          defaultValue={teamDetail.description || ''}
                          rows={3}
                          disabled={currentUserRole === 'guest'}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">邀请方式</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card
                        className="cursor-pointer hover:border-secondary-300 transition-colors"
                        onClick={() => setShowInviteModal(true)}
                      >
                        <CardContent className="p-4">
                          <Mail size={24} className="text-secondary-600 mb-2" />
                          <h4 className="text-sm font-medium">邮件邀请</h4>
                          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">通过邮箱发送邀请</p>
                        </CardContent>
                      </Card>

                      <Card
                        className="cursor-pointer hover:border-success-300 transition-colors"
                        onClick={handleGenerateLink}
                      >
                        <CardContent className="p-4">
                          <Link size={24} className="text-success-600 mb-2" />
                          <h4 className="text-sm font-medium">分享链接</h4>
                          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">生成邀请链接</p>
                        </CardContent>
                      </Card>
                    </div>

                    {inviteLink && (
                      <div className="mt-4 p-4 bg-success-50 dark:bg-success-300/15 rounded-lg border border-success-200 dark:border-success-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-success-800 dark:text-success-600 mb-2">
                              邀请链接已生成
                            </p>
                            <p className="text-xs text-success-600 dark:text-success-600 font-mono break-all">
                              {inviteLink.invite_url}
                            </p>
                            <p className="text-xs text-success-600 dark:text-success-600 mt-2">
                              有效期至 {new Date(inviteLink.expires_at).toLocaleString('zh-CN')} · 剩余{' '}
                              {inviteLink.max_uses - inviteLink.used_count} 次使用
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(inviteLink.invite_url)}>
                            <Copy size={14} className="mr-1" />
                            复制
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">危险区域</h3>
                    {currentUserRole === 'owner' && (
                      <Button variant="danger" onClick={() => handleArchiveTeam(teamDetail.id)}>
                        <Archive size={16} className="mr-2" />
                        归档团队
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'permissions' && <PermissionMatrix readOnly={currentUserRole !== 'owner'} />}
            </div>
          </>
        )}
      </div>

      {/* 创建团队弹窗 */}
      <CreateTeamModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateTeam} />

      {/* 邀请成员弹窗 */}
      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteMember}
        onGenerateLink={handleGenerateLink}
      />
    </div>
  );
}

// ── 子组件：创建团队 ──

function CreateTeamModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="创建新团队">
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            团队名称 <span className="text-error-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入团队名称（2-100个字符）"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">描述（可选）</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述团队的用途和目标"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? '创建中...' : '创建团队'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── 子组件：邀请成员 ──

function InviteMemberModal({
  open,
  onClose,
  onSubmit,
  onGenerateLink,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; role: TeamRoleValue }) => void;
  onGenerateLink: () => void;
}) {
  // 产品要求团队邀请只接受邮箱邀请：direct 方式 = 输入邮箱 + 选角色，link 方式 = 生成分享链接。
  // 默认 direct(邮箱)。
  const [inviteMethod, setInviteMethod] = useState<'direct' | 'link'>('direct');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRoleValue>('member');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (inviteMethod === 'direct' && !email.trim()) return;

    setSubmitting(true);
    try {
      if (inviteMethod === 'direct') {
        await onSubmit({ email: email.trim(), role });
      }
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="邀请成员">
      <div className="pt-4 space-y-4">
        {/* 邀请方式切换 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'direct', label: '邮箱邀请', icon: Mail },
            { key: 'link', label: '分享链接', icon: Link },
          ].map((method) => (
            <button
              key={method.key}
              onClick={() => setInviteMethod(method.key as typeof inviteMethod)}
              className={cn(
                'p-3 rounded-lg border text-center transition-all',
                inviteMethod === method.key
                  ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-300/20 text-secondary-600'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300',
              )}
            >
              <method.icon size={20} className="mx-auto mb-1" />
              <p className="text-xs font-medium">{method.label}</p>
            </button>
          ))}
        </div>

        {inviteMethod === 'link' ? (
          <div className="text-center py-8">
            <QrCode size={48} className="mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">生成一个可分享的邀请链接</p>
            <Button
              onClick={() => {
                onGenerateLink();
                onClose();
              }}
            >
              <Link size={16} className="mr-2" />
              生成邀请链接
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">邮箱</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入要邀请的成员邮箱"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">初始角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TeamRoleValue)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
              >
                <option value="member">成员</option>
                <option value="admin">管理员</option>
                <option value="guest">访客</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '发送中...' : '发送邀请'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default TeamManagement;
