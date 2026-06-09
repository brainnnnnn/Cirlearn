'use client';

import { useState } from 'react';
import { WidgetRenderer } from './WidgetRenderer';
import { parseContent, type ParsedSegment } from '@/lib/heading-parser';
import { ProblemContextCard, ThinkingCard, StepByStepCard, AnswerCard, FormulaCard, TextCard, WordInfoCard } from './cards';
import type { MessageSegment, IntentResult } from '@/hooks/useStreamingChat';
import type { Intent } from '@/types/image-upload';

interface MessageItemProps {
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];
  isStreaming?: boolean;
  error?: string;
  intentName?: string;
  // user bubble extras
  imageThumb?: string;
  // assistant state machine
  assistantState?: 'vlm-loading' | 'intent-select' | 'results';
  intents?: Intent[];
  results?: Record<number, IntentResult>;
  activeResultIndex?: number;
  onIntentSelect?: (index: number) => void;
}

function CardSegment({ segment, isStreaming = false, isLast = false }: { segment: ParsedSegment; isStreaming?: boolean; isLast?: boolean }) {
  const cursor = isStreaming && isLast
    ? <span className="inline-block w-1.5 h-3.5 bg-foreground/40 animate-pulse rounded-sm align-middle ml-0.5" />
    : null;
  if (segment.type === 'card' && !segment.content.trim()) return null;

  if (segment.type === 'widget' && segment.widgetCode) {
    return <WidgetRenderer widgetCode={segment.widgetCode} isStreaming={false} title={segment.widgetTitle} />;
  }

  if (segment.type === 'text') {
    return <TextCard content={segment.content} />;
  }

  switch (segment.cardType) {
    case 'problem_context': return <ProblemContextCard content={segment.content} />;
    case 'thinking':        return <ThinkingCard content={segment.content} />;
    case 'step_by_step':    return <StepByStepCard content={segment.content} />;
    case 'answer':          return <AnswerCard content={segment.content} />;
    case 'formula':         return <FormulaCard content={segment.content} />;
    case 'word_info':       return <WordInfoCard content={segment.content} />;
    default:                return <TextCard content={segment.content} label={segment.heading} />;
  }
}

function ResultCards({ result, isStreaming }: { result: IntentResult; isStreaming: boolean }) {
  const fullText = result.segments
    .filter((s): s is Extract<MessageSegment, { type: 'text' }> => s.type === 'text')
    .map(s => s.content).join('');
  const parsedSegments = parseContent(fullText);
  const widgetSegments = result.segments.filter(
    (s): s is Extract<MessageSegment, { type: 'widget' }> => s.type === 'widget'
  );

  if (result.error) {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-xs text-destructive">
        <span className="font-medium">请求失败：</span>{result.error}
      </div>
    );
  }

  return (
    <>
      {parsedSegments.map((seg, i) => (
        <CardSegment key={`parsed-${i}`} segment={seg} isStreaming={isStreaming} isLast={i === parsedSegments.length - 1} />
      ))}
      {widgetSegments.map(seg => (
        <WidgetRenderer key={seg.key} widgetCode={seg.code} isStreaming={false} title={seg.title} />
      ))}
    </>
  );
}

