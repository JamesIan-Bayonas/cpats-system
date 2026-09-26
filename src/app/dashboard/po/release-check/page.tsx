// src/app/dashboard/po/release-check/page.tsx
// Enterprise UI overhaul for Business Office Financial Clearance.
// Business logic, handlers, validation, API payloads, and state transitions are preserved.

'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
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
  ActionButton,
  QueueTask,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors { _errors?: string[]; }
interface ZodFormErrors {
  poId?: ZodSubErrors;
  paymentType?: ZodSubErrors;
  checkNumber?: ZodSubErrors;
  items?: Record<string, unknown>;
}
interface PurchaseOrderSummary { id: string; poNumber: string; isCheckIssued: boolean; }
interface BillingItemNode { itemName: string; quantity: number; unitPrice: number; }
interface AwaitingCheckPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: { code: string; name: string };
  purchaseOrders: PurchaseOrderSummary[];
  itemsPayload?: BillingItemNode[] | unknown;
}

function deriveItemSummaryTitle(itemsPayload: unknown): string {
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) return 'Purchase Order Requisition';
  const items = itemsPayload as BillingItemNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Purchased Item';
  const firstItemQty = items[0]?.quantity || 1;
  if (items.length === 1) return `${firstItemName} (x${firstItemQty})`;
  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${items.length - 1 > 1 ? 's' : ''}`;
}

function formatPeso(value: number) {
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Icon({ kind }: { kind: 'money' | 'credit' | 'building' | 'receipt' | 'check' | 'arrow' }) {
  const common = 'size-4';
  if (kind === 'money') return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 8.5h.01M17 15.5h.01" strokeLinecap="round"/></svg>;
  if (kind === 'credit') return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4" strokeLinecap="round"/></svg>;
  if (kind === 'building') return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><path d="M4 21V7l8-4 8 4v14M8 10h2M14 10h2M8 14h2M14 14h2M9 21v-4h6v4"/></svg>;
  if (kind === 'receipt') return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><path d="M7 3h10a2 2 0 0 1 2 2v16l-3-1.5L13 21l-3-1.5L7 21V3Z"/><path d="M10 8h6M10 12h6M10 16h4" strokeLinecap="round"/></svg>;
  if (kind === 'check') return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}><path d="M5 12h14M14 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function EmptySelectionState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm"><Icon kind="receipt" /></div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">Select a purchase order to begin review</h3>
      <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-slate-500">Choose an item from the financial-clearance queue. Its requisition context, line-item billing schedule, and settlement controls will appear here.</p>
    </div>
  );
}

export default function ReleaseCheckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);
  const [poId, setPoId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'CASH_CHECK' | 'CREDIT_TERMS'>('CASH_CHECK');
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [billingItems, setBillingItems] = useState<BillingItemNode[]>([]);
  const [physicalCheckSigned, setPhysicalCheckSigned] = useState<boolean>(false);
  const [ledgerLogged, setLedgerLogged] = useState<boolean>(false);
  const [checkQueue, setCheckQueue] = useState<AwaitingCheckPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);
  const notificationTargetHandled = useRef(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncCheckReleaseQueue(res.data.role);
        }
      })
      .catch(() => setSystemError('Failed to load session context. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncCheckReleaseQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        const awaitingTasks = (resData.data || []).filter((item: AwaitingCheckPRNode) => item.status === PRStatus.Awaiting_Check_Issuance);
        setCheckQueue(awaitingTasks);
        if (!notificationTargetHandled.current) {
          notificationTargetHandled.current = true;
          const targetId = new URLSearchParams(window.location.search).get('prId');
          if (targetId) {
            if (awaitingTasks.some((item: AwaitingCheckPRNode) => item.id === targetId)) handleTaskSelection(targetId, awaitingTasks);
            else setSystemError('This request is no longer awaiting financial clearance. Its workflow status may have changed.');
          }
        }
      }
    } catch (err) {
      console.error('Queue sync failed:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handlePriceChange = (index: number, newUnitPrice: number) => {
    const updated = [...billingItems];
    updated[index].unitPrice = Math.max(0, newUnitPrice);
    setBillingItems(updated);
  };

  const calculatedBilledTotal = billingItems.reduce((acc, item) => acc + (item.quantity * (item.unitPrice || 0)), 0);

  const handleFinancialClearanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null); setValidationErrors(null); setTransactionSuccess(null);
    if (!activeUser || activeUser.role !== Role.Business_Office) {
      setSystemError('Access denied. Action restricted to Business Office profiles.'); return;
    }
    if (paymentType === 'CASH_CHECK' && (!physicalCheckSigned || !ledgerLogged)) {
      setSystemError('Both physical signatory checks and ledger entries must be verified before releasing the check.'); return;
    }

    startTransition(async () => {
      try {
        const payload = { poId, paymentType, items: billingItems, ...(paymentType === 'CASH_CHECK' ? { checkNumber } : {}) };
        const response = await fetch('/api/po/release-check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 422 && result.errors) { setValidationErrors(result.errors); throw new Error('Please check the highlighted fields below.'); }
          throw new Error(result.error || 'A transaction exception occurred while recording financial clearance.');
        }
        const successNotice = paymentType === 'CREDIT_TERMS'
          ? `Financial clearance granted under Credit Terms. Total Billed: ₱${calculatedBilledTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
          : `Financial clearance authorized. Check [${checkNumber}] assigned. Total Billed: ₱${calculatedBilledTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        setTransactionSuccess(successNotice);
        setPoId(''); setPaymentType('CASH_CHECK'); setCheckNumber(''); setBillingItems([]); setPhysicalCheckSigned(false); setLedgerLogged(false);
        await syncCheckReleaseQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  const handleTaskSelection = (taskId: string, tasks: AwaitingCheckPRNode[] = checkQueue) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const unissuedPO = task.purchaseOrders.find((po) => !po.isCheckIssued);
      if (unissuedPO) {
        setPoId(unissuedPO.id);
        if (Array.isArray(task.itemsPayload)) {
          const formatted = (task.itemsPayload as any[]).map((item) => ({ itemName: item.itemName || 'Item Description', quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice) || 0 }));
          setBillingItems(formatted);
        } else setBillingItems([]);
      } else {
        setPoId(''); setBillingItems([]); setSystemError('No pending Purchase Order found for this request.');
      }
    }
  };

  if (userLoading) return <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">Loading session context…</div>;
  if (!activeUser || activeUser.role !== Role.Business_Office) {
    return <Card className="max-w-md w-full text-center mx-auto my-12"><h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2><p className="text-slate-500 text-xs mt-2 leading-relaxed">Your account isn’t authorized for financial clearances. Available to the Business Office only.</p></Card>;
  }

  const queueTasks: QueueTask[] = checkQueue.map((task) => {
    const poTarget = task.purchaseOrders.find((p) => !p.isCheckIssued);
    const poCode = poTarget ? poTarget.poNumber : 'PO Missing';
    return {
      id: task.id,
      title: deriveItemSummaryTitle(task.itemsPayload),
      subtitle: task.department?.code ? `${task.department.code} • ${poCode}` : poCode,
      dateLabel: new Date(task.createdAt).toLocaleDateString(),
      justificationPreview: task.justification,
    };
  });

  const selectedTask = checkQueue.find((t) => t.purchaseOrders.some((po) => po.id === poId));
  const selectedPO = selectedTask?.purchaseOrders.find((po) => po.id === poId);
  const checksVerified = Number(physicalCheckSigned) + Number(ledgerLogged);
  const quantityTotal = billingItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 4-B of 6 · Billing Statement Settlement & Disbursement"
        title="Financial Clearance"
        description="Review vendor billing amounts, confirm the settlement modality, and authorize the transaction for purchase execution."
        meta={{ label: 'Business Office session', value: activeUser.email || '' }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Orders Awaiting Financial Clearance"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No pending orders require financial clearance at this time."
        selectedId={selectedTask?.id || ''}
        onSelect={handleTaskSelection}
      >
        {!selectedTask ? <EmptySelectionState /> : (
          <form onSubmit={handleFinancialClearanceSubmit} className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Purchase order under review</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-semibold text-slate-950">{selectedPO?.poNumber || 'Purchase Order'}</h2>
                    <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Awaiting clearance</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Current billed total</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight text-slate-950">{formatPeso(calculatedBilledTotal)}</p>
                </div>
              </div>
              <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
                <div className="bg-white px-5 py-3.5 flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon kind="building" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Originating office</p><p className="mt-1 truncate text-[12px] font-semibold text-slate-800">{selectedTask.department.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{selectedTask.department.code}</p></div></div>
                <div className="bg-white px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Requisition reference</p><p className="mt-1.5 truncate font-mono text-[11px] font-medium text-slate-700" title={selectedTask.id}>{selectedTask.id}</p></div>
                <div className="bg-white px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Billing scope</p><p className="mt-1.5 text-[12px] font-semibold text-slate-800">{billingItems.length} line item{billingItems.length === 1 ? '' : 's'} · {quantityTotal} total unit{quantityTotal === 1 ? '' : 's'}</p></div>
              </div>
            </section>

            <div className="sr-only" aria-hidden="true">
              <FieldLabel>Target Purchase Order Reference</FieldLabel>
              <input type="text" required readOnly className={`${inputClass(!!validationErrors?.poId)} font-mono`} value={poId} />
              {validationErrors?.poId?._errors && <FieldError>{validationErrors.poId._errors[0]}</FieldError>}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Procurement basis</p><h3 className="mt-1 text-[13px] font-semibold text-slate-900">Operational justification</h3></div>
              <div className="px-5 py-4"><p className="text-[12px] leading-5 text-slate-600">{selectedTask.justification}</p></div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor billing schedule</p><h3 className="mt-1 text-[13px] font-semibold text-slate-900">Line-item amount verification</h3><p className="mt-1 text-[11px] leading-4 text-slate-500">Enter or confirm unit prices from the official supplier billing statement.</p></div>
                <div className="shrink-0 sm:text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Billed total</p><p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-800">{formatPeso(calculatedBilledTotal)}</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead><tr className="border-b border-slate-200"><th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Item description</th><th className="w-24 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Qty</th><th className="w-44 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Unit price</th><th className="w-44 px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Line total</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {billingItems.map((item, idx) => {
                      const lineAmount = item.quantity * (item.unitPrice || 0);
                      return <tr key={idx} className="group hover:bg-slate-50/55"><td className="px-5 py-3.5 text-[12px] font-medium leading-5 text-slate-900">{item.itemName}</td><td className="px-4 py-3.5 text-right font-mono text-[12px] tabular-nums text-slate-600">{item.quantity}</td><td className="px-4 py-3.5 text-right"><div className="ml-auto flex w-36 items-center rounded-lg border border-slate-300 bg-white px-2.5 transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-600/10"><span className="mr-1 text-[11px] text-slate-400">₱</span><input type="number" min="0" step="0.01" required aria-label={`Unit price for ${item.itemName}`} placeholder="0.00" className="h-9 w-full bg-transparent text-right font-mono text-[12px] tabular-nums text-slate-900 outline-none placeholder:text-slate-300" value={item.unitPrice || ''} onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)} /></div></td><td className="px-5 py-3.5 text-right font-mono text-[12px] font-semibold tabular-nums text-slate-900">{formatPeso(lineAmount)}</td></tr>;
                    })}
                  </tbody>
                  <tfoot><tr className="border-t border-slate-300 bg-slate-50/70"><td colSpan={3} className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Billing statement total</td><td className="px-5 py-3.5 text-right font-mono text-sm font-semibold tabular-nums text-slate-950">{formatPeso(calculatedBilledTotal)}</td></tr></tfoot>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Settlement path</p><h3 className="mt-1 text-[13px] font-semibold text-slate-900">Select payment modality</h3><p className="mt-1 text-[11px] leading-4 text-slate-500">The selected modality determines whether physical check controls apply before purchase execution.</p></div>
              <div className="grid gap-3 lg:grid-cols-2">
                <button type="button" aria-pressed={paymentType === 'CASH_CHECK'} onClick={() => setPaymentType('CASH_CHECK')} className={`rounded-xl border p-4 text-left transition ${paymentType === 'CASH_CHECK' ? 'border-emerald-400 bg-emerald-50/60 shadow-[0_0_0_1px_rgba(5,150,105,0.08)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}`}><div className="flex items-start gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${paymentType === 'CASH_CHECK' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Icon kind="money" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-slate-900">Cash / Check</span><span className={`flex size-5 items-center justify-center rounded-full border ${paymentType === 'CASH_CHECK' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-transparent'}`}><Icon kind="check" /></span></div><p className="mt-1.5 text-[11px] leading-[1.15rem] text-slate-500">Requires a bank check number plus physical signatory and accounting-ledger verification before release.</p></div></div></button>
                <button type="button" aria-pressed={paymentType === 'CREDIT_TERMS'} onClick={() => { setPaymentType('CREDIT_TERMS'); setCheckNumber(''); }} className={`rounded-xl border p-4 text-left transition ${paymentType === 'CREDIT_TERMS' ? 'border-amber-400 bg-amber-50/65 shadow-[0_0_0_1px_rgba(217,119,6,0.08)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}`}><div className="flex items-start gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${paymentType === 'CREDIT_TERMS' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}><Icon kind="credit" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-slate-900">Credit / Charge Terms</span><span className={`flex size-5 items-center justify-center rounded-full border ${paymentType === 'CREDIT_TERMS' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 text-transparent'}`}><Icon kind="check" /></span></div><p className="mt-1.5 text-[11px] leading-[1.15rem] text-slate-500">Uses supplier credit terms and bypasses pre-purchase check release, proceeding directly to purchase readiness.</p></div></div></button>
              </div>
              {validationErrors?.paymentType?._errors && <FieldError>{validationErrors.paymentType._errors[0]}</FieldError>}
            </section>

            {paymentType === 'CASH_CHECK' && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cash / check controls</p><h3 className="mt-1 text-[13px] font-semibold text-slate-900">Disbursement authorization</h3></div>
                <div className="space-y-5 px-5 py-5">
                  <div className="max-w-md"><FieldLabel>Bank Check Number</FieldLabel><input type="text" required={paymentType === 'CASH_CHECK'} className={`${inputClass(!!validationErrors?.checkNumber)} font-mono`} placeholder="e.g. CHK-2026-9812" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} /><p className="mt-1.5 text-[10px] leading-4 text-slate-400">Record the physical check sequence exactly as issued by the Business Office.</p>{validationErrors?.checkNumber?._errors && <FieldError>{validationErrors.checkNumber._errors[0]}</FieldError>}</div>
                  <div><div className="mb-2.5 flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold text-slate-800">Required release attestations</p><p className="mt-0.5 text-[10px] text-slate-400">Both controls must be verified before financial clearance can be committed.</p></div><span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${checksVerified === 2 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{checksVerified} of 2 verified</span></div><div className="grid gap-2.5"><CheckItem id="gate-sign" checked={physicalCheckSigned} onChange={setPhysicalCheckSigned} label="Check Signatory Clearance Verified" description="I verify the physical corporate check has been reviewed, cross-matched with the total amount, and signed by authorized executives."/><CheckItem id="gate-ledger" checked={ledgerLogged} onChange={setLedgerLogged} label="Disbursement Ledger Commitment" description="The bank payment voucher reference has been recorded in the physical accounting log books."/></div></div>
                </div>
              </section>
            )}

            {paymentType === 'CREDIT_TERMS' && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/55 px-5 py-4"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Icon kind="credit" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Credit terms routing</p><h3 className="mt-1 text-[12px] font-semibold text-amber-950">Check release is not applicable for this modality</h3><p className="mt-1.5 text-[11px] leading-[1.2rem] text-amber-900/80">Authorizing Credit Terms bypasses pre-purchase check release and transitions the request directly to <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-amber-900">Ready_for_Purchase</code>. Billing will be settled upon supplier invoice submission.</p></div></div></section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-300 bg-slate-950 text-white shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
              <div className="grid gap-px bg-white/10 sm:grid-cols-[1fr_auto]">
                <div className="bg-slate-950 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Clearance outcome</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-[12px] font-semibold text-white">{paymentType === 'CASH_CHECK' ? 'Authorize check-backed financial clearance' : 'Authorize supplier credit-terms clearance'}</span><span className="font-mono text-[11px] tabular-nums text-emerald-300">{formatPeso(calculatedBilledTotal)}</span></div><p className="mt-1.5 text-[10px] leading-4 text-slate-400">This action records the settlement modality and advances the requisition according to the existing procurement state rules.</p></div>
                <div className="flex items-center bg-slate-950 px-5 py-4"><ActionButton type="submit" disabled={isPending} className="w-full whitespace-nowrap border-emerald-500 bg-emerald-600 hover:border-emerald-400 hover:bg-emerald-500 sm:w-auto">{isPending ? 'Authorizing clearance…' : <><span>Authorize Financial Clearance</span><Icon kind="arrow" /></>}</ActionButton></div>
              </div>
            </section>
          </form>
        )}
      </ReviewWorkspace>
    </PageShell>
  );
}
