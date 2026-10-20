import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, Camera, X, Loader2, Image as ImageIcon, Sparkles, RefreshCw } from 'lucide-react';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

interface AvatarUploadProps {
  avatarUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onGenerate?: () => void;
  generating?: boolean;
  uploading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  onSelect,
  onRemove,
  onGenerate,
  generating = false,
  uploading = false,
  error,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading && !generating) {
      inputRef.current?.click();
    }
  }, [disabled, uploading, generating]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading && !generating) {
      setIsDragging(true);
    }
  }, [disabled, uploading, generating]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && !uploading && !generating) {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onSelect(file);
      }
    }
  }, [disabled, uploading, generating, onSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file);
    }
    e.target.value = '';
  }, [onSelect]);

  const canInteract = !disabled && !uploading && !generating;
  const displaySrc = resolveAvatarUrl(avatarUrl);

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'relative w-32 h-32 rounded-[var(--radius-pill)] overflow-hidden cursor-pointer transition-all duration-200',
          'ring-4 ring-offset-4',
          isDragging
            ? 'ring-[var(--color-primary)] bg-[var(--color-primary-container)] scale-105'
            : 'ring-neutral-200 dark:ring-neutral-700 hover:ring-[var(--color-primary)] hover:scale-105',
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
        {uploading || generating ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-tertiary)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-text)]0" />
          </div>
        ) : displaySrc ? (
          <>
            <img
              src={displaySrc}
              alt="头像预览"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {isDragging ? (
              <Upload className="w-8 h-8 mb-1 text-[var(--color-primary-text)]0" />
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

      {/* 操作区：上传 / 自动生成 / 移除 */}
      <div className="mt-[var(--space-apple-sm)] flex flex-wrap items-center justify-center gap-2">
        {onGenerate && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
            disabled={uploading || generating}
            className={cn(
              'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-[var(--space-apple-sm)] py-1 text-xs font-medium transition-colors',
              'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]0/15 dark:text-[var(--color-primary-text)]',
              'hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]0/25',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {avatarUrl ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {avatarUrl ? '换一个' : '自动生成'}
          </button>
        )}

        {canInteract && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && !uploading) inputRef.current?.click();
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-[var(--space-apple-sm)] py-1 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors"
          >
            <Upload className="w-3 h-3" />
            上传
          </button>
        )}

        {displaySrc && !uploading && !generating && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-[var(--space-apple-sm)] py-1 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-danger-500 transition-colors"
          >
            <X className="w-3 h-3" />
            移除
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger-500 text-center">{error}</p>
      )}

      <p className="mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        支持 JPG、PNG、WebP，不超过 2MB；或一键自动生成
      </p>
    </div>
  );
};