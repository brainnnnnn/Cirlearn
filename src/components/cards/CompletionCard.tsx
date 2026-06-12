'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex, stripBlockBold } from '@/lib/heading-parser';

interface CompletionCardProps {
  content: string;
}

export function CompletionCard({ content }: CompletionCardProps) {
  return (
    <CardContainer label="补写" icon="✍️" className="border-l-4 border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/20">
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
        [&_p]:my-0.5 [&_p]:text-foreground/85
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
        [&_ol]:mt-1 [&_ol]:space-y-0.5
        [&_blockquote]:border-l-2 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-100/40 [&_blockquote]:dark:bg-amber-900/20 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:rounded-r [&_blockquote]:text-foreground/70 [&_blockquote]:not-italic">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{stripBlockBold(normalizeLatex(content))}</ReactMarkdown>
      </div>
    </CardContainer>
  );
}
