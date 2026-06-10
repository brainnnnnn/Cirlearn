'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface ExampleCardProps {
  content: string;
}

export function ExampleCard({ content }: ExampleCardProps) {
  const lines = content.split('\n').filter(l => l.trim());

  // Try to detect "example problem / solution" structure
  // Patterns: "例1：", "例题：", "例如：", "例："
  const exampleMatch = content.match(/^(例\d*[：:]\s*)/m);
  const hasExampleStructure = lines.some(l => /^例\d*[：:]/.test(l.trim()));

  if (!hasExampleStructure) {
    return (
      <CardContainer label="典型示例" icon="📐">
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

  // Parse example blocks: each block starts with "例X：" or similar
  const blocks: { title: string; body: string }[] = [];
  let currentBlock: { title: string; body: string } | null = null;

  for (const line of lines) {
    const match = line.trim().match(/^(例\d*)[：:]\s*(.*)$/);
    if (match) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { title: match[1] || '例', body: match[2] || '' };
    } else if (currentBlock) {
      currentBlock.body += '\n' + line;
    } else {
      // Lines before first example marker
      currentBlock = { title: '例', body: line };
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  return (
    <CardContainer label="典型示例" icon="📐">
      <div className="space-y-3">
        {blocks.map((block, i) => (
          <div key={i} className="rounded-lg bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/60 dark:border-amber-800/30 overflow-hidden">
            <div className="px-3 py-1.5 bg-amber-100/60 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-800/30">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{block.title}</span>
            </div>
            <div className="px-3.5 py-2.5">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
                [&_p]:my-0.5 [&_p]:text-foreground/85
                [&_strong]:text-foreground [&_strong]:font-semibold
                [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
                [&_ol]:mt-1 [&_ol]:space-y-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatex(block.body)}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}
