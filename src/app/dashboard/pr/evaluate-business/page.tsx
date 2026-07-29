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

interface PendingPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  isDirectPoBypass?: boolean;
  adminProofFilePath?: string | null;
  createdAt: string;
  department: { code: string; name: string };
  itemsPayload?: ItemPayloadNode[] | unknown;
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

  const [targetPrId, setTargetPrId] = useState<string>('');
  const [evaluationAction, setEvaluationAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  const [necessityVerified, setNecessityVerified] = useState<boolean>(false);
  const [budgetAvailable, setBudgetAvailable] = useState<boolean>(false);

  const [activeQueue, setActiveQueue] = useState<PendingPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

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
        const evaluationTasks = (resData.data || []).filter(
          (item: PendingPRNode) => item.status === PRStatus.Pending_Business_Approval
        );
        setActiveQueue(evaluationTasks);
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
    
    // Inject a default audit compliance string if Approved. Ensure negative actions have user remarks.
    const finalRemarks = evaluationAction === 'APPROVE' 
      ? 'Approved by Business Office. Necessity and budget allocation verified.' 
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

  const queueTasks: QueueTask[] = activeQueue.map((task) => ({
    id: task.id,
    title: deriveItemSummaryTitle(task.itemsPayload),
    subtitle: task.department.code,
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
    justificationPreview: task.justification,
  }));

  const selectedPR = activeQueue.find((req) => req.id === targetPrId);
  const itemsList: ItemPayloadNode[] = selectedPR && Array.isArray(selectedPR.itemsPayload)
    ? (selectedPR.itemsPayload as ItemPayloadNode[])
    : [];

  const hasPrices = itemsList.some((item) => typeof item.unitPrice === 'number' && item.unitPrice > 0);
  const calculatedGrandTotal = itemsList.reduce((acc, item) => {
    const price = item.unitPrice || 0;
    return acc + (price * item.quantity);
  }, 0);

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
        queueTitle="Requests Awaiting Evaluation"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No purchase requests are currently waiting for evaluation."
        selectedId={targetPrId}
        onSelect={setTargetPrId}
      >
        <form onSubmit={handleEvaluationSubmit} className="space-y-6">
          <div>
            <FieldLabel>Target Purchase Request (UUID)</FieldLabel>
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
                    Bypass Active
                  </span>
                )}
              </div>

              {/* OPERATIONAL JUSTIFICATION / PURPOSE */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                  Operational Justification & Purpose
                </span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedPR.justification}"
                </div>
              </div>

              {/* ITEMIZED REQUISITION SCHEDULE */}
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
                              <td className="p-2.5 text-right font-mono font-bold text-slate-800">
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
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              Select a requisition from the queue list on the left to inspect its operational justification and itemized schedule.
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
            <DecisionButtonGroup value={evaluationAction} onChange={setEvaluationAction} />
            {fieldErrors?.action?._errors && <FieldError>{fieldErrors.action._errors[0]}</FieldError>}
          </div>

          {/* DYNAMIC AUDIT EVALUATION REMARKS */}
          {(evaluationAction === 'RETURN_FOR_CORRECTION' || evaluationAction === 'DECLINE') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <FieldLabel>
                {evaluationAction === 'RETURN_FOR_CORRECTION' ? 'Reason for Recalibration' : 'Reason for Rejection'}
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
          )}<FieldLabel>Evaluation Decision</FieldLabel>

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