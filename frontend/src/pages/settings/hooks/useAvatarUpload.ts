import { useState, useCallback } from 'react';
import { userService } from '../services/userService';
import { compressImage, validateImage } from '../utils/imageUtils';

interface UseAvatarUploadReturn {
  avatarUrl: string | null;
  uploading: boolean;
  error: string | null;
  selectImage: (file: File) => Promise<void>;
  uploadAvatar: () => Promise<boolean>;
  removeAvatar: () => void;
  clearError: () => void;
}

export const useAvatarUpload = (
  initialUrl: string | null,
  onSuccess?: (url: string) => void,
): UseAvatarUploadReturn => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setAvatarUrl(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败');
    }
  }, []);

  const uploadAvatar = useCallback(async (): Promise<boolean> => {
    if (!avatarUrl) {
      setError('请先选择图片');
      return false;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      const file = new File([blob], 'avatar.webp', { type: 'image/webp' });

      const result = await userService.uploadAvatar(file);
      if (result.success && result.data) {
        setAvatarUrl(result.data.avatarUrl);
        onSuccess?.(result.data.avatarUrl);
        return true;
      } else {
        setError(result.error || '上传失败');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
      return false;
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    avatarUrl,
    uploading,
    error,
    selectImage,
    uploadAvatar,
    removeAvatar,
    clearError,
  };
};
