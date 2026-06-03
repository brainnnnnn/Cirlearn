'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';

interface FormulaCardProps {
  content: string;
}

export function FormulaCard({ content }: FormulaCardProps) {
  return (
    <CardContainer label="公式说明" icon="📐">
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
        [&_p]:my-0.5 [&_p]:text-foreground/85
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
        [&_ol]:mt-1 [&_ol]:space-y-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
      </div>
    </CardContainer>
  );
}
