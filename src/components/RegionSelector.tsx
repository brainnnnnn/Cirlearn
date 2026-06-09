'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Rectangle } from '@/types/image-upload';
import { isValidSelection, cropImage } from '@/lib/image-utils';

interface RegionSelectorProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  onSelectionComplete: (croppedDataUrl: string, coordinates: Rectangle) => void;
  disabled?: boolean;
}

type HandlePosition = 'tl' | 'tr' | 'bl' | 'br';

interface DragState {
  type: 'draw' | 'handle';
  startX: number;
  startY: number;
  // For handle dragging — snapshot of the rect at drag-start
  initialRect?: Rectangle;
  handle?: HandlePosition;
}

/** Clamp a value within [min, max] */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Normalise a rectangle so width/height are always positive */
function normalise(rect: Rectangle): Rectangle {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  return { x, y, width: Math.abs(rect.width), height: Math.abs(rect.height) };
}

/** Clamp a normalised rect to the image bounds */
function clampToBounds(rect: Rectangle, imgW: number, imgH: number): Rectangle {
  const x = clamp(rect.x, 0, imgW);
  const y = clamp(rect.y, 0, imgH);
  const width = clamp(rect.width, 0, imgW - x);
  const height = clamp(rect.height, 0, imgH - y);
  return { x, y, width, height };
}

/**
 * Convert a pointer event position to coordinates relative to the image element.
 */
