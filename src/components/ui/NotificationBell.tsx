'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import NotificationDetailDialog, { type NotificationItem } from './NotificationDetailDialog';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=5', { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      if (result.success) {
        setItems(result.data.notifications);
        setUnreadCount(result.data.unreadCount);
      }
    } catch {
      // The bell remains unobtrusive during temporary network failures.
    }
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(loadNotifications, 0);
    const timer = window.setInterval(loadNotifications, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') loadNotifications(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item?.readAt) return;
    const response = await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: id }) });
    if (!response.ok) throw new Error('Unable to mark notification as read.');
    setItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, readAt: new Date().toISOString() } : candidate));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  const openNotification = async (item: NotificationItem) => {
    setOpen(false);
    setSelectedId(item.id);
    setDetailError(null);
    try {
      await markRead(item.id);
    } catch {
      setDetailError('This notification opened, but it could not be marked as read. Check your connection and try again.');
    }
  };

  return (
    <>
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96" aria-label="Recent notifications">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
              <p className="text-[11px] text-slate-500">{unreadCount ? `${unreadCount} awaiting review` : 'You are all caught up'}</p>
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
          </div>
          <div className="max-h-[55dvh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">No workflow notifications yet.</p>
            ) : items.map((item) => (
              <article key={item.id} className={`flex items-start border-b border-slate-100 px-3 py-2 ${item.readAt ? '' : 'bg-emerald-50/60'}`}>
                <button type="button" onClick={() => openNotification(item)} className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600" aria-label={`View details for ${item.title}`}>
                  <div className="flex gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-emerald-600'}`} />
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-slate-800">{item.title}</p>
                      <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">{item.message}</p>
                      <time className="mt-1 block text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-xs font-bold text-emerald-700 hover:bg-emerald-50">View all and manage email</Link>
        </section>
      )}
    </div>
    {selectedItem && (
      <NotificationDetailDialog
        item={selectedItem}
        readError={detailError}
        onClose={() => { setSelectedId(null); setDetailError(null); }}
      />
    )}
    </>
  );
}
