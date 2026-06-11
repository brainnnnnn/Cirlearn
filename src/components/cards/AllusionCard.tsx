'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardContainer } from './CardContainer';

interface AllusionCardProps {
  content: string;
}

interface AllusionSection {
  label: string;
  text: string;
}

const SECTION_LABELS = ['出处', '故事', '寓意', '用法', '原文'];

function parseSections(content: string): AllusionSection[] {
  const sections: AllusionSection[] = [];
  // Match **label：** or **label:** patterns
  const pattern = /\*\*([^*]+)[：:]\*\*/g;
  const matches: Array<{ label: string; index: number }> = [];
  let m;
  while ((m = pattern.exec(content)) !== null) {
    if (SECTION_LABELS.includes(m[1].trim())) {
      matches.push({ label: m[1].trim(), index: m.index + m[0].length });
    }
  }

  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index - matches[i + 1].label.length - 6 : content.length;
    const text = content.slice(start, end).trim();
    if (text) sections.push({ label: matches[i].label, text });
  }
  return sections;
}

const SECTION_STYLES: Record<string, { dot: string; labelColor: string }> = {
  出处: { dot: 'bg-amber-400',   labelColor: 'text-amber-700 dark:text-amber-400' },
  原文: { dot: 'bg-amber-400',   labelColor: 'text-amber-700 dark:text-amber-400' },
  故事: { dot: 'bg-indigo-400',  labelColor: 'text-indigo-700 dark:text-indigo-400' },
  寓意: { dot: 'bg-emerald-400', labelColor: 'text-emerald-700 dark:text-emerald-400' },
  用法: { dot: 'bg-emerald-400', labelColor: 'text-emerald-700 dark:text-emerald-400' },
};

export function AllusionCard({ content }: AllusionCardProps) {
  const sections = parseSections(content);

  return (
    <CardContainer label="典故" icon="📜">
      {sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map((sec, i) => {
            const style = SECTION_STYLES[sec.label] ?? { dot: 'bg-muted-foreground', labelColor: 'text-muted-foreground' };
            return (
              <div key={i} className="flex gap-2.5">
                {/* Left accent */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                  {i < sections.length - 1 && (
                    <div className="w-px flex-1 bg-border/30 mt-1" />
                  )}
                </div>
                <div className="pb-1 min-w-0">
                  <span className={`text-[11px] font-semibold tracking-wide ${style.labelColor}`}>
                    {sec.label}
                  </span>
                  <div className="mt-0.5 prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
                    [&_p]:my-0 [&_p]:text-foreground/85
                    [&_strong]:text-foreground [&_strong]:font-semibold
                    [&_em]:text-foreground/70 [&_em]:not-italic [&_em]:font-medium">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback: no structured sections, render as plain prose
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
          [&_p]:my-0.5 [&_p]:text-foreground/85
          [&_strong]:text-foreground [&_strong]:font-semibold">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </CardContainer>
  );
}
