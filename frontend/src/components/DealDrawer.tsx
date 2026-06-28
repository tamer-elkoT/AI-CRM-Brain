import { useState } from 'react';
import { useDealDetail, useMarkActioned, useEscalateDeal, useMarkFollowedUp, useUpdateStage } from '../hooks/useDeals';
import { useToast } from './ui/Toast';
import { MessageCircle, Mail, AlertOctagon } from 'lucide-react';
import type { DealDetail } from '../types';
import OutreachModal from './OutreachModal';
import MessageGeneratorModal from './MessageGeneratorModal';

// ─── Feature 4: Action status display config ───
const ACTION_STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  need_action_now: { label: 'Need Action — Now', icon: '🔴', color: 'text-red-600', bg: 'bg-red-500/10' },
  need_action_3days: { label: 'Need Action — 3 Days', icon: '🟡', color: 'text-amber-600', bg: 'bg-amber-500/10' },
  followed_up: { label: 'Followed Up', icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  no_action: { label: 'No Action', icon: '⬜', color: 'text-on-surface-variant', bg: 'bg-surface-container' },
};

// ─── Feature 9: Allowed pipeline stages ───
const PIPELINE_STAGES = [
  'Qualification', 'Needs Analysis', 'Value Proposition',
  'Identify Decision Makers', 'Proposal/Price Quote',
  'Negotiation/Review', 'Closed Won', 'Closed Lost',
];

interface DealDrawerProps {
  dealId: string;
  onClose: () => void;
}

