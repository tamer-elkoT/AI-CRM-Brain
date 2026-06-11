import { useState } from 'react';
import { useAllDeals, useTriggerSync, useGenerateRecommendations, useMarkFollowedUp, useUpdateStage, useDeleteDeal } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import DealDrawer from '../components/DealDrawer';
import CreateDealModal from '../components/CreateDealModal';
import MessageGeneratorModal from '../components/MessageGeneratorModal';
import { Select } from '../components/ui/Select';
import { Flame, Hourglass, AlertTriangle, Search, Plus, RefreshCw, UserPlus, X } from 'lucide-react';
import type { RankedDeal } from '../types';
import { authApi, userApi, dashboardApi } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#006a6110] text-secondary border-secondary/30',
  MEDIUM: 'bg-[#dec29a20] text-tertiary-container border-tertiary-fixed-dim/40',
  LOW: 'bg-[#76777d10] text-outline border-outline/30',
};

// ─── Feature 2: Stage status badge styles ───
const STAGE_BADGE_STYLES: Record<string, string> = {
  'Closed Won': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'Closed Lost': 'bg-red-500/10 text-red-500 border-red-500/30',
};

// ─── Feature 4: Action status display config ───
const ACTION_STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  need_action_now: { label: 'Need Action — Now', icon: '🔴', color: 'text-red-600', bg: 'bg-red-500/10' },
  need_action_3days: { label: 'Need Action — 3 Days', icon: '🟡', color: 'text-amber-600', bg: 'bg-amber-500/10' },
  followed_up: { label: 'Followed Up', icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  no_action: { label: 'No Action', icon: '⬜', color: 'text-on-surface-variant', bg: 'bg-surface-container' },
};

// ─── Feature 9: Allowed pipeline stages ───
const PIPELINE_STAGES = [
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Identify Decision Makers',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
];

