/**
 * RMFOOD 应用根组件
 * 路由配置、认证守卫、QueryProvider
 *
 * 使用 react-router-dom v7 的 createBrowserRouter + RouterProvider
 *
 * 🔒 P3-1: lazyWithPreload 懒加载策略：
 * - 首屏关键页面（登录、仪表盘）同步加载
 * - 其他页面使用懒加载 + 空闲预加载
 * - 大体积模块（图表/导出）延迟加载
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

// 🔒 P3-1: 可预加载懒加载（空闲时预加载）
import { lazyWithPreload } from '@/components/LazyLoad.tsx'

// 🔒 P3-1: 关键页面直接导入，确保首屏加载速度
// 这些文件体积小，同步加载无影响首屏性能
import RhineLoginPage from '@/pages/auth/RhineLoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'

// 🔒 P3-1: 中等体积页面 - 标准懒加载
const FormulaListPage = lazyWithPreload(() => import('@/pages/formula/FormulaListPage'))
const FormulaNewPage = lazyWithPreload(() => import('@/pages/formula/FormulaNewPage'))
const FormulaDetailPage = lazyWithPreload(() => import('@/pages/formula/FormulaDetailPage'))
const FormulaEditPage = lazyWithPreload(() => import('@/pages/formula/FormulaEditPage'))
const FormulaTemplatesPage = lazyWithPreload(() => import('@/pages/formula/FormulaTemplatesPage'))
const FormulaComparePage = lazyWithPreload(() => import('@/pages/formula/FormulaComparePage'))
const FormulaTestPage = lazyWithPreload(() => import('@/pages/formula/FormulaTestPage'))

// 🔒 P3-1: 数据管理 - 中等体积
const ExperimentListPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentListPage'))
const ExperimentDetailPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentDetailPage'))
const ExperimentNewPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentNewPage'))
const ExperimentEditPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentEditPage'))

// 🔒 P3-1: AI 相关页面 - 大体积，懒加载
const AIAssistantPage = lazyWithPreload(() => import('@/pages/ai/AIAssistantPage'))
const AcademicReportPage = lazyWithPreload(() => import('@/pages/academic/AcademicReportPage'))

// 🔒 P3-1: 数据库页面 - 数据密集型
const DatabasePage = lazyWithPreload(() => import('@/pages/database/DatabasePage'))

// 🔒 P3-1: 用户/设置/通知 - 标准懒加载
const UserManagementPage = lazyWithPreload(() => import('@/pages/user/UserManagementPage'))
const SettingsPage = lazyWithPreload(() => import('@/pages/settings/SettingsPage'))
const NotificationPage = lazyWithPreload(() => import('@/pages/notification/NotificationPage'))
const WorkflowPage = lazyWithPreload(() => import('@/pages/workflow/WorkflowPage'))

// 🔒 P3-1: 管理员页面 - 大体积（含图表/审计功能）
const AuditLogPage = lazyWithPreload(() => import('@/pages/admin/AuditLogPage'))

// 🔒 P3-1: 404 页面 - 极小文件同步加载
const NotFoundPage = lazyWithPreload(() => import('@/pages/NotFoundPage'))

// 🔒 P3-1: SSS 企业级功能页面 - 大体积，懒加载
const AnalyticsPage = lazyWithPreload(() => import('@/pages/analytics/AnalyticsPage'))
const OrganizationsPage = lazyWithPreload(() => import('@/pages/organizations/OrganizationsPage'))
const IntegrationsPage = lazyWithPreload(() => import('@/pages/integrations/IntegrationsPage'))

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
  // 🔒 P2-4: 错误上报函数（生产环境可接入 Sentry）
  const handleErrorReport = (error: Error, errorInfo: React.ErrorInfo) => {
    // 开发环境输出到控制桌
    console.error('[App] Uncaught error:', error, errorInfo)

    // 生产环境上报（扩展点）
    if (import.meta.env.PROD) {
      // 例: fetch('/api/errors', { method: 'POST', body: JSON.stringify({...}) })
      // 或: window.Sentry?.captureException(error, { contexts: { react: errorInfo } })
    }
  }

  return (
    <ErrorBoundary
      onErrorReport={handleErrorReport}
      fallback={(error, reset) => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-red-50 to-white">
          <div className="text-center max-w-md p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">页面遇到了一些问题</h1>
            <p className="text-gray-600 mb-6">
              抱歉，页面在加载时发生了错误。请尝试刷新或返回首页。
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                onClick={reset}
              >
                重试
              </button>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                onClick={() => window.location.href = '/'}
              >
                返回首页
              </button>
              <button
                className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      )}
    >
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
