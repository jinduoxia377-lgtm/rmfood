import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { AvatarUpload } from './AvatarUpload';
import { PersonalInfoForm } from './PersonalInfoForm';
import { usePersonalInfo } from '../hooks/usePersonalInfo';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { Edit3, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'view' | 'edit';

export const PersonalInfoSection: React.FC = () => {
  const { addToast } = useToast();
  const [mode, setMode] = useState<ViewMode>('view');

  const {
    profile,
    formData,
    loading,
    saving,
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
    selectImage,
    uploadAvatar,
    removeAvatar,
  } = useAvatarUpload(profile?.avatar_url || null);

  const handleEdit = useCallback(() => {
    setMode('edit');
  }, []);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      if (confirm('您有未保存的更改，确定要放弃吗？')) {
        resetForm();
        setMode('view');
      }
    } else {
      setMode('view');
    }
  }, [isDirty, resetForm]);

  const handleSave = useCallback(async () => {
    if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')) {
      const uploaded = await uploadAvatar();
      if (!uploaded) {
        addToast({ type: 'error', message: '头像上传失败' });
        return;
      }
    }

    const success = await saveProfile();
    if (success) {
      addToast({ type: 'success', message: '个人资料已更新' });
      setMode('view');
    } else {
      addToast({ type: 'error', message: '保存失败，请稍后重试' });
    }
  }, [avatarUrl, uploadAvatar, saveProfile, addToast]);

  const handleAvatarSelect = useCallback((file: File) => {
    selectImage(file);
  }, [selectImage]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-lg font-bold shadow-sm">
            {formData.fullName?.[0] || profile?.username?.[0]?.toUpperCase() || 'U'}
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
            'p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg',
          )}>
            <AvatarUpload
              avatarUrl={avatarUrl}
              onSelect={handleAvatarSelect}
              onRemove={removeAvatar}
              uploading={avatarUploading}
              error={avatarError}
              disabled={mode === 'view'}
            />

            {mode === 'view' && (
              <div className="flex-1">
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

        {saving && (
          <div className="flex items-center gap-2 text-sm text-primary-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
            保存中...
          </div>
        )}
      </CardContent>

      {mode === 'edit' && (
        <CardFooter className="justify-end gap-3">
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
            disabled={!isDirty && !avatarUrl}
          >
            保存修改
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
