'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface HintCardProps {
  content: string;
}

export function HintCard({ content }: HintCardProps) {
  return (
    <CardContainer label="要点提示" icon="👉">
      <div className="relative pl-3 border-l-[3px] border-orange-400/50">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
          [&_p]:my-0.5 [&_p]:text-foreground/85
          [&_strong]:text-foreground [&_strong]:font-semibold
          [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
          [&_ol]:mt-1 [&_ol]:space-y-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(content)}</ReactMarkdown>
        </div>
      </div>
    </CardContainer>
  );
}
