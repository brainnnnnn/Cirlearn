'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface WordInfoCardProps {
  content: string;
  label?: string;
  icon?: string;
}

export function WordInfoCard({ content, label = '字词信息', icon = '📖' }: WordInfoCardProps) {
  return (
    <CardContainer label={label} icon={icon}>
      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
        [&_strong]:text-foreground [&_strong]:font-semibold
        [&_ul]:mt-1 [&_ul]:space-y-1 [&_li]:text-foreground/85
        [&_p]:text-foreground/85 [&_p]:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeLatex(content)}</ReactMarkdown>
      </div>
    </CardContainer>
  );
}
