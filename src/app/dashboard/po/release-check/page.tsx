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
  department: { code: string; name: string };
  purchaseOrders: PurchaseOrderSummary[];
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

        setTransactionSuccess(`Financial authorization confirmed. Check ${checkNumber} assigned.`);
        
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
    const task = checkQueue.find(t => t.id === taskId);
    if (task) {
      const unissuedPO = task.purchaseOrders.find(po => !po.isCheckIssued);
      if (unissuedPO) {
        setPoId(unissuedPO.id);
      } else {
        setPoId('');
        setSystemError("No unissued Purchase Order found for this request.");
      }
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading your session…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Business_Office) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <h2 className="text-rose-700 font-bold text-sm">Access restricted</h2>
          <p className="text-slate-500 text-sm mt-2">
            Your account isn’t authorized to release checks. This page is available to the Business Office only.
          </p>
        </Card>
      </div>
    );
  }

  const queueTasks: QueueTask[] = checkQueue.map((task) => {
    const poTarget = task.purchaseOrders.find(p => !p.isCheckIssued);
    return {
      id: task.id,
      title: task.justification,
      subtitle: poTarget ? poTarget.poNumber : 'PO Missing',
      dateLabel: new Date(task.createdAt).toLocaleDateString(),
    };
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageShell>
        <StageHeader
          eyebrow="Step 4-B of 6 · Check Release"
          title="Business Office Check Release"
          description="Log physical bank disbursement codes and finalize the financial clearance for procurement."
          meta={{ label: 'Signed in as', value: activeUser.email }}
        />

        {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
        {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

        <ReviewWorkspace
          queueTitle="Orders awaiting check issuance"
          tasks={queueTasks}
          loading={queueLoading}
          emptyMessage="No pending orders require check disbursement at this time."
          selectedId={checkQueue.find(t => t.purchaseOrders.some(po => po.id === poId))?.id || ''}
          onSelect={handleTaskSelection}
        >
          <form onSubmit={handleCheckReleaseSubmit} className="space-y-6">
            <div>
              <FieldLabel>Target Purchase Order (UUID)</FieldLabel>
              <input
                type="text"
                required
                readOnly
                className={`${inputClass(!!validationErrors?.poId)} font-mono bg-slate-100 cursor-not-allowed`}
                placeholder="Select a record from the list…"
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
                placeholder="Enter physical check sequence…"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
              />
              {validationErrors?.checkNumber?._errors && (
                <FieldError>{validationErrors.checkNumber._errors[0]}</FieldError>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Disbursement Clearances
              </span>
              <CheckItem
                id="gate-sign"
                checked={physicalCheckSigned}
                onChange={setPhysicalCheckSigned}
                label="Check Signatory Clearance Verified"
                description="I verify the physical corporate check has been reviewed, cross-matched with the total, and signed by authorized executives."
              />
              <CheckItem
                id="gate-ledger"
                checked={ledgerLogged}
                onChange={setLedgerLogged}
                label="Disbursement Ledger Commitment"
                description="The bank payment voucher reference has been recorded in the physical accounting log books."
              />
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <ActionButton type="submit" disabled={isPending}>
                {isPending ? 'Releasing…' : 'Authorize Check Release'}
              </ActionButton>
            </div>
          </form>
        </ReviewWorkspace>
      </PageShell>
    </div>
  );
}