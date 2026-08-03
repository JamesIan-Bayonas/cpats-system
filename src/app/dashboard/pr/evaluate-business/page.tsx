// src/app/dashboard/pr/evaluate-business/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell,
  StageHeader,
  Card,
  ErrorBanner,
  SuccessBanner,
  FieldLabel,
  FieldError,
  inputClass,
  CheckItem,
  ReviewWorkspace,
  DecisionButtonGroup,
  ActionButton,
  QueueTask,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  prId?: ZodSubErrors;
  action?: ZodSubErrors;
  remarks?: ZodSubErrors;
}

interface ItemPayloadNode {
  itemName: string;
  quantity: number;
  unitPrice?: number;
}

interface AuditLogNode {
  id?: string;
  createdAt: string;
  previousState: PRStatus | null;
  newState: PRStatus;
  remarks: string | null;
  actor: {
    email: string;
    role: Role;
  };
}

interface PendingPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  isDirectPoBypass?: boolean;
  adminProofFilePath?: string | null;
  createdAt: string;
  department: { code: string; name: string };
  itemsPayload?: ItemPayloadNode[] | unknown;
  auditLogs?: AuditLogNode[];
}

function deriveItemSummaryTitle(itemsPayload: unknown): string {
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) {
    return 'Purchase Requisition';
  }
  const items = itemsPayload as ItemPayloadNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Item Requisition';
  const firstItemQty = items[0]?.quantity || 1;

  if (items.length === 1) {
    return `${firstItemName} (x${firstItemQty})`;
  }
  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${items.length - 1 > 1 ? 's' : ''}`;
}

export default function BusinessOfficeEvaluationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [targetPrId, setTargetPrId] = useState<string>('');
  const [evaluationAction, setEvaluationAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  // Clearances
  const [necessityVerified, setNecessityVerified] = useState<boolean>(false);
  const [budgetAvailable, setBudgetAvailable] = useState<boolean>(false);

  // Queue Storage & Enterprise Two-Tier Queue Filter States
  const [activeQueue, setActiveQueue] = useState<PendingPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);
  
  // Tier 1 Primary Segment Control ('ACTION_REQUIRED' vs 'DECISION_HISTORY')
  const [primarySegment, setPrimarySegment] = useState<'ACTION_REQUIRED' | 'DECISION_HISTORY'>('ACTION_REQUIRED');
  
  // Tier 2 Secondary Sub-Filter ('ALL' | 'RETURNED' | 'DECLINED')
  const [historySubFilter, setHistorySubFilter] = useState<'ALL' | 'RETURNED' | 'DECLINED'>('ALL');

  // Status Responses
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncWorkspaceQueue(res.data.role);
        }
      })
      .catch(() => setSystemError('Could not load active session. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncWorkspaceQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        const fetchedTasks = (resData.data || []).filter(
          (item: PendingPRNode) =>
            item.status === PRStatus.Pending_Business_Approval ||
            item.status === PRStatus.Returned_for_Correction ||
            item.status === PRStatus.Declined
        );
        setActiveQueue(fetchedTasks);
      }
    } catch (err) {
      console.error('Queue sync failed:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setSuccessMessage(null);

    if (!activeUser || activeUser.role !== Role.Business_Office) {
      setSystemError('Only Business Office personnel can evaluate Purchase Requests.');
      return;
    }

    if (!necessityVerified || !budgetAvailable) {
      setSystemError('Please confirm both verification checks before recording your decision.');
      return;
    }

    if (!evaluationAction) {
      setSystemError('Please select an evaluation action (Approve, Return for Correction, or Decline).');
      return;
    }
    
    const selectedPR = activeQueue.find((req) => req.id === targetPrId);
    const finalRemarks = evaluationAction === 'APPROVE' 
      ? (selectedPR?.isDirectPoBypass 
          ? 'Fast-Track Logged: Verified with attached Executive Pre-Approved Letter. Budget allocation recorded.' 
          : 'Approved by Business Office. Necessity and budget allocation verified.')
      : remarks;

    if (evaluationAction !== 'APPROVE' && finalRemarks.trim().length < 5) {
      setSystemError('Compliance Exception: You must provide a clear reason for returning or rejecting this request (minimum 5 characters).');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/evaluate-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prId: targetPrId, action: evaluationAction, remarks: finalRemarks }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Please review highlighted fields.');
          }
          throw new Error(result.error || 'A transaction exception occurred while recording your decision.');
        }

        setSuccessMessage(`Evaluation committed successfully. Request status updated.`);

        setTargetPrId('');
        setEvaluationAction('');
        setRemarks('');
        setNecessityVerified(false);
        setBudgetAvailable(false);

        await syncWorkspaceQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Business_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-sm mt-2">
          Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized for Business Office evaluation.
        </p>
      </Card>
    );
  }

  // Tier 1 Filtering
  const actionRequiredQueue = activeQueue.filter((item) => item.status === PRStatus.Pending_Business_Approval);
  const decisionHistoryQueue = activeQueue.filter(
    (item) => item.status === PRStatus.Returned_for_Correction || item.status === PRStatus.Declined
  );

  // Tier 2 Filtering (Inside Decision History)
  const filteredHistoryQueue = decisionHistoryQueue.filter((item) => {
    if (historySubFilter === 'RETURNED') return item.status === PRStatus.Returned_for_Correction;
    if (historySubFilter === 'DECLINED') return item.status === PRStatus.Declined;
    return true; // 'ALL'
  });

  const displayedQueueNodes = primarySegment === 'ACTION_REQUIRED' ? actionRequiredQueue : filteredHistoryQueue;

  const queueTasks: QueueTask[] = displayedQueueNodes.map((task) => {
    let statusBadge = task.department.code;
    if (task.status === PRStatus.Returned_for_Correction) {
      statusBadge = `${task.department.code} • RETURNED`;
    } else if (task.status === PRStatus.Declined) {
      statusBadge = `${task.department.code} • DECLINED`;
    } else if (task.isDirectPoBypass) {
      statusBadge = `${task.department.code} • FAST-TRACK`;
    }

    return {
      id: task.id,
      title: deriveItemSummaryTitle(task.itemsPayload),
      subtitle: statusBadge,
      dateLabel: new Date(task.createdAt).toLocaleDateString(),
      justificationPreview: task.justification,
    };
  });

  const selectedPR = activeQueue.find((req) => req.id === targetPrId);
  const itemsList: ItemPayloadNode[] = selectedPR && Array.isArray(selectedPR.itemsPayload)
    ? (selectedPR.itemsPayload as ItemPayloadNode[])
    : [];

  const hasPrices = itemsList.some((item) => typeof item.unitPrice === 'number' && item.unitPrice > 0);
  const calculatedGrandTotal = itemsList.reduce((acc, item) => {
    const price = item.unitPrice || 0;
    return acc + (price * item.quantity);
  }, 0);

  const adminAuditFeedback = selectedPR?.auditLogs?.find(
    (log) => log.actor.role === Role.Admin_Office || log.remarks
  );

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 2 of 6 · Business Office Evaluation"
        title="Business Office Evaluation"
        description="Verify item necessity and departmental budget availability before approving, returning, or declining purchase requisitions."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle={
          primarySegment === 'ACTION_REQUIRED'
            ? 'Action Required Queue'
            : 'Decision History Queue'
        }
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage={
          primarySegment === 'ACTION_REQUIRED'
            ? 'Inbox Clear: No requisitions are currently awaiting evaluation.'
            : 'No matching records found in decision history.'
        }
        selectedId={targetPrId}
        onSelect={(id) => {
          setTargetPrId(id);
          const pr = activeQueue.find((item) => item.id === id);
          if (pr?.isDirectPoBypass) {
            setEvaluationAction('APPROVE');
            setNecessityVerified(true);
            setBudgetAvailable(true);
          }
        }}
      >
        {/* ENTERPRISE TWO-TIER QUEUE FILTERING SYSTEM */}
        <div className="space-y-3 mb-5 font-sans">
          
          {/* TIER 1: PRIMARY SEGMENT CONTROL */}
          <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 flex gap-1">
            <button
              type="button"
              onClick={() => {
                setPrimarySegment('ACTION_REQUIRED');
                setTargetPrId('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                primarySegment === 'ACTION_REQUIRED'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <span>📥 Action Required</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                primarySegment === 'ACTION_REQUIRED' ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-200 text-slate-600 font-bold'
              }`}>
                {actionRequiredQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPrimarySegment('DECISION_HISTORY');
                setTargetPrId('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                primarySegment === 'DECISION_HISTORY'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <span>📜 Decision History</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                primarySegment === 'DECISION_HISTORY' ? 'bg-amber-100 text-amber-900 font-black' : 'bg-slate-200 text-slate-600 font-bold'
              }`}>
                {decisionHistoryQueue.length}
              </span>
            </button>
          </div>

          {/* TIER 2: SECONDARY SUB-FILTER PILLS (Visible strictly when Decision History is active) */}
          {primarySegment === 'DECISION_HISTORY' && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-150">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider pl-1">
                Filter History:
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistorySubFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    historySubFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  All ({decisionHistoryQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubFilter('RETURNED')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    historySubFilter === 'RETURNED'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                  }`}
                >
                  ↶ Returned ({decisionHistoryQueue.filter(i => i.status === PRStatus.Returned_for_Correction).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubFilter('DECLINED')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    historySubFilter === 'DECLINED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  ✕ Declined ({decisionHistoryQueue.filter(i => i.status === PRStatus.Declined).length})
                </button>
              </div>
            </div>
          )}

        </div>

        <form onSubmit={handleEvaluationSubmit} className="space-y-6">
          <div>
            <FieldLabel>Target Purchase Request (Requisition Ref Code)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!fieldErrors?.prId)} font-mono bg-slate-100 cursor-not-allowed`}
              placeholder="Select a request from the queue list on the left…"
              value={targetPrId}
            />
            {fieldErrors?.prId?._errors && <FieldError>{fieldErrors.prId._errors[0]}</FieldError>}
          </div>

          {/* PRE-APPROVED LETTER HIGHLIGHT BANNER */}
          {selectedPR?.isDirectPoBypass && (
            <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase font-mono tracking-wider">
                  ⚡ Executive Pre-Approved Letter Attached
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded uppercase">
                  Fast-Track Record Mode
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                This requisition contains an attached executive pre-approval letter. Verify budget ledger allocation code and confirm fast-track dispatch to Admin Office.
              </p>
              {selectedPR.adminProofFilePath && (
                <div className="pt-1">
                  <a
                    href={selectedPR.adminProofFilePath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 underline hover:text-emerald-950 font-mono"
                  >
                    <span>📄 View Attached Executive Letter Document</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* EXECUTIVE ADMIN & PRIOR AUDIT FEEDBACK CALLOUT */}
          {selectedPR && adminAuditFeedback && (
            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase font-mono tracking-wider">
                  ⚠️ Prior Audit / Admin Office Feedback
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                  {adminAuditFeedback.actor.role.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-amber-950 italic bg-white p-3 rounded-lg border border-amber-200/80 leading-relaxed">
                "{adminAuditFeedback.remarks || 'No specific remark recorded.'}"
              </p>
              <div className="flex justify-between text-[10px] font-mono text-amber-800/80 pt-0.5">
                <span>Actor: {adminAuditFeedback.actor.email}</span>
                <span>Date: {new Date(adminAuditFeedback.createdAt).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* INSPECTION PANEL: OPERATIONAL JUSTIFICATION & ITEMIZED SCHEDULE */}
          {selectedPR ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Originating Department
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedPR.department.name} ({selectedPR.department.code})
                  </span>
                </div>
                {selectedPR.isDirectPoBypass && (
                  <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                    Pre-Approved Letter Attached
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                  Operational Justification & Purpose
                </span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedPR.justification}"
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Itemized Schedule ({itemsList.length} {itemsList.length === 1 ? 'Line Item' : 'Line Items'})
                  </span>
                  {hasPrices && (
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      Est. Total: ₱{calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase font-mono">
                        <th className="p-2.5">Item Description & Specifications</th>
                        <th className="p-2.5 text-center whitespace-nowrap">Qty</th>
                        {hasPrices && <th className="p-2.5 text-right whitespace-nowrap">Unit Price</th>}
                        {hasPrices && <th className="p-2.5 text-right whitespace-nowrap">Subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {itemsList.map((item, idx) => {
                        const unitPrice = item.unitPrice || 0;
                        const subtotal = unitPrice * item.quantity;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-medium text-slate-900">{item.itemName}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-700">{item.quantity}</td>
                            {hasPrices && (
                              <td className="p-2.5 text-right font-mono text-slate-500">
                                {unitPrice > 0 ? `₱${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            )}
                            {hasPrices && (
                              <td className="p-2.5 text-right font-mono text-slate-800">
                                {subtotal > 0 ? `₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AUDIT LOG HISTORY TIMELINE */}
              {selectedPR.auditLogs && selectedPR.auditLogs.length > 0 && (
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Workflow Audit Trail History
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedPR.auditLogs.map((log, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-0.5">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                          <span className="font-bold text-slate-800">{log.actor.role.replace(/_/g, ' ')} ({log.actor.email})</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 text-[11px]">
                          <strong className="text-slate-900">[{log.newState.replace(/_/g, ' ')}]</strong> {log.remarks}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              Select a requisition from the queue list on the left to inspect its details.
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
              Required Verification Checks
            </span>
            <CheckItem
              id="gate-necessity"
              checked={necessityVerified}
              onChange={setNecessityVerified}
              label="Verify Purchase Necessity"
              description="I have reviewed the item specifications and confirmed departmental requirement alignment."
            />
            <CheckItem
              id="gate-budget"
              checked={budgetAvailable}
              onChange={setBudgetAvailable}
              label="Check Budget Availability"
              description="Operational balance matrices have been checked; funds are present under the department allocation code."
            />
          </div>

          <div>
            <FieldLabel>Evaluation Decision</FieldLabel>
            <DecisionButtonGroup
              value={evaluationAction}
              onChange={setEvaluationAction}
              approveLabel="✓ Approve"
              returnLabel="↶ Return for Correction"
              declineLabel="✕ Decline"
            />
            {fieldErrors?.action?._errors && <FieldError>{fieldErrors.action._errors[0]}</FieldError>}
          </div>

          {(evaluationAction === 'RETURN_FOR_CORRECTION' || evaluationAction === 'DECLINE') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <FieldLabel>
                {evaluationAction === 'RETURN_FOR_CORRECTION' ? 'Reason for Return for Correction' : 'Reason for Rejection'}
              </FieldLabel>
              <textarea
                required
                rows={3}
                className={inputClass(!!fieldErrors?.remarks)}
                placeholder={
                  evaluationAction === 'RETURN_FOR_CORRECTION'
                    ? 'Detail the specific corrections required (e.g., Change quantity, item specs unclear)...'
                    : 'Document the reason for rejecting this request (e.g., Out of budget, invalid request)...'
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              {fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Submit Evaluation'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}