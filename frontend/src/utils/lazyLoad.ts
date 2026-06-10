import React, { Suspense, lazy } from 'react'
import type { ComponentType, ReactNode, ErrorInfo } from 'react'

export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ReactNode,
) {
  const LazyComponent = lazy(importFunc)

  function LazyWrapper(props: React.ComponentProps<T>) {
    return React.createElement(
      Suspense,
      { fallback: fallback || React.createElement(DefaultLoading) },
      React.createElement(LazyComponent, props),
    )
  }

  return LazyWrapper
}

export function DefaultLoading() {
  return React.createElement(
    'div',
    { className: 'flex items-center justify-center p-8' },
    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500' }),
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo)
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return React.createElement(
        'div',
        { className: 'p-4 bg-red-50 border border-red-200 rounded-lg' },
        React.createElement('h3', { className: 'text-red-800 font-semibold mb-2' }, 'Loading failed'),
        React.createElement('p', { className: 'text-red-600 text-sm' }, this.state.error?.message),
        React.createElement(
          'button',
          {
            onClick: () => this.setState({ hasError: false, error: null }),
            className: 'mt-2 px-4 py-1 bg-red-500 text-white rounded text-sm',
          },
          'Retry',
        ),
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary }
