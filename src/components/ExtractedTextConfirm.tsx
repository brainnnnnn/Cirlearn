'use client';

import { useEffect, useState } from 'react';

interface ExtractedTextConfirmProps {
  extractedText: string;
  detectedSubject: 'math' | 'chinese' | 'english';
  confidence: number;       // 0.0 to 1.0
  isProcessing?: boolean;   // show loading state when VLM is still working
  error?: string | null;    // error from VLM processing
  onConfirm: (editedText: string) => void;
  onRetry: () => void;      // retry selection
  onCancel: () => void;
}

const SUBJECT_LABELS: Record<ExtractedTextConfirmProps['detectedSubject'], string> = {
  math: '数学',
  chinese: '语文',
  english: '英语',
};

const SUBJECT_BADGE_CLASSES: Record<ExtractedTextConfirmProps['detectedSubject'], string> = {
  math: 'bg-blue-50 text-blue-700',
  chinese: 'bg-amber-50 text-amber-700',
  english: 'bg-green-50 text-green-700',
};

export function ExtractedTextConfirm({
  extractedText,
  detectedSubject,
  confidence,
  isProcessing = false,
  error = null,
  onConfirm,
  onRetry,
  onCancel,
}: ExtractedTextConfirmProps) {
  const [editedText, setEditedText] = useState(extractedText);

  // Sync textarea when extractedText prop changes (e.g. after retry)
  useEffect(() => {
    setEditedText(extractedText);
  }, [extractedText]);

  // Esc key → cancel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const showLowConfidenceWarning = !isProcessing && !error && confidence < 0.7;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="extracted-text-title"
        className="rounded-2xl shadow-lg bg-background border border-border/20 w-full max-w-lg p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2
              id="extracted-text-title"
              className="text-sm font-semibold text-foreground"
            >
              识别结果
            </h2>
            {!isProcessing && !error && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUBJECT_BADGE_CLASSES[detectedSubject]}`}
              >
                {SUBJECT_LABELS[detectedSubject]}
              </span>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            aria-label="关闭"
            onClick={onCancel}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {isProcessing ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <svg
              className="animate-spin w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-sm text-muted-foreground">识别中…</span>
          </div>
        ) : error ? (
          /* Error state */
          <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-destructive mt-0.5" aria-hidden="true">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive mb-1">识别失败</p>
                <p className="text-xs text-destructive/80">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 text-xs px-3 py-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                >
                  重新圈选
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal state */
          <>
            {/* Low confidence warning */}
            {showLowConfidenceWarning && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-3 px-1">
                <span aria-hidden="true">⚠️</span>
                <span>
                  学科识别不确定（{Math.round(confidence * 100)}%），将根据问题内容智能判断
                </span>
              </div>
            )}

            {/* Editable textarea */}
            <textarea
              value={editedText}
              onChange={e => setEditedText(e.target.value)}
              aria-label="识别的文字内容"
              className="w-full text-sm min-h-[100px] rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              placeholder="识别结果将显示在这里…"
            />
          </>
        )}

        {/* Footer actions — hidden while loading or showing error */}
        {!isProcessing && !error && (
          <div className="flex gap-2 mt-4 justify-end">
            {/* Retry selection (secondary) */}
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-sm rounded-xl border border-border/50 bg-background hover:bg-muted/40 text-foreground transition-colors"
            >
              重新圈选
            </button>

            {/* Confirm (primary) */}
            <button
              type="button"
              onClick={() => onConfirm(editedText)}
              disabled={!editedText.trim()}
              className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              发送提问
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
