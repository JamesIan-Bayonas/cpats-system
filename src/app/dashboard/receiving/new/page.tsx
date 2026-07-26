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
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fakeStoragePath = `/storage/assets/${Date.now()}-${file.name}`;
      setAsssetImageFilePath(fakeStoragePath);

      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
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

        setTransactionSuccess('Cargo intake report generated successfully and hardware photo record bound.');

        setPurchaseOrderId('');
        setCondition('');
        setInvoiceFilePath('');
        setAsssetImageFilePath('');
        setImagePreviewUrl(null);
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
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Receiving_Custodian) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account is not authorized for cargo receiving inspections. Available to Receiving Custodians only.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = receivingQueue.map((poNode) => ({
    id: poNode.id,
    title: poNode.purchaseRequest.justification,
    subtitle: poNode.poNumber,
    dateLabel: new Date(poNode.purchaseRequest.createdAt).toLocaleDateString(),
  }));

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 5 of 6 · Cargo Intake & Photo Inspection"
        title="Cargo Intake & Physical Photo Inspection"
        description="Inspect arriving shipments, capture physical hardware photos, attach invoices, and generate receiving reports."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Arrived Shipments Awaiting Inspection"
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
              className={`${inputClass(!!fieldErrors?.purchaseOrderId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select a shipment from the queue..."
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
                className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition min-h-[44px] cursor-pointer ${
                  condition === 'Good'
                    ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ✓ Good Condition
              </button>
              <button
                type="button"
                onClick={() => setCondition('Damaged')}
                className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition min-h-[44px] cursor-pointer ${
                  condition === 'Damaged'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ✕ Damaged Cargo
              </button>
            </div>
            {fieldErrors?.condition?._errors && <FieldError>{fieldErrors.condition._errors[0]}</FieldError>}
          </div>

          <div>
            <FieldLabel>Physical Hardware Photographic Evidence</FieldLabel>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-emerald-600 transition bg-slate-50/50">
              {imagePreviewUrl ? (
                <div className="space-y-3">
                  <img
                    src={imagePreviewUrl}
                    alt="Physical Hardware Intake"
                    className="max-h-48 rounded-lg mx-auto border border-slate-300 shadow-sm object-cover"
                  />
                  <p className="text-[11px] font-mono text-slate-500">{asssetImageFilePath}</p>
                </div>
              ) : (
                <div className="space-y-2 py-3">
                  <svg className="w-8 h-8 text-slate-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-700">Capture Hardware Photo or Drag File Here</p>
                  <p className="text-[10px] text-slate-400">Supports JPG, PNG photographic proof of physical equipment</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFileSelect}
                className="mt-2 text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>
            {fieldErrors?.asssetImageFilePath?._errors && (
              <FieldError>{fieldErrors.asssetImageFilePath._errors[0]}</FieldError>
            )}
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
              placeholder="Optional notes regarding shipping condition or packaging details..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Saving Intake...' : 'Finalize Cargo Intake'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}