import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import api from '@/api/client'

export interface Organization {
  id: number
  name: string
  slug: string
  description?: string
  plan: 'free' | 'pro' | 'enterprise'
  memberCount: number
  teamCount: number
  storageUsed: number
  storageLimit: number
  apiUsage: number
  apiLimit: number
  isFavorite: boolean
  isPinned: boolean
  isActive: boolean
  myRole: 'owner' | 'admin' | 'member' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface OrganizationFilters {
  plan?: ('free' | 'pro' | 'enterprise')[]
  role?: ('owner' | 'admin' | 'member' | 'viewer')[]
  status?: ('active' | 'inactive')[]
}

export interface CreateOrganizationRequest {
  name: string
  slug?: string
  description?: string
  plan?: 'free' | 'pro' | 'enterprise'
}

export interface UpdateOrganizationRequest {
  name?: string
  description?: string
  slug?: string
  plan?: 'free' | 'pro' | 'enterprise'
  isActive?: boolean
}

interface OrganizationsState {
  organizations: Organization[]
  loading: boolean
  error: Error | null
  total: number
  page: number
  pageSize: number
  search: string
  filters: OrganizationFilters
  sortBy: string
  sortOrder: 'asc' | 'desc'
  selectedIds: Set<number>
  lastFetchedAt: number | null
  trashedOrganizations: Organization[]
  trashLoading: boolean
}

type OrganizationsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'SET_ORGANIZATIONS'; payload: { items: Organization[]; total: number } }
  | { type: 'ADD_ORGANIZATION'; payload: Organization }
  | { type: 'UPDATE_ORGANIZATION'; payload: { id: number; data: Partial<Organization> } }
  | { type: 'REMOVE_ORGANIZATION'; payload: number }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<OrganizationFilters> }
  | { type: 'SET_SORT'; payload: { field: string; order: 'asc' | 'desc' } }
  | { type: 'TOGGLE_SELECT'; payload: number }
  | { type: 'SELECT_ALL'; payload: number[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'RESET_STATE' }
  | { type: 'SET_TRASHED'; payload: Organization[] }
  | { type: 'REMOVE_TRASHED'; payload: number }

/** Map backend org list response to frontend Organization type */
function mapOrgResponse(raw: Record<string, any>): Organization {
  const plan = raw.plan || 'free'
  const limits: Record<string, number> = raw.limits || {}
  return {
    id: raw.id,
    name: raw.name || '',
    slug: raw.slug || '',
    description: raw.description || '',
    plan,
    memberCount: raw.member_count ?? raw.memberCount ?? 0,
    teamCount: raw.team_count ?? raw.teamCount ?? 0,
    storageUsed: Number(raw.storage_used_mb ?? raw.storageUsed) * 1024 * 1024 || 0,
    storageLimit: (limits.storage_mb ?? 1024) * 1024 * 1024,
    apiUsage: 0,
    apiLimit: limits.api_calls_per_day ?? 10000,
    isFavorite: false,
    isPinned: false,
    isActive: raw.is_active !== false,
    myRole: raw.member_role ?? raw.my_role ?? 'member',
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.created_at || new Date().toISOString(),
  }
}

const initialState: OrganizationsState = {
  organizations: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  pageSize: 10,
  search: '',
  filters: {},
  sortBy: 'createdAt',
  sortOrder: 'desc',
  selectedIds: new Set(),
  lastFetchedAt: null,
  trashedOrganizations: [],
  trashLoading: false,
}

function organizationsReducer(state: OrganizationsState, action: OrganizationsAction): OrganizationsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }

    case 'SET_ORGANIZATIONS':
      return {
        ...state,
        organizations: action.payload.items,
        total: action.payload.total,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
      }

    case 'ADD_ORGANIZATION':
      return {
        ...state,
        organizations: [action.payload, ...state.organizations],
        total: state.total + 1,
      }

    case 'UPDATE_ORGANIZATION':
      return {
        ...state,
        organizations: state.organizations.map((org) =>
          org.id === action.payload.id ? { ...org, ...action.payload.data } : org,
        ),
      }

    case 'REMOVE_ORGANIZATION':
      return {
        ...state,
        organizations: state.organizations.filter((org) => org.id !== action.payload),
        total: state.total - 1,
        selectedIds: new Set([...state.selectedIds].filter((id) => id !== action.payload)),
      }

    case 'SET_PAGE':
      return { ...state, page: action.payload }

    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, page: 1 }

    case 'SET_SEARCH':
      return { ...state, search: action.payload, page: 1 }

    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload }, page: 1 }

    case 'SET_SORT':
      return { ...state, sortBy: action.payload.field, sortOrder: action.payload.order }

    case 'TOGGLE_SELECT': {
      const newSelected = new Set(state.selectedIds)
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload)
      } else {
        newSelected.add(action.payload)
      }
      return { ...state, selectedIds: newSelected }
    }

    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.payload) }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() }

    case 'RESET_STATE':
      return { ...initialState }

    case 'SET_TRASHED':
      return { ...state, trashedOrganizations: action.payload }

    case 'REMOVE_TRASHED':
      return { ...state, trashedOrganizations: state.trashedOrganizations.filter((o) => o.id !== action.payload) }

    default:
      return state
  }
}

