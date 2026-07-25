// src/app/dashboard/po/new/page.tsx
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
  purchaseRequestId?: ZodSubErrors;
  poNumber?: ZodSubErrors;
}

interface ApprovedPRQueueNode {
  id: string;
  justification: string;
  status: PRStatus;
  createdAt: string;
  department: { code: string; name: string };
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [purchaseRequestId, setPurchaseRequestId] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  
  // Dual-Check Verification Gates
  const [specsVerified, setSpecsVerified] = useState<boolean>(false);
  const [custodyConfirmed, setCustodyConfirmed] = useState<boolean>(false);

  const [purchasingQueue, setPurchasingQueue] = useState<ApprovedPRQueueNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncPurchasingQueue(res.data.role);
        }
      })
      .catch(() => setRuntimeError('Failed to load session context. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncPurchasingQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        const activeTasks = (resData.data || []).filter(
          (item: ApprovedPRQueueNode) => item.status === PRStatus.Approved_Awaiting_PO
        );
        setPurchasingQueue(activeTasks);
      }
    } catch (err) {
      console.error('Queue sync failed:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const selectedPrNode = purchasingQueue.find((item) => item.id === purchaseRequestId);

  const handlePurchaseOrderGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuntimeError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Purchasing_Office) {
      setRuntimeError('Access denied. Only Purchasing Office accounts can generate POs.');
      return;
    }

    if (!specsVerified || !custodyConfirmed) {
      setRuntimeError('Mandatory Compliance: You must verify item specifications and confirm physical document custody before generating the PO.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/po/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseRequestId, poNumber }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error('Please check the highlighted fields below.');
          }
          throw new Error(result.error || 'A system error occurred while generating the PO.');
        }

        setTransactionSuccess(`Purchase Order [${poNumber}] successfully generated and bound to request.`);
        
        setPurchaseRequestId('');
        setPoNumber('');
        setSpecsVerified(false);
        setCustodyConfirmed(false);
        
        await syncPurchasingQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setRuntimeError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Purchasing_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account isn’t authorized to generate Purchase Orders. Available to the Purchasing Office only.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = purchasingQueue.map((task) => ({
    id: task.id,
    title: task.justification,
    subtitle: task.department.code,
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
  }));

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 4-A of 6 · PO Generation"
        title="Generate Purchase Order"
        description="Bind approved requisitions to official Purchase Order numbers prior to check issuance."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {runtimeError && <ErrorBanner>{runtimeError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Approved Requests Awaiting PO"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No approved requests are currently waiting for PO generation."
        selectedId={purchaseRequestId}
        onSelect={setPurchaseRequestId}
      >
        <form onSubmit={handlePurchaseOrderGeneration} className="space-y-6">
          
          {/* Target Reference Field */}
          <div>
            <FieldLabel>Target Purchase Request (UUID)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!validationErrors?.purchaseRequestId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select an approved request from the queue list on the left…"
              value={purchaseRequestId}
            />
            {validationErrors?.purchaseRequestId?._errors && (
              <FieldError>{validationErrors.purchaseRequestId._errors[0]}</FieldError>
            )}
          </div>

          {/* Active Requisition Details Context Banner */}
          {selectedPrNode && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Requisition Summary Preview
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                  {selectedPrNode.department.code} Department
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {selectedPrNode.justification}
              </p>
            </div>
          )}

          {/* PO Number Input */}
          <div>
            <FieldLabel>Purchase Order Number</FieldLabel>
            <input
              type="text"
              required
              className={`${inputClass(!!validationErrors?.poNumber)} font-mono text-sm`}
              placeholder="e.g., PO-2026-XXXX"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
            {validationErrors?.poNumber?._errors && (
              <FieldError>{validationErrors.poNumber._errors[0]}</FieldError>
            )}
          </div>

          {/* Expanded 2-Step Mandatory Preparation Clearances */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Mandatory Preparation Clearances
            </span>
            <div className="space-y-2.5">
              <CheckItem
                id="specs-chk"
                checked={specsVerified}
                onChange={setSpecsVerified}
                label="Item Specifications & Vendor Match"
                description="I confirm that line item quantities, technical specifications, and vendor quotations match the approved request."
              />
              <CheckItem
                id="custody-chk"
                checked={custodyConfirmed}
                onChange={setCustodyConfirmed}
                label="Confirm PO Preparation & Physical Custody"
                description="I affirm that the hard copy of this Purchase Order has been prepared, printed, and is ready for transmission."
              />
            </div>
          </div>

          {/* Form Commitment Action Footer */}
          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Generating PO…' : 'Generate Purchase Order'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}