/**
 * Analytics.tsx â€” Rabih CRM "Reports & Insights" Page
 *
 * Matches Stitch Reports_Tab design:
 *  - 4 metric cards: Sales Velocity Â· Conversion Rate Â· Total Opportunities Â· Stalled Deals
 *  - Deal Velocity Trend (SVG line chart) + AI Insights dark panel
 *  - Win/Loss by Lead Source (horizontal bar chart)
 *  - Revenue by Industry (donut chart)
 *  - Top Performing Deals table
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllDeals, useTriggerSync } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import DealDrawer from '../components/DealDrawer';

const WIN_LOSS_DATA = [
  { label: 'Direct Outbound',   win: 72, color: 'bg-secondary' },
  { label: 'Inbound Marketing', win: 45, color: 'bg-secondary' },
  { label: 'Referrals',         win: 88, color: 'bg-secondary' },
  { label: 'Partner Network',   win: 54, color: 'bg-secondary' },
];

const INDUSTRY_DATA = [
  { label: 'Fintech',    pct: 40, color: '#006a61', dot: 'bg-secondary' },
  { label: 'SaaS',       pct: 30, color: '#131b2e', dot: 'bg-[#131b2e]' },
  { label: 'Healthcare', pct: 15, color: '#89f5e7', dot: 'bg-[#89f5e7]' },
  { label: 'Others',     pct: 15, color: '#c6c6cd', dot: 'bg-outline-variant' },
];

const AI_INSIGHTS = [
  {
    text: "Follow up on 5 deals in ",
    highlight: 'Negotiation',
    rest: " stage that haven't been touched in 3 days.",
    action: 'Take Action',
    route: '/home',
    toast: null,
  },
  {
    text: 'Focus on ',
    highlight: 'Fintech sector',
    rest: ' — 80% higher win rate observed this quarter.',
    action: 'View Report',
    route: null,
    toast: 'Filter your pipeline by Fintech industry to see the 80% win-rate segment.',
  },
  {
    text: 'Pipeline gap detected for Q4. Increase outbound activity in ',
    highlight: 'Enterprise Software',
    rest: '.',
    action: 'Run Campaign',
    route: '/integrations',
    toast: null,
  },
];

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export default function Analytics() {
  const navigate = useNavigate();
  const { data: dealsData, isLoading } = useAllDeals(1, 15, undefined, 'ai_score', false);
  const syncMutation = useTriggerSync();
  const { toast } = useToast();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('Last 30 Days');

  const handleInsightAction = (insight: typeof AI_INSIGHTS[number]) => {
    if (insight.route) {
      navigate(insight.route);
    } else if (insight.toast) {
      toast({ title: '💡 AI Insight', description: insight.toast, variant: 'success' });
    }
  };

  const deals = dealsData?.items ?? [];

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => toast({ title: 'ðŸ”„ Sync Complete', description: res.message, variant: 'success' }),
      onError: (err) => toast({ title: 'Sync Failed', description: (err as Error).message, variant: 'destructive' }),
    });
  };

  // Compute metrics from real data
  const totalDeals = dealsData?.total ?? 0;
  const stalledDeals = deals.filter((d) => d.action_status === 'need_action_now').length;
  const highPriority = deals.filter((d) => d.priority === 'HIGH').length;

  return (
    <>
      {/* â”€â”€ Page Header Strip â”€â”€ */}
      <div className="px-margin-mobile md:px-10 py-5 border-b border-outline-variant bg-surface">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">assessment</span>
              <span className="text-on-surface-variant text-sm font-medium">Reports &amp; Insights</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-on-surface">Intelligence Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDateRange('Last 30 Days')}
              className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-white rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">calendar_today</span>
              {dateRange}
            </button>
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-sm font-semibold hover:bg-secondary/20 transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
              Sync CRM
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-white rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
              Export
            </button>
          </div>
        </div>
        <p className="text-on-surface-variant text-sm mt-2 max-w-2xl md:ml-10">
          Comprehensive sales insights and performance reports. Review your team's closing velocity, conversion efficiency, and automated growth opportunities.
        </p>
      </div>

      <div className="px-margin-mobile md:px-10 py-8 max-w-[1400px] mx-auto w-full space-y-8 pb-16">

        {/* â”€â”€ 4 Metric Cards â”€â”€ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Sales Velocity */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-3 hover:border-secondary/30 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface-variant">Sales Velocity</span>
              <div className="p-2 bg-secondary/10 rounded-xl">
                <span className="material-symbols-outlined text-secondary text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>speed</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-on-surface">18.4 Days</h3>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center bg-emerald-100 px-2 py-0.5 rounded-lg text-emerald-700 text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">arrow_downward</span>12%
                </div>
                <span className="text-on-surface-variant text-xs">vs last month</span>
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-3 hover:border-secondary/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface-variant">Conversion Rate</span>
              <div className="p-2 bg-surface-container-high rounded-xl">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">cached</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-on-surface">24.8%</h3>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center bg-emerald-100 px-2 py-0.5 rounded-lg text-emerald-700 text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>4.2%
                </div>
                <span className="text-on-surface-variant text-xs">vs last month</span>
              </div>
            </div>
          </div>

          {/* Total Opportunities */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-3 hover:border-secondary/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface-variant">Total Opportunities</span>
              <div className="p-2 bg-surface-container-high rounded-xl">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">monitoring</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-on-surface">
                {isLoading ? 'â€”' : totalDeals.toLocaleString()}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center bg-secondary/10 px-2 py-0.5 rounded-lg text-secondary text-xs font-bold">
                  +{highPriority} New
                </div>
                <span className="text-on-surface-variant text-xs">this week</span>
              </div>
            </div>
          </div>

          {/* Stalled Deals */}
          <div className="bg-white p-5 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 border-l-error flex flex-col gap-3 hover:border-error/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface-variant">Stalled Deals</span>
              <div className="p-2 bg-error-container/40 rounded-xl">
                <span className="material-symbols-outlined text-error text-[20px]">priority_high</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-on-surface">
                {isLoading ? 'â€”' : stalledDeals}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-error text-xs font-bold">Requires Attention</span>
                <span className="text-on-surface-variant text-xs">â€¢ &gt;7 days idle</span>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ Viz Row: Trend Chart + AI Insights â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Deal Velocity Trend â€” 8 cols */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-semibold text-on-surface">Deal Velocity Trend</h4>
                <p className="text-on-surface-variant text-sm">Avg. days to close over the last 6 months</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-secondary" />
                  <span className="text-xs font-semibold text-on-surface-variant">Closed-Won</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-outline-variant" />
                  <span className="text-xs font-semibold text-on-surface-variant">Industry Average</span>
                </div>
              </div>
            </div>

            {/* SVG Line Chart */}
            <div className="relative h-[260px] w-full">
              <div className="absolute inset-0 flex flex-col justify-between py-2 border-b border-outline-variant">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-full border-t border-surface-container-highest" />
                ))}
              </div>
              <div className="absolute inset-x-4 bottom-0 h-full flex items-end">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0, 106, 97, 0.2)" />
                      <stop offset="100%" stopColor="rgba(0, 106, 97, 0)" />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <path d="M 0,60 Q 20,45 40,55 T 60,30 T 80,40 T 100,20 L 100,100 L 0,100 Z" fill="url(#chartFill)" />
                  {/* Main line */}
                  <path d="M 0,60 Q 20,45 40,55 T 60,30 T 80,40 T 100,20" fill="none" stroke="#006a61" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Reference line */}
                  <line x1="0" x2="100" y1="50" y2="50" stroke="#c6c6cd" strokeDasharray="4" strokeWidth="1" />
                  {/* Dots */}
                  {[[0,60],[20,45],[40,55],[60,30],[80,40],[100,20]].map(([x,y], i) => (
                    <circle key={i} cx={x} cy={y} r="2.5" fill="#006a61" />
                  ))}
                </svg>
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-2 absolute -bottom-6 left-0 right-0 px-4">
                {['Jan','Feb','Mar','Apr','May','Jun'].map((m) => (
                  <span key={m} className="text-[11px] font-semibold text-on-surface-variant">{m}</span>
                ))}
              </div>
            </div>
          </div>

          {/* AI Insights Panel â€” 4 cols */}
          <div className="lg:col-span-4 bg-[#131b2e] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-[#6bd8cb] text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <h4 className="font-semibold text-[#6bd8cb] text-base">AI Insights</h4>
              </div>
              <div className="space-y-3">
                {AI_INSIGHTS.map((insight, i) => (
                  <button
                    key={i}
                    onClick={() => handleInsightAction(insight)}
                    className="w-full text-left bg-white/10 backdrop-blur-sm border border-white/10 p-4 rounded-xl hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <p className="text-sm text-white/80 leading-relaxed">
                      {insight.text}
                      <span className="text-[#6bd8cb] font-bold">{insight.highlight}</span>
                      {insight.rest}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <span className="text-[11px] font-bold text-[#6bd8cb] uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        {insight.action}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ Win/Loss by Source + Revenue by Industry â”€â”€ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Win/Loss */}
          <div className="bg-white p-6 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <h4 className="text-lg font-semibold text-on-surface mb-1">Win/Loss by Lead Source</h4>
            <p className="text-on-surface-variant text-sm mb-6">Channel effectiveness analysis</p>
            <div className="space-y-5">
              {WIN_LOSS_DATA.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm font-semibold mb-1.5">
                    <span className="text-on-surface">{row.label}</span>
                    <span className="text-on-surface-variant">{row.win}% Win Rate</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                    <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${row.win}%` }} />
                    <div className="h-full bg-error/30 rounded-full" style={{ width: `${100 - row.win}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue by Industry â€” Donut */}
          <div className="bg-white p-6 rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <h4 className="text-lg font-semibold text-on-surface mb-1">Revenue by Industry</h4>
            <p className="text-on-surface-variant text-sm mb-6">Market segment contribution</p>
            <div className="flex items-center gap-8">
              {/* Donut SVG */}
              <div className="relative w-40 h-40 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#006a61" strokeWidth="4"
                    strokeDasharray="40 60" strokeDashoffset="0" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#131b2e" strokeWidth="4"
                    strokeDasharray="30 70" strokeDashoffset="-40" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#89f5e7" strokeWidth="4"
                    strokeDasharray="15 85" strokeDashoffset="-70" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#c6c6cd" strokeWidth="4"
                    strokeDasharray="15 85" strokeDashoffset="-85" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-on-surface font-black text-lg leading-none">$4.2M</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase mt-0.5">Total Rev</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-3">
                {INDUSTRY_DATA.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${item.dot}`} />
                      <span className="text-sm font-medium text-on-surface">{item.label}</span>
                    </div>
                    <span className="text-sm font-mono text-on-surface-variant">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ Top Performing Deals Table â”€â”€ */}
        <div className="bg-white rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
            <h4 className="text-xl font-semibold text-on-surface">Top Performing Deals</h4>
            <button className="text-secondary font-semibold text-sm hover:underline flex items-center gap-1">
              View All Pipeline
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  {['Company', 'Value', 'Probability', 'Owner', 'Stage', 'Last Touch'].map((h) => (
                    <th key={h} className={`px-6 py-3 ${h === 'Last Touch' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">Loadingâ€¦</td></tr>
                ) : deals.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">No deals found. Sync your CRM to populate data.</td></tr>
                ) : deals.map((deal) => (
                  <tr key={deal.deal_id}
                    className="hover:bg-surface-container-lowest transition-colors cursor-pointer"
                    onClick={() => setSelectedDealId(deal.deal_id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#131b2e] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {initials(deal.account_name || deal.deal_name)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-on-surface">{deal.deal_name}</p>
                          <p className="text-[11px] text-on-surface-variant">{deal.account_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-on-surface">
                      ${deal.amount?.toLocaleString() ?? 'â€”'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full" style={{ width: `${deal.ai_score ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-on-surface">{(deal.ai_score ?? 0).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold">
                          {deal.deal_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="text-sm text-on-surface">Owner</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                        deal.stage === 'Closed Won' ? 'bg-secondary/10 text-secondary' :
                        deal.stage === 'Negotiation/Review' ? 'bg-surface-container-highest text-on-surface-variant' :
                        'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {deal.stage ?? 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-on-surface-variant">
                      {deal.last_followup_date
                        ? new Date(deal.last_followup_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                        : 'â€”'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedDealId && (
        <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
      )}
    </>
  );
}

