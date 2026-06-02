import { useState } from 'react';
import { useDashboard, useTriggerSync, useGenerateRecommendations } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import DealDrawer from '../components/DealDrawer';
import ScatterChart from '../components/ScatterChart';
import AccountRankingChart from '../components/AccountRankingChart';
import { Flame, Hourglass, AlertTriangle } from 'lucide-react';
import type { RankedDeal } from '../types';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#006a6110] text-secondary border-secondary/30',
  MEDIUM: 'bg-[#dec29a20] text-tertiary-container border-tertiary-fixed-dim/40',
  LOW: 'bg-[#76777d10] text-outline border-outline/30',
};

export default function Dashboard() {
  const { toast } = useToast();
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const { data, isLoading } = useDashboard('ai_score');
  const syncMutation = useTriggerSync();
  const generateMutation = useGenerateRecommendations();

  // Top 10 urgent deals (lowest AI score first, capped at 10)
  const allDeals = data?.ranked_deals ?? [];
  const urgentDeals = [...allDeals]
    .sort((a, b) => a.ai_score - b.ai_score)
    .slice(0, 10);

  const handleGenerateAI = () => {
    generateMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({
          title: '🧠 AI Analysis Complete',
          description: `${res.recommendations_generated} recommendations generated. ${res.urgent_deals_flagged} urgent deals flagged.`,
          variant: 'success',
        });
      },
      onError: (err) => {
        toast({
          title: 'AI Pipeline Failed',
          description: err.message || 'Something went wrong.',
          variant: 'destructive',
        });
      },
    });
  };

  const getStatusIcon = (score: number) => {
    if (score >= 80) return <Flame className="w-4 h-4 text-orange-500" />;
    if (score >= 50) return <Hourglass className="w-4 h-4 text-amber-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

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
            <button
              onClick={handleGenerateAI}
              disabled={generateMutation.isPending}
              className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center space-x-2 disabled:opacity-50 shadow-sm"
            >
              {generateMutation.isPending ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span className="hidden sm:inline">🧠 Generate AI</span>
                </>
              )}
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

          {/* ─── Top 10 Urgent Deals ─── */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">warning</span>
                  Top 10 Urgent Deals
                  <span className="px-2 py-0.5 rounded-full bg-error/10 text-error font-label-sm text-xs">
                    Needs Attention
                  </span>
                </h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Deals with the lowest AI win probability</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[150px]">Deal Name</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[120px]">Account</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">Amount</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Vibe</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Priority</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">ML Score</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">AI Score</th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {urgentDeals.map((deal: RankedDeal) => (
                    <tr 
                      key={deal.deal_id} 
                      className="border-b border-outline-variant hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                      onClick={() => setSelectedDealId(deal.deal_id)}
                    >
                      <td className="p-3 font-body-md text-body-md font-medium">
                        <span className="text-secondary hover:text-secondary-container hover:underline decoration-secondary underline-offset-2">
                          {deal.deal_name}
                        </span>
                      </td>
                      <td className="p-3 font-body-sm text-body-sm text-on-surface-variant">{deal.account_name}</td>
                      <td className="p-3 font-mono-data text-mono-data text-on-surface-variant">${(deal.amount || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface">
                          {getStatusIcon(deal.ai_score)}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-1 rounded font-label-sm text-label-sm border ${PRIORITY_STYLES[deal.priority] ?? PRIORITY_STYLES.LOW}`}>
                          {deal.priority}
                        </span>
                      </td>
                      <td className="p-3 font-mono-data text-mono-data">{deal.ml_score}%</td>
                      <td className="p-3 font-mono-data text-mono-data font-bold">{deal.ai_score}%</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDealId(deal.deal_id);
                          }}
                          className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-variant transition-colors shadow-sm group-hover:bg-secondary group-hover:text-white"
                        >
                          Insights
                        </button>
                      </td>
                    </tr>
                  ))}
                  {urgentDeals.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-on-surface-variant font-body-md">
                        No deals to display. Sync your CRM data first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedDealId && <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />}
    </>
  );
}