function ProbabilityBreakdown({ deal }: { deal: DealDetail }) {
  const delta = deal.adjusted_probability - deal.base_probability;
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaColor = delta >= 0 ? 'text-secondary' : 'text-error';

  return (
    <div className="space-y-5">
      {/* Base ML Score */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">model_training</span>
            Base ML Score (RandomForest)
          </span>
          <span className="font-mono-data text-mono-data text-on-surface">{deal.base_probability}%</span>
        </div>
        <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-outline-variant rounded-full transition-all duration-1000 ease-out progress-animate"
            style={{ width: `${deal.base_probability}%` }}
          />
        </div>
      </div>

      {/* LLM Adjustment Delta */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface rounded-lg border border-outline-variant">
        <span className="material-symbols-outlined text-secondary text-xl">psychology</span>
        <div className="flex-1">
          <p className="font-label-sm text-label-sm text-on-surface-variant">LLM Intelligence Adjustment</p>
          <p className="font-label-md text-label-md text-on-surface">Contextual signals, risk factors, deal history</p>
        </div>
        <span className={`font-mono-data text-mono-data font-bold ${deltaColor}`}>
          {deltaSign}{delta.toFixed(1)}%
        </span>
      </div>

      {/* Final AI Score */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-label-sm text-label-sm text-secondary font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            Final AI Adjusted Score
          </span>
          <span className="font-mono-data text-mono-data text-on-surface font-bold">{deal.adjusted_probability}%</span>
        </div>
        <div className="w-full h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary-fixed-dim to-secondary transition-all duration-1000 ease-out progress-animate"
            style={{ width: `${deal.adjusted_probability}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function FeatureVectorDisplay({ features }: { features: Record<string, number> }) {
  const sorted = Object.entries(features)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 6);

  const maxAbsValue = Math.max(...sorted.map(([, v]) => Math.abs(v)), 1);

  return (
    <div className="space-y-3">
      {sorted.map(([name, value]) => {
        const isPositive = value >= 0;
        const barWidth = (Math.abs(value) / maxAbsValue) * 100;
        return (
          <div key={name} className="flex items-center gap-3">
            <span className="font-label-sm text-label-sm text-on-surface-variant w-32 truncate text-right">{name}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-secondary' : 'bg-error'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`font-mono-data text-mono-data w-12 text-right ${isPositive ? 'text-secondary' : 'text-error'}`}>
                {isPositive ? '+' : ''}{value.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DealDrawer({ dealId, onClose }: DealDrawerProps) {
  const { data: deal, isLoading } = useDealDetail(dealId);
  const markActioned = useMarkActioned();
  const escalateDeal = useEscalateDeal();
  const markFollowed = useMarkFollowedUp();
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachMode, setOutreachMode] = useState<'whatsapp' | 'email'>('whatsapp');
  const [showMessageGen, setShowMessageGen] = useState(false);
  const [editingStage, setEditingStage] = useState(false);

  const handleAction = () => {
    markActioned.mutate(dealId, { onSuccess: onClose });
  };

  const handleMarkFollowedUp = () => {
    markFollowed.mutate(
      { dealId, data: { channel: 'manual', notes: 'Marked from deal drawer' } },
      {
        onSuccess: (res) => {
          toast({ title: '✅ Followed Up', description: res.message, variant: 'success' });
        },
        onError: (err) => {
          toast({ title: 'Error', description: err.message || 'Failed to record follow-up', variant: 'destructive' });
        },
      }
    );
  };

  const handleStageChange = (newStage: string) => {
    setEditingStage(false);
    updateStage.mutate(
      { dealId, newStage },
      {
        onSuccess: (res) => {
          toast({ title: '🔄 Stage Updated', description: res.message, variant: 'success' });
        },
        onError: (err) => {
          toast({ title: 'Update Failed', description: err.message || 'Could not update stage', variant: 'destructive' });
        },
      }
    );
  };

  if (isLoading || !deal) {
    return (
      <div className="fixed inset-0 bg-primary-container/20 backdrop-blur-layer z-[70] flex justify-end">
        <div className="w-full max-w-[600px] h-full bg-surface-container-lowest shadow-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary" />
        </div>
      </div>
    );
  }

  const actionCfg = ACTION_STATUS_CONFIG[deal.action_status || 'no_action'] || ACTION_STATUS_CONFIG.no_action;

  return (
    <div className="fixed inset-0 bg-primary-container/20 backdrop-blur-layer z-[70] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-[600px] h-full bg-surface-container-lowest shadow-[0px_10px_15px_rgba(15,23,42,0.1)] flex flex-col drawer-slide-in border-l border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Pinned Drawer Header (Stitch refined design) ── */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-lowest z-10 sticky top-0">
          <div>
            {/* Brand label */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-primary font-bold text-label-sm tracking-widest uppercase font-label-md">
                Rabih CRM • رابح
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-primary-container flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                monetization_on
              </span>
              {deal.deal_name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                ID: #{deal.deal_id}
              </p>
              {/* Feature 4: Action status badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-xs ${actionCfg.bg} ${actionCfg.color}`}
              >
                <span className="text-[10px]">{actionCfg.icon}</span>
                {actionCfg.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAction}
              disabled={markActioned.isPending}
              className="bg-primary text-on-primary px-4 py-2 rounded-xl font-label-md text-label-md hover:opacity-90 transition-all shadow-sm disabled:opacity-50 hidden sm:flex items-center gap-2"
            >
              Edit Deal
            </button>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* ── Deal Metadata (Stitch icon-card grid) ── */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-4 uppercase tracking-wider">
              Deal Metadata
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: 'business', label: 'Account', value: deal.account_name },
                { icon: 'payments', label: 'Amount', value: `$${deal.amount.toLocaleString()}`, mono: true },
                { icon: 'event', label: 'Closing', value: deal.closing_date },
                { icon: 'person', label: 'Owner', value: deal.owner_name || 'Unknown' },
                { icon: 'phone', label: 'Client Phone', value: deal.client_phone || 'N/A' },
                { icon: 'mail', label: 'Client Email', value: deal.client_email || 'N/A' },
              ].map(({ icon, label, value, mono }) => (
                <div
                  key={label}
                  className="bg-surface-container-low rounded-2xl border border-outline-variant/30 p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-2 bg-white rounded-xl text-primary flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
                    <p
                      className={`text-on-primary-container font-semibold mt-0.5 break-words ${
                        mono ? 'font-mono-data text-mono-data' : 'font-body-md text-body-md'
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature 9: Stage with inline editing */}
            <div className="mt-4 bg-surface rounded-lg border border-outline-variant p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">step</span>
              <div className="flex-1">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Stage</p>
                {editingStage ? (
                  <select
                    autoFocus
                    defaultValue={deal.stage}
                    className="mt-1 w-full px-2 py-1.5 rounded-lg font-body-md text-body-md bg-surface border border-secondary text-on-surface focus:outline-none"
                    onChange={(e) => handleStageChange(e.target.value)}
                    onBlur={() => setEditingStage(false)}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingStage(true)}
                    className="mt-1 font-body-md text-body-md text-on-surface font-medium flex items-center gap-1.5 hover:text-secondary transition-colors group"
                  >
                    {deal.stage}
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Feature 7: Follow-up history */}
            {(deal.followup_count ?? 0) > 0 && (
              <div className="mt-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20 p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600">history</span>
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Follow-up History</p>
                  <p className="font-body-md text-body-md text-on-surface font-medium mt-0.5">
                    Followed up {deal.followup_count} time{deal.followup_count !== 1 ? 's' : ''}
                    {deal.last_followup_date && <span className="text-on-surface-variant"> · Last: {deal.last_followup_date}</span>}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Predictive Probability KPI Cards (Stitch refined design) ── */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-4 uppercase tracking-wider">
              Predictive Probability
            </h3>
            <div className="flex gap-4">
              {/* Base ML Score */}
              <div className="flex-1 bg-surface-container-low rounded-2xl border border-outline-variant/30 p-5 shadow-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Base ML Score</p>
                <div className="flex items-end gap-2">
                  <span className="font-headline-md text-headline-md text-on-primary-container">
                    {deal.base_probability}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-outline-variant/20 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-outline-variant rounded-full progress-animate"
                    style={{ width: `${deal.base_probability}%` }}
                  />
                </div>
              </div>

              {/* Rabih AI Score — highlighted card */}
              <div className="flex-1 bg-white rounded-2xl border-2 border-primary p-5 shadow-level-2 relative overflow-hidden">
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full -mr-4 -mt-4" />
                <p className="font-label-sm text-label-sm text-primary font-bold mb-2 flex items-center gap-1.5 relative z-10">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  Rabih AI Score
                </p>
                <div className="flex items-end gap-2 relative z-10">
                  <span className="font-headline-md text-headline-md text-on-primary-container">
                    {deal.adjusted_probability}%
                  </span>
                  {/* Delta indicator */}
                  {(() => {
                    const delta = deal.adjusted_probability - deal.base_probability;
                    const sign = delta >= 0 ? '+' : '';
                    return (
                      <div className="bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-primary text-[14px]">
                          {delta >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        <span className="font-label-sm text-label-sm text-primary font-bold">
                          {sign}{delta.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="w-full h-1.5 bg-outline-variant/20 rounded-full mt-3 overflow-hidden relative z-10">
                  <div
                    className="h-full rounded-full bg-primary progress-animate"
                    style={{ width: `${deal.adjusted_probability}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* AI Intelligence */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-4 uppercase tracking-wider">AI Intelligence</h3>
            <div className="space-y-4">
              {/* Analyze Closure Probability */}
              <div className="bg-surface rounded-lg border border-outline-variant overflow-hidden">
                <button
                  onClick={() => setAnalysisOpen(!analysisOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-surface-bright transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">query_stats</span>
                    <span className="font-label-md text-label-md text-on-surface">🔍 Analyze Closure Probability</span>
                  </div>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${analysisOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {analysisOpen && (
                  <div className="px-4 pb-5 pt-2 border-t border-outline-variant">
                    <ProbabilityBreakdown deal={deal} />
                  </div>
                )}
              </div>

              {/* Feature Factors */}
              <div className="bg-surface rounded-lg border border-outline-variant overflow-hidden">
                <button
                  onClick={() => setFactorsOpen(!factorsOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-surface-bright transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">analytics</span>
                    <span className="font-label-md text-label-md text-on-surface">Why this score? (Impact Factors)</span>
                  </div>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${factorsOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {factorsOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-outline-variant">
                    {deal.feature_vector && Object.keys(deal.feature_vector).length > 0 ? (
                      <FeatureVectorDisplay features={deal.feature_vector} />
                    ) : (
                      <p className="text-sm text-on-surface-variant py-2">Feature importance data not available for this deal.</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Arabic RTL Recommendation Box (Stitch refined design) ── */}
              <div
                className="bg-primary-container rounded-2xl p-6 rtl-content text-on-primary-container relative overflow-hidden shadow-level-2"
                dir="rtl"
                lang="ar"
              >
                {/* Decorative language icon watermark */}
                <div className="absolute -top-4 -right-4 text-white/5 opacity-10 pointer-events-none">
                  <span className="material-symbols-outlined text-[100px]">language</span>
                </div>
                {/* Header */}
                <div className="flex items-center justify-start gap-3 mb-4 relative z-10">
                  <div className="p-1.5 bg-primary/20 rounded-lg">
                    <span className="material-symbols-outlined text-primary-fixed-dim">tips_and_updates</span>
                  </div>
                  <h4 className="font-label-md text-label-md text-primary-fixed-dim font-bold">
                    توصية رابح (Rabih CRM)
                  </h4>
                </div>
                {/* Arabic recommendation text — RTL with increased line-height for Arabic script */}
                <p
                  className="font-body-md text-body-md relative z-10"
                  style={{ lineHeight: '1.9', fontFamily: "'Noto Sans Arabic', 'Inter', sans-serif" }}
                >
                  {deal.recommendation_ar}
                </p>
              </div>

              {/* English Translation */}
              {deal.recommendation_en && (
                <div className="bg-surface-container-low rounded-2xl p-5 text-on-surface border border-outline-variant shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">translate</span>
                    <h4 className="font-label-md text-label-md text-on-primary-container font-bold">
                      English Translation
                    </h4>
                  </div>
                  <p className="font-body-md text-body-md leading-relaxed text-on-surface">
                    {deal.recommendation_en}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-4 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Feature 6: Generate AI Message button */}
              <button
                onClick={() => setShowMessageGen(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 rounded-lg font-label-md text-sm transition-colors border border-purple-500/30"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Generate AI Message
              </button>
              <button
                onClick={() => { setOutreachMode('whatsapp'); setShowOutreachModal(true); }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-lg font-label-md text-sm transition-colors border border-[#25D366]/30"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Client
              </button>
              {deal.client_email ? (
                <button
                  onClick={() => { setOutreachMode('email'); setShowOutreachModal(true); }}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-container-high text-on-surface hover:bg-surface-variant rounded-lg font-label-md text-sm transition-colors border border-outline-variant"
                >
                  <Mail className="w-4 h-4" />
                  Email Client
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-container-high text-on-surface-variant/50 rounded-lg font-label-md text-sm border border-outline-variant cursor-not-allowed" title="No email available for this deal">
                  <Mail className="w-4 h-4" />
                  Email (N/A)
                </div>
              )}
              <button
                onClick={() => {
                  escalateDeal.mutate(dealId, {
                    onSuccess: () => {
                      toast({
                        title: 'Deal Escalated',
                        description: `Urgent review request for "${deal.deal_name}" sent to Manager.`,
                        variant: 'destructive',
                      });
                    }
                  });
                }}
                disabled={escalateDeal.isPending}
                className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-label-md text-sm transition-colors border border-red-200 disabled:opacity-50"
              >
                <AlertOctagon className="w-4 h-4" />
                Escalate to Manager
              </button>
            </div>
          </section>
        </div>

        {/* ── Sticky Footer Actions (Stitch refined design) ── */}
        <div className="p-6 border-t border-outline-variant bg-surface-container-lowest sticky bottom-0 z-10 flex flex-wrap justify-between items-center gap-3">
          {/* Left: Follow-up action */}
          <div className="flex gap-2">
            {deal.action_status !== 'followed_up' && (
              <button
                id="btn-mark-followed-up"
                onClick={handleMarkFollowedUp}
                disabled={markFollowed.isPending}
                className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-4 py-2.5 rounded-xl font-label-md text-label-md flex items-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                {markFollowed.isPending ? 'Saving...' : 'Mark Followed Up'}
              </button>
            )}
          </div>

          {/* Right: Dismiss + Mark Actioned */}
          <div className="flex gap-4 items-center">
            <button
              id="btn-dismiss-drawer"
              onClick={onClose}
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              Dismiss
            </button>
            <button
              id="btn-mark-actioned"
              onClick={handleAction}
              disabled={markActioned.isPending}
              className="bg-primary text-on-primary px-8 py-3 rounded-xl font-label-md text-label-md flex items-center gap-2.5 hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  markActioned.isPending ? 'animate-spin' : ''
                }`}
              >
                check_circle
              </span>
              Mark Actioned
            </button>
          </div>
        </div>
      </div>
      
      {showOutreachModal && deal && (
        <OutreachModal
          deal={deal}
          mode={outreachMode}
          onClose={() => setShowOutreachModal(false)}
        />
      )}

      {showMessageGen && deal && (
        <MessageGeneratorModal
          deal={deal}
          onClose={() => setShowMessageGen(false)}
        />
      )}
    </div>
  );
}
