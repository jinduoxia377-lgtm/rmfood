/**
 * RMFOOD 应用根组件
 * 路由配置、认证守卫、QueryProvider
 *
 * 使用 react-router-dom v7 的 createBrowserRouter + RouterProvider
 */
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, lazy, Suspense, type ReactNode } from 'react'

import { useAuthStore } from '@/stores/auth'
import { UserRole } from '@/types/index'
import { ThemeProvider } from '@/stores/ThemeProvider'
import MainLayout from '@/components/layout/MainLayout'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ShortcutHelpProvider } from '@/hooks/useKeyboardShortcuts.tsx'

// 关键页面直接导入，确保首屏加载速度
import RhineLoginPage from '@/pages/auth/RhineLoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'

// 非关键页面使用懒加载，优化启动速度
const FormulaListPage = lazy(() => import('@/pages/formula/FormulaListPage'))
const FormulaNewPage = lazy(() => import('@/pages/formula/FormulaNewPage'))
const FormulaDetailPage = lazy(() => import('@/pages/formula/FormulaDetailPage'))
const FormulaEditPage = lazy(() => import('@/pages/formula/FormulaEditPage'))
const FormulaTemplatesPage = lazy(() => import('@/pages/formula/FormulaTemplatesPage'))
const FormulaComparePage = lazy(() => import('@/pages/formula/FormulaComparePage'))
const FormulaTestPage = lazy(() => import('@/pages/formula/FormulaTestPage'))
const ExperimentListPage = lazy(() => import('@/pages/experiment/ExperimentListPage'))
const ExperimentDetailPage = lazy(() => import('@/pages/experiment/ExperimentDetailPage'))
const ExperimentNewPage = lazy(() => import('@/pages/experiment/ExperimentNewPage'))
const ExperimentEditPage = lazy(() => import('@/pages/experiment/ExperimentEditPage'))
const AIAssistantPage = lazy(() => import('@/pages/ai/AIAssistantPage'))
const AcademicReportPage = lazy(() => import('@/pages/academic/AcademicReportPage'))
const DatabasePage = lazy(() => import('@/pages/database/DatabasePage'))
const UserManagementPage = lazy(() => import('@/pages/user/UserManagementPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const NotificationPage = lazy(() => import('@/pages/notification/NotificationPage'))
const WorkflowPage = lazy(() => import('@/pages/workflow/WorkflowPage'))
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// SSS 企业级功能页面（懒加载）
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'))
const OrganizationsPage = lazy(() => import('@/pages/organizations/OrganizationsPage'))
const IntegrationsPage = lazy(() => import('@/pages/integrations/IntegrationsPage'))

// React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

/* ═══════════════════════════════════════════
   路由守卫组件
   ═══════════════════════════════════════════ */

/**
 * 认证守卫：未登录跳转到登录页 + 登录后 fetchUser
 * ✅ 修复：添加 isLoading 检查，避免 Zustand persist 异步恢复导致的竞态条件
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser()
    }
  }, [isAuthenticated, fetchUser, isLoading])

  // ✅ 关键修复：如果正在加载（persist 还没恢复），显示 loading 而不是立即重定向
  if (isLoading) {
    return <LoadingComponent />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/**
 * 已登录守卫：登录后跳转到仪表盘
 */
function GuestGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/**
 * 管理员权限守卫：非管理员跳转到仪表盘
 * ✅ 修复：添加 isLoading + user=null 检查，避免 persist 异步恢复导致的竞态条件
 * ✅ 修复：角色比较使用 toUpperCase() 兼容 API 返回的小写 'admin'
 */
function AdminGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isLoading) {
    return <LoadingComponent />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return <LoadingComponent />
  }

  if ((user.role as string).toUpperCase() !== UserRole.ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// 加载组件，用于Suspense的fallback
const LoadingComponent = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-gray-600">加载中...</p>
    </div>
  </div>
)

/* ═══════════════════════════════════════════
   路由配置 (react-router-dom v7)
   ═══════════════════════════════════════════ */

const router = createBrowserRouter([
  // 公开路由 — 登录页
  {
    path: '/login',
    element: (
      <GuestGuard>
        <RhineLoginPage />
      </GuestGuard>
    ),
  },
  // 公开路由 — 密码找回
  {
    path: '/forgot-password',
    element: (
      <GuestGuard>
        <ForgotPasswordPage />
      </GuestGuard>
    ),
  },

  // 受保护路由 — 带 MainLayout 布局
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },

      // 配方管理
      {
        path: 'formulas',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaListPage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/new',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaNewPage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/:id',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/:id/edit',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaEditPage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/templates',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaTemplatesPage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/compare',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaComparePage />
          </Suspense>
        ),
      },
      {
        path: 'formulas/test',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <FormulaTestPage />
          </Suspense>
        ),
      },

      // 实验管理
      {
        path: 'experiments',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ExperimentListPage />
          </Suspense>
        ),
      },
      {
        path: 'experiments/new',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ExperimentNewPage />
          </Suspense>
        ),
      },
      {
        path: 'experiments/:id',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ExperimentDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'experiments/:id/edit',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ExperimentEditPage />
          </Suspense>
        ),
      },

      // 智能工具
      {
        path: 'ai',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AIAssistantPage />
          </Suspense>
        ),
      },
      {
        path: 'academic-report',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AcademicReportPage />
          </Suspense>
        ),
      },
      {
        path: 'databases',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <DatabasePage />
          </Suspense>
        ),
      },
      {
        path: 'workflows',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <WorkflowPage />
          </Suspense>
        ),
      },

      // ══════════════════════════════════
      // SSS 企业级功能路由
      // ══════════════════════════════════
      {
        path: 'analytics',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AnalyticsPage />
          </Suspense>
        ),
      },
      {
        path: 'organizations',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <OrganizationsPage />
          </Suspense>
        ),
      },
      {
        path: 'integrations',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <IntegrationsPage />
          </Suspense>
        ),
      },

      // 系统
      {
        path: 'notifications',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <NotificationPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <SettingsPage />
          </Suspense>
        ),
      },


      // 管理员路由
      {
        path: 'users',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AdminGuard>
              <UserManagementPage />
            </AdminGuard>
          </Suspense>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AdminGuard>
              <AuditLogPage />
            </AdminGuard>
          </Suspense>
        ),
      },

      // 404
      {
        path: '404',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },

  // 兜底
  { path: '*', element: <Navigate to="/404" replace /> },
])

/* ═══════════════════════════════════════════
   应用根组件
   ═══════════════════════════════════════════ */

export default function App() {
  return (
    <ErrorBoundary fallback={<div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">应用加载失败</h1>
        <p className="mt-4 text-gray-600">请刷新页面重试</p>
        <button
          className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </button>
      </div>
    </div>}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ShortcutHelpProvider>
              <RouterProvider router={router} />
              <ToastContainer />
            </ShortcutHelpProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
