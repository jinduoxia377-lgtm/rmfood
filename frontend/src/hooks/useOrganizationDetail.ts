import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react'
import api from '@/api/client'
import type { Organization } from './useOrganizations'

export interface Member {
  id: number
  userId: number
  email: string
  displayName: string
  avatarUrl?: string
  role: Role
  status: 'active' | 'pending' | 'invited' | 'suspended'
  joinedAt: string
  lastActiveAt?: string
}

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

/** Map backend member record to frontend Member interface */
function mapMemberResponse(raw: Record<string, any>): Member {
  return {
    id: raw.id,
    userId: raw.user_id ?? raw.userId,
    email: raw.email ?? '',
    displayName: raw.username ?? raw.display_name ?? raw.full_name ?? raw.email?.split('@')[0] ?? '',
    avatarUrl: raw.avatar_url ?? raw.avatarUrl,
    role: (raw.role || 'member') as Role,
    status: (raw.status || 'active') as Member['status'],
    joinedAt: raw.joined_at ?? raw.joinedAt ?? new Date().toISOString(),
    lastActiveAt: raw.last_active_at ?? raw.lastActiveAt,
  }
}

export interface Team {
  id: number
  name: string
  description?: string
  slug: string
  memberIds: number[]
  leadId?: number
  createdAt: string
  updatedAt: string
}

interface OrganizationDetailState {
  organization: Organization | null
  members: Member[]
  teams: Team[]
  loading: boolean
  error: Error | null
  activeTab: string
  organizationId: number | null
}

type OrganizationDetailAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'SET_ORGANIZATION'; payload: Organization }
  | { type: 'SET_MEMBERS'; payload: Member[] }
  | { type: 'ADD_MEMBER'; payload: Member }
  | { type: 'UPDATE_MEMBER'; payload: { id: number; data: Partial<Member> } }
  | { type: 'REMOVE_MEMBER'; payload: number }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'ADD_TEAM'; payload: Team }
  | { type: 'UPDATE_TEAM'; payload: { id: number; data: Partial<Team> } }
  | { type: 'REMOVE_TEAM'; payload: number }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_ORGANIZATION_ID'; payload: number | null }
  | { type: 'RESET_STATE' }

const initialState: OrganizationDetailState = {
  organization: null,
  members: [],
  teams: [],
  loading: false,
  error: null,
  activeTab: 'overview',
  organizationId: null,
}

function organizationDetailReducer(
  state: OrganizationDetailState,
  action: OrganizationDetailAction,
): OrganizationDetailState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }

    case 'SET_ORGANIZATION':
      return { ...state, organization: action.payload, loading: false }

    case 'SET_MEMBERS':
      return { ...state, members: action.payload }

    case 'ADD_MEMBER':
      return { ...state, members: [...state.members, action.payload] }

    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map((member) =>
          member.id === action.payload.id ? { ...member, ...action.payload.data } : member,
        ),
      }

    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.filter((member) => member.id !== action.payload),
      }

    case 'SET_TEAMS':
      return { ...state, teams: action.payload }

    case 'ADD_TEAM':
      return { ...state, teams: [...state.teams, action.payload] }

    case 'UPDATE_TEAM':
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.payload.id ? { ...team, ...action.payload.data } : team,
        ),
      }

    case 'REMOVE_TEAM':
      return {
        ...state,
        teams: state.teams.filter((team) => team.id !== action.payload),
      }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload }

    case 'SET_ORGANIZATION_ID':
      return { ...state, organizationId: action.payload }

    case 'RESET_STATE':
      return { ...initialState }

    default:
      return state
  }
}

interface UseOrganizationDetailOptions {
  autoFetchMembers?: boolean
  autoFetchTeams?: boolean
}

