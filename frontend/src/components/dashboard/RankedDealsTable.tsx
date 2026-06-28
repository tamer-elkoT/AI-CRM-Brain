/**
 * RankedDealsTable.tsx — Dashboard ranked deals preview table
 *
 * Renders the top-N ranked deals with:
 *  - Deal Name / Account / Priority badge
 *  - ML Score progress bar (teal fill)
 *  - AI Score progress bar (teal→midnight gradient)
 *  - "Insights" button → opens DealDrawer
 *  - "View All" link → navigates to /home (All Deals Pipeline)
 *
 * Data source: passed in as props from Dashboard (useDashboard hook).
 * No internal data fetching — keeps component pure and testable.
 */
import { useNavigate } from 'react-router-dom';
import type { RankedDeal } from '../../types';

interface RankedDealsTableProps {
  deals: RankedDeal[];
  onInsights: (dealId: string) => void;
}

/** Priority badge styles matching design spec */
const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   'bg-error/10 text-error border border-error/20',
  MEDIUM: 'bg-[#dec29a20] text-[#574425] border border-[#dec29a40]',
  LOW:    'bg-surface-container text-on-surface-variant border border-outline-variant',
};

export default function RankedDealsTable({ deals, onInsights }: RankedDealsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden">
      {/* Table header row */}
      <div className="px-4 py-3.5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-md text-headline-md text-on-surface">Ranked Deals</h3>
        <button
          id="btn-view-all-deals"
          onClick={() => navigate('/home')}
          className="text-secondary font-label-md text-label-md hover:underline transition-colors"
        >
          View All
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F1F5F9] border-b border-outline-variant">
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[160px]">Deal Name</th>
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[120px]">Account</th>
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Priority</th>
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[110px]">ML Score</th>
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[110px]">AI Score</th>
              <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center font-body-sm text-body-sm text-on-surface-variant">
                  No ranked deals available. Sync your CRM data to get started.
                </td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr
                  key={deal.deal_id}
                  className="border-b border-outline-variant hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                  onClick={() => onInsights(deal.deal_id)}
                >
                  {/* Deal Name */}
                  <td className="p-3">
                    <span className="font-body-md text-body-md text-on-surface font-medium group-hover:text-secondary transition-colors">
                      {deal.deal_name}
                    </span>
                  </td>

                  {/* Account */}
                  <td className="p-3 font-body-sm text-body-sm text-on-surface-variant">
                    {deal.account_name}
                  </td>

                  {/* Priority badge */}
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-1 rounded font-label-sm text-label-sm ${
                        PRIORITY_BADGE[deal.priority] ?? PRIORITY_BADGE.LOW
                      }`}
                    >
                      {deal.priority.charAt(0) + deal.priority.slice(1).toLowerCase()}
                    </span>
                  </td>

                  {/* ML Score — teal progress bar */}
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-full bg-secondary rounded-full progress-animate"
                          style={{ width: `${deal.ml_score}%` }}
                        />
                      </div>
                      <span className="font-mono-data text-mono-data text-on-surface flex-shrink-0">
                        {deal.ml_score}
                      </span>
                    </div>
                  </td>

                  {/* AI Score — teal→midnight gradient bar */}
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-full rounded-full progress-animate"
                          style={{
                            width: `${deal.ai_score}%`,
                            background: 'linear-gradient(to right, #0D9488, #0F172A)',
                          }}
                        />
                      </div>
                      <span className="font-mono-data text-mono-data text-on-surface font-bold flex-shrink-0">
                        {deal.ai_score}
                      </span>
                    </div>
                  </td>

                  {/* Insights button */}
                  <td className="p-3 text-right">
                    <button
                      id={`btn-insights-${deal.deal_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsights(deal.deal_id);
                      }}
                      className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm hover:bg-secondary hover:text-on-secondary transition-all shadow-sm"
                    >
                      Insights
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
