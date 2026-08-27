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
import { createBrowserRouter, RouterProvider, Navigate, type LoaderFunction } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/queryClient';
import { useEffect, lazy, Suspense, type ReactNode } from 'react';

import { useAuthStore } from '@/stores/auth';
import LandingPage from '@/pages/landing/LandingPage';
import { UserRole } from '@/types/index';
import { ThemeProvider } from '@/stores/ThemeProvider';
import { RadixThemeProvider } from '@/theme/RadixThemeProvider';
import MainLayout from '@/components/layout/MainLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModuleErrorBoundary } from '@/components/ai/features';
import { ToastProvider } from '@/components/ui/Toast';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { ShortcutHelpProvider } from '@/hooks/useKeyboardShortcuts.tsx';

// 🔒 P3-1: 可预加载懒加载（空闲时预加载）
import { lazyWithPreload } from '@/components/LazyLoad.tsx';

// 🔒 P3-1: 关键页面直接导入，确保首屏加载速度
// 这些文件体积小，同步加载无影响首屏性能
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import RadixDemoPage from '@/pages/radix-demo/RadixDemoPage';


import { logger } from '@/utils/safeLogger';

// 🔒 P3-1: 公开信息页面（无需认证）
const DocsPage = lazyWithPreload(() => import('@/pages/public/DocsPage'));
const ApiDocsPage = lazyWithPreload(() => import('@/pages/public/ApiDocsPage'));
const FaqsPage = lazyWithPreload(() => import('@/pages/public/FaqsPage'));
const AboutPage = lazyWithPreload(() => import('@/pages/public/AboutPage'));
const CareersPage = lazyWithPreload(() => import('@/pages/public/CareersPage'));
const PrivacyPage = lazyWithPreload(() => import('@/pages/public/PrivacyPage'));

// 页面懒加载
const FormulaListPage = lazyWithPreload(() => import('@/pages/formula/FormulaListPage'));
const FormulaNewPage = lazyWithPreload(() => import('@/pages/formula/FormulaNewPage'));
const FormulaDetailPage = lazyWithPreload(() => import('@/pages/formula/FormulaDetailPage'));
const FormulaEditPage = lazyWithPreload(() => import('@/pages/formula/FormulaEditPage'));
const FormulaTemplatesPage = lazyWithPreload(() => import('@/pages/formula/FormulaTemplatesPage'));
const FormulaComparePage = lazyWithPreload(() => import('@/pages/formula/FormulaComparePage'));
const FormulaTestPage = lazyWithPreload(() => import('@/pages/formula/FormulaTestPage'));

// 🔒 P3-1: 数据管理 - 中等体积
const ExperimentListPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentListPage'));
const ExperimentDetailPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentDetailPage'));
const ExperimentNewPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentNewPage'));
const ExperimentEditPage = lazyWithPreload(() => import('@/pages/experiment/ExperimentEditPage'));

// 🔒 P3-1: AI 相关页面 - 大体积，懒加载
const AIAssistantPage = lazyWithPreload(() => import('@/pages/ai/AIAssistantPage'));
const AcademicReportPage = lazyWithPreload(() => import('@/pages/academic/AcademicReportPage'));

// 🔒 P3-1: 数据库页面 - 数据密集型
const DatabasePage = lazyWithPreload(() => import('@/pages/database/DatabasePage'));

// 🔒 术语管理页面
const TerminologyPage = lazyWithPreload(() => import('@/pages/terminology/TerminologyPage'));

// 🔒 P3-1: 用户/设置/通知 - 标准懒加载
const UserManagementPage = lazyWithPreload(() => import('@/pages/user/UserManagementPage'));
const SettingsPage = lazyWithPreload(() => import('@/pages/settings/SettingsPage'));
const NotificationPage = lazyWithPreload(() => import('@/pages/notification/NotificationPage'));
const WorkflowPage = lazyWithPreload(() => import('@/pages/workflow/WorkflowPage'));
const AgentPage = lazyWithPreload(() => import('@/pages/agent/AgentPage'));

// 🔒 P3-1: 管理员页面 - 大体积（含图表/审计功能）
const AuditLogPage = lazyWithPreload(() => import('@/pages/admin/AuditLogPage'));

// 🔒 P3-1: 404 页面 - 极小文件同步加载
const NotFoundPage = lazyWithPreload(() => import('@/pages/NotFoundPage'));

// 🔒 P3-1: Token 可视化文档页面
const TokenDocPage = lazyWithPreload(() => import('@/pages/TokenDocPage'));

// 🔒 P3-1: SSS 企业级功能页面 - 大体积，懒加载
const AnalyticsPage = lazyWithPreload(() => import('@/pages/analytics/AnalyticsPage'));
const OrganizationsPage = lazyWithPreload(() => import('@/pages/organizations/OrganizationsPage'));
const IntegrationsPage = lazyWithPreload(() => import('@/pages/integrations/IntegrationsPage'));

