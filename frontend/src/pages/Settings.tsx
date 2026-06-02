import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { logout } = useAuth();

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
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Email Notifications</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Get alerts for urgent deals</p>
                </div>
                <div className="w-11 h-6 bg-secondary rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Auto-sync CRM Data</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Sync every 6 hours automatically</p>
                </div>
                <div className="w-11 h-6 bg-outline-variant rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Arabic Recommendations</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Show AI suggestions in Arabic (RTL)</p>
                </div>
                <div className="w-11 h-6 bg-secondary rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-surface-container-lowest border border-red-200 shadow-level-1 rounded-xl p-6 lg:col-span-2">
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