export default function Home() {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('ai_score');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Feature 1: Active vs Closed tab
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const includeClosed = activeTab === 'closed';

  // Feature 6: Message generator modal
  const [messageGenDeal, setMessageGenDeal] = useState<RankedDeal | null>(null);

  // Feature 9: Inline stage editing
  const [editingStageDealId, setEditingStageDealId] = useState<string | null>(null);

  // Epic 3: Inline amount and date editing
  const [editingAmountDealId, setEditingAmountDealId] = useState<string | null>(null);
  const [editingDateDealId, setEditingDateDealId] = useState<string | null>(null);

  const { toast } = useToast();
  const syncMutation = useTriggerSync();
  const generateMutation = useGenerateRecommendations();
  const markFollowedUp = useMarkFollowedUp();
  const updateStage = useUpdateStage();
  const deleteDeal = useDeleteDeal();
  const queryClient = useQueryClient();

  // Epic 3: Inline edit details mutation
  const updateDetails = useMutation({
    mutationFn: ({ dealId, data }: { dealId: string; data: { amount?: number; closing_date?: string } }) =>
      dashboardApi.updateDealDetails(dealId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: '✅ Details Updated', description: 'Deal updated successfully.', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message || 'Could not update deal details.', variant: 'destructive' });
    },
  });

  const handleAmountChange = (dealId: string, value: string) => {
    setEditingAmountDealId(null);
    const amount = parseFloat(value);
    if (!isNaN(amount)) {
      updateDetails.mutate({ dealId, data: { amount } });
    }
  };

  const handleDateChange = (dealId: string, value: string) => {
    setEditingDateDealId(null);
    if (value) {
      updateDetails.mutate({ dealId, data: { closing_date: value } });
    }
  };

  // ── Invite Team modal state (admin only) ──
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('rep');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Fetch current user to gate the Invite button
  const { data: currentUser } = useQuery({
    queryKey: ['user_me'],
    queryFn: userApi.getMe,
    staleTime: 1000 * 60 * 5,
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const result = await authApi.invite({ email: inviteEmail, role: inviteRole });
      const statusLabel = result.email_status === 'sent'
        ? '📧 Email sent!'
        : result.email_status === 'mocked'
        ? '📋 Mock mode — check server log for link'
        : '⚠️ Email failed — check SMTP config';

      toast({
        title: `✅ Invite created for ${inviteEmail}`,
        description: `Role: ${inviteRole} · ${statusLabel}`,
        variant: result.email_status === 'sent' ? 'success' : 'default',
      });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('rep');
    } catch (err: any) {
      toast({
        title: 'Invite Failed',
        description: err?.response?.data?.detail || 'Could not create invite.',
        variant: 'destructive',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({
          title: '🔄 Sync Complete',
          description: res.message,
          variant: 'success',
        });
      },
      onError: (err) => {
        toast({
          title: 'Sync Failed',
          description: err.message || 'Could not sync CRM data.',
          variant: 'destructive',
        });
      },
    });
  };

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

  // Feature 7: Mark as Followed Up inline
  const handleMarkFollowedUp = (e: React.MouseEvent, deal: RankedDeal) => {
    e.stopPropagation();
    markFollowedUp.mutate(
      { dealId: deal.deal_id, data: { channel: 'manual', notes: 'Marked from pipeline table' } },
      {
        onSuccess: (res) => {
          toast({ title: '✅ Followed Up', description: res.message, variant: 'success' });
        },
        onError: (err) => {
          toast({ title: 'Error', description: err.message || 'Failed', variant: 'destructive' });
        },
      }
    );
  };

  // Feature 9: Stage change handler
  const handleStageChange = (dealId: string, newStage: string) => {
    setEditingStageDealId(null);
    updateStage.mutate(
      { dealId, newStage },
      {
        onSuccess: (res) => {
          toast({
            title: '🔄 Stage Updated',
            description: res.message,
            variant: 'success',
          });
        },
        onError: (err) => {
          toast({
            title: 'Update Failed',
            description: err.message || 'Could not update stage.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const { data, isLoading } = useAllDeals(currentPage, pageSize, debouncedSearch, sortBy, includeClosed);

  const deals = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalDeals = data?.total ?? 0;

  const getStatusIcon = (score: number) => {
    if (score >= 80) return <Flame className="w-4 h-4 text-orange-500" />;
    if (score >= 50) return <Hourglass className="w-4 h-4 text-amber-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

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
          <div className="flex items-center space-x-3">
            {/* ── Invite Team button (admin only) ── */}
            {currentUser?.role === 'admin' && (
              <button
                id="btn-invite-team"
                onClick={() => setInviteModalOpen(true)}
                className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors flex items-center space-x-2 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Invite Team</span>
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors flex items-center space-x-2 disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncMutation.isPending ? 'Syncing...' : 'Sync & Refresh'}</span>
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={generateMutation.isPending}
              className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center space-x-2 disabled:opacity-50 shadow-sm"
            >
              {generateMutation.isPending ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span className="hidden sm:inline">Generate AI</span>
                </>
              )}
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center space-x-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Deal</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 flex flex-col pb-12">
        {/* ─── Feature 1: Active / Closed Tabs ─── */}
        <div className="flex items-center gap-1 mb-5 bg-surface-container-high rounded-xl p-1 w-fit">
          <button
            id="tab-active-pipeline"
            onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            Active Pipeline
          </button>
          <button
            id="tab-closed-deals"
            onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'closed'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Closed Deals
          </button>
        </div>

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
                  { value: 'risk', label: '⚠ Sort by Risk Deals' },
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
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : activeTab === 'closed' ? 'No closed deals yet.' : 'Sync your CRM data or create a deal to get started.'}
              </p>
              {activeTab === 'active' && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="bg-secondary text-on-secondary px-5 py-2.5 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Deal
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[180px]">Deal Name</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[130px]">Account</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[130px]">Stage</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[100px]">Amount</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-center">Vibe</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Priority</th>
                      {/* Feature 4: Action Status column */}
                      {activeTab === 'active' && (
                        <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[150px]">Action</th>
                      )}
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[80px]">ML</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant min-w-[80px]">AI</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant">Closing</th>
                      <th className="p-3 font-label-sm text-label-sm text-on-surface-variant text-right min-w-[180px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal: RankedDeal) => {
                      const actionCfg = ACTION_STATUS_CONFIG[deal.action_status || 'no_action'] || ACTION_STATUS_CONFIG.no_action;
                      const stageBadgeStyle = STAGE_BADGE_STYLES[deal.stage || ''] || 'bg-surface-container-high text-on-surface-variant border-outline-variant';
                      const isEditingStage = editingStageDealId === deal.deal_id;

                      return (
                        <tr
                          key={deal.deal_id}
                          className="border-b border-outline-variant hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                          onClick={() => setSelectedDealId(deal.deal_id)}
                        >
                          {/* Deal Name + Feature 2 status badge + Feature 7 follow-up info */}
                          <td className="p-3">
                            <div>
                              <span className="font-body-md text-body-md font-medium text-secondary hover:text-secondary-container hover:underline decoration-secondary underline-offset-2">
                                {deal.deal_name}
                              </span>
                              {/* Feature 7: Follow-up count */}
                              {(deal.followup_count ?? 0) > 0 && (
                                <p className="font-body-sm text-body-sm text-on-surface-variant/70 mt-0.5 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">history</span>
                                  Followed up {deal.followup_count}× {deal.last_followup_date && `· Last: ${deal.last_followup_date}`}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-body-sm text-body-sm text-on-surface-variant">{deal.account_name}</td>

                          {/* Feature 9: Inline stage editing — click badge to show dropdown */}
                          <td className="p-3">
                            {isEditingStage ? (
                              <select
                                autoFocus
                                defaultValue={deal.stage || ''}
                                className="px-2 py-1.5 rounded-lg font-label-sm text-label-sm bg-surface border border-secondary text-on-surface focus:outline-none cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStageChange(deal.deal_id, e.target.value)}
                                onBlur={() => setEditingStageDealId(null)}
                              >
                                {PIPELINE_STAGES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingStageDealId(deal.deal_id); }}
                                title="Click to change stage"
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded font-label-sm text-label-sm border transition-all hover:ring-2 hover:ring-secondary/30 ${stageBadgeStyle}`}
                              >
                                {deal.stage || 'N/A'}
                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                              </button>
                            )}
                          </td>

                          {/* Epic 3: Inline Amount Editing */}
                          <td className="p-3 font-mono-data text-mono-data text-on-surface-variant group/cell">
                            {editingAmountDealId === deal.deal_id ? (
                              <input
                                autoFocus
                                type="number"
                                defaultValue={deal.amount || 0}
                                className="w-24 px-2 py-1 rounded bg-surface border border-secondary text-on-surface focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => handleAmountChange(deal.deal_id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAmountChange(deal.deal_id, e.currentTarget.value);
                                  if (e.key === 'Escape') setEditingAmountDealId(null);
                                }}
                              />
                            ) : (
                              <div
                                onClick={(e) => { e.stopPropagation(); setEditingAmountDealId(deal.deal_id); }}
                                className="cursor-pointer hover:bg-surface-container rounded px-1 -ml-1 transition-colors flex items-center gap-1"
                                title="Click to edit amount"
                              >
                                ${(deal.amount || 0).toLocaleString()}
                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/cell:opacity-100 transition-opacity">edit</span>
                              </div>
                            )}
                          </td>

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

                          {/* Feature 4: Action Status label */}
                          {activeTab === 'active' && (
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-label-sm text-label-sm ${actionCfg.bg} ${actionCfg.color}`}>
                                <span className="text-xs">{actionCfg.icon}</span>
                                {actionCfg.label}
                              </span>
                            </td>
                          )}

                          <td className="p-3 font-mono-data text-mono-data">{deal.ml_score}%</td>
                          <td className="p-3 font-mono-data text-mono-data font-bold">{deal.ai_score}%</td>

                          {/* Epic 3: Inline Closing Date Editing */}
                          <td className="p-3 font-body-sm text-body-sm text-on-surface-variant group/cell">
                            {editingDateDealId === deal.deal_id ? (
                              <input
                                autoFocus
                                type="date"
                                defaultValue={deal.closing_date || ''}
                                className="w-32 px-2 py-1 rounded bg-surface border border-secondary text-on-surface focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => handleDateChange(deal.deal_id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleDateChange(deal.deal_id, e.currentTarget.value);
                                  if (e.key === 'Escape') setEditingDateDealId(null);
                                }}
                              />
                            ) : (
                              <div
                                onClick={(e) => { e.stopPropagation(); setEditingDateDealId(deal.deal_id); }}
                                className="cursor-pointer hover:bg-surface-container rounded px-1 -ml-1 transition-colors flex items-center gap-1"
                                title="Click to edit date"
                              >
                                {deal.closing_date || 'N/A'}
                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/cell:opacity-100 transition-opacity">edit</span>
                              </div>
                            )}
                          </td>

                          {/* Actions column: Insights + Generate Message + Mark Followed Up */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Feature 6: Generate AI Message */}
                              {activeTab === 'active' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMessageGenDeal(deal); }}
                                  title="Generate AI Message"
                                  className="p-1.5 rounded-md text-on-surface-variant hover:bg-[#25D366]/10 hover:text-[#25D366] transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                </button>
                              )}
                              {/* Feature 7: Mark as Followed Up */}
                              {activeTab === 'active' && deal.action_status !== 'followed_up' && (
                                <button
                                  onClick={(e) => handleMarkFollowedUp(e, deal)}
                                  disabled={markFollowedUp.isPending}
                                  title="Mark as Followed Up"
                                  className="p-1.5 rounded-md text-on-surface-variant hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors disabled:opacity-40"
                                >
                                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                </button>
                              )}
                              {/* Insights drawer */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDealId(deal.deal_id);
                                }}
                                className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-variant transition-colors shadow-sm group-hover:bg-secondary group-hover:text-white"
                              >
                                Insights
                              </button>
                              {/* Epic 2: Delete deal */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete "${deal.deal_name}"? This action cannot be undone.`)) {
                                    deleteDeal.mutate(deal.deal_id, {
                                      onSuccess: (res) => {
                                        toast({ title: '🗑️ Deal Deleted', description: res.message, variant: 'success' });
                                        if (selectedDealId === deal.deal_id) setSelectedDealId(null);
                                      },
                                      onError: (err) => {
                                        toast({ title: 'Delete Failed', description: err.message || 'Could not delete deal.', variant: 'destructive' });
                                      },
                                    });
                                  }
                                }}
                                title="Delete deal"
                                className="p-1.5 rounded-md text-on-surface-variant hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
      <CreateDealModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      {messageGenDeal && (
        <MessageGeneratorModal
          deal={messageGenDeal}
          onClose={() => setMessageGenDeal(null)}
        />
      )}

      {/* ── Invite Team Modal ── */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md mx-4 p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-title-lg text-on-surface">Invite Team Member</h3>
                <p className="font-body-sm text-on-surface-variant text-sm">A signup link will be emailed to them</p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5" htmlFor="invite-email">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
                />
              </div>

              <div>
                <label className="block font-label-sm text-on-surface-variant mb-1.5" htmlFor="invite-role">
                  Role
                </label>
                <Select
                  value={inviteRole}
                  onChange={setInviteRole}
                  options={[
                    { value: 'rep', label: 'Sales Rep' },
                    { value: 'manager', label: 'Sales Manager' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>

              <button
                id="btn-invite-submit"
                type="submit"
                disabled={inviteLoading}
                className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {inviteLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Send Invitation</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
