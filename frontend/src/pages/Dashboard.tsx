import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDashboard, useTriggerSync } from '../hooks/useDeals';
import { useAuth } from '../context/AuthContext';
import DealDrawer from '../components/DealDrawer';
import ScatterChart from '../components/ScatterChart';
import AccountRankingChart from '../components/AccountRankingChart';
import { Select } from '../components/ui/Select';
import { Flame, Hourglass, AlertTriangle } from 'lucide-react';
import type { RankedDeal } from '../types';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#006a6110] text-secondary border-secondary/30',
  MEDIUM: 'bg-[#dec29a20] text-tertiary-container border-tertiary-fixed-dim/40',
  LOW: 'bg-[#76777d10] text-outline border-outline/30',
};

interface NavItem {
  icon: string;
  label: string;
  path: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'integration_instructions', label: 'Integrations', path: '/integrations' },
  { icon: 'settings', label: 'Settings', path: '/settings', disabled: true },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('ai_score');

  const limit = undefined;
  const { data, isLoading } = useDashboard(sortBy, limit);
  const syncMutation = useTriggerSync();

  const displayedDeals = data?.ranked_deals ?? [];

  const getStatusIcon = (score: number) => {
    if (score >= 80) return <Flame className="w-4 h-4 text-orange-500" />;
    if (score >= 50) return <Hourglass className="w-4 h-4 text-amber-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col md:flex-row">
      {/* ─── Sidebar ─── */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant py-gutter px-4 z-40 justify-between">
        <div>
          <div className="mb-8 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined fill">analytics</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-black text-on-surface leading-tight">AI CRM Brain</h1>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Enterprise Intelligence</p>
            </div>
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => !item.disabled && navigate(item.path)}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md transition-colors ${
                    isActive
                      ? 'bg-surface-container-highest text-on-surface'
                      : item.disabled
                      ? 'text-on-surface-variant/40 cursor-not-allowed'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                  {item.label}
                  {item.disabled && (
                    <span className="ml-auto px-1.5 py-0.5 bg-surface-container-high rounded font-label-sm text-label-sm text-on-surface-variant">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign Out
        </button>
      </nav>

      {/* ─── Main Content ─── */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
          <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
            <div className="flex-1">
              <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Dashboard</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">دماغ إدارة علاقات العملاء بالذكاء الاصطناعي</p>
            </div>
            <div className="flex items-center space-x-4">
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

            {/* ─── Ranked Deals Table ─── */}
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-container-low gap-4">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    Ranked Deals
                    <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-label-sm text-xs">
                      All
                    </span>
                  </h3>
                </div>
                <div className="w-full sm:w-64">
                  <Select
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: 'ai_score', label: 'Sort by AI Score (High-Low)' },
                      { value: 'ml_score', label: 'Sort by ML Score' },
                      { value: 'amount', label: 'Sort by Deal Amount' },
                    ]}
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto">
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
                    {displayedDeals.map((deal: RankedDeal) => (
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
                              e.stopPropagation(); // prevent row click from firing twice
                              setSelectedDealId(deal.deal_id);
                            }}
                            className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-variant transition-colors shadow-sm group-hover:bg-secondary group-hover:text-white"
                          >
                            Insights
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
            </div>
          </div>
        )}
      </main>

      {selectedDealId && <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />}
    </div>
  );
}