/**
 * 页面过渡动画 — 已移至 MainLayout 内部，避免双重嵌套
 * App.tsx 不再包裹 PageTransition
 */

/* ═══════════════════════════════════════════
   路由守卫组件
   ═══════════════════════════════════════════ */

/**
 * 认证守卫：未登录跳转到登录页 + 登录后 fetchUser
 * ✅ 修复：添加 isLoading 检查，避免 Zustand persist 异步恢复导致的竞态条件
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, fetchUser, isLoading]);

  // ✅ 关键修复：如果正在加载（persist 还没恢复），显示 loading 而不是立即重定向
  if (isLoading) {
    return <LoadingComponent />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * 已登录守卫：登录后跳转到仪表盘
 */
function GuestGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * 管理员权限守卫：非管理员跳转到仪表盘
 * ✅ 修复：添加 isLoading + user=null 检查，避免 persist 异步恢复导致的竞态条件
 * ✅ 修复：角色比较使用 toUpperCase() 兼容 API 返回的小写 'admin'
 */
function AdminGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isLoading) {
    return <LoadingComponent />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <LoadingComponent />;
  }

  if ((user.role as string).toUpperCase() !== UserRole.ADMIN) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// 加载组件，用于Suspense的fallback
const LoadingComponent = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div
        className="inline-block rounded-full h-8 w-8 border-t-2 border-b-2 animate-spin mb-4"
        style={{
          borderColor: 'var(--color-primary-600, var(--color-primary, #34C759))',
          borderTopColor: 'var(--color-primary, #34C759)',
        }}
      ></div>
      <p className="text-neutral-600 dark:text-neutral-400">加载中...</p>
    </div>
  </div>
);

/**
 * 根路径组件 — 未登录展示着陆页，已登录跳转仪表盘
 */
function RootRoute() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <LandingPage />;
  return <Navigate to="/dashboard" replace />;
}

/* ═══════════════════════════════════════════
   路由配置 (react-router-dom v7)
   ═══════════════════════════════════════════ */

const router = createBrowserRouter([
  // 公开路由 — 登录页
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LoginPage />
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
  // 公开路由 — 公官网着陆页
  {
    path: '/landing',
    element: <LandingPage />,
  },
  // 公开路由 — 信息页面
  { path: '/docs',   element: <DocsPage /> },
  { path: '/api-docs', element: <ApiDocsPage /> },
  { path: '/faqs',   element: <FaqsPage /> },
  { path: '/about',  element: <AboutPage /> },
  { path: '/careers', element: <CareersPage /> },
  { path: '/privacy', element: <PrivacyPage /> },

  // 受保护路由 — 带 MainLayout 布局
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { path: 'formula', element: <Navigate to="/formulas" replace /> },
      { index: true, element: <RootRoute /> },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'radix-demo',
        element: <RadixDemoPage />,
      },

      // 配方管理
      {
        path: 'formulas',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ModuleErrorBoundary moduleName="配方列表">
              <FormulaListPage />
            </ModuleErrorBoundary>
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
            <ModuleErrorBoundary moduleName="配方详情">
              <FormulaDetailPage />
            </ModuleErrorBoundary>
          </Suspense>
        ),
      },
      {
        path: 'formulas/:id/edit',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <ModuleErrorBoundary moduleName="配方编辑">
              <FormulaEditPage />
            </ModuleErrorBoundary>
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
        path: 'terminology',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <TerminologyPage />
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
      {
        path: 'agent',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AgentPage />
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
      {
        path: 'tokens',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <TokenDocPage />
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
            <ModuleErrorBoundary moduleName="设置">
              <SettingsPage />
            </ModuleErrorBoundary>
          </Suspense>
        ),
      },

      // 管理员路由
      {
        path: 'users',
        element: (
          <Suspense fallback={<LoadingComponent />}>
            <AdminGuard>
              <ModuleErrorBoundary moduleName="用户管理">
                <UserManagementPage />
              </ModuleErrorBoundary>
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
    ],
  },

  // 兜底
  { path: '*', element: <Navigate to="/404" replace /> },
]);

/* ═══════════════════════════════════════════
   应用根组件
   ═══════════════════════════════════════════ */

export default function App() {
  // 🔒 P2-4: 错误上报函数（生产环境可接入 Sentry）
  const handleErrorReport = (error: Error, errorInfo: React.ErrorInfo) => {
    // 开发环境输出到控制桌
    logger.error('[App] Uncaught error: %s | %s', String(error), String(errorInfo));

    // 生产环境上报（扩展点）
    if (import.meta.env.PROD) {
      // 例: fetch('/api/errors', { method: 'POST', body: JSON.stringify({...}) })
      // 或: window.Sentry?.captureException(error, { contexts: { react: errorInfo } })
    }
  };

  return (
    <ErrorBoundary
      fallback={<div className="flex items-center justify-center min-h-screen"><p>页面加载失败，请刷新重试</p></div>}
    >
      <RadixThemeProvider>
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
      </RadixThemeProvider>
    </ErrorBoundary>
  );
}
