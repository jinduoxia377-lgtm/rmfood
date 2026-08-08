import { authApi } from '@/api/auth';
import type { UserProfile, PersonalInfoFormData, ApiResponse, AvatarUploadResponse } from '../types/user';

export const userService = {
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await authApi.getMe();
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户资料失败',
      };
    }
  },

  async updateProfile(data: PersonalInfoFormData): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await authApi.updateMe({
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        department: data.department,
        avatar_url: data.website,
      });
      return { success: true, data: response, message: '资料更新成功' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新用户资料失败',
      };
    }
  },

  async uploadAvatar(file: File): Promise<ApiResponse<AvatarUploadResponse>> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      // 使用集中式 API 客户端，由 Axios 自动处理 multipart/form-data boundary
      const api = (await import('@/api/client')).default;
      const response = await api.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '头像上传失败',
      };
    }
  },
};
