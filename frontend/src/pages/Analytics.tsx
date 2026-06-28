/**
 * Analytics.tsx — Rabih CRM Analytics Dashboard
 *
 * Design: Emerald Enterprise (from Rabih_CRM/Analytics/)
 *
 * Sections:
 *  1. Header with date range selector + action buttons
 *  2. Four KPI cards: Active Pipeline Value, Total Won, Win Rate, At-Risk
 *  3. Deals by Stage Analysis (horizontal progress bars)
 *  4. Win/Loss Ratio (SVG donut)
 *  5. Top Accounts by Value
 *  6. Highest Value Deals table (clickable → DealDrawer)
 *
 * Data sources:
 *  - usePipelineAnalytics() → /analytics/pipeline (new endpoint)
 *  - useAccountRanking()    → /analytics/accounts/ranked
 *  - useTriggerSync()       → /ingest/deals
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipelineAnalytics, useAccountRanking, useTriggerSync } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import DealDrawer from '../components/DealDrawer';
import type { StageBreakdown } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtMoneyFull(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Pick a bar colour based on pipeline funnel position */
const STAGE_COLORS: Record<string, string> = {
  'Value Proposition':   'bg-[#6bd8cb]',
  'Qualification':       'bg-[#bec6e0]',
  'Needs Analysis':      'bg-[#dae2fd]',
  'Id. Decision Makers': 'bg-[#bec6e0]',
  'Perception Analysis': 'bg-[#dae2fd]',
  'Proposal/Price Quote':'bg-[#89f5e7]',
  'Negotiation/Review':  'bg-[#008378]',
  'Discovery':           'bg-slate-300',
  'Proposal':            'bg-[#89f5e7]',
  'Negotiation':         'bg-[#006a61]',
  'Closing':             'bg-[#005049]',
};

function stageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? 'bg-[#bec6e0]';
}

const STAGE_BADGE_STYLES: Record<string, string> = {
  'Proposal':            'bg-[#dae2fd] text-[#3f465c]',
  'Proposal/Price Quote':'bg-[#dae2fd] text-[#3f465c]',
  'Negotiation':         'bg-[#89f5e7] text-[#005049]',
  'Negotiation/Review':  'bg-[#89f5e7] text-[#005049]',
  'Discovery':           'bg-surface-container-highest text-on-surface-variant',
  'Qualification':       'bg-[#e1e0ff] text-[#2f2ebe]',
  'Closing':             'bg-[#00201d] text-[#89f5e7]',
};

