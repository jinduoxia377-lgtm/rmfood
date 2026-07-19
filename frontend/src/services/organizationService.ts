/**
 * Organization Service - 组织管理服务层
 * 提供组织 CRUD、成员管理、团队管理、权限管理、批量操作等完整 API 封装
 */
import axios from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { errorHandler, ErrorCategory } from './errorHandler';
import { ErrorFactory, parseError } from '@/utils/errorHandler';
import type { AppError } from '@/utils/errorHandler';
import { ERROR_CODES } from '@/constants/errorCodes';
import { envConfig } from '@/config/env';

export type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'custom';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  plan: 'free' | 'pro' | 'enterprise';
  member_count: number;
  team_count: number;
  created_at: string;
  updated_at: string;
  my_role: Role;
  settings?: Record<string, any>;
  is_active: boolean;
  is_archived: boolean;
}

export interface Member {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: Role;
  joined_at: string;
  last_active_at?: string;
  status: 'active' | 'pending' | 'inactive' | 'suspended';
  department?: string;
  title?: string;
}

export interface Team {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  description?: string;
  leader_id?: number;
  member_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  resource: string;
  action: string;
  scope: 'organization' | 'team' | 'personal';
  granted: boolean;
  conditions?: Record<string, any>;
}

export interface RoleDefinition {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permissions: Permission[];
  is_system_role: boolean;
  created_at: string;
}

