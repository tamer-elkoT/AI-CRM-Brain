/**
 * KPICard.tsx — Dashboard metric card with delta indicator
 *
 * Design spec: Cognitive Enterprise — "Metric Cards & Delta Indicators"
 * - Primary value uses headline-lg typography
 * - Delta uses a pill badge (10% opacity of semantic color)
 * - Icon from Material Symbols placed top-right
 */
import type { ReactNode } from 'react';

interface KPICardProps {
  /** Card label shown above the value */
  label: string;
  /** The primary metric value (string for formatted numbers) */
  value: string | number;
  /** Material Symbol icon name */
  icon: string;
  /** Delta display text e.g. "+5% vs last week" */
  delta?: string;
  /** Determines pill color: positive = teal, negative = red, neutral = gray */
  deltaType?: 'positive' | 'negative' | 'neutral';
  /** Accessible id for testing */
  id?: string;
}

export default function KPICard({
  label,
  value,
  icon,
  delta,
  deltaType = 'positive',
  id,
}: KPICardProps): ReactNode {
  const pillStyles: Record<string, string> = {
    positive: 'bg-secondary/10 text-secondary',
    negative: 'bg-error/10 text-error',
    neutral:  'bg-surface-container text-on-surface-variant',
  };

  const arrowIcon = deltaType === 'negative' ? 'arrow_downward' : 'arrow_upward';

  return (
    <div
      id={id}
      className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-4 flex flex-col justify-between hover:shadow-level-2 transition-shadow cursor-default"
    >
      {/* Label + Icon row */}
      <div className="flex justify-between items-start mb-4">
        <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
        <span className={`material-symbols-outlined ${deltaType === 'negative' ? 'text-error' : 'text-secondary'}`}>
          {icon}
        </span>
      </div>

      {/* Value + Delta pill row */}
      <div className="flex items-end justify-between">
        <span className="font-headline-lg text-headline-lg text-on-surface leading-none">
          {value}
        </span>
        {delta && (
          <div className={`px-2 py-1 rounded-full flex items-center space-x-1 ${pillStyles[deltaType]}`}>
            <span className="material-symbols-outlined text-[14px]">{arrowIcon}</span>
            <span className="font-label-sm text-label-sm">{delta}</span>
          </div>
        )}
      </div>
    </div>
  );
}