function stageBadge(stage: string): string {
  return STAGE_BADGE_STYLES[stage] ?? 'bg-surface-container-high text-on-surface-variant';
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container rounded-xl ${className ?? ''}`} />;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: string;
  iconBg: string;
  iconColor: string;
  isLoading: boolean;
  aiGlow?: boolean;
}

function KpiCard({ label, value, sub, icon, iconBg, iconColor, isLoading, aiGlow }: KpiCardProps) {
  return (
    <div
      className={`bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30
        hover:shadow-md transition-all duration-200 group cursor-default
        ${aiGlow ? 'shadow-[inset_0_0_12px_rgba(96,99,238,0.1)] border border-[rgba(96,99,238,0.2)]' : 'shadow-sm'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[11px] font-bold text-outline uppercase tracking-widest leading-tight">{label}</span>
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <span className={`material-symbols-outlined ${iconColor} text-[20px]`}
            style={{ fontVariationSettings: aiGlow ? "'FILL' 1" : "'FILL' 0" }}>
            {icon}
          </span>
        </div>
      </div>
      {isLoading ? (
        <>
          <Skeleton className="h-9 w-28 mb-3" />
          <Skeleton className="h-3 w-24" />
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <h3 className="text-[32px] font-bold text-on-surface leading-none">{value}</h3>
          </div>
          {sub && <div className="mt-4">{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Win Rate Progress bar ────────────────────────────────────────────────────

function WinRateBar({ pct }: { pct: number }) {
  return (
    <div className="mt-4 w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
      <div
        className="bg-primary h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DateRangeKey = 'Last 30 Days' | 'Last 90 Days' | 'This Year';

export default function Analytics() {
  const navigate = useNavigate();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeKey>('Last 90 Days');

  const { data: pipeline, isLoading: pipelineLoading } = usePipelineAnalytics();
  const { data: accountData, isLoading: accountsLoading } = useAccountRanking();
  const syncMutation = useTriggerSync();
  const { toast } = useToast();

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => toast({ title: '🔄 Sync Complete', description: res.message, variant: 'success' }),
      onError: (err) => toast({ title: 'Sync Failed', description: (err as Error).message, variant: 'destructive' }),
    });
  };

  // Compute donut chart stroke parameters
  const wonCount = pipeline?.closed_won_count ?? 0;
  const lostCount = pipeline?.closed_lost_count ?? 0;
  const stalledCount = pipeline?.other_stalled_count ?? 0;
  const totalDonut = wonCount + lostCount + stalledCount;

  const wonPct = totalDonut > 0 ? (wonCount / totalDonut) * 100 : 0;
  const lostPct = totalDonut > 0 ? (lostCount / totalDonut) * 100 : 0;
  const stalledPct = totalDonut > 0 ? (stalledCount / totalDonut) * 100 : 0;

  // For SVG donut: strokeDasharray = [pct, 100]
  // strokeDashoffset = -accumulated_previous_pct
  const circum = 100;
  const lostOffset = -(wonPct);
  const stalledOffset = -(wonPct + lostPct);

  const winRate = pipeline?.win_rate_pct ?? 0;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="px-4 md:px-10 py-5 border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-[1440px] mx-auto">
          <div>
            <h2 className="text-2xl md:text-[28px] font-bold text-on-surface leading-tight">
              Analytics Dashboard
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Data-driven performance metrics
            </p>
          </div>

          {/* Date range + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range picker */}
            <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-1 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 border-r border-outline-variant">
                <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
                <span className="text-sm font-medium text-on-surface whitespace-nowrap hidden sm:block">
                  {dateRange}
                </span>
              </div>
              {(['Last 30 Days', 'Last 90 Days', 'This Year'] as DateRangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    dateRange === r
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {r === 'Last 30 Days' ? '30D' : r === 'Last 90 Days' ? '90D' : 'Year'}
                </button>
              ))}
              <button className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
              </button>
            </div>

            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-sm font-semibold hover:bg-secondary/20 transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
              <span className="hidden sm:inline">Sync CRM</span>
            </button>

            {/* Export */}
            <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-surface-container-lowest rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Canvas ── */}
      <div className="pt-6 pb-12 px-4 md:px-10 max-w-[1440px] mx-auto w-full space-y-6">

        {/* ── 4 KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* 1 — Active Pipeline Value */}
          <KpiCard
            label="Active Pipeline Value"
            value={fmtMoney(pipeline?.active_pipeline_value ?? 0)}
            icon="account_balance_wallet"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            isLoading={pipelineLoading}
            sub={
              <WinRateBar pct={pipeline ? (pipeline.active_pipeline_value / Math.max(pipeline.active_pipeline_value + pipeline.total_won_amount, 1)) * 100 : 0} />
            }
          />

          {/* 2 — Total Won Amount */}
          <KpiCard
            label="Total Won Amount"
            value={fmtMoney(pipeline?.total_won_amount ?? 0)}
            icon="workspace_premium"
            iconBg="bg-[#dae2fd]/50"
            iconColor="text-secondary"
            isLoading={pipelineLoading}
            sub={
              <p className="text-[12px] text-outline">
                {wonCount} deals closed won
              </p>
            }
          />

          {/* 3 — Win Rate % */}
          <KpiCard
            label="Win Rate %"
            value={`${winRate.toFixed(1)}%`}
            icon="trending_up"
            iconBg="bg-[#e1e0ff]/50"
            iconColor="text-[#4648d4]"
            isLoading={pipelineLoading}
            sub={
              <p className="text-[12px] text-outline">
                {wonCount} won · {lostCount} lost
              </p>
            }
          />

          {/* 4 — At-Risk Value (AI glow) */}
          <KpiCard
            label="At-Risk Value"
            value={fmtMoney(pipeline?.at_risk_value ?? 0)}
            icon="auto_awesome"
            iconBg="bg-error-container/30"
            iconColor="text-error"
            isLoading={pipelineLoading}
            aiGlow
            sub={
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-error/10 text-error rounded text-[10px] font-bold uppercase">
                  {pipeline?.at_risk_deal_count ?? 0} Deals
                </span>
                <p className="text-[11px] text-[#2f2ebe] font-medium">
                  AI intervention recommended
                </p>
              </div>
            }
          />
        </div>

        {/* ── Middle Row: Stage Analysis + Win/Loss Donut ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Deals by Stage Analysis — 2 cols */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex justify-between items-center mb-7">
              <div>
                <h4 className="text-lg font-semibold text-on-surface">Deals by Stage Analysis</h4>
                <p className="text-[11px] font-bold text-outline uppercase tracking-wider mt-0.5">
                  Distribution of {fmtMoney(pipeline?.active_pipeline_value ?? 0)} Total Pipeline
                </p>
              </div>
              <div className="flex gap-1">
                <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">bar_chart</span>
                </button>
                <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-outline text-[20px]">filter_alt</span>
                </button>
              </div>
            </div>

            {pipelineLoading ? (
              <div className="space-y-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            ) : pipeline?.stage_breakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] mb-3 opacity-30">bar_chart</span>
                <p className="text-sm">No active deals in the pipeline yet.</p>
                <button
                  onClick={handleSync}
                  className="mt-4 text-primary text-sm font-semibold hover:underline"
                >
                  Sync CRM data →
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {(pipeline?.stage_breakdown ?? []).map((s: StageBreakdown, idx: number) => (
                  <div key={s.stage} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        {idx + 1}. {s.stage}
                      </span>
                      <span className="text-sm font-bold text-on-surface">
                        {fmtMoney(s.total_amount)}{' '}
                        <span className="text-outline font-normal text-[12px] ml-1">({s.deal_count} Deals)</span>
                      </span>
                    </div>
                    <div className="w-full bg-surface-container h-8 rounded-lg overflow-hidden group">
                      <div
                        className={`${stageColor(s.stage)} h-full rounded-lg transition-all duration-700 ease-out hover:brightness-95`}
                        style={{ width: `${Math.max(s.pct_of_pipeline, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Win/Loss Ratio — 1 col */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-on-surface">Win/Loss Ratio</h4>
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">This Period</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              {/* SVG Donut */}
              <div className="relative w-44 h-44 mb-7">
                {pipelineLoading ? (
                  <div className="w-full h-full rounded-full border-8 border-surface-container animate-pulse" />
                ) : (
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Track */}
                    <circle cx="18" cy="18" fill="transparent" r="16" stroke="#eceef0" strokeWidth="4" />
                    {/* Won — primary teal */}
                    {wonPct > 0 && (
                      <circle
                        cx="18" cy="18" fill="transparent" r="16"
                        stroke="#00685f"
                        strokeDasharray={`${wonPct} ${circum}`}
                        strokeLinecap="round"
                        strokeWidth="4.5"
                      />
                    )}
                    {/* Lost — error red */}
                    {lostPct > 0 && (
                      <circle
                        cx="18" cy="18" fill="transparent" r="16"
                        stroke="#ba1a1a"
                        strokeDasharray={`${lostPct} ${circum}`}
                        strokeDashoffset={lostOffset}
                        strokeLinecap="round"
                        strokeWidth="4.5"
                      />
                    )}
                    {/* Stalled — secondary */}
                    {stalledPct > 0 && (
                      <circle
                        cx="18" cy="18" fill="transparent" r="16"
                        stroke="#565e74"
                        strokeDasharray={`${stalledPct} ${circum}`}
                        strokeDashoffset={stalledOffset}
                        strokeLinecap="round"
                        strokeWidth="4.5"
                      />
                    )}
                  </svg>
                )}
                {/* Centre label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {pipelineLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <span className="text-[28px] font-bold text-on-surface leading-none">
                        {winRate.toFixed(0)}%
                      </span>
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">
                        WIN RATE
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="w-full space-y-3">
                {[
                  { label: 'Closed Won',     count: wonCount,     dot: 'bg-primary' },
                  { label: 'Closed Lost',    count: lostCount,    dot: 'bg-error' },
                  { label: 'Other / Stalled',count: stalledCount, dot: 'bg-secondary' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${row.dot}`} />
                      <span className="text-sm text-on-surface-variant">{row.label}</span>
                    </div>
                    {pipelineLoading
                      ? <Skeleton className="h-4 w-16" />
                      : <span className="font-bold text-on-surface text-sm">{row.count} Deals</span>
                    }
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/home')}
              className="mt-7 w-full py-3 border border-outline-variant rounded-xl text-[11px] font-bold text-primary hover:bg-surface-container transition-colors uppercase tracking-widest"
            >
              View Historical Trends
            </button>
          </div>
        </div>

        {/* ── Bottom Row: Top Accounts + Highest Value Deals ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Accounts by Value */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-on-surface">Top Accounts by Value</h4>
              <button
                onClick={() => navigate('/home')}
                className="text-primary text-[11px] font-bold uppercase tracking-wider hover:underline"
              >
                Full List
              </button>
            </div>

            {accountsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (accountData?.accounts ?? []).length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">
                No account data yet. Sync your CRM.
              </div>
            ) : (
              <div className="space-y-3">
                {(accountData?.accounts ?? []).slice(0, 5).map((acct, idx) => (
                  <div
                    key={acct.account_name}
                    className="flex items-center gap-4 p-3 hover:bg-surface-container-low transition-colors rounded-xl border border-transparent hover:border-outline-variant/30 cursor-pointer group"
                    onClick={() => navigate('/home')}
                  >
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                        {acct.account_name}
                      </p>
                      <p className="text-[11px] text-outline">
                        Avg Score: {acct.avg_score.toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-on-surface text-sm">
                        {acct.deal_count} {acct.deal_count === 1 ? 'Deal' : 'Deals'}
                      </p>
                      <p className="text-[10px] font-bold text-primary uppercase">
                        Score {acct.avg_score.toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Highest Value Deals Table */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-on-surface">Highest Value Deals</h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-outline uppercase tracking-wider">Sorted by Amount</span>
                <span className="material-symbols-outlined text-outline text-[16px]">sort</span>
              </div>
            </div>

            {pipelineLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-2.5 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : (pipeline?.top_deals ?? []).length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">
                No active deals found. Sync your CRM.
              </div>
            ) : (
              <div className="overflow-hidden border border-outline-variant/30 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-outline uppercase tracking-wider">Deal Name</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-outline uppercase tracking-wider">Stage</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-outline uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {(pipeline?.top_deals ?? []).map((deal) => (
                      <tr
                        key={deal.deal_id}
                        className="hover:bg-surface-container-low transition-colors cursor-pointer group"
                        onClick={() => setSelectedDealId(deal.deal_id)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                              {deal.deal_name}
                            </span>
                            <span className="text-[11px] text-outline">{deal.account_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${stageBadge(deal.stage)}`}>
                            {deal.stage}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-on-surface text-sm">
                          {fmtMoneyFull(deal.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
