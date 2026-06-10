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

  // Try to extract A/B/C/D options with analysis
  const options: { letter: string; text: string; isCorrect?: boolean }[] = [];
  let buffer = '';

  for (const line of lines) {
    const match = line.trim().match(/^([A-D])[.．、:：)\]]\s*(.*)$/);
    if (match) {
      if (buffer) {
        const last = options[options.length - 1];
        if (last) last.text += '\n' + buffer;
      }
      const text = match[2];
      const isCorrect = /正确|✓|✅|对/.test(text) || /答案/.test(text);
      options.push({ letter: match[1], text, isCorrect });
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
      <CardContainer label="选项解析" icon="🔎">
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
    <CardContainer label="选项解析" icon="🔎">
      <div className="space-y-2">
        {options.map((opt) => (
          <div
            key={opt.letter}
            className={`flex gap-2.5 rounded-lg px-3 py-2 border ${
              opt.isCorrect
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                : 'bg-white dark:bg-card border-border/30'
            }`}
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                opt.isCorrect
                  ? 'bg-emerald-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {opt.letter}
            </span>
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
              [&_p]:my-0 [&_p]:text-foreground/85
              [&_strong]:text-foreground [&_strong]:font-semibold">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(opt.text)}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}