interface UseOrganizationsOptions {
  autoFetch?: boolean
  debounceMs?: number
  cacheTTL?: number
  maxRetries?: number
}

export function useOrganizations(options: UseOrganizationsOptions = {}) {
  const {
    autoFetch = true,
    debounceMs = 300,
    cacheTTL = 1000 * 60 * 5,
    maxRetries = 3,
  } = options

  const [state, dispatch] = useReducer(organizationsReducer, initialState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const buildQueryParams = useCallback(() => {
    const params: Record<string, any> = {
      page: state.page,
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    }

    if (state.search.trim()) {
      params.search = state.search.trim()
    }

    if (state.filters.plan?.length) {
      params.plan = state.filters.plan.join(',')
    }

    if (state.filters.role?.length) {
      params.role = state.filters.role.join(',')
    }

    if (state.filters.status?.length) {
      params.status = state.filters.status.join(',')
    }

    return params
  }, [state.page, state.pageSize, state.search, state.filters, state.sortBy, state.sortOrder])

  const fetchOrganizations = useCallback(async () => {
    if (!mountedRef.current) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const params = buildQueryParams()
      const response = await api.get('/organizations', {
        params,
        signal: abortControllerRef.current.signal,
      })

      if (!mountedRef.current) return

      const data = response.data
      const rawOrgs = data.organizations || data.items || data.data || []
      const mapped = rawOrgs.map((o: Record<string, any>) => mapOrgResponse(o))
      dispatch({
        type: 'SET_ORGANIZATIONS',
        payload: {
          items: mapped,
          total: data.total ?? mapped.length,
        },
      })

      retryCountRef.current = 0
    } catch (error: any) {
      if (!mountedRef.current) return

      if (error.name === 'CanceledError') return

      if (retryCountRef.current < maxRetries && error.response?.status >= 500) {
        retryCountRef.current++
        setTimeout(() => {
          if (mountedRef.current) {
            fetchOrganizations()
          }
        }, Math.pow(2, retryCountRef.current) * 1000)
        return
      }

      dispatch({ type: 'SET_ERROR', payload: error as Error })
    }
  }, [buildQueryParams, maxRetries])

  useEffect(() => {
    if (autoFetch && typeof window !== 'undefined') {
      fetchOrganizations()
    }
  }, [autoFetch, fetchOrganizations])

  const setSearch = useCallback((search: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    dispatch({ type: 'SET_SEARCH', payload: search })

    debounceTimerRef.current = setTimeout(() => {
      fetchOrganizations()
    }, debounceMs)
  }, [fetchOrganizations, debounceMs])

  const setFilters = useCallback((filters: Partial<OrganizationFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }, [])

  useEffect(() => {
    if (state.filters !== initialState.filters) {
      fetchOrganizations()
    }
  }, [state.filters, fetchOrganizations])

  const setSort = useCallback((field: string, order: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORT', payload: { field, order } })
  }, [])

  useEffect(() => {
    if (state.sortBy !== initialState.sortBy || state.sortOrder !== initialState.sortOrder) {
      fetchOrganizations()
    }
  }, [state.sortBy, state.sortOrder, fetchOrganizations])

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page })
  }, [])

  useEffect(() => {
    if (state.page > 1) {
      fetchOrganizations()
    }
  }, [state.page, fetchOrganizations])

  const setPageSize = useCallback((size: number) => {
    dispatch({ type: 'SET_PAGE_SIZE', payload: size })
  }, [])

  const toggleSelect = useCallback((id: number) => {
    dispatch({ type: 'TOGGLE_SELECT', payload: id })
  }, [])

  const selectAll = useCallback(() => {
    const allIds = state.organizations.map((org) => org.id)
    dispatch({ type: 'SELECT_ALL', payload: allIds })
  }, [state.organizations])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

  const createOrganization = useCallback(
    async (data: CreateOrganizationRequest): Promise<Organization> => {
      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        const response = await api.post('/organizations', data)
        // Backend returns { success: true, organization: {...} }
        const rawOrg = response.data?.organization ?? response.data
        const newOrg = mapOrgResponse(rawOrg as Record<string, any>)
        dispatch({ type: 'ADD_ORGANIZATION', payload: newOrg })
        return newOrg
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [],
  )

  const updateOrganization = useCallback(async (id: number, data: UpdateOrganizationRequest): Promise<void> => {
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      await api.put(`/organizations/${id}`, data)
      dispatch({
        type: 'UPDATE_ORGANIZATION',
        payload: { id, data },
      })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error as Error })
      throw error
    }
  }, [])

  const deleteOrganization = useCallback(async (id: number): Promise<void> => {
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      await api.delete(`/organizations/${id}`)
      dispatch({ type: 'REMOVE_ORGANIZATION', payload: id })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error as Error })
      throw error
    }
  }, [])

  const toggleFavorite = useCallback(async (id: number): Promise<void> => {
    // Backend does not yet support favorite; toggle locally only
    const org = state.organizations.find((o) => o.id === id)
    if (!org) return
    dispatch({
      type: 'UPDATE_ORGANIZATION',
      payload: { id, data: { isFavorite: !org.isFavorite } },
    })
  }, [state.organizations])

  const fetchTrashedOrganizations = useCallback(async () => {
    if (!mountedRef.current) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      // Backend does not support status=deleted filter; fetch all then filter server-side
      const response = await api.get('/organizations')
      if (!mountedRef.current) return
      const rawOrgs = response.data?.organizations || response.data?.items || response.data?.data || []
      const allOrgs = rawOrgs.map((o: Record<string, any>) => mapOrgResponse(o))
      // Mark deleted (archived) organizations for trash view
      const trashed = allOrgs.filter((org: Organization) => !org.isActive)
      dispatch({ type: 'SET_TRASHED', payload: trashed })
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      if (!mountedRef.current) return
      dispatch({ type: 'SET_ERROR', payload: error as Error })
    }
  }, [])

  const restoreOrganization = useCallback(async (id: number): Promise<void> => {
    try {
      // Backend uses PUT /organizations/{id}/restore
      await api.put(`/organizations/${id}/restore`)
      dispatch({ type: 'REMOVE_ORGANIZATION', payload: id })
      dispatch({ type: 'REMOVE_TRASHED', payload: id })
    } catch (error: any) {
      throw error
    }
  }, [])

  const cloneOrganization = useCallback(async (id: number, newName?: string): Promise<number> => {
    try {
      const response = await api.post(`/organizations/${id}/clone`, { name: newName })
      // Backend returns { success, new_organization_id }
      const newOrgId = response.data?.new_organization_id ?? response.data?.id
      dispatch({
        type: 'ADD_ORGANIZATION',
        payload: {
          id: newOrgId,
          name: newName || '克隆组织',
          slug: `clone-${Date.now()}`,
          description: '',
          plan: 'free' as const,
          memberCount: 1,
          teamCount: 0,
          storageUsed: 0,
          storageLimit: 500 * 1024 * 1024,
          apiUsage: 0,
          apiLimit: 10000,
          isFavorite: false,
          isPinned: false,
          isActive: true,
          myRole: 'owner' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
      return newOrgId
    } catch (error: any) {
      throw error
    }
  }, [])

  const permanentDeleteOrganization = useCallback(async (id: number): Promise<void> => {
    try {
      // Use the standard delete (soft delete) then remove from trash
      await api.delete(`/organizations/${id}`)
      dispatch({ type: 'REMOVE_ORGANIZATION', payload: id })
      dispatch({ type: 'REMOVE_TRASHED', payload: id })
    } catch (error: any) {
      throw error
    }
  }, [])

  const togglePin = useCallback(async (id: number): Promise<void> => {
    // Backend does not yet support pin; toggle locally only
    const org = state.organizations.find((o) => o.id === id)
    if (!org) return
    dispatch({
      type: 'UPDATE_ORGANIZATION',
      payload: { id, data: { isPinned: !org.isPinned } },
    })
  }, [state.organizations])

  const refetch = useCallback(() => {
    retryCountRef.current = 0
    fetchOrganizations()
  }, [fetchOrganizations])

  const isStale = useMemo(() => {
    if (!state.lastFetchedAt) return true
    return Date.now() - state.lastFetchedAt > cacheTTL
  }, [state.lastFetchedAt, cacheTTL])

  const allSelected = useMemo(
    () => state.organizations.length > 0 && state.selectedIds.size === state.organizations.length,
    [state.organizations.length, state.selectedIds.size],
  )

  const someSelected = useMemo(
    () => state.selectedIds.size > 0 && state.selectedIds.size < state.organizations.length,
    [state.selectedIds.size, state.organizations.length],
  )

  return {
    organizations: state.organizations,
    loading: state.loading,
    error: state.error,
    total: state.total,
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    filters: state.filters,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    selectedIds: state.selectedIds,

    fetchOrganizations,
    setSearch,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    toggleSelect,
    selectAll,
    clearSelection,

    createOrganization,
    updateOrganization,
    deleteOrganization,

    toggleFavorite,
    togglePin,

    refetch,
    isStale,
    allSelected,
    someSelected,
    trashedOrganizations: state.trashedOrganizations ?? [],
    trashLoading: state.loading,
    fetchTrashedOrganizations,
    restoreOrganization,
    permanentDeleteOrganization,
    cloneOrganization,
  }
}

export interface PermissionMatrixData {
  roles: Array<{ role: string; permissions?: Array<{ resourceId: string; actions: string[] }> }>
  resourceTypes: string[]
  actions: string[]
}

export async function getPermissionMatrix(organizationId: number): Promise<PermissionMatrixData> {
  const response = await api.get("/organizations/" + organizationId + "/permissions")
  return response.data
}

export type UseOrganizationsReturn = ReturnType<typeof useOrganizations>
