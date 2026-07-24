// File: src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_PROFILES = [
  { role: 'Requesting_Office', email: 'requester@dmc.edu.ph', label: 'Requester (CCS)' },
  { role: 'Business_Office', email: 'finance@dmc.edu.ph', label: 'Finance Evaluator' },
  { role: 'Admin_Office', email: 'vp-admin@dmc.edu.ph', label: 'VP Administration' },
  { role: 'Purchasing_Office', email: 'purchasing@dmc.edu.ph', label: 'Purchasing Officer' },
  { role: 'Receiving_Custodian', email: 'custodian@dmc.edu.ph', label: 'Asset Custodian' },
  { role: 'Global_Auditor', email: 'auditor@dmc.edu.ph', label: 'Global Auditor' },
];

export default function InstitutionalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDevProfiles, setShowDevProfiles] = useState(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        throw new Error(result.error || 'Authentication failure.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Identity verification failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const applyDemoProfile = (profileEmail: string) => {
    setEmail(profileEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans antialiased text-slate-900">
      
      {/* LEFT PANEL: DMCCFI Branding, Advisories & System Status */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-12 text-white flex-col justify-between relative overflow-hidden">
        
        {/* Subtle Background Accent Blurs */}
        <div className="absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

        {/* Top Institutional Identity */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-lg text-emerald-300 shadow-inner">
            DMC
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-emerald-200">DMC College Foundation Inc.</h2>
            <p className="text-xs text-emerald-100/70">Dipolog City, Zamboanga del Norte</p>
          </div>
        </div>

        {/* Center Section: System Name & Live Bulletins */}
        <div className="relative z-10 max-w-lg my-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Ledger Engine Status: Operational</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
            Campus Procurement Automation & Tracking System
          </h1>

          <p className="text-xs text-emerald-100/80 leading-relaxed">
            Centralized digital procurement portal for automated requisition workflows, multi-stage approval governance, and audit compliance across all departments.
          </p>

          {/* Institutional Procurement Advisories Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
              <span>📢 Procurement Advisory Bulletin</span>
              <span>Q3 Fiscal Cycle</span>
            </div>
            <p className="text-emerald-50/90 leading-normal">
              All departmental Purchase Requests (PRs) for Q3 laboratory supplies and IT hardware must be logged by <strong>Friday, 5:00 PM</strong> for Business Office budget evaluation.
            </p>
          </div>

          {/* Core System Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-2.5 text-center">
              <span className="block text-[10px] text-emerald-200/70 uppercase">Workflow</span>
              <span className="text-xs font-bold text-white">6-Stage RBAC</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-2.5 text-center">
              <span className="block text-[10px] text-emerald-200/70 uppercase">Verification</span>
              <span className="text-xs font-bold text-white">QR / 3-Way Match</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-2.5 text-center">
              <span className="block text-[10px] text-emerald-200/70 uppercase">Compliance</span>
              <span className="text-xs font-bold text-white">RA 10173 / CPA</span>
            </div>
          </div>
        </div>

        {/* Footer Support & Legal Links */}
        <div className="relative z-10 text-xs text-emerald-200/60 flex justify-between items-center border-t border-white/10 pt-4">
          <span>© 2026 DMCCFI. All Rights Reserved.</span>
          <button 
            type="button" 
            onClick={() => setShowPrivacyModal(true)}
            className="hover:text-emerald-200 underline transition text-[11px]"
          >
            Data Privacy & Compliance Policy
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Official Login Form Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
          
          <div className="text-center sm:text-left">
            <div className="inline-flex lg:hidden h-12 w-12 rounded-xl bg-emerald-800 items-center justify-center font-bold text-white mb-4">
              DMC
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Portal Authentication</h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your authorized institutional email address.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-semibold flex items-start space-x-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Institutional Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition"
                placeholder="user@dmc.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <a 
                  href="#support" 
                  onClick={(e) => { e.preventDefault(); alert('Credential resets are managed by DMCCFI MIS. Please contact mis-support@dmc.edu.ph'); }} 
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Forgot Password?
                </a>
              </div>
              <input
                type="password"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-900/10 active:scale-[0.99]"
            >
              {loading ? 'Verifying Account...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Security & Regulatory Undertaking Footer */}
          <div className="pt-2 text-center space-y-2">
            <div className="inline-flex items-center space-x-1.5 text-[11px] text-slate-500">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Protected by DMCCFI Identity Services</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              By accessing this system, you acknowledge compliance with institutional audit guidelines and the Philippine Data Privacy Act of 2012.
            </p>
          </div>

          {/* Testing Evaluation Quick-Select Profiles */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDevProfiles(!showDevProfiles)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 py-1"
            >
              <span>Evaluation Test Profiles</span>
              <span>{showDevProfiles ? '▲ Hide' : '▼ Expand'}</span>
            </button>

            {showDevProfiles && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {DEMO_PROFILES.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => applyDemoProfile(p.email)}
                    className="p-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition group"
                  >
                    <span className="block text-xs font-bold text-slate-800 group-hover:text-emerald-800 truncate">{p.label}</span>
                    <span className="text-[10px] font-mono text-slate-400 truncate block">{p.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* COMPLIANCE & DATA PRIVACY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Data Privacy & Compliance Undertaking
              </h3>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-2 max-h-60 overflow-y-auto pr-1">
              <p>
                <strong>1. Authority to Process Information:</strong> Pursuant to the Data Privacy Act of 2012 (Republic Act No. 10173), all requisition data, vendor invoices, and authorization logs entered into CPATS are processed strictly for official academic procurement purposes.
              </p>
              <p>
                <strong>2. Integrity of Records:</strong> Users affirm that submitted Purchase Requests, attached executive proof files, and digital signature verifications represent accurate transactions subject to Commission on Audit (COA) standards.
              </p>
              <p>
                <strong>3. Audit Logging:</strong> Every operational status transition is cryptographically bound to the authenticated user ID and timestamped within the central ledger.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}