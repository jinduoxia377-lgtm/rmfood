/**
 * 移动端容器组件
 *
 * 自动适配移动端布局，处理安全区域
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Stub hooks - the actual implementation lives in ../hooks/useMobile
function useBreakpoint() {
  return { isMobile: false, isDesktop: true };
}

function useSafeArea() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
  /** 是否启用安全区域适配 */
  safeArea?: boolean;
  /** 最大内容宽度（桌面端） */
  maxWidth?: number;
}

export default function MobileContainer({
  children,
  className,
  safeArea = true,
  maxWidth = 1200,
}: MobileContainerProps) {
  const { isMobile, isDesktop } = useBreakpoint();
  const insets = useSafeArea();

  return (
    <div
      className={cn('w-full mx-auto', isMobile ? 'px-4' : 'px-6', className)}
      style={{
        maxWidth: isDesktop ? maxWidth : undefined,
        paddingTop: safeArea ? insets.top : undefined,
        paddingBottom: safeArea ? insets.bottom : undefined,
        paddingLeft: safeArea && isMobile ? insets.left : undefined,
        paddingRight: safeArea && isMobile ? insets.right : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * 底部弹出面板（移动端）
 */

import { useState, useRef, useEffect } from 'react';
import { X, ChevronUp } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: string | number;
  /** 是否可拖拽调整高度 */
  draggable?: boolean;
}

export function BottomSheet({ open, onClose, title, children, height = '70%', draggable = true }: BottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(height);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const startHeight = useRef<number>(typeof height === 'number' ? height : parseInt(height, 10));

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!draggable) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    startHeight.current = typeof sheetHeight === 'number' ? sheetHeight : Number(sheetHeight);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!draggable || !dragStartY.current) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY.current - clientY;
    const newHeight = Math.max(30, Math.min(90, startHeight.current + (deltaY / window.innerHeight) * 100));
    setSheetHeight(`${newHeight}%`);
  };

  const handleDragEnd = () => {
    dragStartY.current = 0;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />

      {/* 面板 */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-lg bg-white dark:bg-neutral-800 rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ height: sheetHeight }}
      >
        {/* 拖拽手柄 */}
        {draggable && (
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:grabbing touch-none"
            onPointerDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </div>
        )}

        {/* 标题栏 */}
        {(title || true) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            {title && <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <X size={20} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </button>
          </div>
        )}

        {/* 内容区 */}
        <div className="overflow-y-auto overscroll-contain" style={{ height: 'calc(100% - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * 下拉刷新组件
 */

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  /** 自定义刷新提示 */
  pullDownText?: string;
  refreshingText?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  pullDownText = '下拉刷新',
  refreshingText = '正在刷新...',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    // 仅在顶部且滚动位置为0时触发
    const container = containerRef.current;
    if (container?.scrollTop === 0) {
      setPullDistance(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const touch = e.touches[0];
    const distance = Math.max(0, touch.clientY - (container.getBoundingClientRect().top + 60));
    setPullDistance(Math.min(distance, 100)); // 最大100px
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto overscroll-contain"
      style={{ height: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 刷新指示器 */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center h-12 transition-transform duration-200"
        style={{
          transform: `translateY(${Math.min(pullDistance * 0.5, 40)}px)`,
          opacity: pullDistance > 20 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-700">
          {isRefreshing ? (
            <>
              <div className="w-4 h-4 border-2 border-secondary-600 border-t-transparent rounded-full animate-spin" />
              {refreshingText}
            </>
          ) : (
            <>
              <ChevronUp size={16} />
              {pullDistance > 60 ? '释放立即刷新' : pullDownText}
            </>
          )}
        </div>
      </div>

      {/* 内容 */}
      {children}
    </div>
  );
}

