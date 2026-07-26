// File: src/app/dashboard/po/release-check/page.tsx
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
  checkNumber?: ZodSubErrors;
}

interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  isCheckIssued: boolean;
}

interface ItemPayloadNode {
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
  itemsPayload?: ItemPayloadNode[] | unknown;
}

function deriveItemSummaryTitle(itemsPayload: unknown): string {
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) {
    return 'Purchase Order Requisition';
  }
  const items = itemsPayload as ItemPayloadNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Purchased Item';
  const firstItemQty = items[0]?.quantity || 1;

  if (items.length === 1) {
    return `${firstItemName} (x${firstItemQty})`;
  }
  return `${firstItemName} (+${items.length - 1} more item${items.length > 2 ? 's' : ''})`;
}

export default function ReleaseCheckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [poId, setPoId] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
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

  const handleCheckReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Business_Office) {
      setSystemError('Access denied. Action restricted to Business Office profiles.');
      return;
    }

    if (!physicalCheckSigned || !ledgerLogged) {
      setSystemError('Both physical signatory checks and ledger entries must be verified before releasing the check.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/po/release-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poId, checkNumber }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error('Please check the highlighted fields below.');
          }
          throw new Error(result.error || 'A transaction exception occurred while recording the check release.');
        }

        setTransactionSuccess(`Financial authorization confirmed. Check [${checkNumber}] assigned successfully.`);
        
        setPoId('');
        setCheckNumber('');
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
      } else {
        setPoId('');
        setSystemError('No unissued Purchase Order found for this request.');
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
          Your account isn’t authorized to release checks. Available to the Business Office only.
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
      description: task.justification,
    };
  });

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 4-B of 6 · Check Release"
        title="Business Office Check Release Terminal"
        description="Log physical bank disbursement codes and finalize financial clearance before physical item purchase or supplier delivery."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Orders Awaiting Check Issuance"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No pending orders require check disbursement at this time."
        selectedId={checkQueue.find((t) => t.purchaseOrders.some((po) => po.id === poId))?.id || ''}
        onSelect={handleTaskSelection}
      >
        <form onSubmit={handleCheckReleaseSubmit} className="space-y-6">
          <div>
            <FieldLabel>Target Purchase Order (UUID Reference)</FieldLabel>
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

          <div>
            <FieldLabel>Bank Check Number</FieldLabel>
            <input
              type="text"
              required
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

          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Releasing Check…' : 'Authorize Check Release'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}