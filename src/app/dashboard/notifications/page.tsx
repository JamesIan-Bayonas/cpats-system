'use client';

import { Bell, CheckCheck, Link2, MailCheck, ShieldCheck, Unlink } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

interface NotificationItem { id: string; title: string; message: string; actionPath: string; readAt: string | null; createdAt: string }
interface Settings { notificationEmail: string | null; pendingEmail: string | null; emailVerifiedAt: string | null; emailNotificationsEnabled: boolean }

const emptySettings: Settings = { notificationEmail: null, pendingEmail: null, emailVerifiedAt: null, emailNotificationsEnabled: false };

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [notificationResponse, settingsResponse] = await Promise.all([
        fetch('/api/notifications?limit=100', { cache: 'no-store' }),
        fetch('/api/notifications/settings', { cache: 'no-store' }),
      ]);
      const notificationResult = await notificationResponse.json();
      const settingsResult = await settingsResponse.json();
      if (notificationResult.success) {
        setItems(notificationResult.data.notifications);
        setUnreadCount(notificationResult.data.unreadCount);
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
  }, []);

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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Role inbox</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">See requests that have reached your office and optionally send the same alerts to an email address you control.</p>
      </div>

      {message && <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message.text}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Bell className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Workflow activity</h2><p className="text-xs text-slate-500">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p></div></div>
            {unreadCount > 0 && <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"><CheckCheck className="h-4 w-4" />Mark all read</button>}
          </div>
          {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500">Loading notifications…</p> : items.length === 0 ? (
            <div className="px-5 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No notifications yet</p><p className="mt-1 text-xs text-slate-500">New work will appear here when it reaches your role.</p></div>
          ) : <div className="divide-y divide-slate-100">{items.map((item) => (
            <Link key={item.id} href={item.actionPath} onClick={() => markRead(item.id)} className={`block px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5 ${item.readAt ? '' : 'bg-emerald-50/50'}`}>
              <div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-emerald-600'}`} /><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{item.title}</p><p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p><time className="mt-1.5 block text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div></div>
            </Link>
          ))}</div>}
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
    </main>
  );
}
