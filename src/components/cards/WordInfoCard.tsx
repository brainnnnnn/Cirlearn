'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardContainer } from './CardContainer';

interface WordInfoCardProps {
  content: string;
}

export function WordInfoCard({ content }: WordInfoCardProps) {
  return (
    <CardContainer label="字词信息" icon="📖">
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:mt-1 [&_ul]:space-y-1 [&_li]:text-foreground/85
        [&_p]:text-foreground/85 [&_p]:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </CardContainer>
  );
}
