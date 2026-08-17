'use client';

import React from 'react';
import { 
  X, Bell, CheckCheck, Trash2, Download, AlertTriangle, 
  Music, Sparkles, Smartphone, Mic2, Check, ExternalLink,
  ChevronRight, ArrowRight, Laptop
} from 'lucide-react';
import { useNotificationStore, NotificationItem, NotificationType } from '@/context/useNotificationStore';
import { usePlayerStore } from '@/context/usePlayerStore';

function formatNotificationTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'download_completed':
      return <Download className="w-4 h-4 text-emerald-400" />;
    case 'download_failed':
    case 'download_paused':
    case 'insufficient_storage':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'new_release':
    case 'playlist_updated':
      return <Music className="w-4 h-4 text-[#FA233B]" />;
    case 'personalized_mix':
      return <Sparkles className="w-4 h-4 text-yellow-400" />;
    case 'device_connected':
    case 'playback_transferred':
      return <Laptop className="w-4 h-4 text-cyan-400" />;
    case 'lyrics_available':
      return <Mic2 className="w-4 h-4 text-purple-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
}

export function NotificationCenterModal() {
  const { 
    isOpen, 
    setOpen, 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    dismissNotification, 
    clearAll 
  } = useNotificationStore();
  const { setActiveTab } = usePlayerStore();

  if (!isOpen) return null;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const twoDaysMs = 48 * 60 * 60 * 1000;

  const todayNotifications = notifications.filter(n => (now - n.timestamp) < oneDayMs);
  const yesterdayNotifications = notifications.filter(n => (now - n.timestamp) >= oneDayMs && (now - n.timestamp) < twoDaysMs);
  const earlierNotifications = notifications.filter(n => (now - n.timestamp) >= twoDaysMs);

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.actionPayload?.tab) {
      setActiveTab(item.actionPayload.tab as any);
      setOpen(false);
    }
  };

  const renderSection = (title: string, items: NotificationItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider px-1">
          {title}
        </h4>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 group relative ${
                item.read 
                  ? 'bg-white/[0.03] border-white/5 hover:border-white/15' 
                  : 'bg-white/[0.08] border-white/15 hover:border-[#FA233B]/40 shadow-md'
              }`}
            >
              {/* Type Icon Badge */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                item.read ? 'bg-white/5 border-white/5' : 'bg-white/10 border-white/15'
              }`}>
                {getNotificationIcon(item.type)}
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h5 className={`text-xs font-bold truncate ${item.read ? 'text-slate-300' : 'text-white'}`}>
                    {item.title}
                  </h5>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                    {formatNotificationTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {item.message}
                </p>
              </div>

              {/* Unread indicator / Dismiss */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!item.read && (
                  <span className="w-2 h-2 rounded-full bg-[#FA233B]" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded-lg transition-opacity"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md h-[85vh] max-h-[680px] bg-[#0c0d14]/95 border border-white/15 rounded-3xl flex flex-col overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FA233B]/15 border border-[#FA233B]/30 flex items-center justify-center text-[#FA233B]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FA233B] text-white text-[10px] font-mono font-black">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400">Activity Center & Updates</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors text-xs flex items-center gap-1 font-semibold"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-colors text-xs"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No notifications</h4>
              <p className="text-xs text-slate-500 max-w-[220px]">
                You're all caught up! New downloads, artist releases, and device alerts will appear here.
              </p>
            </div>
          ) : (
            <>
              {renderSection('Today', todayNotifications)}
              {renderSection('Yesterday', yesterdayNotifications)}
              {renderSection('Earlier', earlierNotifications)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
