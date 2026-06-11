'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface OptionAnalysisCardProps {
  content: string;
}

export function OptionAnalysisCard({ content }: OptionAnalysisCardProps) {
  const lines = content.split('\n').filter(l => l.trim());

  // Extract A/B/C/D options with analysis text
  const options: { letter: string; text: string }[] = [];
  let buffer = '';

  for (const line of lines) {
    const match = line.trim().match(/^([A-D])[.．、:：)\]]\s*(.*)$/);
    if (match) {
      if (buffer) {
        const last = options[options.length - 1];
        if (last) last.text += '\n' + buffer;
      }
      options.push({ letter: match[1], text: match[2] });
      buffer = '';
    } else if (options.length > 0) {
      buffer += (buffer ? '\n' : '') + line;
    }
  }
  if (buffer && options.length > 0) {
    options[options.length - 1].text += '\n' + buffer;
  }

  // If no structured options found, fall back to normal rendering
  if (options.length === 0) {
    return (
      <CardContainer label="选项分析" icon="🔎">
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
    <CardContainer label="选项分析" icon="🔎">
      <div className="space-y-2">
        {options.map((opt) => (
          <div
            key={opt.letter}
            className="flex gap-3 rounded-lg px-3 py-2.5 bg-white dark:bg-card border border-border/40 hover:border-border/70 transition-colors"
          >
            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {opt.letter}
            </span>
            <div className="flex-1 min-w-0">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
                [&_p]:my-0 [&_p]:text-foreground/85
                [&_strong]:text-foreground [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(opt.text)}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}
