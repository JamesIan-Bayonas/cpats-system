'use client';

import { ArrowUpRight, Bell, CalendarDays, CircleCheck, FileText, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef } from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  actionPath: string;
  readAt: string | null;
  trashedAt?: string | null;
  purgeAfter?: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  '/dashboard/pr/evaluate-business': 'Open budget review',
  '/dashboard/pr/approve-admin': 'Open approval workspace',
  '/dashboard/po/new': 'Open PO preparation',
  '/dashboard/po/release-check': 'Open check issuance',
  '/dashboard/receiving/new': 'Open receiving workspace',
  '/dashboard/audit': 'Open audit record',
};

export function notificationRequestReference(message: string): string | null {
  return message.match(/\bPR-[A-Z0-9]+\b/i)?.[0]?.toUpperCase() ?? null;
}

export function notificationActionLabel(actionPath: string): string {
  return ACTION_LABELS[actionPath] ?? 'Open this workspace';
}

export function NotificationDetailBody({
  item,
  readError,
}: {
  item: NotificationItem;
  readError?: string | null;
}) {
  const reference = notificationRequestReference(item.message);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {reference && (
          <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">Request reference</p>
              <p className="mt-0.5 break-all text-sm font-bold text-slate-800">{reference}</p>
            </div>
          </div>
        )}
        <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">Received</p>
            <time className="mt-0.5 block text-sm font-semibold leading-5 text-slate-800" dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString()}
            </time>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-slate-500">Update</p>
        <p className="mt-2 break-words text-sm leading-6 text-slate-700">{item.message}</p>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>{item.readAt ? 'Marked as read' : 'Marking as read…'}</span>
      </div>

      {readError && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {readError}
        </p>
      )}
    </>
  );
}

export default function NotificationDetailDialog({
  item,
  readError,
  onClose,
}: {
  item: NotificationItem;
  readError?: string | null;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const actionLabel = notificationActionLabel(item.actionPath);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Bell className="size-4 shrink-0" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-700">Workflow notification</p>
              <h2 id={titleId} className="mt-1 text-lg font-bold leading-6 tracking-tight text-slate-950 sm:text-xl">
                {item.title}
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            aria-label="Close notification details"
          >
            <X className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <NotificationDetailBody item={item} readError={readError} />
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Close
          </button>
          {pathname !== item.actionPath && (
            <a
              href={item.actionPath}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {actionLabel}
              <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </a>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
