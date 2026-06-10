import React, { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'

export const lazyWithPreload = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) => {
  const LazyComponent = lazy(factory)

  function ComponentWithPreload(props: any) {
    return React.createElement(
      Suspense,
      { fallback: React.createElement('div', { className: 'animate-pulse bg-gray-200 h-20 rounded' }) },
      React.createElement(LazyComponent, props),
    )
  }

  (ComponentWithPreload as any).preload = factory

  return ComponentWithPreload
}

export const preloadRoute = (path: string) => {
  const routeComponents: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('../pages/dashboard/DashboardPage'),
    '/ai': () => import('../pages/ai/AIAssistantPage'),
  }

  if (routeComponents[path]) {
    routeComponents[path]()
  }
}

export const useLazyRoute = () => {
  return { preloadRoute }
}
