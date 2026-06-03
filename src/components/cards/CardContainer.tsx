'use client';

import { ReactNode } from 'react';

interface CardContainerProps {
  children: ReactNode;
  label?: string;
  icon?: string;
  className?: string;
}

export function CardContainer({ children, label, icon, className = '' }: CardContainerProps) {
  return (
    <div className={`group relative rounded-xl bg-[#F5F5F7] dark:bg-muted/40 overflow-hidden ${className}`}>
      {/* Top label bar */}
      {(label || icon) && (
        <div className="flex items-center gap-1.5 px-3.5 py-2">
          {icon && <span className="text-sm">{icon}</span>}
          {label && (
            <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">
              {label}
            </span>
          )}
        </div>
      )}
      {/* Content */}
      <div className={`${(label || icon) ? 'px-3.5 pb-3 pt-0' : 'p-3.5'}`}>
        {children}
      </div>
    </div>
  );
}
