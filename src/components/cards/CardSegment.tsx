'use client';

import { ParsedSegment } from '@/lib/heading-parser';
import {
  ProblemContextCard,
  ThinkingCard,
  StepByStepCard,
  AnswerCard,
  FormulaCard,
  TextCard,
  WordInfoCard,
  ConceptCard,
  MethodSummaryCard,
  HintCard,
  OptionAnalysisCard,
  DataAnalysisCard,
  ExampleCard,
  AllusionCard,
  CompletionCard,
} from './';
import { WidgetRenderer } from '../WidgetRenderer';

interface CardSegmentProps {
  segment: ParsedSegment;
  isStreaming?: boolean;
  isLast?: boolean;
}

export function CardSegment({ segment, isStreaming = false, isLast = false }: CardSegmentProps) {
  const cursor = isStreaming && isLast
    ? <span className="inline-block w-1.5 h-3.5 bg-foreground/40 animate-pulse rounded-sm align-middle ml-0.5" />
    : null;

  if (segment.type === 'card' && !segment.content.trim()) return null;

  if (segment.type === 'widget' && segment.widgetCode) {
    return <WidgetRenderer widgetCode={segment.widgetCode} isStreaming={false} title={segment.widgetTitle} />;
  }

  if (segment.type === 'text') {
    return (
      <>
        <TextCard content={segment.content} />
        {cursor}
      </>
    );
  }

  let card: React.ReactNode;

  switch (segment.cardType) {
    case 'problem_context':
      card = <ProblemContextCard content={segment.content} />;
      break;
    case 'thinking':
      card = <ThinkingCard content={segment.content} />;
      break;
    case 'step_by_step':
      card = <StepByStepCard content={segment.content} label={segment.heading} />;
      break;
    case 'answer':
      card = <AnswerCard content={segment.content} />;
      break;
    case 'formula':
      card = <FormulaCard content={segment.content} />;
      break;
    case 'concept':
      card = <ConceptCard content={segment.content} />;
      break;
    case 'method_summary':
      card = <MethodSummaryCard content={segment.content} />;
      break;
    case 'hint':
      card = <HintCard content={segment.content} />;
      break;
    case 'option_analysis':
      card = <OptionAnalysisCard content={segment.content} />;
      break;
    case 'data_analysis':
      card = <DataAnalysisCard content={segment.content} />;
      break;
    case 'word_info':
      card = <WordInfoCard content={segment.content} />;
      break;
    case 'example':
      card = <ExampleCard content={segment.content} />;
      break;
    case 'allusion':
      card = <AllusionCard content={segment.content} />;
      break;
    case 'completion':
      card = <CompletionCard content={segment.content} />;
      break;
    default:
      card = <TextCard content={segment.content} label={segment.heading} />;
  }

  return (
    <>
      {card}
      {cursor}
    </>
  );
}
