'use client';

import { AlertTriangle, CalendarDays, Clock3, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';

export type NotificationRetentionDays = 7 | 14 | 60;
export type NotificationTrashSchedule = { retentionDays: NotificationRetentionDays } | { purgeAfter: string };

const RETENTION_OPTIONS: Array<{ days: NotificationRetentionDays; label: string; description: string }> = [
  { days: 7, label: '1 week', description: 'Permanently delete 7 days after moving to trash.' },
  { days: 14, label: '2 weeks', description: 'Permanently delete 14 days after moving to trash.' },
  { days: 60, label: '2 months', description: 'Keep more time available for recovery.' },
];

const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 60;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function endOfLocalDay(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const result = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(result.getTime()) ? null : result;
}

export default function NotificationTrashDialog({
  mode,
  itemCount,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  mode: 'move' | 'permanent';
  itemCount: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (schedule?: NotificationTrashSchedule) => void;
}) {
  const [retentionChoice, setRetentionChoice] = useState<NotificationRetentionDays | 'custom'>(14);
  const [customDate, setCustomDate] = useState(() => toDateInputValue(addDays(new Date(), MIN_RETENTION_DAYS)));
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyboard);
      previouslyFocused?.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  const plural = itemCount === 1 ? 'notification' : 'notifications';
  const isPermanent = mode === 'permanent';
  const now = new Date();
  const minimumDate = toDateInputValue(addDays(now, MIN_RETENTION_DAYS));
  const maximumDate = toDateInputValue(addDays(now, MAX_RETENTION_DAYS));
  const customPurgeAfter = endOfLocalDay(customDate);
  const scheduledDeletion = retentionChoice === 'custom'
    ? customPurgeAfter
    : addDays(now, retentionChoice);
  const schedule: NotificationTrashSchedule | undefined = retentionChoice === 'custom'
    ? customPurgeAfter ? { purgeAfter: customPurgeAfter.toISOString() } : undefined
    : { retentionDays: retentionChoice };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (!busy && event.currentTarget === event.target) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${isPermanent ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
              {isPermanent ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <Trash2 className="size-4 shrink-0" aria-hidden="true" />}
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-950">{isPermanent ? `Delete ${plural} permanently?` : `Move ${plural} to trash?`}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{itemCount} selected {plural}</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={busy} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" aria-label="Close dialog"><X className="size-4 shrink-0" aria-hidden="true" /></button>
        </header>

        <div className="px-5 py-5 sm:px-6">
          {isPermanent ? (
            <p className="text-sm leading-6 text-slate-700">This removes the selected {plural} immediately. The related purchase request and its audit history will remain unchanged, but the notification cannot be restored.</p>
          ) : (
            <fieldset>
              <legend className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Clock3 className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />Choose when trash is permanently deleted</legend>
              <div className="mt-3 grid gap-2">
                {RETENTION_OPTIONS.map((option) => (
                  <label key={option.days} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${retentionChoice === option.days ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="notification-retention" value={option.days} checked={retentionChoice === option.days} onChange={() => setRetentionChoice(option.days)} className="mt-1 accent-emerald-700" />
                    <span><span className="block text-sm font-bold text-slate-800">{option.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{option.description}</span></span>
                  </label>
                ))}
                <div className={`rounded-xl border px-4 py-3 transition-colors ${retentionChoice === 'custom' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <label className="flex cursor-pointer items-start gap-3" htmlFor="notification-custom-purge-date">
                    <input type="radio" name="notification-retention" value="custom" checked={retentionChoice === 'custom'} onChange={() => setRetentionChoice('custom')} className="mt-1 accent-emerald-700" />
                    <span><span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />Choose a date</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Pick a date from 1 week to 2 months from today.</span></span>
                  </label>
                  {retentionChoice === 'custom' && (
                    <div className="mt-3 border-t border-emerald-200 pt-3">
                      <label htmlFor="notification-custom-purge-date" className="block text-xs font-semibold text-slate-700">Permanent deletion date</label>
                      <input id="notification-custom-purge-date" type="date" required min={minimumDate} max={maximumDate} value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">Scheduled deletion:</span> {scheduledDeletion?.toLocaleString() ?? 'Choose a valid date.'} You can restore these notifications before then.</p>
            </fieldset>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">{error}</p>}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => onConfirm(isPermanent ? undefined : schedule)} disabled={busy || (!isPermanent && !schedule)} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${isPermanent ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}><Trash2 className="size-4 shrink-0" aria-hidden="true" />{busy ? 'Working…' : isPermanent ? 'Delete permanently' : 'Move to trash'}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
