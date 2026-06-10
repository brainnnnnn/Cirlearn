'use client';

import { useState } from 'react';
import { parseContent } from '@/lib/heading-parser';
import { CardSegment } from './cards';

interface IntentOption {
  id: string;
  label: string;
  active?: boolean;
}

interface ResultPanelProps {
  title: string;
  content: string;
  intents?: IntentOption[];
  onClose?: () => void;
  onIntentChange?: (intentId: string) => void;
}

export function ResultPanel({ title, content, intents, onClose, onIntentChange }: ResultPanelProps) {
  const [activeIntent, setActiveIntent] = useState(intents?.find(i => i.active)?.id || intents?.[0]?.id);

  const segments = parseContent(content);

  const handleIntentClick = (id: string) => {
    setActiveIntent(id);
    onIntentChange?.(id);
  };

  return (
    <div className="w-full max-w-[420px] mx-auto bg-white dark:bg-background rounded-2xl shadow-lg border border-border/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
        <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Intent tabs — only show when multiple intent candidates */}
      {intents && intents.length > 1 && (
        <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide">
          {intents.map((intent) => (
            <button
              key={intent.id}
              onClick={() => handleIntentClick(intent.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                activeIntent === intent.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {intent.label}
            </button>
          ))}
        </div>
      )}

      {/* Content cards */}
      <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {segments.map((seg, i) => (
          <CardSegment key={`seg-${i}`} segment={seg} />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/10 bg-muted/20">
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button className="w-8 h-8 rounded-full bg-white dark:bg-card border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground/60">AI生成内容仅供参考</span>
      </div>
    </div>
  );
}
