/**
 * AppLayout.tsx — Rabih CRM App Shell (ZaWolf Edition)
 *
 * Changes from Stitch design review:
 *  - ZaWolf logo shown in sidebar brand section
 *  - Nav order: Home (Deals Pipeline) → Dashboard → Accounts → Reports → Automations
 *  - CTA button renamed "New Deal" (single, no duplicate)
 *  - NotificationBell moved to top sticky header (visible on all pages)
 *  - Help link added to sidebar footer
 */
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../services/api';
import NotificationBell from './NotificationBell';
import ProfileDrawer from './ProfileDrawer';
import CreateDealModal from './CreateDealModal';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  stub?: boolean;
}

/**
 * Primary navigation — Home (deals pipeline) is FIRST, then Dashboard.
 * Matches the Stitch "North Star Dashboard" revised spec.
 */
const PRIMARY_NAV: NavItem[] = [
  { icon: 'home',         label: 'Home',        path: '/home' },         // All Deals Pipeline
  { icon: 'analytics',   label: 'Dashboard',   path: '/dashboard' },
  { icon: 'insights',    label: 'Analytics',   path: '/analytics' },    // Analytics Dashboard
  { icon: 'auto_mode',   label: 'Automations', path: '/integrations', stub: true },
];

const FOOTER_NAV: NavItem[] = [
  { icon: 'settings', label: 'Settings', path: '/settings' },
  { icon: 'group',    label: 'Team',     path: '/team' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [newDealOpen,   setNewDealOpen]   = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user_me'],
    queryFn: userApi.getMe,
  });

  const isActive = (item: NavItem) => location.pathname === item.path;

  // ── Page title for top header ──
  const currentPage =
    PRIMARY_NAV.find((item) => item.path === location.pathname)?.label ||
    FOOTER_NAV.find((item) => item.path === location.pathname)?.label ||
    'Rabih CRM';

  // ─── Sidebar Content ───────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Brand — ZaWolf logo */}
      <div>
        <div className="mb-6 flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/home')}>
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-outline-variant flex items-center justify-center flex-shrink-0 shadow-sm">
            <img
              src="/Rabih_Logo.jpeg"
              alt="Rabih CRM"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <h1 className="font-headline-md text-[18px] font-black text-on-surface leading-tight tracking-tight">
              Rabih CRM
            </h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              Enterprise Intelligence · رابح
            </p>
          </div>
        </div>

        {/* ── New Deal CTA ── */}
        <button
          id="btn-new-deal"
          onClick={() => setNewDealOpen(true)}
          className="mb-6 w-full py-3 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-secondary/20"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>New Deal</span>
        </button>

        {/* ── Primary Nav ── */}
        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={`${item.path}-${item.label}`}
                id={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl font-label-md text-label-md transition-all duration-150 ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.stub && !active && (
                  <span className="ml-auto text-[10px] font-label-sm text-on-surface-variant/50 bg-surface-container rounded px-1">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer Nav ── */}
      <div className="pt-4 border-t border-outline-variant space-y-1">
        {/* User profile row */}
        <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all group cursor-pointer">
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setProfileOpen(true); setMobileOpen(false); }}
            onKeyDown={(e) => e.key === 'Enter' && setProfileOpen(true)}
            className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold flex-shrink-0"
          >
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setProfileOpen(true); setMobileOpen(false); }}
            onKeyDown={(e) => e.key === 'Enter' && setProfileOpen(true)}
            className="text-left flex-1 overflow-hidden"
          >
            <p className="font-label-md text-on-surface leading-none truncate group-hover:text-primary transition-colors">
              {user?.name || user?.email || 'Profile'}
            </p>
            <p className="font-label-sm text-on-surface-variant uppercase text-[10px] mt-0.5">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Settings / Team */}
        {FOOTER_NAV.filter((item) => item.path !== '/team' || user?.role === 'admin').map((item) => (
          <button
            key={item.path}
            id={`nav-${item.label.toLowerCase()}`}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md transition-all duration-150 ${
              isActive(item)
                ? 'bg-secondary-container text-on-secondary-container font-bold'
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </button>
        ))}

        {/* Help */}
        <button
          id="nav-help"
          onClick={() => window.open('mailto:support@zawolf.ai', '_blank')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
          Help
        </button>

        {/* Dark mode toggle */}
        <button
          id="btn-toggle-theme"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* Logout */}
        <button
          id="btn-logout"
          onClick={() => { logout(); setMobileOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col md:flex-row">

      {/* ─── Desktop Sidebar ─── */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant py-gutter px-4 z-40 justify-between">
        {sidebarContent}
      </nav>

      {/* ─── Mobile Top Bar ─── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-outline-variant sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-white border border-outline-variant/30 flex-shrink-0">
            <img src="/Rabih_Logo.jpeg" alt="Rabih CRM" className="w-full h-full object-contain" />
          </div>
          <span className="font-label-md text-on-surface font-black text-sm">Rabih CRM</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            id="btn-mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-surface-container transition-colors"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-surface-container-low border-r border-outline-variant py-gutter px-4 z-50 flex flex-col justify-between md:hidden drawer-slide-in-left">
            {sidebarContent}
          </nav>
        </>
      )}

      {/* ─── Main Content Canvas ─── */}
      <main className="flex-1 md:ml-64 flex flex-col" style={{ minHeight: '100vh' }}>
        {/* ── Sticky Top Header (desktop) — NotificationBell lives here ── */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 bg-surface border-b border-outline-variant sticky top-0 z-[60]">
          {/* Page breadcrumb */}
          <div className="flex items-center gap-2 text-on-surface-variant">
            <img src="/Rabih_Logo.jpeg" alt="" className="w-5 h-5 rounded object-contain bg-white border border-outline-variant/20" />
            <span className="font-label-sm text-label-sm">/</span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">{currentPage}</span>
          </div>
          {/* Actions: Notification bell + Avatar */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="h-5 w-px bg-outline-variant" />
            <button
              id="btn-header-profile"
              onClick={() => setProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-primary/30 transition-all"
              title="Open profile"
            >
              {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
            </button>
          </div>
        </div>

        {/* Page content — scrolls naturally */}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {/* ─── Profile Drawer ─── */}
      <ProfileDrawer isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* ─── New Deal Modal ─── */}
      <CreateDealModal open={newDealOpen} onClose={() => setNewDealOpen(false)} />
    </div>
  );
}
