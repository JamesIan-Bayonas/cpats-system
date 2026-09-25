'use client';

import { ArchiveRestore, ArrowLeft, ArrowUpRight, Bell, CheckCheck, Clock3, Inbox, Link2, MailCheck, ShieldCheck, Trash2, Unlink } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  NotificationDetailBody,
  notificationActionLabel,
  notificationActionPath,
  type NotificationItem,
} from '@/components/ui/NotificationDetailDialog';
import NotificationTrashDialog, { type NotificationTrashSchedule } from '@/components/ui/NotificationTrashDialog';

interface Settings { notificationEmail: string | null; pendingEmail: string | null; emailVerifiedAt: string | null; emailNotificationsEnabled: boolean }

const emptySettings: Settings = { notificationEmail: null, pendingEmail: null, emailVerifiedAt: null, emailNotificationsEnabled: false };

function NotificationInlineReader({
  item,
  readError,
  onBack,
}: {
  item: NotificationItem;
  readError?: string | null;
  onBack: () => void;
}) {
  return (
    <article aria-labelledby="notification-reader-title" className="min-w-0">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          Back to notifications
        </button>

        <div className="mt-4 flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Bell className="size-4 shrink-0" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">Workflow notification</p>
            <h2 id="notification-reader-title" className="mt-1 break-words text-lg font-bold leading-6 tracking-tight text-slate-950 sm:text-xl">
              {item.title}
            </h2>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-5">
        <NotificationDetailBody item={item} readError={readError} />
      </div>

      <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Back to notifications
        </button>
        {notificationActionPath(item).startsWith('/dashboard/pr/track') && (
          <Link href="/dashboard/pr/new" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
            Open requester workspace
          </Link>
        )}
        <Link
          href={notificationActionPath(item)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          {notificationActionLabel(item.actionPath)}
          <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [activeView, setActiveView] = useState<'inbox' | 'trash'>('inbox');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [trashDialog, setTrashDialog] = useState<{ mode: 'move' | 'permanent'; ids: string[] } | null>(null);
  const [trashBusy, setTrashBusy] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notificationResponse, settingsResponse] = await Promise.all([
        fetch(`/api/notifications?limit=100&view=${activeView}`, { cache: 'no-store' }),
        fetch('/api/notifications/settings', { cache: 'no-store' }),
      ]);
      const notificationResult = await notificationResponse.json();
      const settingsResult = await settingsResponse.json();
      if (notificationResult.success) {
        setItems(notificationResult.data.notifications);
        setUnreadCount(notificationResult.data.unreadCount);
        setTrashCount(notificationResult.data.trashCount);
      }
      if (settingsResult.success) {
        setSettings(settingsResult.data);
        setEmail(settingsResult.data.pendingEmail || settingsResult.data.notificationEmail || '');
      }
    } catch {
      setMessage({ type: 'error', text: 'Notifications could not be loaded. Please refresh the page.' });
    } finally {
      setLoading(false);
    }
  }, [activeView]);

  useEffect(() => {
    const initialTimer = window.setTimeout(load, 0);
    return () => window.clearTimeout(initialTimer);
  }, [load]);

  async function apiRequest(url: string, method: 'POST' | 'PATCH', body: object) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'The request could not be completed.');
    return result.data;
  }

  const requestCode = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const data = await apiRequest('/api/notifications/settings/request-verification', 'POST', { email });
      setSettings((current) => ({ ...current, pendingEmail: data.pendingEmail }));
      setDevCode(data.devVerificationCode || null);
      setMessage({ type: 'success', text: 'Verification code sent. Enter it below within 15 minutes.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to send code.' }); }
    finally { setSaving(false); }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const data = await apiRequest('/api/notifications/settings/verify', 'POST', { code });
      setSettings((current) => ({ ...current, ...data, pendingEmail: null }));
      setCode(''); setDevCode(null);
      setMessage({ type: 'success', text: 'Email verified. Workflow email notifications are now enabled.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to verify code.' }); }
    finally { setSaving(false); }
  };

  const toggleDelivery = async () => {
    setSaving(true); setMessage(null);
    try {
      const data = await apiRequest('/api/notifications/settings', 'PATCH', { emailNotificationsEnabled: !settings.emailNotificationsEnabled });
      setSettings((current) => ({ ...current, ...data }));
      setMessage({ type: 'success', text: data.emailNotificationsEnabled ? 'Email notifications enabled.' : 'Email notifications paused. In-app alerts remain active.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update setting.' }); }
    finally { setSaving(false); }
  };

  const unlink = async () => {
    setSaving(true); setMessage(null);
    try {
      await apiRequest('/api/notifications/settings', 'PATCH', { unlink: true });
      setSettings(emptySettings); setEmail(''); setCode(''); setDevCode(null);
      setMessage({ type: 'success', text: 'Notification email unlinked. In-app alerts remain active.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to unlink email.' }); }
    finally { setSaving(false); }
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read', 'POST', { all: true });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item?.readAt) {
      await apiRequest('/api/notifications/read', 'POST', { notificationId: id });
      setItems((current) => current.map((entry) => entry.id === id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  };

  const openNotification = async (item: NotificationItem) => {
    setSelectedId(item.id);
    setDetailError(null);
    try {
      await markRead(item.id);
    } catch {
      setDetailError('This notification opened, but it could not be marked as read. Check your connection and try again.');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  };

  const changeView = (view: 'inbox' | 'trash') => {
    setActiveView(view);
    setSelectedIds([]);
    setSelectedId(null);
    setDetailError(null);
  };

  const openTrashDialog = (mode: 'move' | 'permanent', ids: string[]) => {
    setTrashError(null);
    setTrashDialog({ mode, ids });
  };

  const manageTrash = async (schedule?: NotificationTrashSchedule) => {
    if (!trashDialog) return;
    setTrashBusy(true);
    setTrashError(null);
    try {
      await apiRequest('/api/notifications/trash', 'POST', {
        action: trashDialog.mode === 'move' ? 'move' : 'deletePermanently',
        notificationIds: trashDialog.ids,
        ...(trashDialog.mode === 'move' && schedule ? schedule : {}),
      });
      const affected = trashDialog.ids.length;
      setTrashDialog(null);
      setSelectedIds([]);
      setMessage({
        type: 'success',
        text: trashDialog.mode === 'move'
          ? `${affected} notification${affected === 1 ? '' : 's'} moved to Trash.`
          : `${affected} notification${affected === 1 ? '' : 's'} permanently deleted. Procurement records were not changed.`,
      });
      await load();
    } catch (error) {
      setTrashError(error instanceof Error ? error.message : 'The notification action could not be completed.');
    } finally {
      setTrashBusy(false);
    }
  };

  const restoreNotifications = async (ids: string[]) => {
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest('/api/notifications/trash', 'POST', { action: 'restore', notificationIds: ids });
      setSelectedIds([]);
      setMessage({ type: 'success', text: `${ids.length} notification${ids.length === 1 ? '' : 's'} restored to the inbox.` });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'The notifications could not be restored.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          aria-label="Back to your main dashboard"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          Back to dashboard
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Role inbox</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">See updates about your requests and work assigned to your office. You can also send these alerts to an email address you control.</p>
      </div>

      {message && <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message.text}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Bell className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Workflow activity</h2><p className="text-xs text-slate-500">{activeView === 'inbox' ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : `${trashCount} notification${trashCount === 1 ? '' : 's'} in trash`}</p></div></div>
            {activeView === 'inbox' && unreadCount > 0 && <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"><CheckCheck className="h-4 w-4" />Mark all read</button>}
          </div>

          <div className="flex border-b border-slate-200 px-4 sm:px-5" role="tablist" aria-label="Notification folders">
            <button type="button" role="tab" aria-selected={activeView === 'inbox'} onClick={() => changeView('inbox')} className={`inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-xs font-bold transition-colors ${activeView === 'inbox' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Inbox className="h-4 w-4" />Inbox</button>
            <button type="button" role="tab" aria-selected={activeView === 'trash'} onClick={() => changeView('trash')} className={`inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-xs font-bold transition-colors ${activeView === 'trash' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Trash2 className="h-4 w-4" />Trash{trashCount > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{trashCount}</span>}</button>
          </div>

          {selectedItem ? (
            <NotificationInlineReader
              item={selectedItem}
              readError={detailError}
              onBack={() => {
                setSelectedId(null);
                setDetailError(null);
              }}
            />
          ) : (
            <>
          {!loading && items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 sm:px-5">
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={selectedIds.length === items.length} onChange={(event) => setSelectedIds(event.target.checked ? items.map((item) => item.id) : [])} className="size-4 accent-emerald-700" />Select all</label>
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-[11px] text-slate-500">{selectedIds.length} selected</span>
                  {activeView === 'inbox' ? (
                    <button type="button" onClick={() => openTrashDialog('move', selectedIds)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-50"><Trash2 className="h-3.5 w-3.5" />Move to trash</button>
                  ) : (
                    <>
                      <button type="button" disabled={saving} onClick={() => restoreNotifications(selectedIds)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"><ArchiveRestore className="h-3.5 w-3.5" />Restore</button>
                      <button type="button" onClick={() => openTrashDialog('permanent', selectedIds)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white hover:bg-rose-800"><Trash2 className="h-3.5 w-3.5" />Delete permanently</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500">Loading notifications…</p> : items.length === 0 ? (
            <div className="px-5 py-14 text-center">{activeView === 'inbox' ? <Bell className="mx-auto h-8 w-8 text-slate-300" /> : <Trash2 className="mx-auto h-8 w-8 text-slate-300" />}<p className="mt-3 text-sm font-semibold text-slate-700">{activeView === 'inbox' ? 'No notifications yet' : 'Trash is empty'}</p><p className="mt-1 text-xs text-slate-500">{activeView === 'inbox' ? 'New work will appear here when it reaches your role.' : 'Notifications moved to trash will remain recoverable here until their scheduled deletion date.'}</p></div>
          ) : <div className="divide-y divide-slate-100">{items.map((item) => (
            <article key={item.id} className={`flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4 ${activeView === 'inbox' && !item.readAt ? 'bg-emerald-50/50' : 'bg-white'}`}>
              <label className="grid size-10 shrink-0 cursor-pointer place-items-center" aria-label={`Select ${item.title}`}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} className="size-4 accent-emerald-700" /></label>
              <button type="button" onClick={() => openNotification(item)} className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600" aria-label={`View details for ${item.title}`}>
                <div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${activeView === 'trash' || item.readAt ? 'bg-slate-200' : 'bg-emerald-600'}`} /><div className="min-w-0"><p className="break-words text-sm font-bold text-slate-800">{item.title}</p><p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400"><time>{new Date(item.createdAt).toLocaleString()}</time>{activeView === 'trash' && item.purgeAfter && <span className="inline-flex items-center gap-1 font-medium text-amber-700"><Clock3 className="h-3 w-3" />Deletes {new Date(item.purgeAfter).toLocaleDateString()}</span>}</div></div></div>
              </button>
              {activeView === 'trash' && (
                <div className="flex shrink-0 items-center gap-1 pt-1">
                    <button type="button" disabled={saving} onClick={() => restoreNotifications([item.id])} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50" aria-label={`Restore ${item.title}`}><ArchiveRestore className="h-4 w-4" /></button>
                    <button type="button" onClick={() => openTrashDialog('permanent', [item.id])} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${item.title} permanently`}><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </article>
          ))}</div>}
            </>
          )}
        </section>

        <aside className="min-w-0 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><Link2 className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Email delivery</h2><p className="text-xs text-slate-500">Optional external alert address</p></div></div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-700" />Your CPATS sign-in stays separate. You never provide CPATS your Gmail password.</div>

          {settings.notificationEmail ? (
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified address</p><p className="mt-1 break-all text-sm font-semibold text-slate-800">{settings.notificationEmail}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                <button disabled={saving} onClick={toggleDelivery} className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-50 ${settings.emailNotificationsEnabled ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-emerald-700 text-white hover:bg-emerald-800'}`}>{settings.emailNotificationsEnabled ? 'Pause email alerts' : 'Enable email alerts'}</button>
                <button disabled={saving} onClick={unlink} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Unlink className="h-3.5 w-3.5" />Unlink</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Status: <span className={settings.emailNotificationsEnabled ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{settings.emailNotificationsEnabled ? 'Enabled' : 'Paused'}</span></p>
            </div>
          ) : (
            <>
              <form onSubmit={requestCode} className="mt-5 space-y-3"><label className="block text-xs font-bold text-slate-700" htmlFor="notification-email">Email address</label><input id="notification-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.name@gmail.com" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><button disabled={saving} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><MailCheck className="h-4 w-4" />Send verification code</button></form>
              {settings.pendingEmail && <form onSubmit={verifyCode} className="mt-5 border-t border-slate-100 pt-5"><label className="block text-xs font-bold text-slate-700" htmlFor="verification-code">8-character code sent to {settings.pendingEmail}</label>{devCode && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 font-mono text-xs text-amber-900">Demo code: {devCode}</p>}<input id="verification-code" required maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm uppercase tracking-[0.2em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><button disabled={saving} className="mt-3 min-h-10 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Verify and enable</button></form>}
            </>
          )}
        </aside>
      </div>

      {trashDialog && (
        <NotificationTrashDialog
          mode={trashDialog.mode}
          itemCount={trashDialog.ids.length}
          busy={trashBusy}
          error={trashError}
          onClose={() => { if (!trashBusy) { setTrashDialog(null); setTrashError(null); } }}
          onConfirm={manageTrash}
        />
      )}
    </main>
  );
}
