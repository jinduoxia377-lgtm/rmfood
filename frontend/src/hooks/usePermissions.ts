import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import api from '@/api/client'

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'invite'
  | 'export'
  | 'archive'

export type ResourceType = 'organization' | 'team' | 'member' | 'formula' | 'setting' | 'all'

export interface Permission {
  id: number
  name: string
  code: string
  description?: string
  resource: ResourceType
  actions: PermissionAction[]
  createdAt?: string
}

export interface RoleDefinition {
  id: number
  name: string
  code: string
  description?: string
  permissions: Permission[]
  isSystem: boolean
  memberCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateRoleRequest {
  name: string
  code: string
  description?: string
  permissionIds: number[]
}

interface PermissionsState {
  permissions: Permission[]
  roles: RoleDefinition[]
  loading: boolean
  error: Error | null
  currentOrgId: number | null
  lastFetchedAt: number | null
}

type PermissionsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'SET_PERMISSIONS'; payload: Permission[] }
  | { type: 'SET_ROLES'; payload: RoleDefinition[] }
  | { type: 'ADD_ROLE'; payload: RoleDefinition }
  | { type: 'UPDATE_ROLE'; payload: { id: number; data: Partial<RoleDefinition> } }
  | { type: 'REMOVE_ROLE'; payload: number }
  | { type: 'SET_ORG_ID'; payload: number | null }
  | { type: 'RESET_STATE' }

const initialState: PermissionsState = {
  permissions: [],
  roles: [],
  loading: false,
  error: null,
  currentOrgId: null,
  lastFetchedAt: null,
}

function permissionsReducer(state: PermissionsState, action: PermissionsAction): PermissionsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }

    case 'SET_PERMISSIONS':
      return { ...state, permissions: action.payload, loading: false, lastFetchedAt: Date.now() }

    case 'SET_ROLES':
      return { ...state, roles: action.payload, loading: false }

    case 'ADD_ROLE':
      return { ...state, roles: [...state.roles, action.payload] }

    case 'UPDATE_ROLE':
      return {
        ...state,
        roles: state.roles.map((role) =>
          role.id === action.payload.id ? { ...role, ...action.payload.data } : role,
        ),
      }

    case 'REMOVE_ROLE':
      return {
        ...state,
        roles: state.roles.filter((role) => role.id !== action.payload),
      }

    case 'SET_ORG_ID':
      return { ...state, currentOrgId: action.payload }

    case 'RESET_STATE':
      return { ...initialState }

    default:
      return state
  }
}

const DEFAULT_PERMISSIONS: Record<ResourceType, PermissionAction[]> = {
  organization: ['read', 'update', 'manage'],
  team: ['create', 'read', 'update', 'delete'],
  member: ['invite', 'read', 'update', 'delete'],
  formula: ['create', 'read', 'update', 'delete', 'export'],
  setting: ['read', 'update'],
  all: [],
}

interface UsePermissionsOptions {
  autoFetch?: boolean
  cacheTTL?: number
}

