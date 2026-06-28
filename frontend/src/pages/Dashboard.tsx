/**
 * Dashboard.tsx — Rabih CRM "North Star" Dashboard
 *
 * Matches Stitch Dashboard_tab design:
 *  - Welcome greeting with dynamic time-of-day
 *  - 3 KPI cards: Total Active · High Priority · Avg AI Score
 *  - Scatter Chart (Key Accounts) + AI Insight panel
 *  - "High-Intent Pipeline" ranked deals table with account initials
 *
 * Data: useDashboard() → GET /api/v1/deals/ranked
 */
import { useMemo, useState } from 'react';
import { useDashboard, useTriggerSync } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../services/api';
import ScatterChart from '../components/ScatterChart';
import DealDrawer from '../components/DealDrawer';
import FilterPanel, { type FilterState } from '../components/dashboard/FilterPanel';

function formatLastSynced(isoString?: string | null): string {
  if (!isoString) return 'Never';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}${name ? `, ${name.split(' ')[0]}` : ''}.`;
}

/** Derive 2-letter initials from deal/account name */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   'bg-error-container text-error',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-surface-container-high text-on-surface-variant',
};

const INITIALS_COLORS = [
  'bg-primary-fixed text-primary',
  'bg-secondary-container text-on-secondary-container',
  'bg-tertiary-fixed text-tertiary',
  'bg-amber-100 text-amber-700',
];

export default function Dashboard() {
  const { data, isLoading } = useDashboard('ai_score');
  const syncMutation = useTriggerSync();
  const { toast } = useToast();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ priority: 'all', minAiScore: 0 });

  const { data: user } = useQuery({
    queryKey: ['user_me'],
    queryFn: userApi.getMe,
    staleTime: 1000 * 60 * 5,
  });

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => toast({ title: '🔄 Sync Complete', description: res.message, variant: 'success' }),
      onError: (err) => toast({ title: 'Sync Failed', description: (err as Error).message, variant: 'destructive' }),
    });
  };

  const totalActive   = data?.kpis?.total_active ?? 0;
  const highPriority  = data?.kpis?.high_priority_count ?? 0;
  const avgAiScore    = data?.kpis?.avg_ai_score ?? 0;
  const scatterPoints = data?.scatter_points ?? [];
  const allDeals      = data?.ranked_deals ?? [];

  const filteredDeals = useMemo(() =>
    allDeals.filter((d) => {
      const priorityOk = filters.priority === 'all' || d.priority === filters.priority;
      return priorityOk && d.ai_score >= filters.minAiScore;
    }),
    [allDeals, filters]
  );

  return (
    <>
      {/* ── Page Header Strip ── */}
      <div className="px-margin-mobile md:px-10 py-6 border-b border-outline-variant bg-surface">
        <div className="flex items-start justify-between max-w-[1400px] mx-auto">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight">
              {getGreeting(user?.name)}
            </h2>
            <p className="text-on-surface-variant mt-1 text-base">
              Your AI-powered sales intelligence hub. Processing{' '}
              <span className="text-secondary font-semibold">{highPriority} high-priority leads</span> right now.
            </p>
          </div>
          {/* Sync CRM */}
          <div className="flex items-center gap-3 flex-shrink-0 mt-1">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-on-surface-variant">Last Synced</p>
              <p className="font-mono text-sm text-on-surface mt-0.5">
                {isLoading ? '—' : formatLastSynced((data as any)?.last_synced)}
              </p>
            </div>
            <button
              id="btn-sync-crm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shadow-secondary/20"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
              <span className="hidden sm:inline">{syncMutation.isPending ? 'Syncing...' : 'Sync CRM'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-margin-mobile md:px-10 py-8 max-w-[1400px] mx-auto w-full space-y-8 pb-16">

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 — Total Active */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Active Deals</span>
              <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-xl text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-on-surface">
                {isLoading ? '—' : totalActive.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-secondary text-xs font-bold bg-secondary/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>+5% vs last week
              </span>
            </div>
          </div>

          {/* Card 2 — High Priority */}
          <div className="bg-white rounded-2xl p-6 border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">High Priority Count</span>
              <span className="material-symbols-outlined text-error bg-error-container p-2 rounded-xl text-[20px]">priority_high</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-on-surface">
                {isLoading ? '—' : highPriority.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-error text-xs font-bold bg-error-container/40 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">warning</span>Action Required
              </span>
            </div>
          </div>

          {/* Card 3 — Avg AI Score (AI glow) */}
          <div className="bg-white rounded-2xl p-6 border border-[rgba(70,72,212,0.2)] shadow-[0_0_20px_rgba(70,72,212,0.08)] flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Average AI Score</span>
              <span className="material-symbols-outlined text-indigo-500 bg-indigo-50 p-2 rounded-xl text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-on-surface">
                {isLoading ? '—' : avgAiScore.toFixed(1)}
              </span>
              <span className="flex items-center gap-1 text-indigo-600 text-xs font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span>Optimized
              </span>
            </div>
          </div>
        </div>

        {/* Viz Row: Scatter + AI Insight + Filter Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Scatter Chart — 8 cols */}
          <div className="lg:col-span-8">
            {scatterPoints.length > 0 ? (
              <ScatterChart data={scatterPoints} />
            ) : (
              <div className="bg-white rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden h-[400px] flex flex-col">
                <div className="p-6 border-b border-outline-variant">
                  <h3 className="font-semibold text-xl text-on-surface">Key Accounts to Focus On</h3>
                  <p className="text-on-surface-variant text-sm mt-1">Visualizing Deal Value vs. AI Win Probability</p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 relative overflow-hidden bg-surface-container-low">
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(#0D9488 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }} />
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 relative z-10">scatter_plot</span>
                  <span className="text-on-surface-variant text-sm relative z-10">Sync CRM to populate chart</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Insight Panel — 4 cols */}
          <div className="lg:col-span-4 bg-[#131b2e] text-white rounded-2xl p-8 shadow-lg flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary-fixed-dim text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="text-xs font-bold uppercase tracking-widest text-secondary-fixed-dim">AI Insight</span>
              </div>
              <h3 className="text-xl font-black leading-tight mb-3">
                {highPriority > 0
                  ? `You have ${highPriority} high-priority deals needing attention right now.`
                  : 'Your pipeline is well-optimized. Keep up the momentum.'}
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">
                AI suggests focusing on deals with AI scores above {avgAiScore.toFixed(0)}% to maximize closure velocity this quarter.
              </p>
            </div>
            <button
              onClick={() => setSelectedDealId(filteredDeals[0]?.deal_id ?? null)}
              className="mt-8 w-full bg-white text-[#131b2e] font-bold py-3 rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm"
            >
              Explore Detailed Insights
            </button>
          </div>
        </div>

        {/* Filter Panel + High-Intent Pipeline Table */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Table — grows */}
          <div className="flex-1 bg-white rounded-2xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
              <h3 className="text-xl font-semibold text-on-surface">High-Intent Pipeline</h3>
              <div className="flex gap-2">
                <button className="p-2 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">filter_list</span>
                </button>
                <button className="p-2 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">download</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                <span className="text-on-surface-variant text-sm">Loading deals…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container text-on-surface-variant">
                    <tr>
                      {['Account Name', 'Value', 'Priority', 'ML Readiness', 'AI Prediction', 'Action'].map((h) => (
                        <th key={h} className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {filteredDeals.slice(0, 10).map((deal, idx) => {
                      const winPct = deal.ai_score?.toFixed(0) ?? '—';
                      const colorCls = INITIALS_COLORS[idx % INITIALS_COLORS.length];
                      return (
                        <tr key={deal.deal_id}
                          className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                          onClick={() => setSelectedDealId(deal.deal_id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 ${colorCls} rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                                {initials(deal.account_name || deal.deal_name)}
                              </div>
                              <div>
                                <p className="font-semibold text-on-surface text-sm">{deal.deal_name}</p>
                                <p className="text-xs text-on-surface-variant">{deal.account_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-on-surface">
                            ${deal.amount?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${PRIORITY_BADGE[deal.priority] ?? PRIORITY_BADGE.LOW}`}>
                              {deal.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                              <div className="h-full bg-secondary rounded-full" style={{ width: `${deal.ml_score ?? 0}%` }} />
                            </div>
                            <span className="text-[10px] text-on-surface-variant mt-1 block">
                              {(deal.ml_score ?? 0).toFixed(1)}% Match
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 font-bold text-secondary text-sm">
                              <span className="material-symbols-outlined text-[16px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                              {winPct}% Win
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedDealId(deal.deal_id); }}
                              className="bg-surface-container-high text-secondary hover:bg-secondary hover:text-on-secondary px-4 py-1.5 rounded-xl font-semibold text-sm transition-all group-hover:shadow-md"
                            >
                              Insights
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDeals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant text-sm">
                          No deals match the current filters. Sync CRM or adjust filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {filteredDeals.length > 10 && (
              <div className="p-4 border-t border-outline-variant flex justify-center">
                <button className="text-secondary font-bold text-sm hover:underline">
                  View All {filteredDeals.length.toLocaleString()} Deals
                </button>
              </div>
            )}
          </div>

          {/* Filter panel sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <FilterPanel onFilterChange={setFilters} />
          </div>
        </div>
      </div>

      {/* Deal Drawer */}
      {selectedDealId && (
        <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
      )}
    </>
  );
}