function toImageCoords(
  clientX: number,
  clientY: number,
  imageEl: HTMLImageElement
): { x: number; y: number } {
  const rect = imageEl.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function RegionSelector({ imageRef, onSelectionComplete, disabled = false }: RegionSelectorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Rectangle | null>(null);
  const [isValid, setIsValid] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // Revalidate whenever selection changes
  useEffect(() => {
    if (!selection || !imageRef.current) {
      setIsValid(false);
      return;
    }
    const img = imageRef.current;
    setIsValid(isValidSelection(selection, img.offsetWidth, img.offsetHeight));
  }, [selection, imageRef]);

  // ── Pointer helpers ────────────────────────────────────────────────────────

  const getImageEl = useCallback((): HTMLImageElement | null => {
    return imageRef.current ?? null;
  }, [imageRef]);

  // ── Mouse events ───────────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const img = getImageEl();
    if (!img) return;
    const { x, y } = toImageCoords(e.clientX, e.clientY, img);
    dragRef.current = { type: 'draw', startX: x, startY: y };
    setIsDragging(true);
    setSelection({ x, y, width: 0, height: 0 });
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const img = getImageEl();
    if (!img) return;
    const { x, y } = toImageCoords(e.clientX, e.clientY, img);
    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;

    if (drag.type === 'draw') {
      const raw: Rectangle = {
        x: drag.startX,
        y: drag.startY,
        width: x - drag.startX,
        height: y - drag.startY,
      };
      setSelection(clampToBounds(normalise(raw), imgW, imgH));
    } else if (drag.type === 'handle' && drag.initialRect && drag.handle) {
      setSelection(computeHandleDrag(drag.initialRect, drag.handle, x, y, imgW, imgH));
    }
  }

  function onMouseUp() {
    dragRef.current = null;
    setIsDragging(false);
  }

  // ── Touch events ───────────────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const img = getImageEl();
    if (!img) return;
    const { x, y } = toImageCoords(touch.clientX, touch.clientY, img);
    dragRef.current = { type: 'draw', startX: x, startY: y };
    setIsDragging(true);
    setSelection({ x, y, width: 0, height: 0 });
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    e.preventDefault(); // prevent page scroll while drawing
    const drag = dragRef.current;
    if (!drag || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const img = getImageEl();
    if (!img) return;
    const { x, y } = toImageCoords(touch.clientX, touch.clientY, img);
    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;

    if (drag.type === 'draw') {
      const raw: Rectangle = {
        x: drag.startX,
        y: drag.startY,
        width: x - drag.startX,
        height: y - drag.startY,
      };
      setSelection(clampToBounds(normalise(raw), imgW, imgH));
    } else if (drag.type === 'handle' && drag.initialRect && drag.handle) {
      setSelection(computeHandleDrag(drag.initialRect, drag.handle, x, y, imgW, imgH));
    }
  }

  function onTouchEnd() {
    dragRef.current = null;
    setIsDragging(false);
  }

  // ── Handle drag (corner handles for resizing) ──────────────────────────────

  function onHandleMouseDown(e: React.MouseEvent, handle: HandlePosition) {
    e.stopPropagation();
    e.preventDefault();
    const img = getImageEl();
    if (!img || !selection) return;
    const { x, y } = toImageCoords(e.clientX, e.clientY, img);
    dragRef.current = {
      type: 'handle',
      startX: x,
      startY: y,
      initialRect: { ...selection },
      handle,
    };
  }

  function onHandleTouchStart(e: React.TouchEvent, handle: HandlePosition) {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const img = getImageEl();
    if (!img || !selection) return;
    const { x, y } = toImageCoords(touch.clientX, touch.clientY, img);
    dragRef.current = {
      type: 'handle',
      startX: x,
      startY: y,
      initialRect: { ...selection },
      handle,
    };
  }

  // ── Confirm selection ──────────────────────────────────────────────────────

  async function handleConfirm() {
    const img = getImageEl();
    if (!img || !selection || !isValid || isExtracting) return;

    // Scale display coords → natural image coords
    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;
    const naturalCoords: Rectangle = {
      x: Math.round(selection.x * scaleX),
      y: Math.round(selection.y * scaleY),
      width: Math.round(selection.width * scaleX),
      height: Math.round(selection.height * scaleY),
    };

    try {
      setIsExtracting(true);
      // img.src is the data URL rendered in the page
      const croppedDataUrl = await cropImage(img.src, naturalCoords);
      onSelectionComplete(croppedDataUrl, naturalCoords);
    } finally {
      setIsExtracting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const sel = selection;

  return (
    // The overlay fills the parent container absolutely (parent must be position: relative)
    <div
      ref={overlayRef}
      className={`absolute inset-0 select-none ${disabled ? 'cursor-not-allowed opacity-40 pointer-events-none' : 'cursor-crosshair'}`}
      onMouseDown={disabled ? undefined : onMouseDown}
      onMouseMove={disabled ? undefined : onMouseMove}
      onMouseUp={disabled ? undefined : onMouseUp}
      onMouseLeave={disabled ? undefined : onMouseUp}
      onTouchStart={disabled ? undefined : onTouchStart}
      onTouchMove={disabled ? undefined : onTouchMove}
      onTouchEnd={disabled ? undefined : onTouchEnd}
    >
      {/* Selection rectangle */}
      {sel && sel.width > 0 && sel.height > 0 && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-500/20 pointer-events-none"
          style={{
            left: sel.x,
            top: sel.y,
            width: sel.width,
            height: sel.height,
          }}
        >
          {/* Corner handles — rendered inside the selection div so coords are relative */}
          {(
            [
              { pos: 'tl', style: { top: -6, left: -6 } },
              { pos: 'tr', style: { top: -6, right: -6 } },
              { pos: 'bl', style: { bottom: -6, left: -6 } },
              { pos: 'br', style: { bottom: -6, right: -6 } },
            ] as Array<{ pos: HandlePosition; style: React.CSSProperties }>
          ).map(({ pos, style }) => (
            <div
              key={pos}
              className="w-3 h-3 bg-blue-500 rounded-full absolute cursor-pointer pointer-events-auto"
              style={style}
              onMouseDown={e => onHandleMouseDown(e, pos)}
              onTouchStart={e => onHandleTouchStart(e, pos)}
            />
          ))}
        </div>
      )}

      {/* Invalid selection warning */}
      {sel && sel.width > 0 && sel.height > 0 && !isValid && !isDragging && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200 whitespace-nowrap pointer-events-none"
          style={{ zIndex: 10 }}
        >
          选区太小，请重新选择
        </div>
      )}

      {/* Confirm button — anchored to bottom-right corner of the selection */}
      {sel && isValid && !isDragging && (
        <button
          className="absolute px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-md"
          style={{
            left: sel.x + sel.width + 6,
            top: sel.y + sel.height - 32,
            zIndex: 10,
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={handleConfirm}
          disabled={isExtracting}
        >
          {isExtracting ? '识别中…' : '识别'}
        </button>
      )}
    </div>
  );
}

// ── Handle-drag computation ────────────────────────────────────────────────────

/**
 * Given the initial rectangle, which corner handle is being dragged,
 * and the current cursor position (in image display coordinates),
 * return the updated rectangle clamped to the image bounds.
 */
function computeHandleDrag(
  initial: Rectangle,
  handle: HandlePosition,
  curX: number,
  curY: number,
  imgW: number,
  imgH: number
): Rectangle {
  const right = initial.x + initial.width;
  const bottom = initial.y + initial.height;

  let newX = initial.x;
  let newY = initial.y;
  let newRight = right;
  let newBottom = bottom;

  if (handle === 'tl') {
    newX = curX;
    newY = curY;
  } else if (handle === 'tr') {
    newRight = curX;
    newY = curY;
  } else if (handle === 'bl') {
    newX = curX;
    newBottom = curY;
  } else if (handle === 'br') {
    newRight = curX;
    newBottom = curY;
  }

  // Normalise in case user dragged past the opposite edge
  const x = Math.min(newX, newRight);
  const y = Math.min(newY, newBottom);
  const width = Math.abs(newRight - newX);
  const height = Math.abs(newBottom - newY);

  return clampToBounds({ x, y, width, height }, imgW, imgH);
}
