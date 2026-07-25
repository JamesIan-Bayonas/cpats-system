// src/app/dashboard/receiving/new/page.tsx
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
  purchaseOrderId?: ZodSubErrors;
  condition?: ZodSubErrors;
  invoiceFilePath?: ZodSubErrors;
  asssetImageFilePath?: ZodSubErrors;
}

interface PendingPOQueueNode {
  id: string;
  poNumber: string;
  purchaseRequestId: string;
  purchaseRequest: {
    justification: string;
    status: PRStatus;
    createdAt: string;
    department: { code: string; name: string };
  };
}

export default function ReceivingCustodianPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('');
  const [condition, setCondition] = useState<'Good' | 'Damaged' | ''>('');
  const [invoiceFilePath, setInvoiceFilePath] = useState<string>('');
  const [asssetImageFilePath, setAsssetImageFilePath] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [quantityVerified, setQuantityVerified] = useState<boolean>(false);
  const [cameraViewportMapped, setCameraViewportMapped] = useState<boolean>(false);

  const [receivingQueue, setReceivingQueue] = useState<PendingPOQueueNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncReceivingQueue(res.data.role);
        }
      })
      .catch(() => setSystemError('Failed to load session context. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncReceivingQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        setReceivingQueue(resData.data || []);
      }
    } catch (err) {
      console.error('Intake queue sync error:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleReceivingCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Receiving_Custodian) {
      setSystemError('Access denied. Profile credentials insufficient for cargo intake.');
      return;
    }

    if (!quantityVerified || !cameraViewportMapped) {
      setSystemError('Please confirm manifest quantity verification and visual inspection before finalizing.');
      return;
    }

    if (!condition) {
      setSystemError('Please select an asset condition status (Good or Damaged).');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/receiving/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseOrderId,
            condition,
            invoiceFilePath,
            asssetImageFilePath,
            remarks,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Please check the highlighted fields below.');
          }
          throw new Error(result.error || 'A remote exception occurred while recording intake.');
        }

        setTransactionSuccess('Cargo intake report generated successfully and request closed.');

        setPurchaseOrderId('');
        setCondition('');
        setInvoiceFilePath('');
        setAsssetImageFilePath('');
        setRemarks('');
        setQuantityVerified(false);
        setCameraViewportMapped(false);

        await syncReceivingQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading your session…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Receiving_Custodian) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <h2 className="text-rose-700 font-bold text-sm">Access restricted</h2>
          <p className="text-slate-500 text-sm mt-2">
            Your account isn’t authorized for receiving inspections. Available to Receiving Custodians only.
          </p>
        </Card>
      </div>
    );
  }

  const queueTasks: QueueTask[] = receivingQueue.map((poNode) => ({
    id: poNode.id,
    title: poNode.purchaseRequest.justification,
    subtitle: poNode.poNumber,
    dateLabel: new Date(poNode.purchaseRequest.createdAt).toLocaleDateString(),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <PageShell>
        <StageHeader
          eyebrow="Step 5 of 6 · Cargo Intake & Inspection"
          title="Cargo Intake & Inspection"
          description="Inspect arriving shipments, verify quantities, attach supplier invoices, and generate receiving reports."
          meta={{ label: 'Signed in as', value: activeUser.email }}
        />

        {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
        {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

        <ReviewWorkspace
          queueTitle="Arrived shipments awaiting inspection"
          tasks={queueTasks}
          loading={queueLoading}
          emptyMessage="No open physical deliveries are waiting for inspection."
          selectedId={purchaseOrderId}
          onSelect={setPurchaseOrderId}
        >
          <form onSubmit={handleReceivingCommit} className="space-y-6">
            <div>
              <FieldLabel>Target Purchase Order (UUID)</FieldLabel>
              <input
                type="text"
                required
                readOnly
                className={`${inputClass(!!fieldErrors?.purchaseOrderId)} font-mono bg-slate-100 cursor-not-allowed`}
                placeholder="Select a shipment from the queue…"
                value={purchaseOrderId}
              />
              {fieldErrors?.purchaseOrderId?._errors && (
                <FieldError>{fieldErrors.purchaseOrderId._errors[0]}</FieldError>
              )}
            </div>

            <div>
              <FieldLabel>Asset Physical Condition</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCondition('Good')}
                  className={`py-2.5 text-sm font-semibold rounded-lg border transition ${
                    condition === 'Good'
                      ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ✓ Good Condition
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('Damaged')}
                  className={`py-2.5 text-sm font-semibold rounded-lg border transition ${
                    condition === 'Damaged'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ✕ Damaged Cargo
                </button>
              </div>
              {fieldErrors?.condition?._errors && <FieldError>{fieldErrors.condition._errors[0]}</FieldError>}
            </div>

            <div>
              <FieldLabel>Supplier Invoice Storage Path (Link)</FieldLabel>
              <input
                type="text"
                required
                className={`${inputClass(!!fieldErrors?.invoiceFilePath)} font-mono`}
                placeholder="/storage/invoices/INV-2026-XXXX.pdf"
                value={invoiceFilePath}
                onChange={(e) => setInvoiceFilePath(e.target.value)}
              />
              {fieldErrors?.invoiceFilePath?._errors && (
                <FieldError>{fieldErrors.invoiceFilePath._errors[0]}</FieldError>
              )}
            </div>

            <div>
              <FieldLabel>Hardware Photographic Scan Path (Link)</FieldLabel>
              <input
                type="text"
                required
                className={`${inputClass(!!fieldErrors?.asssetImageFilePath)} font-mono`}
                placeholder="/storage/assets/photo-2026-XXXX.jpg"
                value={asssetImageFilePath}
                onChange={(e) => setAsssetImageFilePath(e.target.value)}
              />
              {fieldErrors?.asssetImageFilePath?._errors && (
                <FieldError>{fieldErrors.asssetImageFilePath._errors[0]}</FieldError>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Inspection Clearances
              </span>
              <CheckItem
                id="chk-qty"
                checked={quantityVerified}
                onChange={setQuantityVerified}
                label="Manifest Quantity Verification"
                description="I confirm unit quantities arriving physically match the numbers on the supplier invoice."
              />
              <CheckItem
                id="chk-cam"
                checked={cameraViewportMapped}
                onChange={setCameraViewportMapped}
                label="Physical Photo Record Captured"
                description="Photographic proof of physical condition has been captured and linked to the asset record."
              />
            </div>

            <div>
              <FieldLabel>Inspection Remarks</FieldLabel>
              <textarea
                rows={2}
                className={inputClass(false)}
                placeholder="Optional notes regarding shipping condition or packaging details…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <ActionButton type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Finalize Cargo Intake'}
              </ActionButton>
            </div>
          </form>
        </ReviewWorkspace>
      </PageShell>
    </div>
  );
}