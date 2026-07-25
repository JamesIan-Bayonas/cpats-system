// Shared primitives for all /dashboard/* workflow pages — Optimized for Mobile Ergonomics.
'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 font-sans">{children}</main>;
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
    <Card className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
      <div>
        <span className="inline-block text-[9px] sm:text-[10px] font-bold font-mono text-emerald-800 bg-emerald-100/60 border border-emerald-200/80 px-2.5 py-1 rounded-md uppercase tracking-wide">
          {eyebrow}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-2">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">{description}</p>
      </div>
      {meta && (
        <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block uppercase tracking-wider">{meta.label}</span>
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2.5 sm:px-3 py-1 rounded-md border border-slate-200 inline-block mt-1">
            {meta.value}
          </span>
        </div>
      )}
    </Card>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-4 sm:p-6 transition-all duration-150 ${className}`}>
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5">
      <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3.5 sm:p-4 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg text-emerald-900 text-xs sm:text-sm font-medium flex items-start gap-2.5">
      <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs sm:text-[13px] font-semibold text-slate-800 tracking-normal mb-1.5">
      {children}
    </label>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-rose-600 font-medium mt-1">{children}</p>;
}

export const inputClass = (hasError?: boolean) =>
  `w-full min-h-[44px] px-3.5 py-2.5 bg-white border rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none transition duration-150 ease-in-out ${
    hasError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
  }`;

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
      className="flex items-start gap-3 p-3 sm:p-4 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors duration-150 cursor-pointer min-h-[44px]"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 mt-0.5 accent-emerald-700 rounded cursor-pointer shrink-0"
      />
      <span className="text-xs sm:text-sm">
        <span className="font-semibold text-slate-900">{label}</span>
        {description && <span className="block text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</span>}
      </span>
    </label>
  );
}

export interface QueueTask {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
      <Card className="lg:col-span-1">
        <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{queueTitle}</h3>

        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading queue...</div>
        ) : tasks.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-1">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task.id)}
                className={`w-full text-left p-3 rounded-lg border transition duration-150 cursor-pointer min-h-[44px] ${
                  selectedId === task.id
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {task.subtitle}
                  </span>
                  <span className="text-[10px] text-slate-400">{task.dateLabel}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{task.title}</p>
                <span className="block font-mono text-[9px] text-slate-400 truncate mt-1">Ref: {task.id}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="lg:col-span-2">{children}</Card>
    </div>
  );
}

export function DecisionButtonGroup({
  value,
  onChange,
  approveLabel = '✓ Approve',
  returnLabel = '↺ Recalibrate',
  declineLabel = '✕ Reject',
}: {
  value: string;
  onChange: (v: 'APPROVE' | 'RETURN_FOR_CORRECTION' | 'DECLINE') => void;
  approveLabel?: string;
  returnLabel?: string;
  declineLabel?: string;
}) {
  const base = 'min-h-[44px] py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg border transition-all duration-150 active:scale-[0.99] flex items-center justify-center cursor-pointer';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
      <button
        type="button"
        onClick={() => onChange('APPROVE')}
        className={`${base} ${
          value === 'APPROVE'
            ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {approveLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('RETURN_FOR_CORRECTION')}
        className={`${base} ${
          value === 'RETURN_FOR_CORRECTION'
            ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {returnLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('DECLINE')}
        className={`${base} ${
          value === 'DECLINE'
            ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {declineLabel}
      </button>
    </div>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-700 hover:bg-emerald-800 text-white disabled:bg-slate-300 shadow-xs',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 disabled:opacity-50',
  danger: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
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
      className={`min-h-[44px] px-5 sm:px-6 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.99] disabled:active:scale-100 inline-flex items-center justify-center gap-2 cursor-pointer ${BUTTON_STYLES[variant]} ${className}`}
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
    <Card className="max-w-md w-full text-center mx-auto my-8 sm:my-12 space-y-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h2 className="text-slate-900 font-bold text-sm sm:text-base">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
          Your active account role (<span className="font-semibold text-slate-700">{role ? role.replace(/_/g, ' ') : 'Unauthorized'}</span>) does not have permission to view or execute operations on this page.
        </p>
      </div>
      <div className="pt-2 flex justify-center gap-3">
        <LogoutButton variant="danger" />
      </div>
    </Card>
  );
}