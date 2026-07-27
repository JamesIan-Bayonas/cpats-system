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
  
  // Modal states
  const [showDevProfiles, setShowDevProfiles] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

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
        throw new Error(result.error || 'Authentication failed. Please verify credentials.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Identity verification failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const applyDemoProfile = (profileEmail: string) => {
    setEmail(profileEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F9FAFB] font-sans antialiased text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* ========================================================================= */}
      {/* LEFT PANEL: Deep Forest Institutional Gateway Sidebar                    */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0B2B18] p-10 xl:p-14 text-white flex-col justify-between relative border-r border-emerald-950/80">
        
        {/* Subtle Geometric Background Pattern (2% Opacity Grid Lines) */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#FFFFFF 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* 1. Header: Institutional Seal & Entity Name */}
        <div className="relative z-10 flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-lg bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center font-black text-sm tracking-tight text-white shadow-sm">
            DMC
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-emerald-300">
              DMC College Foundation Inc.
            </h2>
            <p className="text-[11px] text-emerald-100/60 font-medium">
              Dipolog City, Zamboanga del Norte
            </p>
          </div>
        </div>

        {/* 2. Body: System Identification & Operational Status */}
        <div className="relative z-10 my-auto space-y-6 max-w-lg">
          
          {/* Status Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#163824] border border-emerald-600/30 text-emerald-300 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>System State: Operational • TLS 1.3 Secure</span>
          </div>

          {/* System Name */}
          <div>
            <h1 className="text-2xl xl:text-3xl font-extrabold tracking-tight leading-snug text-white">
              Internal Procurement Management System
            </h1>
            <p className="text-xs text-emerald-100/70 mt-2 leading-relaxed">
              Authorized compliance gateway for departmental requisitions, multi-stage approval routing, and COA audit verification.
            </p>
          </div>

          {/* Institutional Workflow Architecture (Monochromatic Vector Schematic) */}
          <div className="bg-[#123820]/60 border border-emerald-500/20 rounded-xl p-4 text-xs space-y-3">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Procurement Routing Lifecycle
            </span>
            <div className="flex items-center justify-between text-[11px] text-emerald-100/80 font-mono pt-1">
              <span className="px-2 py-1 bg-emerald-900/60 rounded border border-emerald-500/30">01. Request</span>
              <span className="text-emerald-500">→</span>
              <span className="px-2 py-1 bg-emerald-900/60 rounded border border-emerald-500/30">02. Finance</span>
              <span className="text-emerald-500">→</span>
              <span className="px-2 py-1 bg-emerald-900/60 rounded border border-emerald-500/30">03. Admin</span>
              <span className="text-emerald-500">→</span>
              <span className="px-2 py-1 bg-emerald-900/60 rounded border border-emerald-500/30">04. Asset</span>
            </div>
          </div>

          {/* Official Advisory Bulletin */}
          <div className="bg-[#163824] border-l-2 border-emerald-400 rounded-r-xl p-4 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
              <span>Official System Advisory</span>
              <span>Q3 Fiscal Cycle</span>
            </div>
            <p className="text-emerald-100/80 text-[11px] leading-relaxed">
              All departmental Purchase Requests (PR) for Q3 supplies must be submitted prior to the Friday 5:00 PM Business Office cut-off.
            </p>
          </div>

          {/* System Governance Tags */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="bg-[#123820]/40 border border-emerald-500/15 rounded-lg p-2 text-center">
              <span className="block text-[9px] text-emerald-300/60 uppercase font-medium">Governance</span>
              <span className="text-[11px] font-semibold text-emerald-100">6-Stage RBAC</span>
            </div>
            <div className="bg-[#123820]/40 border border-emerald-500/15 rounded-lg p-2 text-center">
              <span className="block text-[9px] text-emerald-300/60 uppercase font-medium">Audit Trail</span>
              <span className="text-[11px] font-semibold text-emerald-100">QR / 3-Way Match</span>
            </div>
            <div className="bg-[#123820]/40 border border-emerald-500/15 rounded-lg p-2 text-center">
              <span className="block text-[9px] text-emerald-300/60 uppercase font-medium">Legal Compliance</span>
              <span className="text-[11px] font-semibold text-emerald-100">RA 10173 / COA</span>
            </div>
          </div>

        </div>

        {/* 3. Footer: Framed Institutional Legal & Privacy Sub-Card */}
        <div className="relative z-10 mt-auto pt-4">
          <div className="bg-[#123820]/50 border border-emerald-500/15 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
            <div className="space-y-0.5">
              <span className="block font-bold text-emerald-100/90 text-[11px]">
                © 2026 DMC College Foundation Inc.
              </span>
              <span className="block text-[10px] text-emerald-200/50">
                Internal Governance &amp; COA Audit Gateway
              </span>
            </div>

            <button 
              type="button" 
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-600/40 hover:border-emerald-500/60 text-emerald-200 hover:text-white text-[10px] font-semibold transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
            >
              <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Data Privacy Undertaking</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: Official Login Card & Authentication Form                   */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[55%] flex flex-col justify-between p-6 sm:p-12 relative">
        
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#111827 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="my-auto max-w-[420px] w-full mx-auto space-y-6">
          
          {/* Elevated High-Contrast Card */}
          <div className="bg-white p-8 sm:p-10 rounded-xl border border-slate-200/90 shadow-xl shadow-slate-200/40 relative">
            
            {/* Header Block */}
            <div className="mb-6">
              <div className="inline-flex lg:hidden h-10 w-10 rounded-lg bg-[#0B2B18] items-center justify-center font-bold text-white text-xs mb-3">
                DMC
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Institutional Sign In
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Access restricted to authorized personnel. Enter your assigned credentials.
              </p>
            </div>

            {/* Error Feedback Banner */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-rose-800 text-xs font-medium flex items-start space-x-2.5">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Field 1: Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#15803D] focus:ring-2 focus:ring-[#DCFCE7] outline-none transition font-sans"
                  placeholder="user@dmc.edu.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Field 2: Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowSupportModal(true)}
                    className="text-xs font-semibold text-[#15803D] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#15803D] focus:ring-2 focus:ring-[#DCFCE7] outline-none transition font-sans"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Action CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#15803D] hover:bg-[#166534] disabled:bg-slate-300 text-white font-semibold text-xs tracking-wide rounded-lg transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
              >
                <svg className="w-4 h-4 text-emerald-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{loading ? 'Authenticating Credentials...' : 'Authenticate & Access System'}</span>
              </button>

            </form>

            {/* Security Notice Footnote */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-1.5">
              <div className="inline-flex items-center space-x-1.5 text-[11px] font-medium text-slate-500">
                <svg className="w-3.5 h-3.5 text-[#15803D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Restricted Campus Gateway</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight max-w-xs mx-auto">
                Unauthorized access is strictly prohibited. All login attempts and transaction actions are logged under DMC IT Governance Policy.
              </p>
            </div>

          </div>

        </div>

        {/* Outer Footer: Separated Administrative Test Profiles Toggle */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowDevProfiles(!showDevProfiles)}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 underline transition cursor-pointer"
          >
            {showDevProfiles ? '✕ Hide Evaluation Profiles' : '⚙ Administrative Evaluation Profiles'}
          </button>

          {showDevProfiles && (
            <div className="mt-3 max-w-xl mx-auto p-3 bg-white border border-slate-200 rounded-xl shadow-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMO_PROFILES.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => applyDemoProfile(p.email)}
                  className="p-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition group cursor-pointer"
                >
                  <span className="block text-xs font-bold text-slate-800 group-hover:text-emerald-800 truncate">{p.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 truncate block">{p.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: IT SUPPORT & CREDENTIAL RESET MODAL                              */}
      {/* ========================================================================= */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Institutional IT Support
              </h3>
              <button 
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-3">
              <p>
                Self-service password resets are disabled for security compliance. Accounts are issued and maintained directly by the DMC Management Information Systems (MIS) office.
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                <div><strong>Office:</strong> MIS & Systems Center</div>
                <div><strong>Internal Ext:</strong> Local 104</div>
                <div><strong>Email:</strong> mis-support@dmc.edu.ph</div>
              </div>
            </div>
            <div className="pt-2 text-right">
              <button
                onClick={() => setShowSupportModal(false)}
                className="px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close Guidance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DATA PRIVACY & COMPLIANCE UNDERTAKING MODAL                      */}
      {/* ========================================================================= */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Data Privacy & Governance Undertaking
              </h3>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-2.5 max-h-60 overflow-y-auto pr-1">
              <p>
                <strong>1. Authority to Process Information:</strong> Pursuant to Republic Act No. 10173 (Data Privacy Act of 2012), all requisition records, vendor invoices, and authorization logs entered into IPMS are processed strictly for official academic procurement purposes.
              </p>
              <p>
                <strong>2. Integrity of Records:</strong> Users affirm that submitted Purchase Requests, attached executive proof files, and digital verifications represent accurate institutional transactions subject to Commission on Audit (COA) standards.
              </p>
              <p>
                <strong>3. Audit Trail Logging:</strong> Every operational status transition is cryptographically bound to the authenticated user account and timestamped within the central ledger.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white font-semibold text-xs rounded-lg transition cursor-pointer"
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