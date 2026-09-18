// src/components/ui/WorkflowUI.tsx
// Shared enterprise primitives for all /dashboard/* workflow pages.
// Presentation-only overhaul: no business logic, API contracts, or workflow rules are changed.
'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export function deriveItemSummaryTitle(
  itemsPayload: any,
  fallbackJustification: string = 'Purchase Requisition',
): string {
  if (!itemsPayload) return fallbackJustification;

  try {
    const parsed =
      typeof itemsPayload === 'string' ? JSON.parse(itemsPayload) : itemsPayload;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      const itemName = first.itemName || first.name || 'Requested Item';
      const qty = first.quantity || first.qty || 1;
      const totalCount = parsed.length;

      if (totalCount === 1) {
        return `${itemName} (x${qty})`;
      }

      return `${itemName} (x${qty}) +${totalCount - 1} more item${
        totalCount - 1 > 1 ? 's' : ''
      }`;
    }
  } catch {
    // Preserve original fallback behavior on malformed JSON.
  }

  return fallbackJustification;
}

function SearchIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}

function XIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="m5 12.5 4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReturnIcon({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path
        d="M12 3.5 21 20H3l9-16.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9v4.5M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="space-y-5 sm:space-y-6">{children}</div>
    </main>
  );
}

export function StageHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: { label: string; value: string };
}) {
  return (
    <section
      aria-labelledby="workflow-stage-title"
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.03)]"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-700" />
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {eyebrow}
            </span>
          </div>

          <h1
            id="workflow-stage-title"
            className="text-[1.35rem] font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.65rem]"
          >
            {title}
          </h1>

          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600 sm:text-sm">
            {description}
          </p>
        </div>

        {meta && (
          <dl className="shrink-0 border-t border-slate-100 pt-4 lg:min-w-56 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {meta.label}
            </dt>
            <dd className="mt-1.5 break-all font-mono text-xs font-semibold text-slate-700">
              {meta.value}
            </dd>
          </dl>
        )}
      </div>
    </section>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const hasCustomBg = /\bbg-/.test(className);
  const defaultBg = hasCustomBg ? '' : 'bg-white';

  return (
    <div
      className={`${defaultBg} rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.035),0_6px_20px_rgba(15,23,42,0.025)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3.5 text-[13px] font-medium leading-5 text-rose-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <AlertIcon className="size-4" />
      </span>
      <span className="pt-1">{children}</span>
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3.5 text-[13px] font-medium leading-5 text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckIcon className="size-4" />
      </span>
      <span className="pt-1">{children}</span>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold leading-5 text-slate-800">
      {children}
    </label>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium leading-4 text-rose-700">
      <span aria-hidden="true" className="mt-[1px]">
        •
      </span>
      <span>{children}</span>
    </p>
  );
}

export const inputClass = (hasError?: boolean) =>
  [
    'w-full min-h-11 rounded-lg border bg-white px-3.5 py-2.5',
    'text-[13px] text-slate-900 placeholder:text-slate-400',
    'shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] duration-150',
    'focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
    hasError
      ? 'border-rose-400 ring-4 ring-rose-500/10 focus:border-rose-500 focus:ring-rose-500/10'
      : 'border-slate-300 hover:border-slate-400',
  ].join(' ');

export function CheckItem({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`group flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-150 ${
        checked
          ? 'border-emerald-300 bg-emerald-50/70 shadow-[0_0_0_1px_rgba(5,150,105,0.05)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
      }`}
    >
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? 'border-emerald-700 bg-emerald-700 text-white'
            : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <CheckIcon className="size-3.5" />
      </span>

      <span className="min-w-0">
        <span className="block text-[12px] font-semibold leading-5 text-slate-900">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-[1.15rem] text-slate-500">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export interface QueueTask {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  justificationPreview?: string;
}

function QueueSkeleton() {
  return (
    <div className="space-y-2 p-1" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-50" />
          <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

export function ReviewWorkspace({
  queueTitle,
  tasks,
  loading,
  emptyMessage,
  selectedId,
  onSelect,
  children,
}: {
  queueTitle: string;
  tasks: QueueTask[];
  loading: boolean;
  emptyMessage: string;
  selectedId: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = tasks.filter((task) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      task.title.toLowerCase().includes(q) ||
      task.subtitle.toLowerCase().includes(q) ||
      task.id.toLowerCase().includes(q) ||
      (task.justificationPreview &&
        task.justificationPreview.toLowerCase().includes(q))
    );
  });

  return (
    <section
      aria-label="Operational review workspace"
      className="grid min-w-0 gap-5 lg:grid-cols-[minmax(290px,360px)_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]"
    >
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.035),0_8px_24px_rgba(15,23,42,0.025)]">
          <div className="border-b border-slate-200/80 bg-slate-50/70 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Work queue
                </p>
                <h2 className="mt-1 truncate text-[13px] font-semibold text-slate-900">
                  {queueTitle}
                </h2>
              </div>

              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold tabular-nums text-slate-600">
                {filteredTasks.length}/{tasks.length}
              </span>
            </div>

            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label={`Search ${queueTitle}`}
                placeholder="Search ref, item, department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-[12px] text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear queue search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[calc(100vh-16rem)] min-h-36 overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <QueueSkeleton />
            ) : filteredTasks.length === 0 ? (
              <div className="m-1 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
                <div className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                  <SearchIcon className="size-4" />
                </div>
                <p className="mt-3 text-[12px] font-medium text-slate-600">
                  {searchQuery ? 'No matching records' : 'Queue clear'}
                </p>
                <p className="mt-1 max-w-64 text-[11px] leading-[1.15rem] text-slate-400">
                  {searchQuery
                    ? 'Try a requisition reference, department code, or item keyword.'
                    : emptyMessage}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTasks.map((task) => {
                  const isSelected = selectedId === task.id;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(task.id)}
                      className={`group relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-50/75 shadow-[0_0_0_1px_rgba(5,150,105,0.06)]'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50/80'
                      }`}
                    >
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-700"
                        />
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`truncate font-mono text-[10px] font-semibold uppercase tracking-[0.06em] ${
                            isSelected ? 'text-emerald-800' : 'text-slate-500'
                          }`}
                        >
                          {task.subtitle}
                        </span>
                        <time className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                          {task.dateLabel}
                        </time>
                      </div>

                      <div className="mt-1.5 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[12px] font-semibold leading-[1.15rem] text-slate-900">
                            {task.title}
                          </p>

                          {task.justificationPreview && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-[1.05rem] text-slate-500">
                              {task.justificationPreview}
                            </p>
                          )}
                        </div>

                        <ChevronRightIcon
                          className={`mt-0.5 size-4 shrink-0 transition-transform ${
                            isSelected
                              ? 'translate-x-0 text-emerald-700'
                              : '-translate-x-0.5 text-slate-300 group-hover:translate-x-0 group-hover:text-slate-500'
                          }`}
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-slate-200/60 pt-2">
                        <span className="min-w-0 truncate font-mono text-[9px] text-slate-400">
                          {task.id}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                            In review
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.035),0_10px_30px_rgba(15,23,42,0.03)]">
          <div className="border-b border-slate-100 px-5 py-3.5 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Record workspace
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-slate-700">
                  {selectedId ? 'Reviewing selected transaction' : 'Awaiting record selection'}
                </p>
              </div>

              {selectedId && (
                <span className="hidden max-w-72 truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500 sm:block">
                  {selectedId}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function DecisionButtonGroup({
  value,
  onChange,
  approveLabel = 'Approve',
  returnLabel = 'Return for Correction',
  declineLabel = 'Decline',
}: {
  value: string;
  onChange: (v: 'APPROVE' | 'RETURN_FOR_CORRECTION' | 'DECLINE') => void;
  approveLabel?: string;
  returnLabel?: string;
  declineLabel?: string;
}) {
  const base =
    'min-h-11 rounded-lg border px-3.5 py-2.5 text-[12px] font-semibold leading-4 transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px';

  return (
    <div
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      role="group"
      aria-label="Decision selection"
    >
      <button
        type="button"
        aria-pressed={value === 'APPROVE'}
        onClick={() => onChange('APPROVE')}
        className={`${base} ${
          value === 'APPROVE'
            ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
            : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="size-4 shrink-0" />
          <span>{approveLabel}</span>
        </span>
      </button>

      <button
        type="button"
        aria-pressed={value === 'RETURN_FOR_CORRECTION'}
        onClick={() => onChange('RETURN_FOR_CORRECTION')}
        className={`${base} ${
          value === 'RETURN_FOR_CORRECTION'
            ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-sm'
            : 'border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <ReturnIcon className="size-4 shrink-0" />
          <span>{returnLabel}</span>
        </span>
      </button>

      <button
        type="button"
        aria-pressed={value === 'DECLINE'}
        onClick={() => onChange('DECLINE')}
        className={`${base} ${
          value === 'DECLINE'
            ? 'border-rose-700 bg-rose-700 text-white shadow-sm'
            : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <XIcon className="size-4 shrink-0" />
          <span>{declineLabel}</span>
        </span>
      </button>
    </div>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'border border-emerald-800 bg-emerald-800 text-white shadow-sm hover:bg-emerald-900 hover:border-emerald-900 disabled:border-slate-300 disabled:bg-slate-300 disabled:text-white',
  outline:
    'border border-slate-300 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50',
  danger:
    'border border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50',
  ghost:
    'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

export function ActionButton({
  variant = 'primary',
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-[12px] font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 sm:px-6 ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LogoutButton({
  variant = 'outline',
  className = '',
}: {
  variant?: ButtonVariant;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
      setLoading(false);
    }
  };

  return (
    <ActionButton
      type="button"
      variant={variant}
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Signing out…' : 'Sign Out'}
    </ActionButton>
  );
}

export function AccessRestrictedCard({ role }: { role?: string }) {
  return (
    <Card className="mx-auto my-8 w-full max-w-md space-y-5 text-center sm:my-12">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700">
        <AlertIcon className="size-5" />
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-600">
          Authorization boundary
        </p>
        <h2 className="mt-1.5 text-base font-semibold tracking-tight text-slate-950">
          Access Restricted
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-slate-500">
          Your active account role (
          <span className="font-semibold text-slate-700">
            {role ? role.replace(/_/g, ' ') : 'Unauthorized'}
          </span>
          ) does not have permission to view or execute operations on this page.
        </p>
      </div>

      <div className="flex justify-center border-t border-slate-100 pt-4">
        <LogoutButton variant="danger" />
      </div>
    </Card>
  );
}