export function useOrganizationDetail(options: UseOrganizationDetailOptions = {}) {
  const { autoFetchMembers = true, autoFetchTeams = true } = options

  const [state, dispatch] = useReducer(organizationDetailReducer, initialState)
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

  const fetchDetail = useCallback(
    async (id: number) => {
      if (!mountedRef.current) return
      if (typeof window === 'undefined') return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      dispatch({ type: 'SET_ORGANIZATION_ID', payload: id })
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        const [orgResponse, membersResponse, teamsResponse] = await Promise.all([
          api.get(`/organizations/${id}`, {
            signal: abortControllerRef.current.signal,
          }),
          autoFetchMembers
            ? api.get(`/organizations/${id}/members`, {
                signal: abortControllerRef.current.signal,
              })
            : Promise.resolve({ data: [] }),
          autoFetchTeams
            ? api.get(`/organizations/${id}/teams`, {
                signal: abortControllerRef.current.signal,
              })
            : Promise.resolve({ data: [] }),
        ])

        if (!mountedRef.current) return

        // Backend returns { organization: {...} }, { members: [...] }, { teams: [...] }
        const rawOrg = orgResponse.data?.organization ?? orgResponse.data
        dispatch({ type: 'SET_ORGANIZATION', payload: rawOrg })

        if (autoFetchMembers) {
          const rawMembers = membersResponse.data?.members || membersResponse.data || []
          dispatch({
            type: 'SET_MEMBERS',
            payload: rawMembers.map((m: Record<string, any>) => mapMemberResponse(m)),
          })
        }

        if (autoFetchTeams) {
          dispatch({
            type: 'SET_TEAMS',
            payload: teamsResponse.data?.teams || teamsResponse.data || [],
          })
        }
      } catch (error: any) {
        if (!mountedRef.current) return
        if (error.name === 'CanceledError') return

        dispatch({ type: 'SET_ERROR', payload: error as Error })
      }
    },
    [autoFetchMembers, autoFetchTeams],
  )

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })
  }, [])

  const inviteMember = useCallback(
    async (email: string, role: Role = 'member'): Promise<void> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        // Backend: POST /organizations/{id}/members with { email, role, team_ids? }
        const response = await api.post(`/organizations/${state.organizationId}/members`, {
          email,
          role,
        })

        const newMember = response.data as Member
        dispatch({ type: 'ADD_MEMBER', payload: newMember })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId],
  )

  const removeMember = useCallback(
    async (memberUserId: number): Promise<void> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        // Backend DELETE /{org_id}/members/{user_id} expects user_id
        await api.delete(`/organizations/${state.organizationId}/members/${memberUserId}`)
        // Remove from local state by matching userId
        dispatch({
          type: 'REMOVE_MEMBER',
          payload: state.members.find((m) => m.userId === memberUserId)?.id ?? memberUserId,
        })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId, state.members],
  )

  const updateMemberRole = useCallback(
    async (memberId: number, role: Role): Promise<void> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        // Backend: PUT /organizations/{id}/members/{user_id}/role
        await api.put(`/organizations/${state.organizationId}/members/${memberId}/role`, { role })
        dispatch({
          type: 'UPDATE_MEMBER',
          payload: { id: memberId, data: { role } },
        })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId],
  )

  const createTeam = useCallback(
    async (data: Partial<Team>): Promise<Team> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        const response = await api.post(`/organizations/${state.organizationId}/teams`, data)
        const newTeam = response.data as Team
        dispatch({ type: 'ADD_TEAM', payload: newTeam })
        return newTeam
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId],
  )

  const updateTeam = useCallback(
    async (teamId: number, data: Partial<Team>): Promise<Team> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        // Backend: PUT /organizations/{id}/teams/{team_id}
        await api.put(`/organizations/${state.organizationId}/teams/${teamId}`, data)
        dispatch({
          type: 'UPDATE_TEAM',
          payload: { id: teamId, data },
        })

        const updatedTeam = state.teams.find((t) => t.id === teamId)
        return updatedTeam ? { ...updatedTeam, ...data } : ({} as Team)
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId, state.teams],
  )

  const deleteTeam = useCallback(
    async (teamId: number): Promise<void> => {
      if (!state.organizationId) throw new Error('No organization selected')

      dispatch({ type: 'SET_ERROR', payload: null })

      try {
        await api.delete(`/organizations/${state.organizationId}/teams/${teamId}`)
        dispatch({ type: 'REMOVE_TEAM', payload: teamId })
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
        throw error
      }
    },
    [state.organizationId],
  )

  const fetchMembers = useCallback(async (): Promise<void> => {
    if (!state.organizationId || !mountedRef.current) return

    try {
      const response = await api.get(`/organizations/${state.organizationId}/members`)
      if (mountedRef.current) {
        // Backend returns { members: [...] }
        dispatch({
          type: 'SET_MEMBERS',
          payload: response.data?.members || response.data || [],
        })
      }
    } catch (error: any) {
      if (mountedRef.current) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
      }
    }
  }, [state.organizationId])

  const fetchTeams = useCallback(async (): Promise<void> => {
    if (!state.organizationId || !mountedRef.current) return

    try {
      const response = await api.get(`/organizations/${state.organizationId}/teams`)
      if (mountedRef.current) {
        // Backend returns { teams: [...] }
        dispatch({
          type: 'SET_TEAMS',
          payload: response.data?.teams || response.data || [],
        })
      }
    } catch (error: any) {
      if (mountedRef.current) {
        dispatch({ type: 'SET_ERROR', payload: error as Error })
      }
    }
  }, [state.organizationId])

  const refetch = useCallback(() => {
    if (state.organizationId) {
      fetchDetail(state.organizationId)
    }
  }, [fetchDetail, state.organizationId])

  const memberCount = useMemo(() => state.members.length, [state.members.length])
  const teamCount = useMemo(() => state.teams.length, [state.teams.length])
  const activeMemberCount = useMemo(
    () => state.members.filter((m) => m.status === 'active').length,
    [state.members],
  )
  const pendingInvites = useMemo(
    () => state.members.filter((m) => m.status === 'pending' || m.status === 'invited').length,
    [state.members],
  )

  return {
    organization: state.organization,
    members: state.members,
    teams: state.teams,
    loading: state.loading,
    error: state.error,
    activeTab: state.activeTab,

    fetchDetail,
    setActiveTab,

    inviteMember,
    removeMember,
    updateMemberRole,

    createTeam,
    updateTeam,
    deleteTeam,

    fetchMembers,
    fetchTeams,
    refetch,

    memberCount,
    teamCount,
    activeMemberCount,
    pendingInvites,
  }
}

export type UseOrganizationDetailReturn = ReturnType<typeof useOrganizationDetail>
