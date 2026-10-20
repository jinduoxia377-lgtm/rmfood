import { useState, useCallback, useEffect } from 'react';
import { userService } from '../services/userService';
import { compressImage, validateImage } from '../utils/imageUtils';

interface UseAvatarUploadReturn {
  avatarUrl: string | null;
  uploading: boolean;
  error: string | null;
  /** 当前头像与初始头像是否不同（用于控制「保存修改」按钮可用性） */
  avatarChanged: boolean;
  selectImage: (file: File) => Promise<void>;
  /** 用自动生成的 Blob 设置预览（生成器输出），保存时随表单一起上传 */
  setGeneratedAvatar: (blob: Blob) => void;
  /** 将当前预览上传到后端，成功返回服务端头像 URL，失败返回 null */
  uploadAvatar: () => Promise<string | null>;
  removeAvatar: () => void;
  /** 取消编辑时还原为初始头像 */
  resetAvatar: () => void;
  clearError: () => void;
}

export const useAvatarUpload = (
  initialUrl: string | null,
  onSuccess?: (url: string) => void,
): UseAvatarUploadReturn => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl);
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 个人资料异步加载完成后，同步初始头像值（避免已有头像被误判为空态/已变更）
  useEffect(() => {
    if (initialUrl !== null && initialUrl !== undefined) {
      setAvatarUrl(initialUrl);
      setOriginalAvatarUrl(initialUrl);
    }
  }, [initialUrl]);

  const selectImage = useCallback(async (file: File) => {
    setError(null);

    const validation = validateImage(file, { maxSizeMB: 2 });
    if (!validation.valid) {
      setError(validation.error || '图片验证失败');
      return;
    }

    try {
      const compressedBlob = await compressImage(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 400,
      });

      const previewUrl = URL.createObjectURL(compressedBlob);
      setAvatarUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return previewUrl;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败');
    }
  }, []);

  const setGeneratedAvatar = useCallback((blob: Blob) => {
    setError(null);
    const previewUrl = URL.createObjectURL(blob);
    setAvatarUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return previewUrl;
    });
  }, []);

  const uploadAvatar = useCallback(async (): Promise<string | null> => {
    if (!avatarUrl) {
      setError('请先选择图片');
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      // 文件名/扩展名不重要（后端按魔数重新生成 UUID 文件名），type 使用 Blob 实际类型
      const file = new File([blob], 'avatar', { type: blob.type || 'image/webp' });

      const result = await userService.uploadAvatar(file);
      if (result.success && result.data) {
        // 清理本地 blob URL，改用服务端地址
        if (avatarUrl.startsWith('blob:')) URL.revokeObjectURL(avatarUrl);
        setAvatarUrl(result.data.avatarUrl);
        onSuccess?.(result.data.avatarUrl);
        return result.data.avatarUrl;
      } else {
        setError(result.error || '上传失败');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
      return null;
    } finally {
      setUploading(false);
    }
  }, [avatarUrl, onSuccess]);

  const removeAvatar = useCallback(() => {
    if (avatarUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(null);
    setError(null);
  }, [avatarUrl]);

  const resetAvatar = useCallback(() => {
    setAvatarUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return originalAvatarUrl;
    });
    setError(null);
  }, [originalAvatarUrl]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    avatarUrl,
    uploading,
    error,
    avatarChanged: avatarUrl !== originalAvatarUrl,
    selectImage,
    setGeneratedAvatar,
    uploadAvatar,
    removeAvatar,
    resetAvatar,
    clearError,
  };
};