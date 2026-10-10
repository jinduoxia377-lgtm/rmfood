import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface AvatarUploadProps {
  avatarUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  uploading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  onSelect,
  onRemove,
  uploading = false,
  error,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  }, [disabled, uploading]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  }, [disabled, uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && !uploading) {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onSelect(file);
      }
    }
  }, [disabled, uploading, onSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file);
    }
    e.target.value = '';
  }, [onSelect]);

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'relative w-32 h-32 rounded-full overflow-hidden cursor-pointer transition-all duration-200',
          'ring-4 ring-offset-4',
          isDragging
            ? 'ring-primary-400 bg-primary-50 dark:bg-primary-300/20 scale-105'
            : 'ring-neutral-200 dark:ring-neutral-700 hover:ring-primary-400 hover:scale-105',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'ring-danger-400',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="上传头像"
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : avatarUrl ? (
          <>
            <img
              src={avatarUrl}
              alt="头像预览"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
            {isDragging ? (
              <Upload className="w-8 h-8 mb-1 text-primary-500" />
            ) : (
              <ImageIcon className="w-8 h-8 mb-1" />
            )}
            <span className="text-xs">
              {isDragging ? '松开上传' : '点击上传'}
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled} aria-hidden="true" tabIndex={-1} />
      </div>

      {avatarUrl && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="mt-2 flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-danger-500 transition-colors"
        >
          <X className="w-3 h-3" />
          移除图片
        </button>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger-500 text-center">{error}</p>
      )}

      <p className="mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        支持 JPG、PNG、WebP，不超过 2MB
      </p>
    </div>
  );
};
