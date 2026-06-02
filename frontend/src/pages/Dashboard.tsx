import { useDashboard, useTriggerSync } from '../hooks/useDeals';
import ScatterChart from '../components/ScatterChart';
import AccountRankingChart from '../components/AccountRankingChart';

export default function Dashboard() {
  const { data, isLoading } = useDashboard('ai_score');
  const syncMutation = useTriggerSync();

  return (
    <>
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div className="flex-1">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Dashboard</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">دماغ إدارة علاقات العملاء بالذكاء الاصطناعي</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors flex items-center space-x-2 disabled:opacity-50 shadow-sm"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
              <span className="hidden sm:inline">Sync CRM</span>
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      ) : (
        <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 flex flex-col space-y-gutter md:space-y-6 pb-12">
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-4">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">Total Active Deals</span>
                <span className="material-symbols-outlined text-secondary">trending_up</span>
              </div>
              <div className="font-headline-lg text-headline-lg text-on-surface">{data?.kpis?.total_active ?? 0}</div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-4">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">High Priority Count</span>
                <span className="material-symbols-outlined text-error">priority_high</span>
              </div>
              <div className="font-headline-lg text-headline-lg text-on-surface">{data?.kpis?.high_priority_count ?? 0}</div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-4">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">Average AI Score</span>
                <span className="material-symbols-outlined text-secondary-container">auto_awesome</span>
              </div>
              <div className="font-headline-lg text-headline-lg text-on-surface">{data?.kpis?.avg_ai_score ?? 0}%</div>
            </div>
          </div>

          {/* ─── Charts ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <ScatterChart data={data?.scatter_points ?? []} />
            <AccountRankingChart />
          </div>
        </div>
      )}
    </>
  );
}
