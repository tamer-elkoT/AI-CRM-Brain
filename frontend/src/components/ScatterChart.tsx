import {
  ScatterChart as RechartsScatter,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from 'recharts';
import type { DealScatterPoint } from '../types';

interface ScatterChartProps {
  data: DealScatterPoint[];
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   '#0D9488',   // primary/secondary — teal
  MEDIUM: '#dec29a',   // tertiary-fixed-dim — amber
  LOW:    '#76777d',   // outline — slate
};

interface TooltipPayloadEntry {
  payload: DealScatterPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const deal = payload[0].payload;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-lg rounded-xl p-4 min-w-[200px]">
      <p className="font-label-md text-label-md text-on-surface font-bold mb-2">{deal.deal_name}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Amount</span>
          <span className="font-mono-data text-mono-data text-on-surface">${deal.amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-label-sm text-label-sm text-on-surface-variant">AI Score</span>
          <span className="font-mono-data text-mono-data text-on-surface">{deal.ai_score}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Priority</span>
          <span
            className="inline-block px-2 py-0.5 rounded font-label-sm text-label-sm"
            style={{ backgroundColor: PRIORITY_COLORS[deal.priority] + '20', color: PRIORITY_COLORS[deal.priority] }}
          >
            {deal.priority}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ScatterChartComponent({ data }: ScatterChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-8 text-center">
        <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">bubble_chart</span>
        <p className="font-body-md text-body-md text-on-surface-variant">No scatter data available yet. Sync your CRM to populate.</p>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const xDomain: [number, number] = [0, Math.ceil(maxAmount * 1.1)];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">Key Accounts Visualization</h3>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Deal Amount vs. AI Closure Probability</p>
        </div>
        <div className="flex items-center gap-4">
          {Object.entries(PRIORITY_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={360}>
          <RechartsScatter margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c6c6cd" strokeOpacity={0.4} />

            {/* Quadrant shading */}
            <ReferenceArea x1={xDomain[1] / 2} x2={xDomain[1]} y1={50} y2={100} fill="#006a61" fillOpacity={0.04} />
            <ReferenceArea x1={0} x2={xDomain[1] / 2} y1={0} y2={50} fill="#ba1a1a" fillOpacity={0.03} />

            <XAxis
              type="number"
              dataKey="amount"
              name="Amount"
              domain={xDomain}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: '#45464d' }}
              label={{ value: 'Deal Amount ($)', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#76777d' } }}
            />
            <YAxis
              type="number"
              dataKey="ai_score"
              name="AI Score"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: '#45464d' }}
              label={{ value: 'AI Closure Probability (%)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 12, fill: '#76777d' } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fillOpacity={0.85}>
              {data.map((entry) => (
                <Cell
                  key={entry.deal_id}
                  fill={PRIORITY_COLORS[entry.priority] || PRIORITY_COLORS.LOW}
                  r={Math.max(6, Math.min(14, (entry.amount / maxAmount) * 16))}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ))}
            </Scatter>
          </RechartsScatter>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
