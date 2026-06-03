'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';

interface ProblemContextCardProps {
  content: string;
}

export function ProblemContextCard({ content }: ProblemContextCardProps) {
  const knownMatch = content.match(/已知[：:]([\s\S]*?)(?=所求[：:]|$)/);
  const askMatch = content.match(/所求[：:]([\s\S]*)/);
  
  const known = knownMatch ? knownMatch[1].trim() : '';
  const ask = askMatch ? askMatch[1].trim() : '';
  const hasStructured = known || ask;

  return (
    <CardContainer label="题目信息" icon="📋">
      {hasStructured ? (
        <div className="space-y-2">
          {known && (
            <div className="flex gap-2">
              <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-card text-foreground/80 shadow-sm">
                已知
              </span>
              <p className="text-[13px] leading-relaxed text-foreground/85">{known}</p>
            </div>
          )}
          {ask && (
            <div className="flex gap-2">
              <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-card text-foreground/80 shadow-sm">
                所求
              </span>
              <p className="text-[13px] leading-relaxed text-foreground/85">{ask}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:my-0.5 [&_p]:text-foreground/85">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
        </div>
      )}
    </CardContainer>
  );
}
