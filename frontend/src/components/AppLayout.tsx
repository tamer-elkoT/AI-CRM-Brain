import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'home', label: 'Home', path: '/home' },
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'integration_instructions', label: 'Integrations', path: '/integrations' },
  { icon: 'settings', label: 'Settings', path: '/settings' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
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
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md transition-colors ${
                  isActive
                    ? 'bg-surface-container-highest text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => {
          logout();
          setMobileOpen(false);
        }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        Sign Out
      </button>
    </>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col md:flex-row">
      {/* ─── Desktop Sidebar ─── */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant py-gutter px-4 z-40 justify-between">
        {sidebarContent}
      </nav>

      {/* ─── Mobile Header ─── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-outline-variant sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined fill text-[18px]">analytics</span>
          </div>
          <span className="font-headline-md text-headline-md font-black text-on-surface text-sm">AI CRM Brain</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-surface-container-low border-r border-outline-variant py-gutter px-4 z-50 flex flex-col justify-between md:hidden drawer-slide-in-left">
            {sidebarContent}
          </nav>
        </>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
