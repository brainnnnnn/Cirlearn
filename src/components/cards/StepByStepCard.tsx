'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';

interface StepByStepCardProps {
  content: string;
}

export function StepByStepCard({ content }: StepByStepCardProps) {
  const lines = content.split('\n').filter(l => l.trim());
  const hasNumberedSteps = lines.some(l => /^\d+[.．、]\s*/.test(l.trim()));
  
  if (!hasNumberedSteps) {
    return (
      <CardContainer label="分步推导" icon="🔢">
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

  const steps: { num: string; text: string }[] = [];
  let currentStep: { num: string; text: string } | null = null;
  
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)[.．、]\s*(.*)$/);
    if (match) {
      if (currentStep) steps.push(currentStep);
      currentStep = { num: match[1], text: match[2] };
    } else if (currentStep) {
      currentStep.text += '\n' + line;
    }
  }
  if (currentStep) steps.push(currentStep);

  return (
    <CardContainer label="分步推导" icon="🔢">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-white dark:bg-card flex items-center justify-center shadow-sm">
                <span className="text-[11px] font-bold text-primary">{step.num}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 bg-border/40 my-1" />
              )}
            </div>
            <div className="pb-1">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
                [&_p]:my-0 [&_p]:text-foreground/85
                [&_strong]:text-foreground [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{step.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}
