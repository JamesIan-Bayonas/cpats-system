// src/app/dashboard/po/new/page.tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  purchaseRequestId?: ZodSubErrors;
  poNumber?: ZodSubErrors;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. AUTHORITATIVE CONTEXT REGISTRY (Explicit Type Widening Applied)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "purchaser-uuid-static-888",
    role: Role.Purchasing_Office,
    departmentId: "purchasing-dept-uuid-wxy"
  };

  // 2. RUNTIME WORKSPACE STATE
  const [purchaseRequestId, setPurchaseRequestId] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  
  // Custom Interface Operational Checkbox
  const [custodyConfirmed, setCustodyConfirmed] = useState<boolean>(false);

  // Error/Success Interception Hydration
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // 3. SYSTEM MUTATION DISPATCH LAYER
  const handlePurchaseOrderGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuntimeError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    // Context Control Gate
    if (activeUser.role !== Role.Purchasing_Office) {
      setRuntimeError("CRITICAL ACCESS VIOLATION: Access denied. System node restricts manipulation to authorized Purchasers.");
      return;
    }

    if (!custodyConfirmed) {
      setRuntimeError("COMPLIANCE EXCEPTION: Legal control and custody affirmation must be acknowledged before processing records.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/po/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseRequestId,
            poNumber
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error("Validation Guard Triggered: Verify input parameter syntax.");
          }
          throw new Error(result.error || "A database engine interrupt aborted token creation.");
        }

        setTransactionSuccess(`Authoritative binding achieved. Purchase Order Reference [${poNumber}] logged. Requisition state moved to Awaiting Check Issuance.`);
        
        // Purge field variables
        setPurchaseRequestId('');
        setPoNumber('');
        setCustodyConfirmed(false);
        
        router.refresh();

      } catch (err: any) {
        setRuntimeError(err.message || "A hardware pipeline interrupt blocked network execution vectors.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 my-8 text-slate-900">
      
      {/* Workflow Navigation Header Context Panel */}
      <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 4: Purchase Order Generation Matrix</h2>
          <p className="text-xs text-slate-500 mt-1">
            Department Ledger Anchor: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ecosystem Asset Registry</span>
          <span className="text-xs font-semibold text-indigo-600">Deterministic Procurement Pipeline</span>
        </div>
      </div>

      {/* Real-time System Message Broadcast Panels */}
      {runtimeError && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">Ecosystem Constraint Intercept</span>
          {runtimeError}
        </div>
      )}

      {transactionSuccess && (
        <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg text-indigo-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">Asset Token Persisted</span>
          {transactionSuccess}
        </div>
      )}

      <form onSubmit={handlePurchaseOrderGeneration} className="space-y-6">
        
        {/* Parent Requisition Key Target */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Approved Purchase Request Core Tracking Key (UUIDv4)
          </label>
          <input
            type="text"
            required
            className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
              ${validationErrors?.purchaseRequestId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="Extract from Approved Requests list panel..."
            value={purchaseRequestId}
            onChange={(e) => setPurchaseRequestId(e.target.value)}
          />
          {validationErrors?.purchaseRequestId?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{validationErrors.purchaseRequestId._errors[0]}</p>
          )}
        </div>

        {/* Unique Custom Document reference designation code input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Authoritative Purchase Order Identifier Code (PO Number)
          </label>
          <input
            type="text"
            required
            className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
              ${validationErrors?.poNumber ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="e.g., PO-2026-XXXX"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
          {validationErrors?.poNumber?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{validationErrors.poNumber._errors[0]}</p>
          )}
        </div>

        {/* Section 3.2 Manual Mandatory Guardrail Acknowledgment Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start">
          <div className="flex items-center h-5">
            <input
              id="custody-chk"
              type="checkbox"
              className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
              checked={custodyConfirmed}
              onChange={(e) => setCustodyConfirmed(e.target.checked)}
            />
          </div>
          <div className="ml-3 text-xs leading-relaxed">
            <label htmlFor="custody-chk" className="font-bold text-slate-800 cursor-pointer uppercase tracking-wide block">
              Custody & Structural Transmission Affirmation
            </label>
            <p className="text-slate-500 mt-0.5">
              I affirm that control and custody of this Purchase Order document remains strictly within the Purchasing Office domain. Committing this form signals that the hard copy has been successfully prepared, printed, and is ready for institutional vendor dispatch or Business Office check issuance routing[cite: 2].
            </p>
          </div>
        </div>

        {/* Submission Segment Bar */}
        <div className="border-t border-slate-200 pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
          >
            {isPending ? 'Encrypting Mapping Bindings...' : 'Generate Authoritative PO'}
          </button>
        </div>

      </form>
    </div>
  );
}