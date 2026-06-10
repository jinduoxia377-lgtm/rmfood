import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: (index: number) => number;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
  getItemKey?: (index: number, item: T) => string | number;
  onScrollEnd?: () => void;
  scrollThreshold?: number;
}

export interface VirtualListHandle {
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  refresh: () => void;
}

const DEFAULT_ESTIMATE_SIZE = 50;
const DEFAULT_OVERSCAN = 5;

function VirtualList<T>(
  {
    items,
    renderItem,
    estimateSize = () => DEFAULT_ESTIMATE_SIZE,
    overscan = DEFAULT_OVERSCAN,
    className = '',
    style,
    height = '100%',
    getItemKey,
    onScrollEnd,
    scrollThreshold = 100,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isNearEnd, setIsNearEnd] = useState(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemElement: (index: number) => {
      if (!parentRef.current) return null;
      return parentRef.current.querySelector(`[data-index="${index}"]`)!;
    },
  });

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
      virtualizer.scrollToIndex(index, { align });
    },
    scrollToTop: () => {
      virtualizer.scrollToIndex(0);
    },
    scrollToBottom: () => {
      virtualizer.scrollToIndex(items.length - 1);
    },
    refresh: () => {
      virtualizer.measure();
    },
  }));

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!onScrollEnd || !parentRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < scrollThreshold;

      if (isAtBottom && !isNearEnd) {
        setIsNearEnd(true);
        onScrollEnd();
      } else if (!isAtBottom) {
        setIsNearEnd(false);
      }
    },
    [onScrollEnd, scrollThreshold, isNearEnd],
  );

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={`virtual-list-container ${className}`}
      style={{
        height,
        overflow: 'auto',
        position: 'relative',
        ...style,
      }}
      onScroll={handleScroll}
      data-testid="virtual-list"
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = getItemKey ? getItemKey(virtualItem.index, item) : virtualItem.index;

          return (
            <div
              key={key}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VirtualListForwarded = forwardRef(VirtualList) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListHandle> }
) => React.ReactElement;

export default VirtualListForwarded;

export function createVirtualizedComponent<T>(config: {
  name: string;
  estimateSize?: (index: number) => number;
  overscan?: number;
}) {
  return React.forwardRef<VirtualListHandle, Omit<VirtualListProps<T>, 'estimateSize' | 'overscan'>>(
    (props, ref) => {
      return (
        <VirtualListForwarded<T>
          {...props}
          ref={ref}
          estimateSize={config.estimateSize}
          overscan={config.overscan}
          data-component={config.name}
        />
      );
    },
  );
}
