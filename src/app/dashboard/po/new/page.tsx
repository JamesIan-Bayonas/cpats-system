// src/app/dashboard/po/new/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  purchaseRequestId?: ZodSubErrors;
  poNumber?: ZodSubErrors;
}

interface ApprovedPRQueueNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: {
    code: string;
    name: string;
  };
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

  // Live Task Queue States
  const [purchasingQueue, setPurchasingQueue] = useState<ApprovedPRQueueNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // Error/Success Interception Hydration
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // 3. LEDGER QUEUE SYNCHRONIZATION RUNTIME
  const syncPurchasingQueue = async () => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: Role.Purchasing_Office })
      });
      const resData = await response.json();
      if (response.ok) {
        // Enforce state verification filter boundary
        const activeTasks = (resData.data || []).filter(
          (item: ApprovedPRQueueNode) => item.status === PRStatus.Approved_Awaiting_PO
        );
        setPurchasingQueue(activeTasks);
      }
    } catch (err) {
      console.error("Purchasing workspace connection pool error:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    syncPurchasingQueue();
  }, []);

  // 4. SYSTEM MUTATION DISPATCH LAYER
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
        
        // Re-hydrate local records and clean system caches
        await syncPurchasingQueue();
        router.refresh();

      } catch (err: any) {
        setRuntimeError(err.message || "A hardware pipeline interrupt blocked network execution vectors.");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 my-8 font-sans text-slate-900">
      
      {/* Workflow Navigation Header Context Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 4-A: Purchase Order Generation Matrix</h2>
          <p className="text-xs text-slate-500 mt-1">
            Department Ledger Anchor: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ecosystem Asset Registry</span>
          <span className="text-xs font-semibold text-indigo-600">Deterministic Procurement Pipeline</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE REQUISITIONS QUEUE */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Approved Requests Awaiting PO</h3>
          
          {queueLoading ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 animate-pulse">Syncing system transactions...</div>
          ) : purchasingQueue.length === 0 ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
              Queue Clear: No approved requisitions await structural document mapping[cite: 1].
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {purchasingQueue.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setPurchaseRequestId(task.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:border-slate-400 hover:bg-slate-50/50
                    ${purchaseRequestId === task.id ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-[10px] font-black tracking-tight text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                      {task.department.code}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">{new Date(task.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-1.5">{task.justification}</p>
                  <span className="block font-mono text-[9px] text-slate-400 truncate">UUID: {task.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: GENERATION PROCESSING FORM */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {runtimeError && (
            <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">Ecosystem Constraint Intercept</span>
              {runtimeError}
            </div>
          )}

          {transactionSuccess && (
            <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg text-indigo-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">Asset Token Persisted</span>
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
                placeholder="Select a valid row from the left panel to map tracking pointers..."
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
                  I affirm that control and custody of this Purchase Order document remains strictly within the Purchasing Office domain[cite: 1]. Committing this form signals that the hard copy has been successfully prepared, printed, and is ready for institutional vendor dispatch or Business Office check issuance routing[cite: 1, 2].
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

      </div>
    </div>
  );
}