'use client';

import { useRef, useState, useEffect } from 'react';
import { validateImageFile } from '@/lib/image-utils';

interface ImageUploadButtonProps {
  onImageSelect: (file: File) => void;
  disabled?: boolean;
}

export function ImageUploadButton({ onImageSelect, disabled = false }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  function showError(message: string) {
    setError(message);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => {
      setError(null);
    }, 5000);
  }

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';

    if (!file) return;

    const result = validateImageFile(file);
    if (!result.valid) {
      const errorType = result.error?.type;
      if (errorType === 'file-size') {
        showError('图片大小不能超过10MB，请选择更小的图片');
      } else if (errorType === 'file-format') {
        showError('不支持的文件格式，请选择 JPG、PNG、WebP 或 HEIC 图片');
      } else {
        showError('无法读取文件，请重试');
      }
      return;
    }

    // Clear any existing error and emit the validated file
    setError(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    onImageSelect(file);
  }

  return (
    <div className="relative flex flex-col items-end">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Upload button */}
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        aria-label="上传图片"
        className="flex items-center justify-center w-[42px] h-[42px] rounded-xl border border-border/50 hover:bg-muted/50 transition-colors disabled:opacity-40 shrink-0"
      >
        {/* Camera / upload SVG icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Camera body */}
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          {/* Lens */}
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>

      {/* Inline error message */}
      {error && (
        <div
          role="alert"
          className="absolute bottom-full mb-2 right-0 w-max max-w-[220px] text-xs text-destructive bg-background border border-destructive/30 rounded-lg px-2.5 py-1.5 shadow-sm"
        >
          {error}
        </div>
      )}
    </div>
  );
}