export interface GetOrganizationsRequest {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'member_count';
  sort_order?: 'asc' | 'desc';
  plan?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

export interface GetOrganizationsResponse {
  data: Organization[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
  description?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  settings?: Record<string, any>;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  logo_url?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  settings?: Record<string, any>;
  is_active?: boolean;
}

export interface CreateRoleRequest {
  name: string;
  slug: string;
  description?: string;
  permissions: Omit<Permission, 'id'>[];
}

export interface BulkOperationResponse {
  success: boolean;
  succeeded: number;
  failed: number;
  errors?: { id: number; message: string }[];
}

export interface ExportResponse {
  download_url: string;
  file_name: string;
  format: string;
  size: number;
  expires_at: string;
}

export interface ExportOptions {
  include_members?: boolean;
  include_teams?: boolean;
  include_permissions?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  fields?: string[];
}

export interface AnalyticsData {
  total_organizations: number;
  active_organizations: number;
  new_organizations_this_month: number;
  total_members: number;
  average_team_size: number;
  growth_rate: number;
  top_plans: { plan: string; count: number }[];
  activity_timeline: {
    date: string;
    organizations_created: number;
    members_added: number;
  }[];
}

export interface KPIData {
  id: string;
  name: string;
  value: number;
  unit: string;
  change_percent: number;
  change_direction: 'up' | 'down' | 'neutral';
  target?: number;
}

class OrganizationService {
  private client: AxiosInstance;
  private baseUrl = `${envConfig.api.baseUrl}/organizations`;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: parseInt(import.meta.env?.VITE_API_TIMEOUT || '30000', 10),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      },
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        return Promise.reject(this.handleError(error));
      },
    );
  }

  private handleError(error: any): AppError {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || this.getDefaultErrorMessage(status);

      switch (status) {
        case 400:
          return ErrorFactory.validation(message);
        case 401:
          localStorage.removeItem('access_token');
          window.location.href = '/login';
          return ErrorFactory.auth.tokenExpired();
        case 403:
          return ErrorFactory.auth.permissionDenied();
        case 404:
          return ErrorFactory.notFound();
        case 409:
          return ErrorFactory.ai.generationFailed('资源冲突');
        case 422:
          return ErrorFactory.validation(message);
        case 429:
          return ErrorFactory.rateLimited();
        case 500:
        case 502:
        case 503:
        case 504:
          return ErrorFactory.serverError(message);
        default:
          return parseError(error, ERROR_CODES.API_REQUEST_FAILED);
      }
    } else if (error.request) {
      return ErrorFactory.network();
    } else {
      return parseError(error, ERROR_CODES.COMMON_UNKNOWN);
    }
  }

  private getDefaultErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: '请求参数错误',
      401: '未授权访问',
      403: '禁止访问',
      404: '资源不存在',
      409: '资源冲突',
      422: '数据验证失败',
      429: '请求过于频繁',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务不可用',
      504: '网关超时',
    };
    return messages[status] || '请求失败';
  }

  async getOrganizations(
    params: GetOrganizationsRequest = {},
    signal?: AbortSignal,
  ): Promise<GetOrganizationsResponse> {
    const response = await this.client.get<GetOrganizationsResponse>('', {
      params,
      signal,
    });
    return response.data;
  }

  async getOrganizationById(id: number, signal?: AbortSignal): Promise<Organization> {
    const response = await this.client.get<Organization>(`/${id}`, { signal });
    return response.data;
  }

  async createOrganization(data: CreateOrganizationRequest, signal?: AbortSignal): Promise<Organization> {
    const response = await this.client.post<Organization>('', data, { signal });
    return response.data;
  }

  async updateOrganization(id: number, data: UpdateOrganizationRequest, signal?: AbortSignal): Promise<Organization> {
    const response = await this.client.put<Organization>(`/${id}`, data, { signal });
    return response.data;
  }

  async deleteOrganization(id: number, signal?: AbortSignal): Promise<void> {
    await this.client.delete(`/${id}`, { signal });
  }

  async restoreOrganization(id: number, signal?: AbortSignal): Promise<void> {
    await this.client.post(`/${id}/restore`, null, { signal });
  }

  async getMembers(
    organizationId: number,
    params?: { page?: number; page_size?: number; search?: string; role?: Role; status?: string },
    signal?: AbortSignal,
  ): Promise<{ data: Member[]; total: number }> {
    const response = await this.client.get(`/${organizationId}/members`, {
      params,
      signal,
    });
    return response.data;
  }

  async inviteMember(
    organizationId: number,
    email: string,
    role: Role = 'member',
    signal?: AbortSignal,
  ): Promise<void> {
    await this.client.post(`/${organizationId}/members/invite`, { email, role }, { signal });
  }

  async updateMemberRole(organizationId: number, memberId: number, role: Role, signal?: AbortSignal): Promise<void> {
    await this.client.put(`/${organizationId}/members/${memberId}/role`, { role }, { signal });
  }

  async removeMember(organizationId: number, memberId: number, signal?: AbortSignal): Promise<void> {
    await this.client.delete(`/${organizationId}/members/${memberId}`, { signal });
  }

  async getTeams(organizationId: number, signal?: AbortSignal): Promise<Team[]> {
    const response = await this.client.get<Team[]>(`/${organizationId}/teams`, { signal });
    return response.data;
  }

  async createTeam(organizationId: number, data: Partial<Team>, signal?: AbortSignal): Promise<Team> {
    const response = await this.client.post<Team>(`/${organizationId}/teams`, data, { signal });
    return response.data;
  }

  async updateTeam(teamId: number, data: Partial<Team>, signal?: AbortSignal): Promise<Team> {
    const response = await this.client.put<Team>(`/teams/${teamId}`, data, { signal });
    return response.data;
  }

  async deleteTeam(teamId: number, signal?: AbortSignal): Promise<void> {
    await this.client.delete(`/teams/${teamId}`, { signal });
  }

  async getPermissions(organizationId: number, signal?: AbortSignal): Promise<Permission[]> {
    const response = await this.client.get<Permission[]>(`/${organizationId}/permissions`, { signal });
    return response.data;
  }

  async updatePermissions(organizationId: number, permissions: Permission[], signal?: AbortSignal): Promise<void> {
    await this.client.put(`/${organizationId}/permissions`, { permissions }, { signal });
  }

  async getRoles(signal?: AbortSignal): Promise<RoleDefinition[]> {
    const response = await this.client.get<RoleDefinition[]>('/roles', { signal });
    return response.data;
  }

  async createRole(data: CreateRoleRequest, signal?: AbortSignal): Promise<RoleDefinition> {
    const response = await this.client.post<RoleDefinition>('/roles', data, { signal });
    return response.data;
  }

  async updateRole(roleId: number, data: Partial<RoleDefinition>, signal?: AbortSignal): Promise<RoleDefinition> {
    const response = await this.client.put<RoleDefinition>(`/roles/${roleId}`, data, { signal });
    return response.data;
  }

  async deleteRole(roleId: number, signal?: AbortSignal): Promise<void> {
    await this.client.delete(`/roles/${roleId}`, { signal });
  }

  async bulkUpdatePermissions(
    organizationIds: number[],
    permissions: Partial<Permission>,
    signal?: AbortSignal,
  ): Promise<BulkOperationResponse> {
    const response = await this.client.post<BulkOperationResponse>(
      '/bulk/permissions',
      { organization_ids: organizationIds, permissions },
      { signal },
    );
    return response.data;
  }

  async bulkExportData(
    organizationIds: number[],
    format: 'csv' | 'excel' | 'pdf',
    options?: ExportOptions,
    signal?: AbortSignal,
  ): Promise<ExportResponse> {
    const response = await this.client.post<ExportResponse>(
      '/bulk/export',
      { organization_ids: organizationIds, format, options },
      { signal },
    );
    return response.data;
  }

  async bulkArchive(organizationIds: number[], signal?: AbortSignal): Promise<BulkOperationResponse> {
    const response = await this.client.post<BulkOperationResponse>(
      '/bulk/archive',
      { organization_ids: organizationIds },
      { signal },
    );
    return response.data;
  }

  async bulkDelete(organizationIds: number[], signal?: AbortSignal): Promise<BulkOperationResponse> {
    const response = await this.client.post<BulkOperationResponse>(
      '/bulk/delete',
      { organization_ids: organizationIds },
      { signal },
    );
    return response.data;
  }

  async exportOrganizationData(
    organizationId: number,
    format: ExportFormat,
    options?: ExportOptions,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const response = await this.client.post<Blob>(
      `/${organizationId}/export`,
      { format, options },
      {
        signal,
        responseType: 'blob',
      },
    );
    return response.data;
  }

  async getAnalytics(timeRange?: string, signal?: AbortSignal): Promise<AnalyticsData> {
    const params = timeRange ? { time_range: timeRange } : {};
    const response = await this.client.get<AnalyticsData>('/analytics', { params, signal });
    return response.data;
  }

  async getKPIs(signal?: AbortSignal): Promise<KPIData[]> {
    const response = await this.client.get<KPIData[]>('/analytics/kpis', { signal });
    return response.data;
  }
}

export const organizationService = new OrganizationService();

export default organizationService;
