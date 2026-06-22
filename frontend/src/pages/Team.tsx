import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  admin:   { label: 'Admin',   color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'shield_person' },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: 'manage_accounts' },
  rep:     { label: 'Sales Rep', color: 'bg-green-100 text-green-700 border-green-200',  icon: 'person' },
};

export default function Team() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteRole, setInviteRole]     = useState<'rep' | 'manager'>('rep');
  const [inviting, setInviting]         = useState(false);
  const [inviteResult, setInviteResult] = useState<{ link: string; token: string } | null>(null);
  const [inviteError, setInviteError]   = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const [testingScheduler, setTestingScheduler] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState<string | null>(null);

  // ── Fetch team members ─────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/team/members');
      setMembers(res.data);
    } catch {
      setError('Could not load team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Send Invite ────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const res = await api.post('/auth/invite', { email: inviteEmail.trim(), role: inviteRole });
      const token = res.data.invite_token;
      const link = `${window.location.origin}/signup/team?token=${token}`;
      setInviteResult({ link, token });
    } catch (e: any) {
      setInviteError(e.response?.data?.detail || 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('rep');
    setInviteResult(null);
    setInviteError(null);
    setCopied(false);
  };

  // ── Trigger scheduler test ─────────────────────────────────────────────────
  const handleTestScheduler = async () => {
    setTestingScheduler(true);
    setSchedulerResult(null);
    try {
      const res = await api.post('/followups/trigger-scheduler');
      setSchedulerResult(`✅ ${res.data.message || 'Scheduler triggered. Check WhatsApp!'}`);
    } catch (e: any) {
      setSchedulerResult(`❌ ${e.response?.data?.detail || 'Failed to trigger scheduler.'}`);
    } finally {
      setTestingScheduler(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px]">lock</span>
        <p className="font-body-lg">Only admins can manage the team.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-on-surface text-2xl font-bold">Team Management</h1>
          <p className="font-body-md text-on-surface-variant mt-1">
            Invite sales reps and managers. Their name must match the deal owner name in Zoho.
          </p>
        </div>
        <button
          id="invite-member-btn"
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Invite Member
        </button>
      </div>

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-blue-600 mt-0.5 shrink-0">info</span>
        <div>
          <p className="font-label-md text-blue-800 mb-1">How WhatsApp notifications work</p>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Invite a rep → they sign up with their <strong>name exactly as in Zoho deal owner</strong></li>
            <li>They set their <strong>WhatsApp phone number</strong> in Settings → Profile</li>
            <li>The scheduler matches <code className="bg-blue-100 px-1 rounded">deal.owner_name</code> → <code className="bg-blue-100 px-1 rounded">User.name</code> and sends alerts</li>
          </ol>
        </div>
      </div>

      {/* Test Scheduler Button */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-label-md text-on-surface">🧪 Test WhatsApp Notifications</p>
          <p className="font-body-sm text-on-surface-variant">Manually trigger the follow-up scheduler to send alerts now.</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            id="trigger-scheduler-btn"
            onClick={handleTestScheduler}
            disabled={testingScheduler}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-white font-label-md hover:bg-[#1fad53] transition disabled:opacity-50"
          >
            {testingScheduler ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">send</span>Send Now</>
            )}
          </button>
          {schedulerResult && (
            <p className="text-xs text-on-surface-variant max-w-[220px] text-right">{schedulerResult}</p>
          )}
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-level-1">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-label-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
            Team Members ({members.length})
          </h2>
          <button onClick={fetchMembers} className="p-1.5 rounded-full hover:bg-surface-container transition">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-error">
            <span className="material-symbols-outlined text-4xl mb-2 block">error</span>
            {error}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 block">group_off</span>
            No team members yet. Invite your first rep!
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {members.map((m) => {
              const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS['rep'];
              return (
                <div key={m.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container/50 transition">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                    {m.name?.charAt(0) || m.email.charAt(0)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-label-md text-on-surface truncate">{m.name || '—'}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${roleInfo.color}`}>
                        <span className="material-symbols-outlined text-[12px]">{roleInfo.icon}</span>
                        {roleInfo.label}
                      </span>
                      {!m.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">Inactive</span>
                      )}
                    </div>
                    <p className="font-body-sm text-on-surface-variant truncate">{m.email}</p>
                  </div>
                  {/* Phone */}
                  <div className="text-right shrink-0">
                    {m.phone_number ? (
                      <div className="flex items-center gap-1 text-[#25D366]">
                        <span className="material-symbols-outlined text-[14px]">phone_iphone</span>
                        <span className="font-body-sm">{m.phone_number}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">phone_disabled</span>
                        No phone — won't get alerts
                      </span>
                    )}
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zoho Owner Matching Helper */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="font-label-md text-amber-800 flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          Name must match Zoho deal owner exactly
        </p>
        <p className="font-body-sm text-amber-700">
          Go to <strong>Zoho CRM → Deals</strong> and note the exact "Owner" name for each deal (e.g. "Ahmed Hassan").
          The rep must sign up with that <strong>exact name</strong> so the scheduler can match them and send WhatsApp alerts.
        </p>
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) resetInviteModal(); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-on-surface">Invite Team Member</h3>
                  <p className="font-body-sm text-on-surface-variant">Send a magic link to join your workspace</p>
                </div>
              </div>
              <button onClick={resetInviteModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {!inviteResult ? (
                <>
                  {/* Email */}
                  <div>
                    <label className="block font-label-sm text-on-surface mb-1.5">Email Address</label>
                    <input
                      id="invite-email-input"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="ahmed.hassan@company.com"
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-on-surface focus:outline-none focus:border-primary transition"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block font-label-sm text-on-surface mb-1.5">Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['rep', 'manager'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setInviteRole(r)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
                            inviteRole === r
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[24px]">
                            {r === 'rep' ? 'person' : 'manage_accounts'}
                          </span>
                          <span className="font-label-md">{r === 'rep' ? 'Sales Rep' : 'Manager'}</span>
                          <span className="text-xs text-center opacity-70">
                            {r === 'rep' ? 'Sees own deals only' : 'Sees all deals'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700">
                      <strong>⚠️ Important:</strong> When the rep signs up, their <strong>Name</strong> must exactly match their deal owner name in Zoho CRM.
                    </p>
                  </div>

                  {inviteError && (
                    <p className="text-sm text-error bg-error/5 border border-error/20 rounded-lg px-3 py-2">{inviteError}</p>
                  )}

                  <button
                    id="send-invite-btn"
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {inviting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating link...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">send</span>Generate Invite Link</>
                    )}
                  </button>
                </>
              ) : (
                /* Success State */
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-3xl">🎉</div>
                    <div className="text-center">
                      <p className="font-headline-sm text-on-surface">Invite Ready!</p>
                      <p className="font-body-sm text-on-surface-variant mt-1">Share this link with your team member.</p>
                    </div>
                  </div>

                  <div className="bg-surface-container rounded-xl p-3">
                    <p className="font-label-sm text-on-surface-variant mb-1.5">Magic Link (expires in 48h)</p>
                    <p className="font-body-sm text-on-surface break-all text-xs leading-relaxed">{inviteResult.link}</p>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">📋 Tell the rep to:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Open the link and sign up</li>
                      <li>Use their <strong>exact Zoho owner name</strong></li>
                      <li>Add their <strong>WhatsApp phone number</strong></li>
                      <li>Log in and check Settings ✅</li>
                    </ol>
                  </div>

                  <button
                    onClick={resetInviteModal}
                    className="w-full px-4 py-2 border border-outline-variant rounded-xl font-label-md text-on-surface hover:bg-surface-container transition"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
