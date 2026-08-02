// src/app/dashboard/po/release-check/page.tsx
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
  ActionButton,
  QueueTask,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  poId?: ZodSubErrors;
  paymentType?: ZodSubErrors;
  checkNumber?: ZodSubErrors;
  items?: Record<string, unknown>;
}

interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  isCheckIssued: boolean;
}

interface BillingItemNode {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

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
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) {
    return 'Purchase Order Requisition';
  }
  const items = itemsPayload as BillingItemNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Purchased Item';
  const firstItemQty = items[0]?.quantity || 1;

  if (items.length === 1) {
    return `${firstItemName} (x${firstItemQty})`;
  }
  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${items.length - 1 > 1 ? 's' : ''}`;
}

export default function ReleaseCheckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [poId, setPoId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'CASH_CHECK' | 'CREDIT_TERMS'>('CASH_CHECK');
  const [checkNumber, setCheckNumber] = useState<string>('');
  
  // Billing Statement Items State
  const [billingItems, setBillingItems] = useState<BillingItemNode[]>([]);

  // Clearances
  const [physicalCheckSigned, setPhysicalCheckSigned] = useState<boolean>(false);
  const [ledgerLogged, setLedgerLogged] = useState<boolean>(false);

  const [checkQueue, setCheckQueue] = useState<AwaitingCheckPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        const awaitingTasks = (resData.data || []).filter(
          (item: AwaitingCheckPRNode) => item.status === PRStatus.Awaiting_Check_Issuance
        );
        setCheckQueue(awaitingTasks);
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

  const calculatedBilledTotal = billingItems.reduce((acc, item) => {
    return acc + (item.quantity * (item.unitPrice || 0));
  }, 0);

  const handleFinancialClearanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Business_Office) {
      setSystemError('Access denied. Action restricted to Business Office profiles.');
      return;
    }

    if (paymentType === 'CASH_CHECK' && (!physicalCheckSigned || !ledgerLogged)) {
      setSystemError('Both physical signatory checks and ledger entries must be verified before releasing the check.');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          poId,
          paymentType,
          items: billingItems,
          ...(paymentType === 'CASH_CHECK' ? { checkNumber } : {})
        };

        const response = await fetch('/api/po/release-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error('Please check the highlighted fields below.');
          }
          throw new Error(result.error || 'A transaction exception occurred while recording financial clearance.');
        }

        const successNotice = paymentType === 'CREDIT_TERMS'
          ? `Financial clearance granted under Credit Terms. Total Billed: ₱${calculatedBilledTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
          : `Financial clearance authorized. Check [${checkNumber}] assigned. Total Billed: ₱${calculatedBilledTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;

        setTransactionSuccess(successNotice);
        
        setPoId('');
        setPaymentType('CASH_CHECK');
        setCheckNumber('');
        setBillingItems([]);
        setPhysicalCheckSigned(false);
        setLedgerLogged(false);
        
        await syncCheckReleaseQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  const handleTaskSelection = (taskId: string) => {
    const task = checkQueue.find((t) => t.id === taskId);
    if (task) {
      const unissuedPO = task.purchaseOrders.find((po) => !po.isCheckIssued);
      if (unissuedPO) {
        setPoId(unissuedPO.id);
        
        if (Array.isArray(task.itemsPayload)) {
          const formatted = (task.itemsPayload as any[]).map((item) => ({
            itemName: item.itemName || 'Item Description',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
          }));
          setBillingItems(formatted);
        } else {
          setBillingItems([]);
        }
      } else {
        setPoId('');
        setBillingItems([]);
        setSystemError('No pending Purchase Order found for this request.');
      }
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Business_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account isn’t authorized for financial clearances. Available to the Business Office only.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = checkQueue.map((task) => {
    const poTarget = task.purchaseOrders.find((p) => !p.isCheckIssued);
    const poCode = poTarget ? poTarget.poNumber : 'PO Missing';
    const deptBadge = task.department?.code ? `${task.department.code} • ${poCode}` : poCode;

    return {
      id: task.id,
      title: deriveItemSummaryTitle(task.itemsPayload),
      subtitle: deptBadge,
      dateLabel: new Date(task.createdAt).toLocaleDateString(),
      justificationPreview: task.justification,
    };
  });

  const selectedTask = checkQueue.find((t) => t.purchaseOrders.some((po) => po.id === poId));

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 4-B of 6 · Billing Statement Settlement & Disbursement"
        title="Business Office Financial Clearance Terminal"
        description="Review vendor billing statements, enter line-item amounts, select payment modality (Cash/Check vs Credit Terms), and log disbursement details."
        meta={{ label: 'Signed in as', value: activeUser?.email || '' }}
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
        <form onSubmit={handleFinancialClearanceSubmit} className="space-y-6">
          <div>
            <FieldLabel>Target Purchase Order Reference</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!validationErrors?.poId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select an order from the queue list on the left…"
              value={poId}
            />
            {validationErrors?.poId?._errors && (
              <FieldError>{validationErrors.poId._errors[0]}</FieldError>
            )}
          </div>

          {/* REQUISITION PURPOSE & OPERATIONAL JUSTIFICATION CALLOUT */}
          {selectedTask ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Originating Department
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedTask.department.name} ({selectedTask.department.code})
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  Requisition Ref Code: {selectedTask.id.substring(0, 13)}...
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                  Operational Justification & Purpose
                </span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedTask.justification}"
                </div>
              </div>
            </div>
          ) : null}

          {/* BILLING STATEMENT: ITEMS — QUANTITY — AMOUNT UI CARD */}
          {selectedTask && billingItems.length > 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900 font-mono block">
                    Billing Statement: Items — Quantity — Amount
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Input unit prices based on official vendor billing statement / quotation
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                  Billed Total: ₱{calculatedBilledTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase font-mono">
                      <th className="p-2.5">Items (Item Description)</th>
                      <th className="p-2.5 text-center whitespace-nowrap">Quantity</th>
                      <th className="p-2.5 text-right whitespace-nowrap">Unit Price (₱)</th>
                      <th className="p-2.5 text-right whitespace-nowrap">Amount (Subtotal ₱)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {billingItems.map((item, idx) => {
                      const lineAmount = item.quantity * (item.unitPrice || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="p-2.5 font-bold text-slate-900">{item.itemName}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-700">{item.quantity}</td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="0.00"
                              className="w-28 text-right font-mono text-xs px-2 py-1 bg-white border border-slate-300 rounded focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                              value={item.unitPrice || ''}
                              onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            ₱{lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              Select an order from the queue list on the left to populate its billing statement itemization schedule.
            </div>
          )}

          <div>
            <FieldLabel>Select Payment Modality</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('CASH_CHECK')}
                className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                  paymentType === 'CASH_CHECK'
                    ? 'border-emerald-700 bg-emerald-50/80 ring-2 ring-emerald-700/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">💵 Cash / Check Disbursement</span>
                  {paymentType === 'CASH_CHECK' && <span className="text-emerald-700 text-xs font-bold">✓ Selected</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Requires bank check issuance. Enter bank check sequence number below.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType('CREDIT_TERMS');
                  setCheckNumber('');
                }}
                className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                  paymentType === 'CREDIT_TERMS'
                    ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">📄 Credit / Charge Terms ("Utang")</span>
                  {paymentType === 'CREDIT_TERMS' && <span className="text-amber-700 text-xs font-bold">✓ Selected</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  30-day net billing with accredited supplier. Authorizes direct purchase without check release.
                </p>
              </button>
            </div>
            {validationErrors?.paymentType?._errors && (
              <FieldError>{validationErrors.paymentType._errors[0]}</FieldError>
            )}
          </div>

          {paymentType === 'CASH_CHECK' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <FieldLabel>Bank Check Number</FieldLabel>
                <input
                  type="text"
                  required={paymentType === 'CASH_CHECK'}
                  className={`${inputClass(!!validationErrors?.checkNumber)} font-mono`}
                  placeholder="e.g. CHK-2026-9812"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                />
                {validationErrors?.checkNumber?._errors && (
                  <FieldError>{validationErrors.checkNumber._errors[0]}</FieldError>
                )}
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Disbursement Authorization Clearances
                </span>
                <div className="space-y-2.5">
                  <CheckItem
                    id="gate-sign"
                    checked={physicalCheckSigned}
                    onChange={setPhysicalCheckSigned}
                    label="Check Signatory Clearance Verified"
                    description="I verify the physical corporate check has been reviewed, cross-matched with the total amount, and signed by authorized executives."
                  />
                  <CheckItem
                    id="gate-ledger"
                    checked={ledgerLogged}
                    onChange={setLedgerLogged}
                    label="Disbursement Ledger Commitment"
                    description="The bank payment voucher reference has been recorded in the physical accounting log books."
                  />
                </div>
              </div>
            </div>
          )}

          {paymentType === 'CREDIT_TERMS' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="font-bold block uppercase tracking-wider text-[10px]">
                ⚡ Charge Account Authorization Notice
              </span>
              <p className="leading-relaxed">
                Authorizing Credit Terms bypasses pre-purchase check release and transitions the request directly to <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">Ready_for_Purchase</code>. Billing will be settled upon supplier invoice submission.
              </p>
            </div>
          )}

          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Granting Clearance…' : 'Authorize Financial Clearance'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}