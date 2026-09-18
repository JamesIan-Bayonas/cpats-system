'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';

const DEMO_PROFILES = [
  { email: 'requester@dmc.edu.ph', label: 'Requester (CCS)' },
  { email: 'finance@dmc.edu.ph', label: 'Finance Evaluator' },
  { email: 'vp-admin@dmc.edu.ph', label: 'VP Administration' },
  { email: 'purchasing@dmc.edu.ph', label: 'Purchasing Officer' },
  { email: 'custodian@dmc.edu.ph', label: 'Asset Custodian' },
  { email: 'auditor@dmc.edu.ph', label: 'Global Auditor' },
];

const WORKFLOW_HANDOFFS = [
  { office: 'Requesting office', responsibility: 'Prepares the requisition' },
  { office: 'Business and administration', responsibility: 'Reviews and authorizes' },
  { office: 'Purchasing and receiving', responsibility: 'Fulfills and records delivery' },
  { office: 'Institutional audit', responsibility: 'Verifies the complete record' },
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-3">
      <div className="relative size-12 shrink-0 bg-white p-1 shadow-[0_0_0_1px_rgba(6,61,45,.12)] sm:size-14">
        <Image
          src="/dmc-logo.png"
          alt="DMC College Foundation, Inc. seal"
          fill
          sizes="56px"
          className="object-contain p-1"
          priority
        />
      </div>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold tracking-[-0.02em] sm:text-base ${inverse ? 'text-white' : 'text-[#17221e]'}`}>
          DMC College Foundation, Inc.
        </p>
        <p className={`mt-0.5 truncate text-[11px] sm:text-xs ${inverse ? 'text-[#9bc9ae]' : 'text-[#507064]'}`}>
          Campus Procurement Automation &amp; Tracking System
        </p>
      </div>
    </div>
  );
}

function Dialog({
  children,
  label,
  onClose,
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#063d2d]/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="w-full max-w-md border border-[#cbd8d1] bg-white shadow-[0_24px_80px_rgba(2,44,34,.28)]">
        <div className="flex items-start justify-between gap-5 border-b border-[#cbd8d1] px-6 py-5">
          <div className="min-w-0">{children}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center text-[#507064] transition-colors hover:bg-[#edf5f0] hover:text-[#063d2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087443]"
            aria-label={`Close ${label}`}
          >
            <X className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstitutionalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDevProfiles, setShowDevProfiles] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Authentication failed. Check your email and password.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'We could not verify this account. Check your email and password.',
      );
    } finally {
      setLoading(false);
    }
  };

  const applyDemoProfile = (profileEmail: string) => {
    setEmail(profileEmail);
    setPassword('Password123!');
    setErrorMessage(null);
  };

  return (
    <main className="min-h-[100svh] bg-[#f4f8f5] text-[#17221e] selection:bg-[#9bc9ae] selection:text-[#063d2d] xl:grid xl:grid-cols-[minmax(0,1.12fr)_minmax(520px,.88fr)]">
      <section className="relative hidden min-h-[100svh] overflow-hidden bg-[#063d2d] px-[clamp(3rem,5vw,6.5rem)] py-12 text-white xl:flex xl:flex-col">
        <header className="relative z-10">
          <BrandMark inverse />
        </header>

        <div className="relative z-10 my-auto grid grid-cols-[minmax(0,1fr)_minmax(260px,.72fr)] items-center gap-[clamp(3rem,6vw,7rem)] py-14">
          <div className="max-w-xl">
            <h1 className="text-[clamp(3.35rem,4.6vw,5.8rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-white">
              Every request carries its history with it.
            </h1>
            <p className="mt-8 max-w-[34rem] text-[15px] leading-7 text-[#c7dfd0]">
              CPATS keeps each office working from the same record—from the first requisition to receiving and audit.
            </p>
          </div>

          <div className="border-l border-[#9bc9ae]/45 pl-8">
            <p className="max-w-[15rem] text-sm font-medium leading-6 text-[#dcefe5]">
              One accountable record, carried across every handoff.
            </p>
            <ol className="mt-8 space-y-7">
              {WORKFLOW_HANDOFFS.map((handoff, index) => (
                <li key={handoff.office} className="relative grid grid-cols-[1.75rem_1fr] gap-3">
                  <span className="absolute -left-[2.3rem] top-1.5 size-2.5 bg-[#9bc9ae] ring-[5px] ring-[#063d2d]" />
                  <span className="pt-0.5 text-xs tabular-nums text-[#9bc9ae]">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{handoff.office}</p>
                    <p className="mt-1 text-xs leading-5 text-[#9bc9ae]">{handoff.responsibility}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="relative z-10 flex items-end justify-between gap-8 border-t border-white/15 pt-5 text-xs text-[#9bc9ae]">
          <p>© 2026 DMC College Foundation, Inc.</p>
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="inline-flex items-center gap-1.5 font-medium text-[#c7dfd0] underline decoration-[#9bc9ae]/50 underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9bc9ae]"
          >
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Data privacy undertaking
          </button>
        </footer>
      </section>

      <section className="flex min-h-[100svh] flex-col px-5 py-5 sm:px-10 sm:py-8 xl:px-[clamp(4rem,7vw,8rem)] xl:py-12">
        <header className="flex items-center justify-between gap-4 border-b border-[#cbd8d1] pb-5 xl:hidden">
          <BrandMark />
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#087443] underline decoration-[#9bc9ae] underline-offset-4"
          >
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Privacy
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-[27rem] flex-1 items-center py-10 sm:py-14 xl:py-8">
          <div className="w-full">
            <div className="mb-9">
              <div className="mb-5 flex items-center gap-3 text-sm font-medium text-[#087443]">
                <span className="h-px w-8 bg-[#087443]" />
                Secure staff access
              </div>
              <h2 className="text-[2.4rem] font-semibold leading-none tracking-[-0.055em] text-[#17221e] sm:text-[2.75rem]">
                Sign in to CPATS
              </h2>
              <p className="mt-4 max-w-[25rem] text-sm leading-6 text-[#507064]">
                Use the institutional account assigned to your office.
              </p>
            </div>

            {errorMessage && (
              <div role="alert" className="mb-6 border-l-4 border-[#b4233b] bg-[#fff2f3] px-4 py-3 text-sm text-[#7f1528]">
                <p className="font-semibold">Sign-in failed</p>
                <p className="mt-1 leading-5">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="institutional-email" className="block text-sm font-semibold text-[#263a32]">
                  Institutional email
                </label>
                <input
                  id="institutional-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@dmc.edu.ph"
                  className="h-12 w-full border border-[#9fb4aa] bg-white px-4 text-sm text-[#17221e] shadow-[0_1px_0_rgba(6,61,45,.05)] outline-none transition-[border-color,box-shadow] placeholder:text-[#80968c] hover:border-[#6f9182] focus:border-[#087443] focus:ring-2 focus:ring-[#9bc9ae]/45"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="institutional-password" className="block text-sm font-semibold text-[#263a32]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(true)}
                    className="text-xs font-semibold text-[#087443] underline decoration-[#9bc9ae] underline-offset-4 transition-colors hover:text-[#063d2d]"
                  >
                    Get sign-in help
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="institutional-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full border border-[#9fb4aa] bg-white px-4 pr-12 text-sm text-[#17221e] shadow-[0_1px_0_rgba(6,61,45,.05)] outline-none transition-[border-color,box-shadow] placeholder:text-[#80968c] hover:border-[#6f9182] focus:border-[#087443] focus:ring-2 focus:ring-[#9bc9ae]/45"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[#6f8179] transition-colors hover:bg-[#edf5f0] hover:text-[#063d2d]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 bg-[#087443] px-5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(6,61,45,.18)] transition-[background-color,transform] hover:bg-[#063d2d] active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#9fb4aa] disabled:shadow-none"
              >
                <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
                {loading ? 'Verifying account…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-7 flex items-start gap-2.5 border-t border-[#cbd8d1] pt-5 text-xs leading-5 text-[#637a70]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#087443]" aria-hidden="true" />
              <p>Access is restricted to authorized DMC personnel. Sign-in attempts and procurement actions are recorded.</p>
            </div>
          </div>
        </div>

        <footer className="mx-auto w-full max-w-[27rem] border-t border-[#cbd8d1] pt-4 xl:max-w-none">
          <button
            type="button"
            onClick={() => setShowDevProfiles((visible) => !visible)}
            aria-expanded={showDevProfiles}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#70877d] underline decoration-[#cbd8d1] underline-offset-4 transition-colors hover:text-[#063d2d]"
          >
            {showDevProfiles ? (
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {showDevProfiles ? 'Close evaluation profiles' : 'Open evaluation profiles'}
          </button>

          {showDevProfiles && (
            <div className="mt-4 grid border-l border-t border-[#cbd8d1] bg-white sm:grid-cols-2 xl:grid-cols-3">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.email}
                  type="button"
                  onClick={() => applyDemoProfile(profile.email)}
                  className="border-b border-r border-[#cbd8d1] p-3 text-left transition-colors hover:bg-[#edf5f0] focus-visible:z-10"
                >
                  <span className="block truncate text-xs font-semibold text-[#263a32]">{profile.label}</span>
                  <span className="mt-1 block truncate text-[10px] text-[#70877d]">{profile.email}</span>
                </button>
              ))}
            </div>
          )}
        </footer>
      </section>

      {showSupportModal && (
        <Dialog label="Institutional IT support" onClose={() => setShowSupportModal(false)}>
          <div className="pr-2">
            <HelpCircle className="mb-4 size-6 shrink-0 text-[#087443]" aria-hidden="true" />
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#17221e]">Institutional IT support</h3>
            <p className="mt-3 text-sm leading-6 text-[#507064]">
              Password resets are handled by the DMC Management Information Systems office.
            </p>
            <dl className="mt-5 divide-y divide-[#cbd8d1] border-y border-[#cbd8d1] text-sm text-[#263a32]">
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#70877d]">Office</dt><dd className="font-semibold text-right">MIS &amp; Systems Center</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#70877d]">Internal extension</dt><dd className="font-semibold">Local 104</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#70877d]">Email</dt><dd className="font-semibold">mis-support@dmc.edu.ph</dd></div>
            </dl>
            <button type="button" onClick={() => setShowSupportModal(false)} className="mt-6 h-10 bg-[#087443] px-5 text-sm font-semibold text-white hover:bg-[#063d2d]">Close</button>
          </div>
        </Dialog>
      )}

      {showPrivacyModal && (
        <Dialog label="Data privacy and governance undertaking" onClose={() => setShowPrivacyModal(false)}>
          <div className="pr-2">
            <ShieldCheck className="mb-4 size-6 shrink-0 text-[#087443]" aria-hidden="true" />
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#17221e]">Data privacy &amp; governance</h3>
            <div className="mt-4 max-h-64 space-y-4 overflow-y-auto pr-3 text-sm leading-6 text-[#507064]">
              <p><strong className="text-[#263a32]">Authority to process information.</strong> Under Republic Act No. 10173, requisition records, invoices, and authorization logs are processed for official academic procurement.</p>
              <p><strong className="text-[#263a32]">Integrity of records.</strong> Purchase requests, proof files, and digital verifications represent institutional transactions subject to Commission on Audit standards.</p>
              <p><strong className="text-[#263a32]">Audit trail logging.</strong> Operational status transitions are tied to the authenticated account and timestamped in the central ledger.</p>
            </div>
            <button type="button" onClick={() => setShowPrivacyModal(false)} className="mt-6 inline-flex h-10 items-center justify-center gap-1.5 bg-[#087443] px-5 text-sm font-semibold text-white hover:bg-[#063d2d]"><CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />Acknowledge</button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