export function MessageItem({
  role, content, segments, isStreaming = false, error, intentName,
  imageThumb, assistantState, intents, results, activeResultIndex = 0,
  onIntentSelect,
}: MessageItemProps) {

  // ── User bubble ──────────────────────────────────────────────────────────
  if (role === 'user') {
    if (imageThumb) {
      return (
        <div className="flex justify-end mb-3">
          <div className="rounded-2xl rounded-tr-sm overflow-hidden border border-border/20 shadow-sm max-w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageThumb} alt="圈选区域" className="block w-full h-auto object-contain" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  // ── Assistant bubble ─────────────────────────────────────────────────────

  // 1. VLM loading
  if (assistantState === 'vlm-loading') {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] w-full">
          <div className="rounded-2xl border border-border/20 bg-white dark:bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <svg className="animate-spin w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-sm text-muted-foreground">意图识别中…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Intent select
  if (assistantState === 'intent-select' && intents) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] w-full">
          <div className="rounded-2xl border border-border/20 bg-white dark:bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/10">
              <span className="text-[13px] font-medium text-foreground">识别到 {intents.length} 个意图</span>
            </div>
            <div className="p-3 space-y-2">
              {intents.map((intent, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onIntentSelect?.(i)}
                  className="w-full text-left rounded-xl border border-border/50 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground">{intent.name}</span>
                    <span className="text-[10px] text-muted-foreground/60">{Math.round(intent.confidence * 100)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{intent.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Results (with intent tab switcher if multiple)
  if (assistantState === 'results' && intents && results) {
    const activeResult = results[activeResultIndex];
    const activeStreaming = activeResult?.isStreaming ?? false;
    const activeIntentName = intents[activeResultIndex]?.name ?? intentName ?? 'AI Tutor';

    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[90%] w-full">
          <div className="rounded-2xl border border-border/20 bg-white dark:bg-card shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10">
              <span className="text-[13px] font-medium text-foreground">{activeIntentName}</span>
              {activeStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>

            {/* Intent tabs — below header, only when multiple intents */}
            {intents.length > 1 && (
              <div className="flex gap-1.5 px-4 py-2 border-b border-border/10 overflow-x-auto">
                {intents.map((intent, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onIntentSelect?.(i)}
                    className={`text-[11px] px-3 py-1 rounded-full border whitespace-nowrap transition-colors ${
                      i === activeResultIndex
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {results[i]?.isStreaming && (
                        <svg className="animate-spin w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      {intent.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Cards */}
            <div className="px-3 py-3 space-y-2.5 bg-[#F8F8FA] dark:bg-muted/30">
              {activeResult
                ? <ResultCards result={activeResult} isStreaming={activeStreaming} />
                : (
                  <div className="flex items-center gap-2 py-3 px-1">
                    <svg className="animate-spin w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span className="text-sm text-muted-foreground">生成中…</span>
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/10 bg-muted/20">
              <div className="flex gap-1.5">
                <button className="w-7 h-7 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
              <span className="text-[10px] text-muted-foreground/50">AI生成内容仅供参考</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Legacy text-only assistant bubble (text input path)
  const hasContent = segments.some(s => s.type === 'text' ? s.content.trim() : s.code.trim());
  const fullText = segments
    .filter((s): s is Extract<MessageSegment, { type: 'text' }> => s.type === 'text')
    .map(s => s.content).join('');
  const parsedSegments = parseContent(fullText);
  const widgetSegments = segments.filter(
    (s): s is Extract<MessageSegment, { type: 'widget' }> => s.type === 'widget'
  );

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] w-full">
        <div className="rounded-2xl border border-border/20 bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10">
            <span className="text-[13px] font-medium text-foreground">{intentName || 'AI Tutor'}</span>
            {isStreaming && !hasContent ? (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                思考中
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/50">AI辅导</span>
            )}
          </div>
          <div className="px-3 py-3 space-y-2.5 bg-[#F8F8FA] dark:bg-muted/30">
            {error ? (
              <div className="px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-xs text-destructive">
                <span className="font-medium">请求失败：</span>{error}
              </div>
            ) : (
              <>
                {parsedSegments.map((seg, i) => (
                  <CardSegment key={`parsed-${i}`} segment={seg} isStreaming={isStreaming} isLast={i === parsedSegments.length - 1} />
                ))}
                {widgetSegments.map(seg => (
                  <WidgetRenderer key={seg.key} widgetCode={seg.code} isStreaming={false} title={seg.title} />
                ))}
              </>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/10 bg-muted/20">
            <div className="flex gap-1.5">
              <button className="w-7 h-7 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground/50">AI生成内容仅供参考</span>
          </div>
        </div>
      </div>
    </div>
  );
}
