import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAccountRanking } from '../hooks/useDeals';

interface AccountData {
  account_name: string;
  avg_score: number;
  deal_count: number;
}

interface TooltipPayloadEntry {
  payload: AccountData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-lg rounded-xl p-4 min-w-[180px]">
      <p className="font-label-md text-label-md text-on-surface font-bold mb-2">{d.account_name}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Avg AI Score</span>
          <span className="font-mono-data text-mono-data text-on-surface">{d.avg_score}%</span>
        </div>
        <div className="flex justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Deals</span>
          <span className="font-mono-data text-mono-data text-on-surface">{d.deal_count}</span>
        </div>
      </div>
    </div>
  );
}

function getBarColor(score: number): string {
  if (score >= 75) return '#006a61';  // secondary — teal
  if (score >= 50) return '#dec29a';  // amber
  return '#76777d';                   // slate
}

export default function AccountRankingChart() {
  const { data, isLoading } = useAccountRanking();
  const accountData = data?.accounts ?? [];

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
      </div>
    );
  }

  if (accountData.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-8 text-center">
        <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">bar_chart</span>
        <p className="font-body-md text-body-md text-on-surface-variant">No account data yet — generate AI recommendations first.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant bg-surface-container-low">
        <h3 className="font-headline-md text-headline-md text-on-surface">Account Win Probability</h3>
        <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Top accounts ranked by average AI score</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={accountData.length * 48 + 20}>
          <BarChart data={accountData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c6c6cd" strokeOpacity={0.3} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#45464d' }} tickFormatter={(v: number) => `${v}%`} />
            <YAxis
              type="category"
              dataKey="account_name"
              width={120}
              tick={{ fontSize: 12, fill: '#45464d' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="avg_score" radius={[0, 4, 4, 0]} barSize={20}>
              {accountData.map((entry) => (
                <Cell key={entry.account_name} fill={getBarColor(entry.avg_score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
