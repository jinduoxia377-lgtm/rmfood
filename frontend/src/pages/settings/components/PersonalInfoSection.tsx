import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { AvatarUpload } from './AvatarUpload';
import { PersonalInfoForm } from './PersonalInfoForm';
import { usePersonalInfo } from '../hooks/usePersonalInfo';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { userService } from '../services/userService';
import { generateAvatar, randomizeSeed, AVATAR_STYLE_OPTIONS, type AvatarStyle } from '../utils/avatarGenerator';
import { resolveAvatarUrl } from '@/utils/avatarUrl';
import { Edit3, X, Save, Sparkles, Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'view' | 'edit';

export const PersonalInfoSection: React.FC = () => {
  const { addToast } = useToast();
  const [mode, setMode] = useState<ViewMode>('view');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('gradient');
  const [aiGenerating, setAiGenerating] = useState(false);

  const {
    profile,
    formData,
    loading,
    saving,
    saveStatus,
    errors,
    isDirty,
    updateField,
    saveProfile,
    resetForm,
  } = usePersonalInfo();

  const {
    avatarUrl,
    uploading: avatarUploading,
    error: avatarError,
    avatarChanged,
    selectImage,
    setGeneratedAvatar,
    uploadAvatar,
    removeAvatar,
    resetAvatar,
  } = useAvatarUpload(profile?.avatarUrl || null);

  const handleEdit = useCallback(() => {
    setMode('edit');
  }, []);

  const handleCancel = useCallback(() => {
    if (isDirty || avatarChanged) {
      if (confirm('您有未保存的更改，确定要放弃吗？')) {
        resetForm();
        resetAvatar();
        setMode('view');
      }
    } else {
      setMode('view');
    }
  }, [isDirty, avatarChanged, resetForm, resetAvatar]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleGenerate = useCallback(async (style?: AvatarStyle) => {
    // 使用指定风格（或当前选中风格）+ 随机种子，保证「换一个」得到全新头像
    const targetStyle = style ?? avatarStyle;
    try {
      const blob = await generateAvatar(randomizeSeed(profile?.username || 'user'), { style: targetStyle });
      setGeneratedAvatar(blob);
      addToast({ type: 'success', message: '新头像已生成，点击「保存修改」生效' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : '头像生成失败' });
    }
  }, [avatarStyle, profile?.username, setGeneratedAvatar, addToast]);

  const handleGenerateReal = useCallback(async () => {
    // 请求后端生成真实 AI 人物头像（StyleGAN2 在线服务），返回图片 Blob，
    // 复用现有上传链路，点击「保存修改」时落库
    setAiGenerating(true);
    try {
      const result = await userService.generateRealAvatar();
      if (result.success && result.data) {
        setGeneratedAvatar(result.data);
        addToast({ type: 'success', message: 'AI 真实头像已生成，点击「保存修改」生效' });
      } else {
        addToast({ type: 'error', message: result.error || 'AI 头像生成失败' });
      }
    } finally {
      setAiGenerating(false);
    }
  }, [setGeneratedAvatar, addToast]);

  const handleAvatarSelect = useCallback((file: File) => {
    selectImage(file);
  }, [selectImage]);

  const handleSave = useCallback(async () => {
    // 头像变更处理：
    // - blob 预览 → 先上传到后端，拿到服务端 URL
    // - null（移除）→ 向后端传 avatar_url=null 清除
    // - 服务端 URL（未再修改）→ 直接随资料提交
    let finalAvatar: string | null | undefined;
    if (avatarChanged) {
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')) {
        const serverUrl = await uploadAvatar();
        if (!serverUrl) {
          addToast({ type: 'error', message: '头像上传失败' });
          return;
        }
        finalAvatar = serverUrl;
      } else {
        finalAvatar = avatarUrl;
      }
    }

    const success = await saveProfile(finalAvatar);
    if (success) {
      addToast({ type: 'success', message: '个人资料已更新' });
      setMode('view');
    } else {
      addToast({ type: 'error', message: '保存失败，请稍后重试' });
    }
  }, [avatarChanged, avatarUrl, uploadAvatar, saveProfile, addToast]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-[var(--radius-pill)] h-8 w-8 border-b-2 border-[var(--color-primary)]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const resolvedAvatar = resolveAvatarUrl(avatarUrl);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-[var(--space-apple-sm)] flex-wrap">
          <div className="w-12 h-12 rounded-[var(--radius-pill)] bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-accent-surface)] flex items-center justify-center text-white text-lg font-bold shadow-sm overflow-hidden">
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt="我的头像" className="w-full h-full object-cover" />
            ) : (
              formData.fullName?.[0] || profile?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle as="h2">{formData.fullName || profile?.username}</CardTitle>
            {profile?.role && <Badge variant="info" size="sm">{profile.role}</Badge>}
          </div>
          <CardDescription className="w-full pl-0 sm:pl-[60px]">@{profile?.username}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className={cn(
          'grid gap-6',
          'grid-cols-1 lg:grid-cols-4',
        )}>
          <div className={cn(
            'lg:col-span-1',
            'flex lg:flex-col items-center lg:items-start gap-4',
            'p-[var(--space-apple-md)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)]',
          )}>
            <AvatarUpload
              avatarUrl={avatarUrl}
              onSelect={handleAvatarSelect}
              onRemove={removeAvatar}
              onGenerate={mode === 'edit' ? () => handleGenerate() : undefined}
              generating={aiGenerating}
              uploading={avatarUploading}
              error={avatarError}
              disabled={mode === 'view'}
            />

            {/* AI 真实头像 + 生成风格选择（仅编辑态） */}
            {mode === 'edit' && (
              <div className="w-full space-y-[var(--space-apple-sm)]">
                <button
                  type="button"
                  onClick={handleGenerateReal}
                  disabled={aiGenerating}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-[var(--space-apple-sm)] py-1.5 text-xs font-semibold transition-colors',
                    'bg-gradient-to-r from-primary-600 to-accent-700 text-white shadow-sm',
                    'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {aiGenerating ? 'AI 生成中...' : 'AI 真实头像'}
                </button>

                <div>
                  <p className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">
                    <Sparkles className="w-3 h-3" />
                    生成风格
                  </p>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5">
                    {AVATAR_STYLE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAvatarStyle(opt.id);
                          handleGenerate(opt.id);
                        }}
                        className={cn(
                          'rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium transition-colors',
                          avatarStyle === opt.id
                            ? 'bg-[var(--color-primary)] text-white shadow-sm'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]0/15 hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)]',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === 'view' && (
              <div className="flex-1 w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  icon={<Edit3 className="w-4 h-4" />}
                  className="w-full"
                >
                  编辑资料
                </Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <PersonalInfoForm
              data={formData}
              errors={errors}
              onChange={updateField}
              disabled={mode === 'view'}
            />
          </div>
        </div>

        {saving || saveStatus !== 'idle' ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-primary-text)]">
            {saving || saveStatus === 'saving' ? (
              <>
                <div className="animate-spin rounded-[var(--radius-pill)] h-4 w-4 border-b-2 border-[var(--color-primary)]" />
                保存中...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                已保存
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-danger-500" />
                保存失败，请检查输入后重试
              </>
            )}
          </div>
        ) : null}
      </CardContent>

      {mode === 'edit' && (
        <CardFooter className="justify-end gap-[var(--space-apple-sm)]">
          <Button
            variant="ghost"
            onClick={handleCancel}
            icon={<X className="w-4 h-4" />}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving || avatarUploading}
            icon={<Save className="w-4 h-4" />}
            disabled={!isDirty && !avatarChanged}
          >
            保存修改
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};