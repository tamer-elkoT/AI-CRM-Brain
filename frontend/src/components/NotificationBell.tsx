import { useState, useRef, useEffect } from 'react';
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications';
import type { CrmNotification } from '../types';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  follow_up_due: { icon: 'schedule',    color: 'text-amber-600',          bg: 'bg-amber-50' },
  deal_updated:  { icon: 'update',      color: 'text-blue-600',           bg: 'bg-blue-50' },
  score_changed: { icon: 'trending_up', color: 'text-emerald-600',        bg: 'bg-emerald-50' },
  system:        { icon: 'info',        color: 'text-on-surface-variant', bg: 'bg-surface-container' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(1, 15);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadData?.unread_count ?? 0;
  const notifications = notifData?.items ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (n: CrmNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
  };

  return (
    <div className="relative" ref={ref}>
      {/* ── Bell Button ── */}
      <button
        id="notification-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-black flex items-center justify-center shadow-sm animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] z-[300] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">notifications</span>
              <h3 className="font-semibold text-base text-on-surface">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-error text-on-error text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs font-semibold text-secondary hover:text-secondary/70 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-14 text-center flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-[44px] text-on-surface-variant/30">
                  notifications_off
                </span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">All caught up!</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">No notifications yet</p>
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-container ${
                      !n.is_read ? 'bg-secondary/5' : 'bg-transparent'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="material-symbols-outlined text-[18px]">{cfg.icon}</span>
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-on-surface' : 'font-normal text-on-surface-variant'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[11px] text-on-surface-variant/60 mt-1.5 font-medium">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-lowest">
              <button className="w-full text-center text-sm font-semibold text-secondary hover:underline transition-colors">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
