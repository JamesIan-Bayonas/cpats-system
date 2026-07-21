// src/app/dashboard/po/release-check/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  poId?: ZodSubErrors;
  checkNumber?: ZodSubErrors;
}

interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  isCheckIssued: boolean;
}

interface AwaitingCheckPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: {
    code: string;
    name: string;
  };
  purchaseOrders: PurchaseOrderSummary[];
}

export default function ReleaseCheckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

 // 1. CONTEXT CLEARANCE MATRIX (Realigned to seeded Business Office ID)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "business-evaluator-uuid-999",
    role: Role.Business_Office,
    departmentId: "business-finance-dept-xyz"
  };

  // 2. INTERACTIVE COMPONENT STATES
  const [poId, setPoId] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  
  // Auditable Gate Toggles
  const [physicalCheckSigned, setPhysicalCheckSigned] = useState<boolean>(false);
  const [ledgerLogged, setLedgerLogged] = useState<boolean>(false);

  // Workspace Ledger Data Queue States
  const [checkQueue, setCheckQueue] = useState<AwaitingCheckPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // System Message Repositories
  const [systemError, setSystemError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // 3. LEDGER QUEUE SYNCHRONIZATION RUNTIME
  const syncCheckReleaseQueue = async () => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: Role.Business_Office })
      });
      const resData = await response.json();
      if (response.ok) {
        // Isolate requests specifically waiting for check clearances
        const awaitingTasks = (resData.data || []).filter(
          (item: AwaitingCheckPRNode) => item.status === PRStatus.Awaiting_Check_Issuance
        );
        setCheckQueue(awaitingTasks);
      }
    } catch (err) {
      console.error("Disbursement workspace connection pool error:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    syncCheckReleaseQueue();
  }, []);

  // 4. MUTATION EMISSION PIPELINE
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
        
        // Refresh component data spaces cleanly
        await syncCheckReleaseQueue();
        router.refresh();

      } catch (err: any) {
        setSystemError(err.message || "A network routing pipeline interrupt halted application communication.");
      }
    });
  };

  // Helper mapping selection logic
  const handleTaskSelection = (task: AwaitingCheckPRNode) => {
    const unissuedPO = task.purchaseOrders.find(po => !po.isCheckIssued);
    if (unissuedPO) {
      setPoId(unissuedPO.id);
    } else {
      setPoId('');
      setSystemError("Link Error: No unissued Purchase Order record could be isolated inside this request parameter block.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 my-8 font-sans text-slate-900">
      
      {/* Structural Governance Header Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex justify-between items-center">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: PENDING BANK CHECK RELEASE TASK QUEUE */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Orders Awaiting Check Issuance</h3>
          
          {queueLoading ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 animate-pulse">Syncing financial records...</div>
          ) : checkQueue.length === 0 ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
              Clear Window: No assets currently stand trapped behind check allocation cycles[cite: 1].
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {checkQueue.map((task) => {
                const poTarget = task.purchaseOrders.find(p => !p.isCheckIssued);
                const isSelected = poTarget && poId === poTarget.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskSelection(task)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:border-slate-400 hover:bg-slate-50/50
                      ${isSelected ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[10px] font-black tracking-tight text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">
                        {task.department.code}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-700">
                        {poTarget ? poTarget.poNumber : 'PO Missing'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 line-clamp-1 mb-1">{task.justification}</p>
                    <span className="block font-mono text-[9px] text-slate-400 truncate">PO UUID: {poTarget?.id || 'N/A'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TERMINAL INPUT & DISBURSEMENT FORMS */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {systemError && (
            <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">State Machine Intercept</span>
              {systemError}
            </div>
          )}

          {transactionSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">Ledger Transaction Confirmed</span>
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
                placeholder="Select a record from the ledger queue to populate..."
                value={poId}
                onChange={(e) => setPoId(e.target.value)}
              />
              {validationErrors?.poId?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{validationErrors.poId._errors[0]}</p>
              )}
            </div>

            {/* Institutional Check Registration Identifier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Authoritative Bank Check Number Reference Code
              </label>
              <input
                type="text"
                required
                className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
                  ${validationErrors?.checkNumber ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="Enter physical bank check reference sequence..."
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
                  <strong>Check Signatory Clearance Verified:</strong> I verify that the physical corporate check has been reviewed, cross-matched with the initial items payload total, and formally signed by authorized academic executives[cite: 1].
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
                  <strong>Disbursement Ledger Commitment:</strong> The bank payment voucher reference has been recorded in the physical accounting log books to maintain compliance transparency[cite: 1, 2].
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

      </div>
    </div>
  );
}