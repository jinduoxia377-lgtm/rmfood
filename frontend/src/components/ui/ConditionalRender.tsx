import { useState, useEffect } from 'react';

interface ConditionalRenderProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
}

export function ConditionalRender({
  condition,
  children,
  fallback = null,
  delay = 0,
}: ConditionalRenderProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (condition) {
      const timer = setTimeout(() => {
        setIsRendered(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsRendered(false);
    }
  }, [condition, delay]);

  if (!condition) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="transition-opacity duration-200"
      style={{
        opacity: isRendered ? 1 : 0,
        pointerEvents: isRendered ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

interface DebouncedRenderProps {
  value: unknown;
  children: React.ReactNode;
  delay?: number;
}

export function DebouncedRender({
  value,
  children,
  delay = 300,
}: DebouncedRenderProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  if (value !== debouncedValue) {
    return null;
  }

  return <>{children}</>;
}
