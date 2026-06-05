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
  follow_up_due: { icon: 'schedule', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  deal_updated: { icon: 'update', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  score_changed: { icon: 'trending_up', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  system: { icon: 'info', color: 'text-on-surface-variant', bg: 'bg-surface-container' },
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

  // Close on click outside
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
    if (!n.is_read) {
      markRead.mutate(n.id);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        id="notification-bell"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 md:right-auto md:left-0 top-full mt-2 w-80 sm:w-96 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="font-label-sm text-label-sm text-secondary hover:text-secondary/80 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-2">notifications_off</span>
                <p className="font-body-md text-body-md text-on-surface-variant">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-surface-container ${
                      !n.is_read ? 'bg-secondary/5' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className="material-symbols-outlined text-[18px]">{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-label-md text-label-md truncate ${!n.is_read ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
