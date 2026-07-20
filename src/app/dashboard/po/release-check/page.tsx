// src/app/dashboard/po/release-check/page.tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  poId?: ZodSubErrors;
  checkNumber?: ZodSubErrors;
}

export default function ReleaseCheckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. CONTEXT CLEARANCE MATRIX (Explicit Type Widening Applied per Rule 6)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "finance-officer-uuid-111",
    role: Role.Business_Office,
    departmentId: "business-finance-dept-xyz"
  };

  // 2. INTERACTIVE COMPONENT STATES
  const [poId, setPoId] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  
  // Auditable Gate Toggles
  const [physicalCheckSigned, setPhysicalCheckSigned] = useState<boolean>(false);
  const [ledgerLogged, setLedgerLogged] = useState<boolean>(false);

  // System Message Repositories
  const [systemError, setSystemError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // 3. MUTATION EMISSION PIPELINE
  const handleCheckReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    // Layer 1 Security Checks
    if (activeUser.role !== Role.Business_Office) {
      setSystemError("SECURITY ERROR: Clearance level insufficient. Action restricted to Business Office profiles.");
      return;
    }

    if (!physicalCheckSigned || !ledgerLogged) {
      setSystemError("COMPLIANCE FAULT: Both physical signatory checks and operational book entries must be validated before updating the state machine.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/po/release-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poId,
            checkNumber
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error("Payload Schema Error: Input structure fails validation parsing.");
          }
          throw new Error(result.error || "A remote transaction exception forced a storage rollback.");
        }

        setTransactionSuccess(`Financial authorization confirmed. Check ${checkNumber} assigned. Purchase Order status advanced to Ready for Purchase.`);
        
        // Purge state variables
        setPoId('');
        setCheckNumber('');
        setPhysicalCheckSigned(false);
        setLedgerLogged(false);
        
        router.refresh();

      } catch (err: any) {
        setSystemError(err.message || "A network routing pipeline interrupt halted application communication.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 my-8 text-slate-900">
      
      {/* Structural Governance Header Panel */}
      <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 4-B: Business Office Check Release Terminal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Active Security Signature: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Financial Audit Release Node</span>
          <span className="text-xs font-semibold text-amber-600">DMC Core Ledger Protocol 2026</span>
        </div>
      </div>

      {/* Real-time System Message Broadcast Panels */}
      {systemError && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">State Machine Intercept</span>
          {systemError}
        </div>
      )}

      {transactionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">Ledger Transaction Confirmed</span>
          {transactionSuccess}
        </div>
      )}

      <form onSubmit={handleCheckReleaseSubmit} className="space-y-6">
        
        {/* Target PO Tracking Identifier Key */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Target Purchase Order Relational Code Identifier (PO UUIDv4)
          </label>
          <input
            type="text"
            required
            className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
              ${validationErrors?.poId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="e.g., c734574b-2342-4b2e-9d21-dec734574b12"
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
          />
          {validationErrors?.poId?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{validationErrors.poId._errors[0]}</p>
          )}
        </div>

        {/* Instutional Check Registration Identifier */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Authoritative Bank Check Number Reference Code
          </label>
          <input
            type="text"
            required
            className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
              ${validationErrors?.checkNumber ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="Enter physical check reference code..."
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
          />
          {validationErrors?.checkNumber?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{validationErrors.checkNumber._errors[0]}</p>
          )}
        </div>

        {/* CPA Compliance Handlers */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Authoritative Verification Framework Gates</span>
          
          <div className="flex items-start">
            <input
              id="gate-sign"
              type="checkbox"
              className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
              checked={physicalCheckSigned}
              onChange={(e) => setPhysicalCheckSigned(e.target.checked)}
            />
            <label htmlFor="gate-sign" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
              <strong>Check Signatory Clearance Verified:</strong> I verify that the physical corporate check has been reviewed, cross-matched with the initial items payload total, and formally signed by authorized academic executives.
            </label>
          </div>

          <div className="flex items-start">
            <input
              id="gate-ledger"
              type="checkbox"
              className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
              checked={ledgerLogged}
              onChange={(e) => setLedgerLogged(e.target.checked)}
            />
            <label htmlFor="gate-ledger" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
              <strong>Disbursement Ledger Commitment:</strong> The bank payment voucher reference has been recorded in the physical accounting log books to maintain compliance transparency[cite: 2].
            </label>
          </div>
        </div>

        {/* Submission Dispatch Controller */}
        <div className="border-t border-slate-200 pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
          >
            {isPending ? 'Advancing Workflow States...' : 'Authorize Check Release'}
          </button>
        </div>

      </form>
    </div>
  );
}