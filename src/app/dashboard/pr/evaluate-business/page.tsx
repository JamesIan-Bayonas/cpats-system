'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PRStatus, Role } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell, StageHeader, Card, ErrorBanner, SuccessBanner, FieldLabel, FieldError,
  inputClass, CheckItem, ReviewWorkspace, DecisionButtonGroup, ActionButton, QueueTask,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors { _errors?: string[] }
interface ZodFormErrors { prId?: ZodSubErrors; action?: ZodSubErrors; remarks?: ZodSubErrors }
interface ItemPayloadNode { itemName: string; quantity: number; unitPrice?: number }
interface AuditLogNode {
  id?: string; createdAt: string; previousState: PRStatus | null; newState: PRStatus;
  remarks: string | null; actor: { email: string; role: Role };
}
interface PendingPRNode {
  id: string; justification: string; status: PRStatus; isDirectPoBypass?: boolean;
  adminProofFilePath?: string | null; createdAt: string;
  department: { code: string; name: string }; itemsPayload?: ItemPayloadNode[] | unknown;
  auditLogs?: AuditLogNode[];
}

function deriveItemSummaryTitle(itemsPayload: unknown): string {
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) return 'Purchase Requisition';
  const items = itemsPayload as ItemPayloadNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Item Requisition';
  const firstItemQty = items[0]?.quantity || 1;
  if (items.length === 1) return `${firstItemName} (x${firstItemQty})`;
  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${items.length - 1 > 1 ? 's' : ''}`;
}

const Icon = ({ path, className = 'h-4 w-4' }: { path: string; className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function BusinessOfficeEvaluationPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [targetPrId, setTargetPrId] = useState('');
  const [evaluationAction, setEvaluationAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState('');
  const [necessityVerified, setNecessityVerified] = useState(false);
  const [budgetAvailable, setBudgetAvailable] = useState(false);
  const [activeQueue, setActiveQueue] = useState<PendingPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [primarySegment, setPrimarySegment] = useState<'ACTION_REQUIRED' | 'DECISION_HISTORY'>('ACTION_REQUIRED');
  const [historySubFilter, setHistorySubFilter] = useState<'ALL' | 'RETURNED' | 'DECLINED'>('ALL');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((res) => res.json()).then((res) => {
      if (res.success && res.data) { setActiveUser(res.data); syncWorkspaceQueue(res.data.role); }
    }).catch(() => setSystemError('Could not load active session. Please refresh.')).finally(() => setUserLoading(false));
  }, []);

  const syncWorkspaceQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: userRole }) });
      const resData = await response.json();
      if (response.ok) setActiveQueue((resData.data || []).filter((item: PendingPRNode) =>
        item.status === PRStatus.Pending_Business_Approval || item.status === PRStatus.Returned_for_Correction || item.status === PRStatus.Declined));
    } catch (err) { console.error('Queue sync failed:', err); } finally { setQueueLoading(false); }
  };

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSystemError(null); setFieldErrors(null); setSuccessMessage(null);
    if (!activeUser || activeUser.role !== Role.Business_Office) { setSystemError('Only Business Office personnel can evaluate Purchase Requests.'); return; }
    if (!necessityVerified || !budgetAvailable) { setSystemError('Please confirm both verification checks before recording your decision.'); return; }
    if (!evaluationAction) { setSystemError('Please select an evaluation action (Approve, Return for Correction, or Decline).'); return; }
    const selectedPR = activeQueue.find((req) => req.id === targetPrId);
    const finalRemarks = evaluationAction === 'APPROVE'
      ? (selectedPR?.isDirectPoBypass ? 'Fast-Track Logged: Verified with attached Executive Pre-Approved Letter. Budget allocation recorded.' : 'Approved by Business Office. Necessity and budget allocation verified.') : remarks;
    if (evaluationAction !== 'APPROVE' && finalRemarks.trim().length < 5) {
      setSystemError('Compliance Exception: You must provide a clear reason for returning or rejecting this request (minimum 5 characters).'); return;
    }
    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/evaluate-business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prId: targetPrId, action: evaluationAction, remarks: finalRemarks }) });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 422 && result.errors) { setFieldErrors(result.errors); throw new Error('Please review highlighted fields.'); }
          throw new Error(result.error || 'A transaction exception occurred while recording your decision.');
        }
        setSuccessMessage('Evaluation committed successfully. Request status updated.');
        setTargetPrId(''); setEvaluationAction(''); setRemarks(''); setNecessityVerified(false); setBudgetAvailable(false);
        await syncWorkspaceQueue(activeUser.role); router.refresh();
      } catch (err: any) { setSystemError(err.message || 'Something went wrong. Please try again.'); }
    });
  };

  if (userLoading) return <div className="flex min-h-[45vh] items-center justify-center text-sm text-slate-500">Loading session context…</div>;
  if (!activeUser || activeUser.role !== Role.Business_Office) return (
    <Card className="mx-auto my-12 w-full max-w-md text-center"><h2 className="text-sm font-bold text-rose-700">Access Restricted</h2>
      <p className="mt-2 text-sm text-slate-500">Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized for Business Office evaluation.</p></Card>
  );

  const actionRequiredQueue = activeQueue.filter((item) => item.status === PRStatus.Pending_Business_Approval);
  const decisionHistoryQueue = activeQueue.filter((item) => item.status === PRStatus.Returned_for_Correction || item.status === PRStatus.Declined);
  const filteredHistoryQueue = decisionHistoryQueue.filter((item) => historySubFilter === 'RETURNED' ? item.status === PRStatus.Returned_for_Correction : historySubFilter === 'DECLINED' ? item.status === PRStatus.Declined : true);
  const displayedQueueNodes = primarySegment === 'ACTION_REQUIRED' ? actionRequiredQueue : filteredHistoryQueue;
  const queueTasks: QueueTask[] = displayedQueueNodes.map((task) => ({
    id: task.id, title: deriveItemSummaryTitle(task.itemsPayload),
    subtitle: task.status === PRStatus.Returned_for_Correction ? `${task.department.code} • RETURNED` : task.status === PRStatus.Declined ? `${task.department.code} • DECLINED` : task.isDirectPoBypass ? `${task.department.code} • FAST-TRACK` : task.department.code,
    dateLabel: new Date(task.createdAt).toLocaleDateString(), justificationPreview: task.justification,
  }));
  const selectedPR = activeQueue.find((req) => req.id === targetPrId);
  const itemsList: ItemPayloadNode[] = selectedPR && Array.isArray(selectedPR.itemsPayload) ? selectedPR.itemsPayload as ItemPayloadNode[] : [];
  const hasPrices = itemsList.some((item) => typeof item.unitPrice === 'number' && item.unitPrice > 0);
  const calculatedGrandTotal = itemsList.reduce((acc, item) => acc + (item.unitPrice || 0) * item.quantity, 0);
  const adminAuditFeedback = selectedPR?.auditLogs?.find((log) => log.actor.role === Role.Admin_Office || log.remarks);
  const checksComplete = Number(necessityVerified) + Number(budgetAvailable);

  return <PageShell>
    <StageHeader eyebrow="Step 2 of 6 · Business Office Evaluation" title="Fiscal Evaluation"
      description="Review procurement necessity, confirm available allocation, and record the Business Office decision."
      meta={{ label: 'Business Office reviewer', value: activeUser.email }} />
    {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
    {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

    <ReviewWorkspace queueTitle={primarySegment === 'ACTION_REQUIRED' ? 'Fiscal review queue' : 'Decision history'} tasks={queueTasks}
      loading={queueLoading} emptyMessage={primarySegment === 'ACTION_REQUIRED' ? 'No requisitions are awaiting fiscal evaluation.' : 'No matching records found in decision history.'}
      selectedId={targetPrId} onSelect={(id) => { setTargetPrId(id); const pr = activeQueue.find((item) => item.id === id); if (pr?.isDirectPoBypass) { setEvaluationAction('APPROVE'); setNecessityVerified(true); setBudgetAvailable(true); } }}>

      <div className="mb-6 space-y-3">
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Queue view">
          {([['ACTION_REQUIRED', 'Action required', actionRequiredQueue.length], ['DECISION_HISTORY', 'Decision history', decisionHistoryQueue.length]] as const).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={primarySegment === key} onClick={() => { setPrimarySegment(key); setTargetPrId(''); }}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${primarySegment === key ? 'border border-slate-200 bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}<span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        {primarySegment === 'DECISION_HISTORY' && <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Show</span>
          {([['ALL', 'All', decisionHistoryQueue.length], ['RETURNED', 'Returned', decisionHistoryQueue.filter(i => i.status === PRStatus.Returned_for_Correction).length], ['DECLINED', 'Declined', decisionHistoryQueue.filter(i => i.status === PRStatus.Declined).length]] as const).map(([key, label, count]) =>
            <button key={key} type="button" onClick={() => setHistorySubFilter(key)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${historySubFilter === key ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{label} {count}</button>)}
        </div>}
      </div>

      <form onSubmit={handleEvaluationSubmit} className="space-y-6">
        {!selectedPR ? <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 text-center">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"><Icon path="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></div>
          <h2 className="text-sm font-semibold text-slate-800">Select a requisition to begin</h2><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Choose a record from the queue to review its procurement basis, line items, and fiscal controls.</p>
        </div> : <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Fiscal review dossier</p>
                  <h2 className="mt-1.5 text-lg font-semibold tracking-tight">{deriveItemSummaryTitle(selectedPR.itemsPayload)}</h2>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">PR {selectedPR.id}</p></div>
                <span className={`w-fit rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${selectedPR.isDirectPoBypass ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-white/5 text-slate-300'}`}>{selectedPR.isDirectPoBypass ? 'Fast-track' : 'Standard review'}</span>
              </div>
            </div>
            <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[['Originating office', `${selectedPR.department.name} (${selectedPR.department.code})`], ['Submitted', new Date(selectedPR.createdAt).toLocaleDateString()], ['Estimated value', hasPrices ? `₱${calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not provided']].map(([label, value]) =>
                <div key={label} className="px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800 tabular-nums">{value}</p></div>)}
            </div>
          </section>

          {selectedPR.isDirectPoBypass && <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex gap-3"><div className="mt-0.5 text-emerald-700"><Icon path="M13 10V3L4 14h7v7l9-11h-7Z" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-emerald-950">Executive pre-approval on file</h3><span className="rounded-md bg-emerald-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-800">Fast-track record</span></div><p className="mt-1 text-xs leading-5 text-emerald-800">Verify the budget ledger allocation and confirm dispatch to the Admin Office.</p>{selectedPR.adminProofFilePath && <a href={selectedPR.adminProofFilePath} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 underline underline-offset-2">View executive letter <span aria-hidden>↗</span></a>}</div></div>
          </section>}

          {adminAuditFeedback && <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-amber-700">Prior review feedback</p><p className="mt-2 text-sm leading-6 text-amber-950">{adminAuditFeedback.remarks || 'No specific remark recorded.'}</p></div><span className="shrink-0 rounded-md bg-white px-2 py-1 text-[9px] font-semibold uppercase text-amber-800 ring-1 ring-amber-200">{adminAuditFeedback.actor.role.replace(/_/g, ' ')}</span></div><p className="mt-3 border-t border-amber-200/80 pt-3 text-[10px] text-amber-800">{adminAuditFeedback.actor.email} · {new Date(adminAuditFeedback.createdAt).toLocaleString()}</p></section>}

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Procurement basis</p><h3 className="mt-1 text-sm font-semibold text-slate-900">Justification and item schedule</h3></div>
            <div className="px-5 py-5 sm:px-6"><p className="text-xs leading-6 text-slate-700">{selectedPR.justification}</p></div>
            <div className="overflow-x-auto border-t border-slate-200"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 sm:px-6">Item description</th><th className="px-4 py-3 text-right">Qty</th>{hasPrices && <><th className="px-4 py-3 text-right">Unit price</th><th className="px-5 py-3 text-right sm:px-6">Subtotal</th></>}</tr></thead>
              <tbody className="divide-y divide-slate-100">{itemsList.map((item, idx) => { const unitPrice = item.unitPrice || 0; const subtotal = unitPrice * item.quantity; return <tr key={idx} className="hover:bg-slate-50/70"><td className="px-5 py-3.5 font-medium text-slate-900 sm:px-6">{item.itemName}</td><td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-slate-700">{item.quantity}</td>{hasPrices && <><td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">{unitPrice > 0 ? `₱${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td><td className="px-5 py-3.5 text-right font-mono font-medium tabular-nums text-slate-800 sm:px-6">{subtotal > 0 ? `₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td></>}</tr>; })}</tbody>
              {hasPrices && <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50"><td colSpan={3} className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estimated total</td><td className="px-5 py-3 text-right font-mono text-sm font-bold tabular-nums text-slate-950 sm:px-6">₱{calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot>}
            </table></div>
          </section>

          {selectedPR.auditLogs && selectedPR.auditLogs.length > 0 && <details className="group rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-xs font-semibold text-slate-800">Workflow history <span className="text-slate-400 transition group-open:rotate-180">⌄</span></summary><div className="border-t border-slate-200 px-5 py-2">{selectedPR.auditLogs.map((log, idx) => <div key={idx} className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[1fr_auto]"><p className="text-xs text-slate-700"><span className="font-semibold text-slate-900">{log.newState.replace(/_/g, ' ')}</span>{log.remarks ? ` — ${log.remarks}` : ''}</p><p className="text-[10px] text-slate-400 sm:text-right">{log.actor.email}<br />{new Date(log.createdAt).toLocaleString()}</p></div>)}</div></details>}

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6"><div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Required controls</p><h3 className="mt-1 text-sm font-semibold text-slate-900">Fiscal verification</h3></div><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${checksComplete === 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{checksComplete} of 2 verified</span></div><div className="space-y-2"><CheckItem id="gate-necessity" checked={necessityVerified} onChange={setNecessityVerified} label="Purchase necessity verified" description="Item specifications and departmental requirements have been reviewed." /><CheckItem id="gate-budget" checked={budgetAvailable} onChange={setBudgetAvailable} label="Budget availability confirmed" description="Funds are available under the department allocation code." /></div></section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Disposition</p><h3 className="mt-1 text-sm font-semibold text-slate-900">Business Office decision</h3><p className="mt-1 text-xs text-slate-500">Choose the outcome that should be recorded for this requisition.</p></div><DecisionButtonGroup value={evaluationAction} onChange={setEvaluationAction} approveLabel="Approve" returnLabel="Return for correction" declineLabel="Decline" />{fieldErrors?.action?._errors && <FieldError>{fieldErrors.action._errors[0]}</FieldError>}
            {(evaluationAction === 'RETURN_FOR_CORRECTION' || evaluationAction === 'DECLINE') && <div className="mt-5 border-t border-slate-200 pt-5"><FieldLabel>{evaluationAction === 'RETURN_FOR_CORRECTION' ? 'Corrections required' : 'Reason for declining'}</FieldLabel><textarea required rows={4} className={inputClass(!!fieldErrors?.remarks)} placeholder={evaluationAction === 'RETURN_FOR_CORRECTION' ? 'Specify the corrections required…' : 'Document the reason for declining this request…'} value={remarks} onChange={(e) => setRemarks(e.target.value)} />{fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}</div>}
          </section>

          <input type="hidden" required readOnly value={targetPrId} />{fieldErrors?.prId?._errors && <FieldError>{fieldErrors.prId._errors[0]}</FieldError>}
          <section className="flex flex-col gap-4 rounded-2xl bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">Final action</p><p className="mt-1 text-sm font-semibold">Record fiscal evaluation</p><p className="mt-1 text-xs text-slate-400">This updates the requisition to the selected workflow state.</p></div><ActionButton type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Submit evaluation'}</ActionButton></section>
        </>}
      </form>
    </ReviewWorkspace>
  </PageShell>;
}
