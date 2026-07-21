// src/app/dashboard/pr/evaluate-business/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  prId?: ZodSubErrors;
  action?: ZodSubErrors;
  remarks?: ZodSubErrors;
}

interface PendingPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: {
    code: string;
    name: string;
  };
}

export default function BusinessOfficeEvaluationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. SECURITY CONTEXT MATRIX (Explicit Type Widening)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "business-evaluator-uuid-999", 
    role: Role.Business_Office,
    departmentId: "business-finance-dept-xyz"
  };

  // 2. STATE MANAGEMENT CORE
  const [targetPrId, setTargetPrId] = useState<string>('');
  const [evaluationAction, setEvaluationAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  // Audit Compliance Verification Toggles (Step 2 Guidelines)
  const [necessityVerified, setNecessityVerified] = useState<boolean>(false);
  const [budgetAvailable, setBudgetAvailable] = useState<boolean>(false);

  // Queue Ledger Storage Pools
  const [activeQueue, setActiveQueue] = useState<PendingPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // Error Catch Pools
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 3. LEDGER QUEUE SYNCHRONIZATION RUNTIME
  const syncWorkspaceQueue = async () => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: Role.Business_Office })
      });
      const resData = await response.json();
      if (response.ok) {
        // Filter out items in check processing to focus strictly on Step 2 tasks
        const evaluationTasks = (resData.data || []).filter(
          (item: PendingPRNode) => item.status === PRStatus.Pending_Business_Approval
        );
        setActiveQueue(evaluationTasks);
      }
    } catch (err) {
      console.error("Queue connection interrupted:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    syncWorkspaceQueue();
  }, []);

  // 4. MUTATION PIPELINE TRANSMISSION
  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setSuccessMessage(null);

    if (activeUser.role !== Role.Business_Office) {
      setSystemError("SECURITY EXCEPTION: Current operational profile lacks execution credentials for Business Office nodes.");
      return;
    }

    if (!necessityVerified || !budgetAvailable) {
      setSystemError("COMPLIANCE VIOLATION: Verification gates for Purchase Necessity and Budget Availability must be validated manually before committing mutations.");
      return;
    }

    if (!evaluationAction) {
      setSystemError("VALIDATION ERROR: An authoritative workflow action must be explicitly selected.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/evaluate-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prId: targetPrId,
            action: evaluationAction,
            remarks: remarks
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error("Payload Format Discrepancy: Review field structure parameters.");
          }
          throw new Error(result.error || "An internal transaction fault rolled back the evaluation event.");
        }

        setSuccessMessage(`Workflow transition committed successfully. State updated to reflect action: ${evaluationAction}.`);
        
        // Reset interactive parameters
        setTargetPrId('');
        setEvaluationAction('');
        setRemarks('');
        setNecessityVerified(false);
        setBudgetAvailable(false);
        
        // Synchronize state models and hot-reload components
        await syncWorkspaceQueue();
        router.refresh();

      } catch (err: any) {
        setSystemError(err.message || "A network interrupt stalled delivery to the relational ledger cluster.");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 my-8 font-sans text-slate-900">
      
      {/* Structural Compliance Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black tracking-tight">Step 2: Business Office Evaluation Interface</h2>
          <p className="text-xs text-slate-500 mt-1">
            Active Security Scope: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Internal Audit Control Node</span>
          <span className="text-xs font-semibold text-amber-600">Mr. Lugo, CPA Compliance Template</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: LIVE COMPLIANCE TASK QUEUES */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Tasks Awaiting Evaluation Review</h3>
          
          {queueLoading ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 animate-pulse">Syncing system transactions...</div>
          ) : activeQueue.length === 0 ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
              Clear Backlog: No items matching checkpoint validation filters[cite: 1].
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {activeQueue.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setTargetPrId(task.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:border-slate-400 hover:bg-slate-50/50
                    ${targetPrId === task.id ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900' : 'border-slate-200 bg-white'}`}
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

        {/* RIGHT COLUMN: EVALUATION SUBMISSION FORM PANEL */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {systemError && (
            <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">State Machine Interrupt Block</span>
              {systemError}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">Ledger Update Verified</span>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleEvaluationSubmit} className="space-y-6">
            
            {/* Target Purchase Request Tracking Identifier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Target Purchase Request Identifier (UUIDv4)
              </label>
              <input
                type="text"
                required
                className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
                  ${fieldErrors?.prId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="Select a record from the ledger queue to populate..."
                value={targetPrId}
                onChange={(e) => setTargetPrId(e.target.value)}
              />
              {fieldErrors?.prId?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.prId._errors[0]}</p>
              )}
            </div>

            {/* Mandatory CPA Procedural Audit Checkboxes */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pre-Condition Verification Gates</span>
              
              <div className="flex items-start">
                <input
                  id="gate-necessity"
                  type="checkbox"
                  className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                  checked={necessityVerified}
                  onChange={(e) => setNecessityVerified(e.target.checked)}
                />
                <label htmlFor="gate-necessity" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>Verify Purchase Necessity:</strong> I have reviewed the item payload logs and confirmed the departmental requirement justification aligns with core institutional resource criteria[cite: 1].
                </label>
              </div>

              <div className="flex items-start">
                <input
                  id="gate-budget"
                  type="checkbox"
                  className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                  checked={budgetAvailable}
                  onChange={(e) => setBudgetAvailable(e.target.checked)}
                />
                <label htmlFor="gate-budget" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>Check Budget Availability:</strong> Operational balance matrices have been checked; appropriate funds are present under the respective department allocation code to absorb this procurement[cite: 1].
                </label>
              </div>
            </div>

            {/* Authoritative Action Vector Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Execution Decision / State Shift Command
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setEvaluationAction('APPROVE')}
                  className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                    ${evaluationAction === 'APPROVE' 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  ✓ Approve Request
                </button>
                <button
                  type="button"
                  onClick={() => setEvaluationAction('RETURN_FOR_CORRECTION')}
                  className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                    ${evaluationAction === 'RETURN_FOR_CORRECTION' 
                      ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  ↶ Return for Correction
                </button>
                <button
                  type="button"
                  onClick={() => setEvaluationAction('DECLINE')}
                  className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                    ${evaluationAction === 'DECLINE' 
                      ? 'bg-rose-600 border-rose-600 text-white shadow-md' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  ✕ Decline Request
                </button>
              </div>
              {fieldErrors?.action?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.action._errors[0]}</p>
              )}
            </div>

            {/* Audit Compliance Comment Block */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Audit Trails Evaluation Remarks
              </label>
              <textarea
                required
                rows={3}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm placeholder:text-slate-400
                  ${fieldErrors?.remarks ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="Document detailed institutional evaluation rationale for financial auditing transparency..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              {fieldErrors?.remarks?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.remarks._errors[0]}</p>
              )}
            </div>

            {/* Submission Commit Segment */}
            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
              >
                {isPending ? 'Committing Atomic State Mutation...' : 'Execute Ledger Evaluation'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}