import React, { useState } from 'react';

import { logger } from '@/utils/safeLogger';
import {
  CollaborationPermission,
} from '../../../types/collaboration.types';
import type {
  ShareSettings,
  AccessStatistics,
} from '../../../types/collaboration.types';

interface ShareDialogProps {
  isOpen: boolean;
  reportTitle: string;
  currentShareSettings: ShareSettings;
  accessStats?: AccessStatistics | null;
  onShareSettingsChange: (settings: Partial<ShareSettings>) => void;
  onGenerateLink: () => Promise<string>;
  onAddCollaborator: (email: string, permission: CollaborationPermission) => Promise<boolean>;
  onClose: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  reportTitle,
  currentShareSettings,
  accessStats,
  onShareSettingsChange,
  onGenerateLink,
  onAddCollaborator,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'email' | 'embed' | 'stats'>('link');
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorPermission, setNewCollaboratorPermission] = useState<CollaborationPermission>(CollaborationPermission.VIEW);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!currentShareSettings.link) {
      setIsGenerating(true);
      await onGenerateLink();
      setIsGenerating(false);
    }

    if (currentShareSettings.link) {
      try {
        await navigator.clipboard.writeText(currentShareSettings.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('Failed to copy:', err);
      }
    }
  };

  const handleAddCollaborator = async () => {
    if (!newCollaboratorEmail.trim()) return;

    const success = await onAddCollaborator(newCollaboratorEmail, newCollaboratorPermission);
    if (success) {
      setNewCollaboratorEmail('');
    }
  };

  const tabs = [
    { id: 'link' as const, label: '链接分享', icon: '🔗' },
    { id: 'email' as const, label: '邀请协作者', icon: '👥' },
    { id: 'embed' as const, label: '嵌入代码', icon: '📎' },
    { id: 'stats' as const, label: '访问统计', icon: '📊' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">分享报告</h3>
            <p className="mt-0.5 text-sm text-neutral-500">{reportTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-neutral-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-secondary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    checked={currentShareSettings.isPublic}
                    onChange={(e) => onShareSettingsChange({ isPublic: e.target.checked })}
                    className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-neutral-700">公开访问（任何人可查看）</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">分享链接</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={currentShareSettings.link || ''}
                    readOnly
                    placeholder="点击生成按钮创建分享链接..."
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg bg-slate-50 text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    disabled={isGenerating}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      copied
                        ? 'bg-success-100 text-success-700'
                        : 'bg-secondary-container text-secondary-main hover:bg-secondary-container'
                    }`}
                  >
                    {copied ? '已复制！' : isGenerating ? '生成中...' : '复制链接'}
                  </button>
                  {!currentShareSettings.link && (
                    <button
                      onClick={() => onGenerateLink()}
                      disabled={isGenerating}
                      className="px-4 py-2 text-sm font-medium text-secondary-600 bg-secondary-50 rounded-lg hover:bg-secondary-100"
                    >
                      生成新链接
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">访问密码（可选）</label>
                  <input
                    type="password"
                    value={currentShareSettings.password || ''}
                    onChange={(e) => onShareSettingsChange({ password: e.target.value || undefined })}
                    placeholder="设置后需要密码才能访问"
                    className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">有效期至</label>
                  <input
                    type="datetime-local"
                    value={currentShareSettings.expiresAt?.slice(0, 16) || ''}
                    onChange={(e) => onShareSettingsChange({
                      expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })}
                    className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentShareSettings.allowDownload}
                    onChange={(e) => onShareSettingsChange({ allowDownload: e.target.checked })}
                    className="w-4 h-4 text-secondary-600 rounded"
                  />
                  <span className="text-sm text-neutral-700">允许下载</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentShareSettings.allowCopy}
                    onChange={(e) => onShareSettingsChange({ allowCopy: e.target.checked })}
                    className="w-4 h-4 text-secondary-600 rounded"
                  />
                  <span className="text-sm text-neutral-700">允许复制内容</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentShareSettings.allowComment}
                    onChange={(e) => onShareSettingsChange({ allowComment: e.target.checked })}
                    className="w-4 h-4 text-secondary-600 rounded"
                  />
                  <span className="text-sm text-neutral-700">允许评论</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">邀请邮箱</label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={newCollaboratorEmail}
                    onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                  />
                  <select
                    value={newCollaboratorPermission}
                    onChange={(e) => setNewCollaboratorPermission(e.target.value as CollaborationPermission)}
                    className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                  >
                    <option value={CollaborationPermission.VIEW}>可查看</option>
                    <option value={CollaborationPermission.COMMENT}>可评论</option>
                    <option value={CollaborationPermission.EDIT}>可编辑</option>
                  </select>
                  <button
                    onClick={handleAddCollaborator}
                    disabled={!newCollaboratorEmail.trim()}
                    className="px-4 py-2 bg-secondary-container text-secondary-main text-sm font-medium rounded-lg hover:bg-secondary-container disabled:opacity-50"
                  >
                    邀请
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">权限说明</h4>
                <div className="space-y-2 text-xs text-neutral-600">
                  <div className="flex items-start space-x-2">
                    <span className="font-medium text-neutral-900 w-16">可查看</span>
                    <span>只能阅读报告内容，无法修改或添加评论</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-medium text-neutral-900 w-16">可评论</span>
                    <span>可以查看并添加批注和评论，无法编辑正文</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="font-medium text-neutral-900 w-16">可编辑</span>
                    <span>可以修改报告内容、添加批注和管理协作者</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                将以下代码嵌入到您的网站或博客中，即可展示此报告：
              </p>
              <div className="relative">
                <pre className="bg-neutral-900 text-success-400 p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`<iframe
  src="${window.location.origin}/embed/report/${Date.now()}"
  width="100%"
  height="800"
  frameborder="0"
  allowfullscreen>
</iframe>`}</code>
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText('embed-code')}
                  className="absolute top-2 right-2 p-1.5 bg-neutral-700 text-white rounded hover:bg-neutral-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stats' && accessStats && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <StatCard title="总浏览量" value={accessStats.totalViews} icon="👁️" />
                <StatCard title="独立访客" value={accessStats.uniqueVisitors} icon="👤" />
                <StatCard title="下载次数" value={accessStats.totalDownloads} icon="⬇️" />
                <StatCard title="平均停留" value={`${Math.floor(accessStats.averageTimeOnPage / 60)}分钟`} icon="⏱️" />
              </div>

              <div>
                <h4 className="text-sm font-medium text-neutral-700 mb-3">近7天浏览趋势</h4>
                <div className="flex items-end space-x-2 h-32">
                  {accessStats.viewsByDate.map((item: { date: string; count: number }, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-secondary-500 rounded-t"
                        style={{ height: `${(item.count / Math.max(...accessStats.viewsByDate.map((d: { date: string; count: number }) => d.count))) * 100}%` }}
                      />
                      <span className="text-xs text-neutral-500 mt-1">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-2">来源分布</h4>
                  <div className="space-y-2">
                    {accessStats.topReferrers.map((source: { source: string; count: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">{source.source}</span>
                        <span className="font-medium text-neutral-900">{source.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-2">地区分布</h4>
                  <div className="space-y-2">
                    {accessStats.geographicDistribution.map((geo: { country: string; count: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">{geo.country}</span>
                        <span className="font-medium text-neutral-900">{geo.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: string }> = ({ title, value, icon }) => (
  <div className="bg-slate-50 rounded-lg p-4 text-center">
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-display font-semibold text-neutral-900">{value.toLocaleString()}</div>
    <div className="text-xs text-neutral-500 mt-1">{title}</div>
  </div>
);

export default ShareDialog;
