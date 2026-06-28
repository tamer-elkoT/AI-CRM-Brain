/**
 * FilterPanel.tsx — Dashboard right-sidebar filter panel
 *
 * Renders:
 *  - Priority radio group (All / High / Medium / Low)
 *  - Minimum AI Score range slider
 *
 * All filtering is client-side — emits state via onFilterChange callback.
 * No API calls are made from this component.
 */
import { useState } from 'react';

export type PriorityFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FilterState {
  priority: PriorityFilter;
  minAiScore: number;
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
}

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all',    label: 'All Priorities' },
  { value: 'HIGH',   label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW',    label: 'Low' },
];

export default function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [minAiScore, setMinAiScore] = useState(0);

  const handlePriorityChange = (value: PriorityFilter) => {
    setPriority(value);
    onFilterChange({ priority: value, minAiScore });
  };

  const handleScoreChange = (value: number) => {
    setMinAiScore(value);
    onFilterChange({ priority, minAiScore: value });
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-4">
      {/* Panel header */}
      <h4 className="font-label-md text-label-md text-on-surface mb-4 flex items-center">
        <span className="material-symbols-outlined mr-2 text-[18px] text-secondary">filter_list</span>
        Filter Settings
      </h4>

      {/* Priority filter */}
      <div className="mb-6">
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-3">
          Priority Level
        </label>
        <div className="space-y-2.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center space-x-2.5 cursor-pointer group">
              <input
                type="radio"
                name="priority-filter"
                value={opt.value}
                checked={priority === opt.value}
                onChange={() => handlePriorityChange(opt.value)}
                className="w-4 h-4 border-outline-variant cursor-pointer accent-secondary"
              />
              <span className="font-body-sm text-body-sm text-on-surface group-hover:text-secondary transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* AI Score slider */}
      <div>
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">
          <div className="flex justify-between items-center">
            <span>Minimum AI Score</span>
            <span className="font-mono-data text-mono-data text-on-surface">{minAiScore}</span>
          </div>
        </label>
        <input
          id="ai-score-slider"
          type="range"
          min={0}
          max={100}
          value={minAiScore}
          onChange={(e) => handleScoreChange(Number(e.target.value))}
          className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-secondary"
        />
        <div className="flex justify-between mt-1">
          <span className="font-label-sm text-[10px] text-on-surface-variant">0</span>
          <span className="font-label-sm text-[10px] text-on-surface-variant">100</span>
        </div>
      </div>
    </div>
  );
}