export function usePermissions(options: UsePermissionsOptions = {}) {
  const { autoFetch = true, cacheTTL = 1000 * 60 * 10 } = options

  const [state, dispatch] = useReducer(permissionsReducer, initialState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const fetchPermissions = useCallback(
    async (orgId: number): Promise<void> => {
      if (!mountedRef.current || typeof window === 'undefined') return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      dispatch({ type: 'SET_ORG_ID', payload: orgId })
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        const response = await api.get(`/organizations/${orgId}/permissions`, {
          signal: abortControllerRef.current.signal,
        })

        if (!mountedRef.current) return

        dispatch({
          type: 'SET_PERMISSIONS',
          payload: response.data.items || response.data || DEFAULT_PERMISSIONS as any,
        })
      } catch (error: any) {
        if (!mountedRef.current) return
        if (error.name === 'CanceledError') return

        dispatch({ type: 'SET_ERROR', payload: error as Error })
      }
    },
    [],
  )

  const fetchRoles = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || !state.currentOrgId || typeof window === 'undefined') return

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await api.get(`/organizations/${state.currentOrgId}/roles`)

      if (!mountedRef.current) return

      dispatch({
        type: 'SET_ROLES',
        payload: response.data.items || response.data || [],
      })
    } catch (error: any) {
      if (!mountedRef.current) return

      dispatch({ type: 'SET_ERROR', payload: error as Error })
    }
  }, [state.currentOrgId])

  useEffect(() => {
    if (autoFetch && state.currentOrgId && typeof window !== 'undefined') {
      fetchRoles()
    }
  }, [autoFetch, state.currentOrgId, fetchRoles])

  const createRole = useCallback(
    async (data: CreateRoleRequest): Promise<RoleDefinition> => {
      if (!state.currentOrgId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        const response = await api.post(`/organizations/${state.currentOrgId}/roles`, data)
        const newRole = response.data as RoleDefinition
        dispatch({ type: 'ADD_ROLE', payload: newRole })
        return newRole
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.currentOrgId],
  )

  const updateRole = useCallback(
    async (roleId: number, data: Partial<RoleDefinition>): Promise<void> => {
      if (!state.currentOrgId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        await api.patch(`/organizations/${state.currentOrgId}/roles/${roleId}`, data)
        dispatch({
          type: 'UPDATE_ROLE',
          payload: { id: roleId, data },
        })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.currentOrgId],
  )

  const deleteRole = useCallback(
    async (roleId: number): Promise<void> => {
      if (!state.currentOrgId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        await api.delete(`/organizations/${state.currentOrgId}/roles/${roleId}`)
        dispatch({ type: 'REMOVE_ROLE', payload: roleId })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.currentOrgId],
  )

  const hasPermission = useCallback(
    (action: PermissionAction, resource?: ResourceType): boolean => {
      if (resource === 'all' || !resource) {
        return state.permissions.some((p) => p.actions.includes(action))
      }

      const resourcePermission = state.permissions.find((p) => p.resource === resource)
      if (!resourcePermission) {
        const defaults = DEFAULT_PERMISSIONS[resource]
        return defaults?.includes(action) ?? false
      }

      return resourcePermission.actions.includes(action)
    },
    [state.permissions],
  )

  const hasAnyPermission = useCallback(
    (actions: PermissionAction[], resource?: ResourceType): boolean => {
      return actions.some((action) => hasPermission(action, resource))
    },
    [hasPermission],
  )

  const hasAllPermissions = useCallback(
    (actions: PermissionAction[], resource?: ResourceType): boolean => {
      return actions.every((action) => hasPermission(action, resource))
    },
    [hasPermission],
  )

  const getRoleById = useCallback(
    (roleId: number): RoleDefinition | undefined => {
      return state.roles.find((r) => r.id === roleId)
    },
    [state.roles],
  )

  const getRoleByCode = useCallback(
    (code: string): RoleDefinition | undefined => {
      return state.roles.find((r) => r.code === code)
    },
    [state.roles],
  )

  const refetch = useCallback(() => {
    if (state.currentOrgId) {
      fetchPermissions(state.currentOrgId)
      fetchRoles()
    }
  }, [fetchPermissions, fetchRoles, state.currentOrgId])

  const isStale = useMemo(() => {
    if (!state.lastFetchedAt) return true
    return Date.now() - state.lastFetchedAt > cacheTTL
  }, [state.lastFetchedAt, cacheTTL])

  const permissionGroups = useMemo(() => {
    const groups = new Map<ResourceType, Permission[]>()

    for (const perm of state.permissions) {
      const existing = groups.get(perm.resource) || []
      existing.push(perm)
      groups.set(perm.resource, existing)
    }

    return Object.fromEntries(groups) as Record<ResourceType, Permission[]>
  }, [state.permissions])

  const systemRoles = useMemo(
    () => state.roles.filter((r) => r.isSystem),
    [state.roles],
  )

  const customRoles = useMemo(
    () => state.roles.filter((r) => !r.isSystem),
    [state.roles],
  )

  return {
    permissions: state.permissions,
    roles: state.roles,
    loading: state.loading,
    error: state.error,

    fetchPermissions,
    fetchRoles,

    createRole,
    updateRole,
    deleteRole,

    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    getRoleById,
    getRoleByCode,

    refetch,

    isStale,
    permissionGroups,
    systemRoles,
    customRoles,
  }
}

export type UsePermissionsReturn = ReturnType<typeof usePermissions>
