'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CardContainer } from './CardContainer';
import { normalizeLatex } from '@/lib/heading-parser';

interface StepByStepCardProps {
  content: string;
  label?: string;
}

interface Step {
  num: string;
  text: string;
}

interface Group {
  title: string | null; // null = 无小问标题
  steps: Step[];
}

// Matches sub-question markers: **(1)** / **（1）** / **(一)** / **①** etc.
const SUB_Q_RE = /^\*\*[（(]?([0-9①②③④⑤一二三四五一-鿿]{1,3})[)）]?\*\*\s*(.*)$/;
const STEP_RE = /^(\d+)[.．、]\s*(.*)$/;

function parseGroups(content: string): Group[] {
  const lines = content.split('\n').filter(l => l.trim());

  // Check if any sub-question markers exist
  const hasSubQ = lines.some(l => SUB_Q_RE.test(l.trim()));

  if (!hasSubQ) {
    // Single group, no title
    const steps = parseSteps(lines);
    return [{ title: null, steps }];
  }

  const groups: Group[] = [];
  let currentGroup: Group | null = null;
  let pendingLines: string[] = [];

  for (const line of lines) {
    const subMatch = line.trim().match(SUB_Q_RE);
    if (subMatch) {
      // Flush pending lines into current group if any
      if (currentGroup) {
        currentGroup.steps = parseSteps(pendingLines);
        groups.push(currentGroup);
      } else if (pendingLines.length > 0) {
        // Lines before first sub-question marker
        groups.push({ title: null, steps: parseSteps(pendingLines) });
      }
      const titleText = subMatch[2].trim();
      currentGroup = { title: `(${subMatch[1]})${titleText ? '  ' + titleText : ''}`, steps: [] };
      pendingLines = [];
    } else {
      pendingLines.push(line);
    }
  }

  if (currentGroup) {
    currentGroup.steps = parseSteps(pendingLines);
    groups.push(currentGroup);
  }

  return groups;
}

function parseSteps(lines: string[]): Step[] {
  const steps: Step[] = [];
  let current: Step | null = null;

  for (const line of lines) {
    const match = line.trim().match(STEP_RE);
    if (match) {
      if (current) steps.push(current);
      current = { num: match[1], text: match[2] };
    } else if (current) {
      current.text += '\n' + line;
    }
  }
  if (current) steps.push(current);
  return steps;
}

function StepList({ steps, isStreaming }: { steps: Step[]; isStreaming?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="shrink-0 flex flex-col items-center self-stretch">
            <div className="w-6 h-6 rounded-full bg-white dark:bg-card flex items-center justify-center shadow-sm border border-border/20">
              <span className="text-[11px] font-bold text-primary">{step.num}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 bg-border/40 my-1" />
            )}
          </div>
          <div className="pb-1 min-w-0">
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
              [&_p]:my-0 [&_p]:text-foreground/85
              [&_strong]:text-foreground [&_strong]:font-semibold">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {normalizeLatex(step.text)}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepByStepCard({ content, label }: StepByStepCardProps) {
  const lines = content.split('\n').filter(l => l.trim());
  const hasNumberedSteps = lines.some(l => STEP_RE.test(l.trim()));

  // Fallback: no numbered steps at all — plain markdown
  if (!hasNumberedSteps) {
    return (
      <CardContainer label="分步解析" icon="🔢">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed
          [&_p]:my-0.5 [&_p]:text-foreground/85
          [&_strong]:text-foreground [&_strong]:font-semibold
          [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:text-foreground/85
          [&_ol]:mt-1 [&_ol]:space-y-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {normalizeLatex(content)}
          </ReactMarkdown>
        </div>
      </CardContainer>
    );
  }

  const groups = parseGroups(content);
  const isMultiGroup = groups.length > 1 || (groups.length === 1 && groups[0].title !== null);

  return (
    <CardContainer label="分步解析" icon="🔢">
      {isMultiGroup ? (
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[12px] font-semibold text-primary/80 bg-primary/8 px-2 py-0.5 rounded-md prose prose-sm dark:prose-invert inline [&_p]:inline [&_p]:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {normalizeLatex(group.title)}
                    </ReactMarkdown>
                  </span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              )}
              <StepList steps={group.steps} />
            </div>
          ))}
        </div>
      ) : (
        <StepList steps={groups[0]?.steps ?? []} />
      )}
    </CardContainer>
  );
}
