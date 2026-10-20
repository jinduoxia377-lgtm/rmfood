/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 中药材图片组件
 * 根据药材名称显示对应图片
 */
import { useState, useEffect } from 'react';
import { databaseApi } from '@/api/database';

interface HerbImageProps {
  herbName: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

// 默认药材图标（SVG）
const DEFAULT_HERB_ICON = (
  <svg className="w-full h-full text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    <path d="M8 12l2-6 2 6-2 6-2-6z" />
    <path d="M12 12l2-6 2 6-2 6-2-6z" />
  </svg>
);

export function HerbImage({ herbName, className = '', fallbackIcon = DEFAULT_HERB_ICON }: HerbImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!herbName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 空名称时同步结束加载态是预期行为
      setIsLoading(false);
      return;
    }

    // 查找药材图片URL
    databaseApi
      .get(`/herbs/image-url/${encodeURIComponent(herbName)}`)
      .then((data: any) => {
        if (data?.image_url) {
          setImageUrl(data.image_url);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [herbName]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg ${className}`}>
        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-lg ${className}`}>
        {fallbackIcon}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={herbName}
      className={`${className} object-cover rounded-lg`}
      onError={() => setError(true)}
    />
  );
}

// 批量药材图片列表
export function HerbImageList({ herbs, className = '' }: { herbs: any[]; className?: string }) {
  return (
    <div className={`grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 ${className}`}>
      {herbs.map((herb) => (
        <HerbImage
          key={herb.id || herb.name_cn}
          herbName={herb.name_cn}
          className="w-16 h-16"
        />
      ))}
    </div>
  );
}
