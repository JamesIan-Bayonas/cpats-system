// src/app/dashboard/pr/approve-admin/page.tsx
// Enterprise executive-review UI overhaul.
// Existing state, validation, queue synchronization, upload behavior, and API mutation contract are preserved.

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
  prId?: ZodSubErrors;
  action?: ZodSubErrors;
  remarks?: ZodSubErrors;
  adminProofFilePath?: ZodSubErrors;
}

interface ItemPayloadNode {
  itemName: string;
  quantity: number;
  unitPrice?: number;
}

interface PendingAdminPRNode {
  id: string;
  justification: string;
  status: PRStatus;
  isDirectPoBypass?: boolean;
  adminProofFilePath?: string | null;
  createdAt: string;
  department: {
    code: string;
    name: string;
  };
  itemsPayload?: ItemPayloadNode[] | unknown;
}

function deriveItemSummaryTitle(itemsPayload: unknown): string {
  if (!itemsPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) {
    return 'Executive Purchase Requisition';
  }

  const items = itemsPayload as ItemPayloadNode[];
  const firstItemName = items[0]?.itemName?.trim() || 'Requested Item';
  const firstItemQty = items[0]?.quantity || 1;

  if (items.length === 1) {
    return `${firstItemName} (x${firstItemQty})`;
  }

  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${
    items.length - 1 > 1 ? 's' : ''
  }`;
}

const isImageFile = (path?: string | null) => {
  if (!path) return false;
  return /\.(jpg|jpeg|png|webp|svg)$/i.test(path);
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function DocumentIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5M10 13h5M10 16h5" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M4 21V7l8-4 8 4v14M8 10h2M14 10h2M8 14h2M14 14h2M9 21v-4h6v4" />
    </svg>
  );
}

function ShieldCheckIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M5 12h14M14 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M12 16V4M8 8l4-4 4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptySelectionState() {
  return (
    <div className="flex min-h-[430px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm">
        <DocumentIcon className="size-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        Select a requisition for executive review
      </h3>
      <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-slate-500">
        Choose a pending record from the queue to inspect its evidence, item schedule,
        authorization requirements, and executive disposition controls.
      </p>
    </div>
  );
}

export default function AdminOfficeApprovalPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [prId, setPrId] = useState<string>('');
  const [action, setAction] = useState<
    'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''
  >('');
  const [remarks, setRemarks] = useState<string>('');

  // Option 1 Off-Campus Toggle & Proof State
  const [isOption1Enabled, setIsOption1Enabled] = useState<boolean>(false);
  const [option1ProofFilePath, setOption1ProofFilePath] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // Mandatory Signatory Verification Checkboxes
  const [checkedPR, setCheckedPR] = useState<boolean>(false);
  const [checkedPOAuth, setCheckedPOAuth] = useState<boolean>(false);
  const [checkedPurchaseAuth, setCheckedPurchaseAuth] = useState<boolean>(false);

  // Queue Storage
  const [adminQueue, setAdminQueue] = useState<PendingAdminPRNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // Status Responses
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncAdminWorkspaceQueue(res.data.role);
        } else {
          setActiveUser({
            id: 'admin-approver-uuid-static-789',
            email: 'vp-admin@dmc.edu.ph',
            role: Role.Admin_Office,
            departmentId: 'administration-dept-uuid-hq',
            departmentCode: 'OVPA',
            departmentName: 'Office of the VP for Administration',
          });
          syncAdminWorkspaceQueue(Role.Admin_Office);
        }
      })
      .catch(() => setSystemError('Failed to load session context. Please refresh.'))
      .finally(() => setUserLoading(false));
  }, []);

  const syncAdminWorkspaceQueue = async (role: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role }),
      });

      const resData = await response.json();

      if (response.ok) {
        const adminTasks = (resData.data || []).filter(
          (item: PendingAdminPRNode) =>
            item.status === PRStatus.Pending_Admin_Approval,
        );
        setAdminQueue(adminTasks);
      }
    } catch (err) {
      console.error('Admin queue synchronization interrupted:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleProofFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      setAttachedFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.url) {
          setOption1ProofFilePath(data.url);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  const handleAdminApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setSuccessStatus(null);

    if (!activeUser || activeUser.role !== Role.Admin_Office) {
      setSystemError(
        'SECURITY VIOLATION: Operational profile lacks Admin Office regulatory clearance.',
      );
      return;
    }

    if (!action) {
      setSystemError(
        'VALIDATION FAILURE: You must authoritatively select an approval, correction, or decline command.',
      );
      return;
    }

    if (action === 'APPROVE') {
      if (!checkedPR || !checkedPOAuth || !checkedPurchaseAuth) {
        setSystemError(
          'COMPLIANCE EXCEPTION: All three regulatory authorization check-boxes must be actively validated.',
        );
        return;
      }

      if (
        isOption1Enabled &&
        (!option1ProofFilePath || option1ProofFilePath.trim().length === 0)
      ) {
        setSystemError(
          'AUDIT TRAIL FAILURE: Option 1 Remote Sign-Off is enabled, but no proof file has been attached.',
        );
        return;
      }
    }

    const selectedPR = adminQueue.find((req) => req.id === prId);

    const finalRemarks =
      action === 'APPROVE'
        ? remarks.trim().length >= 5
          ? remarks
          : selectedPR?.isDirectPoBypass
            ? 'Fast-Track Executive Logged: Verified with attached Executive Pre-Approved Letter. Authorized for Purchase Order generation.'
            : `Executive approval granted by Admin Office.`
        : remarks;

    if (action !== 'APPROVE' && finalRemarks.trim().length < 5) {
      setSystemError(
        'COMPLIANCE EXCEPTION: Audit evaluation remarks are mandatory for returning or declining requests (min. 5 characters).',
      );
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          prId,
          action,
          remarks: finalRemarks,
          ...(action === 'APPROVE' &&
          isOption1Enabled &&
          option1ProofFilePath
            ? { adminProofFilePath: option1ProofFilePath }
            : {}),
        };

        const response = await fetch('/api/pr/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Please review the highlighted fields below.');
          }

          throw new Error(
            result.error ||
              'The remote execution node rolled back the database transaction.',
          );
        }

        setSuccessStatus(
          `Executive order finalized. Request [${prId.substring(
            0,
            8,
          )}...] transitioned to: ${action}.`,
        );

        setPrId('');
        setAction('');
        setRemarks('');
        setIsOption1Enabled(false);
        setOption1ProofFilePath('');
        setAttachedFileName(null);
        setCheckedPR(false);
        setCheckedPOAuth(false);
        setCheckedPurchaseAuth(false);

        await syncAdminWorkspaceQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(
          err.message ||
            'A network or server disconnect interrupted ledger propagation.',
        );
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading executive session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Admin_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account (
          {activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized for
          Executive Administration Sign-off.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = adminQueue.map((task) => ({
    id: task.id,
    title: deriveItemSummaryTitle(task.itemsPayload),
    subtitle: task.isDirectPoBypass
      ? `${task.department?.code || 'OVPA'} • PRE-APPROVED`
      : task.department?.code || 'OVPA',
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
    justificationPreview: task.justification,
  }));

  const selectedPR = adminQueue.find((req) => req.id === prId);

  const itemsList: ItemPayloadNode[] =
    selectedPR && Array.isArray(selectedPR.itemsPayload)
      ? (selectedPR.itemsPayload as ItemPayloadNode[])
      : [];

  const hasPrices = itemsList.some(
    (item) => typeof item.unitPrice === 'number' && item.unitPrice > 0,
  );

  const calculatedGrandTotal = itemsList.reduce((acc, item) => {
    const price = item.unitPrice || 0;
    return acc + price * item.quantity;
  }, 0);

  const authorizationCount =
    Number(checkedPR) + Number(checkedPOAuth) + Number(checkedPurchaseAuth);

  const selectedActionLabel =
    action === 'APPROVE'
      ? 'Approve requisition'
      : action === 'RETURN_FOR_CORRECTION'
        ? 'Return for correction'
        : action === 'DECLINE'
          ? 'Decline requisition'
          : 'No decision selected';

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 3 of 6 · Executive Administration Approval"
        title="Executive Requisition Review"
        description="Inspect procurement evidence, confirm executive authorization requirements, and issue the formal administrative disposition."
        meta={{
          label: 'Institutional signatory',
          value: `${activeUser.departmentCode} • Executive Node`,
        }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {successStatus && <SuccessBanner>{successStatus}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Requests Awaiting Executive Sign-Off"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="Backlog Clear: No documents require structural executive evaluation."
        selectedId={prId}
        onSelect={(id) => {
          setPrId(id);
          const pr = adminQueue.find((item) => item.id === id);

          if (pr) {
            setAction('APPROVE');
            setCheckedPR(true);
            setCheckedPOAuth(true);
            setCheckedPurchaseAuth(true);
          }

          setIsOption1Enabled(false);
          setOption1ProofFilePath('');
          setAttachedFileName(null);
        }}
      >
        {!selectedPR ? (
          <EmptySelectionState />
        ) : (
          <form onSubmit={handleAdminApproval} className="space-y-6">
            {/* Hidden immutable reference retained for native/form validation semantics */}
            <div className="sr-only" aria-hidden="true">
              <FieldLabel>Target Requisition (Requisition Ref Code)</FieldLabel>
              <input
                type="text"
                required
                readOnly
                className={`${inputClass(!!fieldErrors?.prId)} font-mono`}
                value={prId}
              />
              {fieldErrors?.prId?._errors && (
                <FieldError>{fieldErrors.prId._errors[0]}</FieldError>
              )}
            </div>

            {/* ================================================================ */}
            {/* EXECUTIVE DOSSIER HEADER                                          */}
            {/* ================================================================ */}
            <section
              aria-labelledby="executive-dossier-heading"
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Executive review dossier
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <h2
                      id="executive-dossier-heading"
                      className="font-mono text-sm font-semibold text-slate-950"
                    >
                      {selectedPR.id}
                    </h2>

                    {selectedPR.isDirectPoBypass && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                        Pre-approved letter
                      </span>
                    )}
                  </div>
                </div>

                {hasPrices && (
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Estimated requisition value
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-950">
                      {formatPeso(calculatedGrandTotal)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
                <div className="bg-white px-4 py-3.5 sm:px-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <BuildingIcon className="size-4" />
                    </span>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Originating office
                      </p>
                      <p className="mt-1 truncate text-[12px] font-semibold text-slate-800">
                        {selectedPR.department.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {selectedPR.department.code}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white px-4 py-3.5 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Submission date
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold text-slate-800">
                    {new Date(selectedPR.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="bg-white px-4 py-3.5 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Procurement scope
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold text-slate-800">
                    {itemsList.length} line item{itemsList.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </section>

            {/* ================================================================ */}
            {/* EVIDENCE / SUPPORTING DOCUMENTATION                               */}
            {/* ================================================================ */}
            {selectedPR.adminProofFilePath && (
              <section className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/35">
                <div className="flex flex-col gap-3 border-b border-emerald-200/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Supporting evidence
                    </p>
                    <h3 className="mt-1 text-[13px] font-semibold text-emerald-950">
                      Requesting Office approval document
                    </h3>
                  </div>

                  <a
                    href={selectedPR.adminProofFilePath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  >
                    Open source document
                  </a>
                </div>

                <div className="p-4 sm:p-5">
                  {isImageFile(selectedPR.adminProofFilePath) ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                      <img
                        src={selectedPR.adminProofFilePath}
                        alt="Pre-Approved Executive Letter"
                        className="mx-auto max-h-[420px] w-auto rounded-md object-contain"
                      />
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <p
                          className="truncate font-mono text-[9px] text-slate-400"
                          title={selectedPR.adminProofFilePath}
                        >
                          {selectedPR.adminProofFilePath}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <DocumentIcon className="size-[18px]" />
                      </span>

                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800">
                          Attached executive approval document
                        </p>
                        <p
                          className="mt-0.5 truncate font-mono text-[10px] text-slate-400"
                          title={selectedPR.adminProofFilePath}
                        >
                          {selectedPR.adminProofFilePath}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ================================================================ */}
            {/* PROCUREMENT BASIS                                                 */}
            {/* ================================================================ */}
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Procurement basis
                </p>
                <h3 className="mt-1 text-[13px] font-semibold text-slate-900">
                  Operational justification
                </h3>
              </div>

              <div className="px-4 py-4 sm:px-5">
                <p className="text-[12px] leading-5 text-slate-600">
                  {selectedPR.justification}
                </p>
              </div>
            </section>

            {/* ================================================================ */}
            {/* ITEMIZED SCHEDULE                                                 */}
            {/* ================================================================ */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Requisition schedule
                  </p>
                  <h3 className="mt-1 text-[13px] font-semibold text-slate-900">
                    Requested items
                  </h3>
                </div>

                {hasPrices && (
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Estimated total
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-800">
                      {formatPeso(calculatedGrandTotal)}
                    </p>
                  </div>
                )}
              </div>

              {itemsList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white">
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:px-5">
                          Item description
                        </th>
                        <th className="w-20 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          Qty
                        </th>
                        {hasPrices && (
                          <>
                            <th className="w-40 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                              Unit price
                            </th>
                            <th className="w-40 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:px-5">
                              Subtotal
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {itemsList.map((item, idx) => {
                        const unitPrice = item.unitPrice || 0;
                        const subtotal = unitPrice * item.quantity;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/55">
                            <td className="px-4 py-3.5 text-[12px] font-medium text-slate-900 sm:px-5">
                              {item.itemName}
                            </td>

                            <td className="px-4 py-3.5 text-right font-mono text-[12px] font-medium tabular-nums text-slate-600">
                              {item.quantity}
                            </td>

                            {hasPrices && (
                              <>
                                <td className="px-4 py-3.5 text-right font-mono text-[12px] tabular-nums text-slate-500">
                                  {unitPrice > 0 ? formatPeso(unitPrice) : '—'}
                                </td>

                                <td className="px-4 py-3.5 text-right font-mono text-[12px] font-semibold tabular-nums text-slate-900 sm:px-5">
                                  {subtotal > 0 ? formatPeso(subtotal) : '—'}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-10 text-center text-[12px] text-slate-400">
                  No itemized schedule is available for this requisition.
                </div>
              )}
            </section>

            {/* ================================================================ */}
            {/* EXECUTIVE DECISION                                                */}
            {/* ================================================================ */}
            <section aria-labelledby="executive-decision-heading" className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Executive disposition
                </p>
                <h3
                  id="executive-decision-heading"
                  className="mt-1 text-[13px] font-semibold text-slate-900"
                >
                  Select administrative action
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Select the formal disposition that will be recorded against this requisition.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={action === 'APPROVE'}
                  onClick={() => setAction('APPROVE')}
                  className={`rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:translate-y-px ${
                    action === 'APPROVE'
                      ? 'border-emerald-400 bg-emerald-50/65 shadow-[0_0_0_1px_rgba(5,150,105,0.08)]'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/35'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        action === 'APPROVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ShieldCheckIcon className="size-[18px]" />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900">
                        Approve
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                        Authorize the requisition for PO preparation and procurement.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={action === 'RETURN_FOR_CORRECTION'}
                  onClick={() => setAction('RETURN_FOR_CORRECTION')}
                  className={`rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:translate-y-px ${
                    action === 'RETURN_FOR_CORRECTION'
                      ? 'border-amber-400 bg-amber-50/65 shadow-[0_0_0_1px_rgba(217,119,6,0.08)]'
                      : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/35'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        action === 'RETURN_FOR_CORRECTION'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <DocumentIcon className="size-[18px]" />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900">
                        Return for correction
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                        Send the requisition back with required administrative corrections.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={action === 'DECLINE'}
                  onClick={() => setAction('DECLINE')}
                  className={`rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 active:translate-y-px ${
                    action === 'DECLINE'
                      ? 'border-rose-400 bg-rose-50/65 shadow-[0_0_0_1px_rgba(225,29,72,0.08)]'
                      : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/35'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        action === 'DECLINE'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <DocumentIcon className="size-[18px]" />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900">
                        Decline
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                        Reject the requisition and close the executive approval path.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {fieldErrors?.action?._errors && (
                <FieldError>{fieldErrors.action._errors[0]}</FieldError>
              )}
            </section>

            {/* ================================================================ */}
            {/* APPROVAL AUTHORIZATION CONTROLS                                   */}
            {/* ================================================================ */}
            {action === 'APPROVE' && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Regulatory authorization
                    </p>
                    <h3 className="mt-1 text-[13px] font-semibold text-slate-900">
                      Required executive clearances
                    </h3>
                  </div>

                  <span
                    className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                      authorizationCount === 3
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {authorizationCount} of 3 verified
                  </span>
                </div>

                <div className="space-y-5 px-4 py-5 sm:px-5">
                  <div className="grid gap-2.5">
                    <CheckItem
                      id="chk-pr"
                      checked={checkedPR}
                      onChange={setCheckedPR}
                      label="Approval of Purchase Request"
                      description="Official verification that requested purchase aligns with institutional academic objectives."
                    />

                    <CheckItem
                      id="chk-po"
                      checked={checkedPOAuth}
                      onChange={setCheckedPOAuth}
                      label="Authorization to Prepare Purchase Order"
                      description="Granting Purchasing Office clearance to bind vendor specifications and generate hard copy PO."
                    />

                    <CheckItem
                      id="chk-item"
                      checked={checkedPurchaseAuth}
                      onChange={setCheckedPurchaseAuth}
                      label="Authorization to Procure Requested Items"
                      description="Authorizing business disbursement and financial check release."
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <CheckItem
                      id="chk-option1-toggle"
                      checked={isOption1Enabled}
                      onChange={(checked) => {
                        setIsOption1Enabled(checked);
                        if (!checked) {
                          setOption1ProofFilePath('');
                          setAttachedFileName(null);
                        }
                      }}
                      label="Enable Option 1: Off-Campus Remote Sign-Off"
                      description="Use only when the Head of Office is off-campus and granted remote approval via messaging."
                    />
                  </div>

                  {isOption1Enabled && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/55 p-4">
                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-slate-800">
                          Remote approval evidence
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                          Attach the message screenshot or remote sign-off document that supports
                          this authorization.
                        </p>
                      </div>

                      {attachedFileName || option1ProofFilePath ? (
                        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                              <DocumentIcon className="size-[18px]" />
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800">
                                {attachedFileName || 'Proof Document Attached'}
                              </p>
                              <p
                                className="mt-0.5 truncate font-mono text-[9px] text-slate-400"
                                title={option1ProofFilePath}
                              >
                                {option1ProofFilePath}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setOption1ProofFilePath('');
                              setAttachedFileName(null);
                            }}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="proof-file-input"
                          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center transition hover:border-emerald-400 hover:bg-emerald-50/30"
                        >
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={handleProofFileUpload}
                            className="hidden"
                            id="proof-file-input"
                          />

                          <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <UploadIcon className="size-[18px]" />
                          </span>

                          <span className="mt-3 text-[12px] font-semibold text-slate-800">
                            Attach remote sign-off proof
                          </span>
                          <span className="mt-1 text-[10px] text-slate-400">
                            PDF or image
                          </span>
                        </label>
                      )}

                      {fieldErrors?.adminProofFilePath?._errors && (
                        <FieldError>
                          {fieldErrors.adminProofFilePath._errors[0]}
                        </FieldError>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ================================================================ */}
            {/* RETURN / DECLINE REMARKS                                          */}
            {/* ================================================================ */}
            {(action === 'RETURN_FOR_CORRECTION' || action === 'DECLINE') && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <FieldLabel>
                  {action === 'RETURN_FOR_CORRECTION'
                    ? 'Reason for Return for Correction'
                    : 'Reason for Rejection'}
                </FieldLabel>

                <textarea
                  required
                  rows={4}
                  className={`${inputClass(
                    !!fieldErrors?.remarks,
                  )} h-auto resize-y py-3 leading-5`}
                  placeholder={
                    action === 'RETURN_FOR_CORRECTION'
                      ? 'Detail specific corrections required for the department...'
                      : 'Document justification for rejecting this executive request...'
                  }
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />

                <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                  This explanation becomes part of the requisition audit trail.
                </p>

                {fieldErrors?.remarks?._errors && (
                  <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>
                )}
              </section>
            )}

            {/* Optional approval remarks preserve the existing handler behavior */}
            {action === 'APPROVE' && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <FieldLabel>Executive Remarks (Optional)</FieldLabel>
                <textarea
                  rows={3}
                  className={`${inputClass(
                    !!fieldErrors?.remarks,
                  )} h-auto resize-y py-3 leading-5`}
                  placeholder="Add an executive note for the audit trail, if needed..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                {fieldErrors?.remarks?._errors && (
                  <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>
                )}
              </section>
            )}

            {/* ================================================================ */}
            {/* FINAL EXECUTIVE COMMIT                                            */}
            {/* ================================================================ */}
            <section
              className={`overflow-hidden rounded-xl border shadow-[0_8px_24px_rgba(15,23,42,0.10)] ${
                action === 'DECLINE'
                  ? 'border-rose-800 bg-rose-950'
                  : action === 'RETURN_FOR_CORRECTION'
                    ? 'border-amber-700 bg-[#2b2111]'
                    : 'border-slate-800 bg-slate-950'
              } text-white`}
            >
              <div className="grid gap-px bg-white/10 sm:grid-cols-[1fr_auto]">
                <div className="px-4 py-4 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Executive disposition to record
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[12px] font-semibold text-white">
                      {selectedActionLabel}
                    </span>

                    <span className="font-mono text-[10px] text-white/50">
                      {selectedPR.id}
                    </span>
                  </div>

                  <p className="mt-1.5 max-w-xl text-[10px] leading-4 text-white/50">
                    Submission records the selected executive action against the requisition and
                    advances it according to the existing procurement workflow rules.
                  </p>
                </div>

                <div className="flex items-center px-4 py-4 sm:px-5">
                  <ActionButton
                    type="submit"
                    disabled={isPending}
                    className={`w-full whitespace-nowrap sm:w-auto ${
                      action === 'DECLINE'
                        ? 'border-rose-500 bg-rose-600 hover:border-rose-400 hover:bg-rose-500'
                        : action === 'RETURN_FOR_CORRECTION'
                          ? 'border-amber-400 bg-amber-500 text-slate-950 hover:border-amber-300 hover:bg-amber-400'
                          : 'border-emerald-500 bg-emerald-600 hover:border-emerald-400 hover:bg-emerald-500'
                    }`}
                  >
                    {isPending ? (
                      'Committing executive decision…'
                    ) : (
                      <>
                        Submit Executive Decision
                        <ArrowRightIcon className="size-4" />
                      </>
                    )}
                  </ActionButton>
                </div>
              </div>
            </section>
          </form>
        )}
      </ReviewWorkspace>
    </PageShell>
  );
}
