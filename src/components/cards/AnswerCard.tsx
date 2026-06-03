'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';

interface AnswerCardProps {
  content: string;
}

export function AnswerCard({ content }: AnswerCardProps) {
  return (
    <CardContainer label="答案" icon="✅">
      <div className="rounded-lg bg-white dark:bg-card px-3.5 py-3 shadow-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
          [&_p]:my-0.5 [&_p]:text-emerald-700 dark:[&_p]:text-emerald-400
          [&_strong]:text-emerald-800 dark:[&_strong]:text-emerald-300 [&_strong]:font-semibold
          [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-emerald-700
          [&_ol]:mt-1 [&_ol]:space-y-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
        </div>
      </div>
    </CardContainer>
  );
}
