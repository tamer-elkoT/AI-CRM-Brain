import { useState } from 'react';
import { useDashboard } from '../hooks/useDeals';
import { useAllDeals } from '../hooks/useDeals';
import DealDrawer from '../components/DealDrawer';
import { Select } from '../components/ui/Select';
import { Flame, Hourglass, AlertTriangle, Search } from 'lucide-react';
import type { RankedDeal } from '../types';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#006a6110] text-secondary border-secondary/30',
  MEDIUM: 'bg-[#dec29a20] text-tertiary-container border-tertiary-fixed-dim/40',
  LOW: 'bg-[#76777d10] text-outline border-outline/30',
};

export default function Home() {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('ai_score');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    // Simple debounce
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const { data, isLoading } = useAllDeals(currentPage, pageSize, debouncedSearch, sortBy);

  const deals = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalDeals = data?.total ?? 0;

  const getStatusIcon = (score: number) => {
    if (score >= 80) return <Flame className="w-4 h-4 text-orange-500" />;
    if (score >= 50) return <Hourglass className="w-4 h-4 text-amber-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  // Build page numbers with ellipsis for large page counts
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <>
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div className="flex-1">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">All Deals Pipeline</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">خط أنابيب جميع الصفقات</p>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 flex flex-col pb-12">
        {/* ─── Toolbar ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search deals or accounts..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-56">
              <Select
                value={sortBy}
                onChange={handleSortChange}
                options={[
                  { value: 'ai_score', label: 'Sort by AI Score' },
                  { value: 'ml_score', label: 'Sort by ML Score' },
                  { value: 'amount', label: 'Sort by Amount' },
                  { value: 'deal_name', label: 'Sort by Name' },
                ]}
              />
            </div>
            <span className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary font-label-sm text-xs whitespace-nowrap">
              {totalDeals} deals
            </span>
          </div>
        </div>

        {/* ─── Deals Table ─── */}
        <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl overflow-hidden flex flex-col flex-1">
          {isLoading ? (
            <div className="flex-1 flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
            </div>
          ) : deals.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center py-20 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">search_off</span>
              <p className="font-headline-md text-headline-md text-on-surface mb-1">No deals found</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Sync your CRM data to populate the pipeline.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[180px]">Deal Name</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[130px]">Account</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">Stage</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">Amount</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-center">Vibe</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Priority</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[80px]">ML</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[80px]">AI</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Closing</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal: RankedDeal) => (
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
                        <td className="p-3">
                          <span className="inline-block px-2 py-1 rounded font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant border border-outline-variant">
                            {deal.stage || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3 font-mono-data text-mono-data text-on-surface-variant">${(deal.amount || 0).toLocaleString()}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface mx-auto">
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
                        <td className="p-3 font-body-sm text-body-sm text-on-surface-variant">{deal.closing_date || 'N/A'}</td>
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
                  </tbody>
                </table>
              </div>

              {/* ─── Pagination ─── */}
              {totalPages > 1 && (
                <div className="p-3 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Page {currentPage} of {totalPages} · {totalDeals} deals
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    {getPageNumbers().map((page, idx) =>
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-on-surface-variant">…</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`w-8 h-8 rounded font-label-sm text-label-sm transition-colors ${
                            page === currentPage
                              ? 'bg-secondary text-on-secondary'
                              : 'text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedDealId && <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />}
    </>
  );
}
