import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeProvider';
import { userApi, authApi, ingestionApi, whatsappApi } from '../services/api';

export default function Settings() {
  const { logout, user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // ── Profile edit state ──────────────────────────────────────────────────────
  const [profileName, setProfileName]     = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePhone, setProfilePhone]   = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [profileError, setProfileError]   = useState('');

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileUsername(user.username || '');
      setProfilePhone(user.phone_number || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError('');
    try {
      await userApi.updateTemplates({
        name: profileName,
        username: profileUsername,
        phone_number: profilePhone,
      });
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setProfileError(typeof detail === 'string' ? detail : 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Template management state ───────────────────────────────────────────────
  const [waTemplate, setWaTemplate]       = useState('');
  const [emailTpl, setEmailTpl]           = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setWaTemplate(user.whatsapp_template || '');
      setEmailTpl(user.email_template || '');
    }
  }, [user]);

  const handleSaveTemplates = async () => {
    setTemplateSaving(true);
    setTemplateSaved(false);
    try {
      await userApi.updateTemplates({ whatsapp_template: waTemplate, email_template: emailTpl });
      await refreshUser();
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save templates', err);
    } finally {
      setTemplateSaving(false);
    }
  };

  // ── Notification preferences ────────────────────────────────────────────────
  const [emailNotifications, setEmailNotifications] = useState(() => localStorage.getItem('pref-email-notifications') !== 'false');
  const [autoSync, setAutoSync]             = useState(() => localStorage.getItem('pref-auto-sync') === 'true');
  const [arabicRecs, setArabicRecs]         = useState(() => localStorage.getItem('pref-arabic-recs') !== 'false');

  useEffect(() => { localStorage.setItem('pref-email-notifications', String(emailNotifications)); }, [emailNotifications]);
  useEffect(() => { localStorage.setItem('pref-auto-sync', String(autoSync)); }, [autoSync]);
  useEffect(() => { localStorage.setItem('pref-arabic-recs', String(arabicRecs)); }, [arabicRecs]);

  // ── WhatsApp Connect state ──────────────────────────────────────────────────
  const [waConnected, setWaConnected]     = useState(false);
  const [waPhone, setWaPhone]             = useState<string | null>(null);
  const [waServiceDown, setWaServiceDown] = useState(false);
  const [showQRModal, setShowQRModal]     = useState(false);
  const [qrImage, setQrImage]             = useState<string | null>(null);
  const [qrStatus, setQrStatus]           = useState<'pending' | 'connected' | 'waiting' | 'error' | 'loading'>('loading');
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrTimedOut, setQrTimedOut]       = useState(false);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showQRRef     = useRef(showQRModal);
  useEffect(() => { showQRRef.current = showQRModal; }, [showQRModal]);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await whatsappApi.getStatus();
      setWaConnected(s.connected);
      setWaPhone(s.phone);
      setWaServiceDown(false);
      if (s.connected && showQRRef.current) setShowQRModal(false);
    } catch {
      setWaServiceDown(true);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    statusPollRef.current = setInterval(fetchStatus, 15000); // poll every 15s (not 4s) to avoid log spam
    return () => { if (statusPollRef.current) clearInterval(statusPollRef.current); };
  }, [fetchStatus]);

  const fetchQR = useCallback(async () => {
    try {
      const data = await whatsappApi.getQR();
      setQrStatus(data.status);
      setQrImage(data.qr);
    } catch {
      setQrStatus('error');
    }
  }, []);

  useEffect(() => {
    if (showQRModal) {
      setQrStatus('loading');
      setQrImage(null);
      setQrTimedOut(false);
      fetchQR();
      qrPollRef.current = setInterval(fetchQR, 5000);
      // Show a helpful timeout message if QR hasn't appeared in 30s
      qrTimeoutRef.current = setTimeout(() => setQrTimedOut(true), 30000);
    } else {
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      setQrTimedOut(false);
    }
    return () => {
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    };
  }, [showQRModal, fetchQR]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await whatsappApi.disconnect();
      setWaConnected(false);
      setWaPhone(null);
    } catch (e) {
      console.error('Disconnect error', e);
    } finally {
      setDisconnecting(false);
    }
  };

  // ── CSV/Excel upload (Admin only) ────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState('');
  const [uploadError, setUploadError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (user?.company_id) fd.append('company_id', user.company_id);
      const res = await ingestionApi.uploadCustomData(fd);
      setUploadMsg(`✅ ${res.message} (${res.deals_inserted} deals inserted)`);
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Zoho OAuth (Admin only) ──────────────────────────────────────────────────
  const [zohoConnecting, setZohoConnecting] = useState(false);
  const handleConnectZoho = async () => {
    setZohoConnecting(true);
    try {
      const { auth_url } = await authApi.initiateZohoOAuth();
      window.location.href = auth_url;
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Could not initiate Zoho OAuth. Check ZOHO_CLIENT_ID in .env.';
      alert(detail);
      setZohoConnecting(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-secondary' : 'bg-outline-variant'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${value ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );

  return (
    <>
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Settings</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Profile Card (Epic 1.3 + 1.4) ── */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xl font-bold">
                {user?.name ? user.name[0].toUpperCase() : '?'}
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{user?.name || 'Your Profile'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                    {user?.role?.toUpperCase() || 'REP'}
                  </span>
                  {user?.company_name && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant border border-outline-variant">
                      <span className="material-symbols-outlined text-[12px]">domain</span>
                      {user.company_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {profileError && (
              <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">{profileError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface-variant focus:outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-secondary transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Username</label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="@username"
                    className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Phone</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+966 50 123 4567"
                    className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {profileSaved && (
                  <span className="font-label-sm text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Saved!
                  </span>
                )}
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="px-5 py-2 bg-secondary text-on-secondary rounded-lg font-label-md hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {profileSaving ? (
                    <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">save</span>Save Profile</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── WhatsApp + Notifications Card ── */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                <span className="material-symbols-outlined">notifications_active</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">🔔 Notifications & WhatsApp</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Link WhatsApp to receive deal alerts</p>
              </div>
            </div>

            {/* WhatsApp Connection Section */}
            <div className="mb-5 pb-5 border-b border-outline-variant">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-label-md text-on-surface flex items-center gap-2">
                    <span className="text-xl">📱</span> WhatsApp
                  </p>
                  <p className="font-body-sm text-on-surface-variant mt-0.5">Link your phone to receive deal alerts</p>
                </div>
                {waServiceDown ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Service Offline
                  </span>
                ) : waConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30">
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" />Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-500" />Disconnected
                  </span>
                )}
              </div>

              {waConnected && waPhone && (
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-[#25D366]/5 rounded-lg border border-[#25D366]/20">
                  <span className="text-[#25D366] material-symbols-outlined text-[18px]">phone_iphone</span>
                  <span className="font-body-sm text-on-surface">+{waPhone}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-[#25D366]">
                    <span className="material-symbols-outlined text-[14px]">verified</span>Verified
                  </span>
                </div>
              )}

              {waServiceDown && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-semibold mb-1">⚠️ Microservice offline. Start it:</p>
                  <code className="block text-xs bg-amber-100 text-amber-800 rounded px-2 py-1.5">
                    cd whatsapp-microservice &amp;&amp; npm start
                  </code>
                </div>
              )}

              <div className="flex gap-2">
                {!waConnected && !waServiceDown && (
                  <button
                    id="whatsapp-connect-btn"
                    onClick={() => setShowQRModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] text-white font-label-md hover:bg-[#1fad53] transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                    Scan QR to Connect
                  </button>
                )}
                {waConnected && (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">link_off</span>
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                )}
                {waServiceDown && (
                  <button
                    onClick={fetchStatus}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Retry
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-label-md text-on-surface">Email Notifications</p>
                  <p className="font-body-sm text-on-surface-variant">Alerts for urgent deals</p>
                </div>
                <Toggle value={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
              </div>
              {waConnected && (
                <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-lg p-3">
                  <p className="font-body-sm text-on-surface-variant">
                    <span className="font-label-sm text-[#25D366]">Active:</span> You'll receive WhatsApp alerts for:
                  </p>
                  <ul className="mt-1.5 space-y-1 font-body-sm text-on-surface-variant">
                    <li className="flex items-center gap-2"><span className="text-xs">🚨</span>Risk deals: High amount + low AI probability</li>
                    <li className="flex items-center gap-2"><span className="text-xs">🔥</span>Hot leads: AI probability &gt; 85%</li>
                    <li className="flex items-center gap-2"><span className="text-xs">⏰</span>Deferred follow-ups that are due today</li>
                  </ul>
                </div>
              )}
            </div>
          </div>


          {/* ── CRM Integration Card (Admin Only) ── */}
          {isAdmin && (
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined">cloud_sync</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">CRM Integration</h3>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Connect your data source</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Zoho Connect */}
                <button
                  onClick={handleConnectZoho}
                  disabled={zohoConnecting}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Zoho_logo.svg/120px-Zoho_logo.svg.png" alt="Zoho" className="h-6" />
                    <div className="text-left">
                      <p className="font-label-md text-blue-800">Connect Zoho CRM</p>
                      <p className="text-xs text-blue-600">OAuth 2.0 — syncs deals to your workspace</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-blue-600">
                    {zohoConnecting ? 'hourglass_empty' : 'open_in_new'}
                  </span>
                </button>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-outline-variant" />
                  <span className="mx-3 text-xs text-on-surface-variant">or upload manually</span>
                  <div className="flex-grow border-t border-outline-variant" />
                </div>

                {/* CSV/Excel Upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  id="settings-file-upload"
                />
                <label
                  htmlFor="settings-file-upload"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary/5 transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant">upload_file</span>
                  <span className="font-label-md text-on-surface-variant">
                    {uploading ? 'Processing...' : 'Upload CSV or Excel file'}
                  </span>
                </label>

                {uploadMsg && <p className="text-sm text-emerald-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>{uploadMsg}</p>}
                {uploadError && <p className="text-sm text-red-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">error</span>{uploadError}</p>}
                <p className="text-xs text-on-surface-variant">Columns: Deal_Name, Amount, Stage, Closing_Date, Owner_Name, Account_Name, Probability</p>
              </div>
            </div>
          )}

          {/* ── Preferences Card ── */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined">tune</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Preferences</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Application behavior</p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                    Dark Mode
                  </p>
                  <p className="font-body-sm text-on-surface-variant">Switch between light and dark themes</p>
                </div>
                <Toggle value={theme === 'dark'} onChange={toggleTheme} />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-on-surface">Auto-sync CRM Data</p>
                  <p className="font-body-sm text-on-surface-variant">Sync every 6 hours automatically</p>
                </div>
                <Toggle value={autoSync} onChange={() => setAutoSync(!autoSync)} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-label-md text-on-surface">Arabic Recommendations</p>
                  <p className="font-body-sm text-on-surface-variant">Show AI suggestions in Arabic (RTL)</p>
                </div>
                <Toggle value={arabicRecs} onChange={() => setArabicRecs(!arabicRecs)} />
              </div>
            </div>
          </div>

          {/* ── Outreach Templates Card ── */}
          {(!user || ['rep', 'Sales', 'sales_rep'].includes(user.role)) && (
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined">edit_note</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">📝 Outreach Templates</h3>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Customize your WhatsApp and Email intro</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-2 flex items-center gap-1.5">
                    <span className="text-[#25D366]">●</span>Custom WhatsApp Template
                  </label>
                  <textarea
                    rows={5}
                    value={waTemplate}
                    onChange={(e) => setWaTemplate(e.target.value)}
                    placeholder={"Hi [Client Name],\n\nHere's what our AI recommends:\n[AI recommendation]\n\nBest regards,\n[Your Name]"}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-secondary">mail</span>Custom Email Template
                  </label>
                  <textarea
                    rows={5}
                    value={emailTpl}
                    onChange={(e) => setEmailTpl(e.target.value)}
                    placeholder={"Dear [Client Name],\n\nHere's our AI insight:\n[AI recommendation]\n\nBest regards,\n[Your Name]"}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary transition-all resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-outline-variant">
                {templateSaved && (
                  <span className="font-label-sm text-secondary flex items-center gap-1 animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>Templates saved!
                  </span>
                )}
                <button
                  onClick={handleSaveTemplates}
                  disabled={templateSaving}
                  className="px-6 py-2.5 bg-secondary text-on-secondary rounded-lg font-label-md hover:opacity-90 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {templateSaving ? (
                    <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">save</span>Save Templates</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Danger Zone ── */}
          <div className="bg-surface-container-lowest border border-red-200 shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Danger Zone</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Irreversible actions</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-md text-on-surface">Sign out of your account</p>
                <p className="font-body-sm text-on-surface-variant">You will be redirected to the login page.</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-label-md hover:bg-red-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── WhatsApp QR Code Modal ── */}
      {showQRModal && (
        <div
          id="whatsapp-qr-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowQRModal(false); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                  <span className="text-white text-xl">💬</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-on-surface">Connect WhatsApp</h3>
                  <p className="font-body-sm text-on-surface-variant">Scan to link your account</p>
                </div>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {/* QR Code Area */}
            <div className="px-6 py-6 flex flex-col items-center min-h-[280px] justify-center">
              {qrStatus === 'connected' ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center text-4xl">✅</div>
                  <div className="text-center">
                    <p className="font-headline-sm text-on-surface">Connected!</p>
                    <p className="font-body-sm text-on-surface-variant mt-1">WhatsApp is linked successfully.</p>
                  </div>
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="px-6 py-2 bg-[#25D366] text-white rounded-lg font-label-md hover:bg-[#1fad53] transition"
                  >
                    Done
                  </button>
                </div>
              ) : qrStatus === 'loading' || (qrStatus === 'waiting' && !qrImage) ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  {!qrTimedOut ? (
                    <>
                      <div className="w-14 h-14 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
                      <div className="text-center">
                        <p className="font-body-md text-on-surface-variant">Generating QR code...</p>
                        <p className="text-xs text-on-surface-variant/60 mt-1">This takes a few seconds after disconnecting</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl">⏱️</span>
                      <div className="text-center">
                        <p className="font-label-md text-on-surface">Taking too long?</p>
                        <p className="font-body-sm text-on-surface-variant mt-1 max-w-[220px]">
                          Make sure the WhatsApp microservice is running, then retry.
                        </p>
                        <code className="block mt-2 text-xs bg-surface-container rounded px-3 py-1.5 text-left">
                          cd whatsapp-microservice && npm start
                        </code>
                      </div>
                      <button
                        onClick={() => { setQrTimedOut(false); fetchQR(); }}
                        className="px-4 py-2 bg-[#25D366] text-white rounded-lg font-label-md hover:bg-[#1fad53] transition"
                      >
                        Retry
                      </button>
                    </>
                  )}
                </div>
              ) : qrStatus === 'error' ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <span className="text-4xl">⚠️</span>
                  <div>
                    <p className="font-label-md text-on-surface">Microservice Not Running</p>
                    <p className="font-body-sm text-on-surface-variant mt-1">Open a terminal and run:</p>
                    <code className="block mt-2 text-xs bg-surface-container text-on-surface rounded px-3 py-2 text-left">
                      cd whatsapp-microservice<br />npm start
                    </code>
                  </div>
                  <button
                    onClick={fetchQR}
                    className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-on-surface hover:bg-surface-container transition"
                  >
                    Retry
                  </button>
                </div>
              ) : qrImage ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative p-2 bg-white rounded-xl shadow-md">
                    <img
                      src={qrImage}
                      alt="WhatsApp QR Code — scan with your phone"
                      className="w-56 h-56 rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                        <span className="text-2xl">💬</span>
                      </div>
                    </div>
                  </div>
                  <p className="font-body-sm text-on-surface-variant text-center text-xs">
                    ↻ QR refreshes automatically every 5 seconds
                  </p>
                </div>
              ) : null}
            </div>

            {/* Step-by-step instructions — show whenever a QR image is visible */}
            {qrImage && (
              <div className="px-6 pb-6">
                <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4">
                  <p className="font-label-sm text-[#25D366] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">info</span>How to scan:
                  </p>
                  <ol className="space-y-2 font-body-sm text-on-surface-variant">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[#25D366] shrink-0 w-5">1.</span>
                      Open WhatsApp on your phone
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[#25D366] shrink-0 w-5">2.</span>
                      Tap ⋮ Menu → <strong>Linked Devices</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[#25D366] shrink-0 w-5">3.</span>
                      Tap <strong>"Link a Device"</strong> and scan above
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
