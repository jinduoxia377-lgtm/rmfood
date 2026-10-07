import { useState, useRef, useCallback } from 'react';
import { useIntersectionObserver } from '@/hooks/usePerformance';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3C/svg%3E',
  width,
  height,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback((isIntersecting: boolean) => {
    if (isIntersecting && !isLoaded && !hasError) {
      setIsLoaded(true);
    }
  }, [isLoaded, hasError]);

  const setRef = useIntersectionObserver<HTMLDivElement>(handleIntersect, {
    rootMargin: '100px',
  });

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      setRef(node);
      if (node) {
        Object.assign(imgRef, { current: node });
      }
    },
    [setRef],
  );

  const handleImageLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      ref={handleRef}
      className={`relative overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${className}`}
      style={{ width, height }}
    >
      {!isLoaded && !hasError && (
        <img
          src={placeholder}
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      )}

      {isLoaded && (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{
            opacity: isLoaded ? 1 : 0,
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      {hasError && (
        <div className="flex items-center justify-center w-full h-full bg-neutral-100 dark:bg-neutral-800">
          <svg
            className="w-8 h-8 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
