'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import QRCodeSVG from '@/components/ui/QRCodeSVG';
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
  deriveItemSummaryTitle,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  purchaseRequestId?: ZodSubErrors;
  poNumber?: ZodSubErrors;
  paymentType?: ZodSubErrors;
}

interface ApprovedPRQueueNode {
  id: string;
  justification: string;
  itemsPayload?: any;
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
  const [paymentType, setPaymentType] = useState<'CASH_CHECK' | 'CREDIT_TERMS'>('CASH_CHECK');
  const [custodyConfirmed, setCustodyConfirmed] = useState<boolean>(false);

  const [createdPoDetails, setCreatedPoDetails] = useState<{
    poNumber: string;
    qrCodeToken: string;
    paymentType: string;
    departmentCode?: string;
    prId?: string;
  } | null>(null);

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

  const handleGeneratePoNumber = () => {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    setPoNumber(`PO-${year}-${randomSeq}`);
  };

  const handlePurchaseOrderGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuntimeError(null);
    setValidationErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Purchasing_Office) {
      setRuntimeError('Access denied. Only Purchasing Office accounts can generate POs.');
      return;
    }

    if (!custodyConfirmed) {
      setRuntimeError('You must confirm custody and preparation of the Purchase Order before proceeding.');
      return;
    }

    const selectedPR = purchasingQueue.find((node) => node.id === purchaseRequestId);

    startTransition(async () => {
      try {
        const response = await fetch('/api/po/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseRequestId, poNumber, paymentType }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setValidationErrors(result.errors);
            throw new Error('Please check the highlighted fields below.');
          }
          throw new Error(result.error || 'A system error occurred while generating the PO.');
        }

        setCreatedPoDetails({
          poNumber: result.data.poNumber,
          qrCodeToken: result.data.qrCodeToken,
          paymentType: result.data.paymentType,
          departmentCode: selectedPR?.department.code || 'DMC',
          prId: purchaseRequestId,
        });

        const statusNotice = paymentType === 'CREDIT_TERMS'
          ? 'Bound on CREDIT TERMS (Charge Account). Transmitted directly to supplier; ready for cargo delivery.'
          : 'Bound on CASH / CHECK terms. Routed to Business Office for check issuance.';

        setTransactionSuccess(`Purchase Order [${poNumber}] generated successfully. ${statusNotice}`);
        
        setPurchaseRequestId('');
        setPoNumber('');
        setPaymentType('CASH_CHECK');
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Purchasing_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account is not authorized to generate Purchase Orders. Available to Purchasing Office profiles only.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = purchasingQueue.map((task) => ({
    id: task.id,
    title: deriveItemSummaryTitle(task.itemsPayload, task.justification),
    subtitle: task.department.code,
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
    justificationPreview: task.justification,
  }));

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 4-A of 6 · PO Generation & Modality Selection"
        title="Generate Purchase Order & Asset QR Tag"
        description="Bind approved requisitions to official PO numbers, select payment modality (Cash/Check vs Credit Terms), and generate cryptographic QR barcode tags."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {runtimeError && <ErrorBanner>{runtimeError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      {createdPoDetails && (
        <div className="bg-[#022C22] text-white border border-emerald-800 rounded-xl p-6 my-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-300 bg-emerald-900/90 px-2.5 py-1 rounded border border-emerald-700">
                  Official Asset Sticker Tag
                </span>
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-200 bg-emerald-900/80 px-2.5 py-1 rounded border border-emerald-700">
                  Dept: {createdPoDetails.departmentCode}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded border ${
                  createdPoDetails.paymentType === 'CREDIT_TERMS' 
                    ? 'bg-amber-900/90 text-amber-200 border-amber-700' 
                    : 'bg-emerald-900/80 text-emerald-200 border-emerald-700'
                }`}>
                  Modality: {createdPoDetails.paymentType.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tight text-white">{createdPoDetails.poNumber}</h3>
              <p className="text-xs text-emerald-200 font-mono break-all max-w-md">
                Cryptographic Token: <span className="text-emerald-300 font-bold">{createdPoDetails.qrCodeToken}</span>
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase px-4 py-2 rounded-lg transition cursor-pointer active:scale-95 shadow-sm inline-flex items-center gap-2"
                >
                  <span>🖨</span> Print Official Asset Tag Sticker
                </button>
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl shadow-md shrink-0 border border-emerald-400/40 text-center">
              <QRCodeSVG value={createdPoDetails.qrCodeToken} size={130} />
              <span className="block text-[9px] font-mono font-bold text-slate-700 mt-1.5 uppercase tracking-wider">DMC CPATS STICKER</span>
            </div>
          </div>
        </div>
      )}

      <ReviewWorkspace
        queueTitle="Approved Requests Awaiting PO"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No approved requests are currently waiting for PO generation."
        selectedId={purchaseRequestId}
        onSelect={setPurchaseRequestId}
      >
        <form onSubmit={handlePurchaseOrderGeneration} className="space-y-6">
          <div>
            <FieldLabel>Purchase Request Reference (UUID)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!validationErrors?.purchaseRequestId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select an approved request from the list..."
              value={purchaseRequestId}
            />
            {validationErrors?.purchaseRequestId?._errors && (
              <FieldError>{validationErrors.purchaseRequestId._errors[0]}</FieldError>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <FieldLabel>Purchase Order Number</FieldLabel>
              <button
                type="button"
                onClick={handleGeneratePoNumber}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                ⚡ Auto-Format PO Number
              </button>
            </div>
            <input
              type="text"
              required
              className={`${inputClass(!!validationErrors?.poNumber)} font-mono`}
              placeholder="e.g., PO-2026-8891"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
            {validationErrors?.poNumber?._errors && (
              <FieldError>{validationErrors.poNumber._errors[0]}</FieldError>
            )}
          </div>

          <div>
            <FieldLabel>Procurement Payment Modality</FieldLabel>
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
                  <span className="text-xs font-bold text-slate-900">💵 Cash / Check Purchase</span>
                  {paymentType === 'CASH_CHECK' && <span className="text-emerald-700 text-xs font-bold">✓ Selected</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Requires Business Office check release prior to item purchase. Transitions to <code className="text-slate-700 font-mono text-[10px]">Awaiting_Check_Issuance</code>.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('CREDIT_TERMS')}
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
                  30-day net billing with accredited supplier. Bypasses pre-purchase check release and routes directly to <code className="text-slate-700 font-mono text-[10px]">Ready_for_Purchase</code>.
                </p>
              </button>
            </div>
            {validationErrors?.paymentType?._errors && (
              <FieldError>{validationErrors.paymentType._errors[0]}</FieldError>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
              Mandatory Preparation Check
            </span>
            <CheckItem
              id="custody-chk"
              checked={custodyConfirmed}
              onChange={setCustodyConfirmed}
              label="Confirm PO Preparation & Custody"
              description="I affirm that the hard copy of this Purchase Order has been prepared, printed, and is ready for transmission."
            />
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Generating PO & Tag...' : 'Generate PO & Asset Tag'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}