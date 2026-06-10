import { useState, useRef, useCallback, useEffect } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight?: number;
  className?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight = 500,
  className = '',
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleStartIndex = Math.floor(scrollTop / itemHeight);
  const visibleEndIndex = Math.min(
    visibleStartIndex + Math.ceil(containerHeight / itemHeight) + 2,
    items.length,
  );

  const offsetTop = visibleStartIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    setScrollTop(0);
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        className="relative"
        style={{ height: items.length * itemHeight }}
      >
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            transform: `translateY(${offsetTop}px)`,
          }}
        >
          {items.slice(visibleStartIndex, visibleEndIndex).map((item, index) => (
            <div
              key={`${item}-${visibleStartIndex + index}`}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleStartIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
