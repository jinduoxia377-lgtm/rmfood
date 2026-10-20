import { authApi } from '@/api/auth';
import { envConfig } from '@/config/env';
import { normalizeUser } from '@/utils/userNormalizer';
import type { UserProfile, PersonalInfoFormData, ApiResponse, AvatarUploadResponse } from '../types/user';

export const userService = {
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    try {
      const response = await authApi.getMe();
      return { success: true, data: normalizeUser(response as unknown as Record<string, unknown>) as UserProfile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户资料失败',
      };
    }
  },

  /**
   * 更新个人资料。
   *
   * @param data  表单字段（fullName/email/phone/department/position/bio/website/github/linkedin）
   * @param options.avatarUrl 头像相关操作：
   *   - 传 string  → 同步头像地址（上传接口已写入后端时通常无需再传）
   *   - 传 null    → 清除已保存的头像（avatar_url 置空）
   *   - 不传       → 不修改头像字段
   */
  async updateProfile(
    data: PersonalInfoFormData,
    options?: { avatarUrl?: string | null },
  ): Promise<ApiResponse<UserProfile>> {
    try {
      const payload: Record<string, unknown> = {
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        department: data.department,
        position: data.position,
        bio: data.bio,
        website: data.website,
        github: data.github,
        linkedin: data.linkedin,
      };
      if (options && 'avatarUrl' in options) {
        payload.avatar_url = options.avatarUrl;
      }

      const response = await authApi.updateMe(payload as Parameters<typeof authApi.updateMe>[0]);
      return { success: true, data: normalizeUser(response as unknown as Record<string, unknown>) as UserProfile, message: '资料更新成功' };
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
      // 后端 /auth/me/avatar 期望的字段名是 `file`（与项目其他上传保持一致）
      formData.append('file', file);

      // 关键：不能用项目 axios 实例（默认 Content-Type: application/json 会把 FormData
      // 转成 JSON 导致 422），也不能手动设 multipart/form-data（会丢失 boundary）。
      // 改用原生 fetch：浏览器自动生成 multipart/form-data; boundary=...，
      // credentials 携带登录 Cookie，并手动附加 CSRF 双提交头。
      const csrfMatch = document.cookie.match(/(?:^| )csrf_token=([^;]+)/);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';
      const response = await fetch(`${envConfig.api.baseUrl}/auth/me/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
        body: formData,
      });

      if (!response.ok) {
        // 解析后端错误详情，便于前端展示真实原因（而不是笼统的 422）
        let detail = `Request failed with status code ${response.status}`;
        try {
          const data = await response.json() as { detail?: unknown; error?: string; message?: string };
          if (typeof data.detail === 'string') detail = data.detail;
          else if (data.error) detail = data.error;
          else if (data.message) detail = data.message;
        } catch { /* 保留默认错误信息 */ }
        return { success: false, error: detail };
      }

      const data = (await response.json()) as AvatarUploadResponse;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '头像上传失败',
      };
    }
  },

  /**
   * 请求后端生成一张真实 AI 人物头像（StyleGAN2 在线服务）。
   * 返回图片 Blob，前端复用现有上传链路，用户点击「保存修改」时落库。
   */
  async generateRealAvatar(): Promise<ApiResponse<Blob>> {
    try {
      const csrfMatch = document.cookie.match(/(?:^| )csrf_token=([^;]+)/);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';
      const response = await fetch(`${envConfig.api.baseUrl}/auth/me/avatar/generate-real`, {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      });

      if (!response.ok) {
        let detail = `Request failed with status code ${response.status}`;
        try {
          const data = await response.json() as { detail?: unknown; error?: string; message?: string };
          if (typeof data.detail === 'string') detail = data.detail;
          else if (data.error) detail = data.error;
          else if (data.message) detail = data.message;
        } catch { /* 保留默认错误信息 */ }
        return { success: false, error: detail };
      }

      const blob = await response.blob();
      return { success: true, data: blob };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 头像生成失败',
      };
    }
  },
};