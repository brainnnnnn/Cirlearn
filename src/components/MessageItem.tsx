'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { WidgetRenderer } from './WidgetRenderer';
import { parseContent, type ParsedSegment } from '@/lib/heading-parser';
import { ProblemContextCard, ThinkingCard, StepByStepCard, AnswerCard, FormulaCard, TextCard, WordInfoCard } from './cards';
import type { MessageSegment } from '@/hooks/useStreamingChat';

interface MessageItemProps {
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];
  isStreaming?: boolean;
}

function CardSegment({ segment, isStreaming = false, isLast = false }: { segment: ParsedSegment; isStreaming?: boolean; isLast?: boolean }) {
  const cursor = isStreaming && isLast
    ? <span className="inline-block w-1.5 h-3.5 bg-foreground/40 animate-pulse rounded-sm align-middle ml-0.5" />
    : null;
  if (segment.type === 'card' && !segment.content.trim()) return null;

  if (segment.type === 'widget' && segment.widgetCode) {
    return (
      <WidgetRenderer
        widgetCode={segment.widgetCode}
        isStreaming={false}
        title={segment.widgetTitle}
      />
    );
  }

  if (segment.type === 'text') {
    return <TextCard content={segment.content} />;
  }

  switch (segment.cardType) {
    case 'problem_context':
      return <ProblemContextCard content={segment.content} />;
    case 'thinking':
      return <ThinkingCard content={segment.content} />;
    case 'step_by_step':
      return <StepByStepCard content={segment.content} />;
    case 'answer':
      return <AnswerCard content={segment.content} />;
    case 'formula':
      return <FormulaCard content={segment.content} />;
    case 'word_info':
      return <WordInfoCard content={segment.content} />;
    default:
      return <TextCard content={segment.content} label={segment.heading} />;
  }
}

export function MessageItem({ role, content, segments, isStreaming = false, error }: MessageItemProps & { error?: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  const hasContent = segments.some(s => s.type === 'text' ? s.content.trim() : s.code.trim());

  const fullText = segments
    .filter((s): s is Extract<MessageSegment, { type: 'text' }> => s.type === 'text')
    .map(s => s.content)
    .join('');

  const parsedSegments = parseContent(fullText);
  const widgetSegments = segments.filter((s): s is Extract<MessageSegment, { type: 'widget' }> => s.type === 'widget');

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] w-full">
        <div className="rounded-2xl border border-border/20 bg-white dark:bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10">
            <span className="text-[13px] font-medium text-foreground">圈圈学</span>
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

          {/* Cards */}
          <div className="px-3 py-3 space-y-2.5 bg-[#F8F8FA] dark:bg-muted/30">
            {error ? (
              <div className="px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-xs text-destructive leading-relaxed">
                <span className="font-medium">请求失败：</span>{error}
              </div>
            ) : (
              <>
                {parsedSegments.map((seg, i) => (
                  <CardSegment key={`parsed-${i}`} segment={seg} isStreaming={isStreaming} isLast={i === parsedSegments.length - 1} />
                ))}
                {widgetSegments.map((seg) => (
                  <WidgetRenderer
                    key={seg.key}
                    widgetCode={seg.code}
                    isStreaming={false}
                    title={seg.title}
                  />
                ))}
              </>
            )}
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/10 bg-muted/20">
            <div className="flex gap-1.5">
              <button className="w-7 h-7 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <button className="w-7 h-7 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
