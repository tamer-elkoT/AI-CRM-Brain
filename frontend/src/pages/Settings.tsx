import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeProvider';
import { userApi } from '../services/api';

export default function Settings() {
  const { logout, user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Template management state
  const [waTemplate, setWaTemplate] = useState('');
  const [emailTpl, setEmailTpl] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Load templates from user profile
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
      await userApi.updateTemplates({
        whatsapp_template: waTemplate,
        email_template: emailTpl,
      });
      await refreshUser();
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save templates', err);
    } finally {
      setTemplateSaving(false);
    }
  };

  // Notification preferences (persisted in localStorage for MVP)
  const [whatsappAlerts, setWhatsappAlerts] = useState(() => {
    return localStorage.getItem('pref-whatsapp-alerts') === 'true';
  });
  const [emailNotifications, setEmailNotifications] = useState(() => {
    return localStorage.getItem('pref-email-notifications') !== 'false'; // default ON
  });
  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem('pref-auto-sync') === 'true';
  });
  const [arabicRecs, setArabicRecs] = useState(() => {
    return localStorage.getItem('pref-arabic-recs') !== 'false'; // default ON
  });

  // Persist all toggles
  useEffect(() => {
    localStorage.setItem('pref-whatsapp-alerts', String(whatsappAlerts));
  }, [whatsappAlerts]);
  useEffect(() => {
    localStorage.setItem('pref-email-notifications', String(emailNotifications));
  }, [emailNotifications]);
  useEffect(() => {
    localStorage.setItem('pref-auto-sync', String(autoSync));
  }, [autoSync]);
  useEffect(() => {
    localStorage.setItem('pref-arabic-recs', String(arabicRecs));
  }, [arabicRecs]);

  return (
    <>
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-30">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div className="flex-1">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Settings</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Card */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Account Profile</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Your personal information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                  disabled
                />
              </div>
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Email</label>
                <input
                  type="email"
                  placeholder="user@company.com"
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                  disabled
                />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant italic">Profile editing coming in v1.1</p>
            </div>
          </div>

          {/* 🔔 Notification Preferences Card */}
          <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                <span className="material-symbols-outlined">notifications_active</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">🔔 Notification Preferences</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Configure deal alerts & notifications</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* WhatsApp Alerts Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                    <span className="text-[#25D366]">●</span>
                    WhatsApp Alerts
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Get WhatsApp notifications for urgent & hot deals
                  </p>
                </div>
                <button
                  onClick={() => setWhatsappAlerts(!whatsappAlerts)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    whatsappAlerts ? 'bg-[#25D366]' : 'bg-outline-variant'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      whatsappAlerts ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Email Notifications Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Email Notifications</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Get email alerts for urgent deals</p>
                </div>
                <button
                  onClick={() => setEmailNotifications(!emailNotifications)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    emailNotifications ? 'bg-secondary' : 'bg-outline-variant'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      emailNotifications ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {whatsappAlerts && (
                <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-lg p-3">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    <span className="font-label-sm text-[#25D366]">Active:</span> You'll receive WhatsApp messages when:
                  </p>
                  <ul className="mt-1.5 space-y-1 font-body-sm text-body-sm text-on-surface-variant">
                    <li className="flex items-center gap-2">
                      <span className="text-red-500 text-xs">🚨</span>
                      Risk deals: High amount + low AI probability
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-orange-500 text-xs">🔥</span>
                      Hot leads: AI probability &gt; 85% — ready to close
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 📝 Outreach Templates Card — Sales users only */}
          {(!user || user.role === 'Sales') && (
            <div className="bg-surface-container-lowest border border-outline-variant shadow-level-1 rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined">edit_note</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">📝 Outreach Templates</h3>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Customize your WhatsApp and Email intro/outro for client outreach</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* WhatsApp Template */}
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-2 flex items-center gap-1.5">
                    <span className="text-[#25D366]">●</span>
                    Custom WhatsApp Template
                  </label>
                  <textarea
                    rows={5}
                    value={waTemplate}
                    onChange={(e) => setWaTemplate(e.target.value)}
                    placeholder={"Hi [Client Name],\n\nI'm reaching out regarding your deal. Here's what our AI recommends:\n\n[AI recommendation will be auto-inserted here]\n\nBest regards,\n[Your Name]"}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary transition-all resize-none"
                  />
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                    This template will be pre-filled when you contact clients via WhatsApp from a deal.
                  </p>
                </div>

                {/* Email Template */}
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-secondary">mail</span>
                    Custom Email Template
                  </label>
                  <textarea
                    rows={5}
                    value={emailTpl}
                    onChange={(e) => setEmailTpl(e.target.value)}
                    placeholder={"Dear [Client Name],\n\nI wanted to share some insights about your deal:\n\n[AI recommendation will be auto-inserted here]\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]"}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary transition-all resize-none"
                  />
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                    This template will be pre-filled when you email clients from a deal.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-outline-variant">
                {templateSaved && (
                  <span className="font-label-sm text-label-sm text-secondary flex items-center gap-1 animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Templates saved!
                  </span>
                )}
                <button
                  onClick={handleSaveTemplates}
                  disabled={templateSaving}
                  className="px-6 py-2.5 bg-secondary text-on-secondary rounded-lg font-label-md text-label-md hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {templateSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Save Templates
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Preferences Card */}
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
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                    Dark Mode
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Switch between light and dark themes</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    theme === 'dark' ? 'bg-secondary' : 'bg-outline-variant'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      theme === 'dark' ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Auto-sync Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Auto-sync CRM Data</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Sync every 6 hours automatically</p>
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    autoSync ? 'bg-secondary' : 'bg-outline-variant'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      autoSync ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Arabic Recommendations Toggle */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Arabic Recommendations</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Show AI suggestions in Arabic (RTL)</p>
                </div>
                <button
                  onClick={() => setArabicRecs(!arabicRecs)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    arabicRecs ? 'bg-secondary' : 'bg-outline-variant'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                      arabicRecs ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
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
                <p className="font-label-md text-label-md text-on-surface">Sign out of your account</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">You will be redirected to the login page.</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-label-md text-label-md hover:bg-red-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
