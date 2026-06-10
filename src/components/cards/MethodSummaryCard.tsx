'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface MethodSummaryCardProps {
  content: string;
}

export function MethodSummaryCard({ content }: MethodSummaryCardProps) {
  const lines = content.split('\n').filter(l => l.trim());
  const hasBulletPoints = lines.some(l => /^[-•*]\s+/.test(l.trim()));

  if (!hasBulletPoints) {
    return (
      <CardContainer label="方法归纳" icon="📝">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
          [&_p]:my-0.5 [&_p]:text-foreground/85
          [&_strong]:text-foreground [&_strong]:font-semibold
          [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
          [&_ol]:mt-1 [&_ol]:space-y-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(content)}</ReactMarkdown>
        </div>
      </CardContainer>
    );
  }

  return (
    <CardContainer label="方法归纳" icon="📝">
      <div className="space-y-2">
        {lines.map((line, i) => {
          const bulletMatch = line.trim().match(/^[-•*]\s+(.*)$/);
          if (bulletMatch) {
            return (
              <div key={i} className="flex gap-2.5">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{i + 1}</span>
                </span>
                <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
                  [&_p]:my-0 [&_p]:text-foreground/85
                  [&_strong]:text-foreground [&_strong]:font-semibold">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(bulletMatch[1])}</ReactMarkdown>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
              [&_p]:my-0 [&_p]:text-foreground/85">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(line)}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    </CardContainer>
  );
}
