/**
 * 组织自定义角色管理器
 * 加载/创建/更新/删除组织自定义角色，渲染 PermissionManager 编辑器。
 */
import React, { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import { PermissionManager } from './PermissionManager'
import { Card, CardContent, Skeleton, useToast } from '@/components/ui'

export interface OrgRole {
  code: string
  name: string
  description?: string
  permissions?: Record<string, unknown>
}

export const CustomRoleManager: React.FC<{ organizationId: number }> = ({ organizationId }) => {
  const toast = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ roles: OrgRole[] }>({
    queryKey: ['org-roles', organizationId],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${organizationId}/roles`)
      return data
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['org-roles', organizationId] })

  const createRole = useMutation({
    mutationFn: async (data: { name: string; description?: string; permissions?: Record<string, unknown> }) => {
      const { data: res } = await api.post(`/organizations/${organizationId}/roles`, data)
      return res
    },
    onSuccess: () => { invalidate(); toast.success('角色已创建') },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '创建角色失败'),
  })

  const updateRole = useMutation({
    mutationFn: async ({ roleCode, data }: { roleCode: string; data: Record<string, unknown> }) => {
      const { data: res } = await api.put(`/organizations/${organizationId}/roles/${roleCode}`, data)
      return res
    },
    onSuccess: () => { invalidate(); toast.success('角色已更新') },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新角色失败'),
  })

  const deleteRole = useMutation({
    mutationFn: async (roleCode: string) => {
      const { data: res } = await api.delete(`/organizations/${organizationId}/roles/${roleCode}`)
      return res
    },
    onSuccess: () => { invalidate(); toast.success('角色已删除') },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '删除角色失败'),
  })

  const handleCreateRole = useCallback(async (data: any) => {
    await createRole.mutateAsync({ name: data.name, description: data.description, permissions: data.permissions || {} })
  }, [createRole])

  const handleUpdateRole = useCallback(async (roleId: string | number, data: any) => {
    await updateRole.mutateAsync({ roleCode: String(roleId), data })
  }, [updateRole])

  const handleDeleteRole = useCallback(async (roleId: string | number) => {
    await deleteRole.mutateAsync(String(roleId))
  }, [deleteRole])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-sm)]">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-32 w-full rounded-[var(--radius-Apple-sm)]" />
        </CardContent>
      </Card>
    )
  }

  return (
    <PermissionManager
      organizationId={organizationId}
      roles={data?.roles ?? []}
      permissions={[]}
      onCreateRole={handleCreateRole}
      onUpdateRole={handleUpdateRole}
      onDeleteRole={handleDeleteRole}
    />
  )
}