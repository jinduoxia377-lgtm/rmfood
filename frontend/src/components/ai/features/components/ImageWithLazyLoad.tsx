/**
 * ImageWithLazyLoad - 图片懒加载组件
 *
 * 使用 Intersection Observer API 实现图片的按需加载
 * 特性：
 * - 进入视口前 100px 开始加载（提前预加载）
 * - 加载时显示骨架屏动画
 * - 支持自定义占位符和错误状态
 * - 自动断开 Observer 避免内存泄漏
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useRef, useState, useEffect } from 'react'

interface ImageWithLazyLoadProps {
  /** 图片地址 */
  src: string
  /** 替代文本 */
  alt: string
  /** 自定义类名 */
  className?: string
  /** 容器样式 */
  containerStyle?: React.CSSProperties
  /** 图片样式 */
  imageStyle?: React.CSSProperties
  /** 提前加载距离（默认100px） */
  rootMargin?: string
  /** 是否使用原生 loading="lazy" */
  useNativeLazy?: boolean
  /** 占位符组件 */
  placeholder?: React.ReactNode
  /** 错误状态组件 */
  errorComponent?: React.ReactNode
  /** 加载完成回调 */
  onLoad?: () => void
  /** 加载失败回调 */
  onError?: () => void
}

export const ImageWithLazyLoad: React.FC<ImageWithLazyLoadProps> = ({
  src,
  alt,
  className = '',
  containerStyle,
  imageStyle,
  rootMargin = '100px',
  useNativeLazy = false,
  placeholder,
  errorComponent,
  onLoad,
  onError,
}) => {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(useNativeLazy)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (useNativeLazy || isVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        rootMargin,
        threshold: 0,
      },
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [rootMargin, useNativeLazy, isVisible])

  const handleLoad = () => {
    setIsLoaded(true)
    setHasError(false)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(false)
    onError?.()
  }

  const defaultPlaceholder = (
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 bg-[length:200%_100%] animate-shimmer" />
  )

  const defaultError = (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={containerStyle}
      data-testid="lazy-image-container"
    >
      {!isLoaded && !hasError && (placeholder || defaultPlaceholder)}

      {hasError && (errorComponent || defaultError)}

      {(isVisible || useNativeLazy) && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={useNativeLazy ? 'lazy' : 'eager'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  )
}

export default ImageWithLazyLoad
