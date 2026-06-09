'use client';

import { useEffect, useRef } from 'react';
import type { Rectangle } from '@/types/image-upload';
import { RegionSelector } from './RegionSelector';

interface ImagePreviewProps {
  imageSrc: string; // data URL of the uploaded image
  onRegionSelect: (croppedDataUrl: string, coordinates: Rectangle) => void;
  onClose: () => void;
}

export function ImagePreview({ imageSrc, onRegionSelect, onClose }: ImagePreviewProps) {
  const imageRef = useRef<HTMLImageElement>(null);

  // Trap Esc key to call onClose
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // Backdrop: fixed full-screen dark overlay with backdrop blur
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-preview-title"
        className="relative flex flex-col gap-4 w-full max-w-[860px] max-h-[90vh] rounded-2xl shadow-lg bg-background border border-border/20 p-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>

        {/* Header */}
        <div className="pr-8">
          <h2
            id="image-preview-title"
            className="text-sm font-semibold text-foreground"
          >
            圈选题目区域
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            拖拽选择题目区域，点击确认识别
          </p>
        </div>

        {/* Image container — must be position: relative so RegionSelector (absolute) overlays correctly */}
        <div className="relative flex items-center justify-center overflow-auto">
          <div className="relative inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="上传的题目图片"
              className="block max-w-full w-auto h-auto object-contain rounded-lg"
              style={{ maxWidth: 'min(860px, 90vw)', maxHeight: 'calc(90vh - 120px)' }}
              draggable={false}
            />
            {/* RegionSelector overlays the image */}
            <RegionSelector
              imageRef={imageRef}
              onSelectionComplete={onRegionSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
