// src/app/dashboard/pr/approve-admin/page.tsx
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
  return `${firstItemName} (x${firstItemQty}) +${items.length - 1} more item${items.length - 1 > 1 ? 's' : ''}`;
}

const isImageFile = (path?: string | null) => {
  if (!path) return false;
  return /\.(jpg|jpeg|png|webp|svg)$/i.test(path);
};

export default function AdminOfficeApprovalPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [prId, setPrId] = useState<string>('');
  const [action, setAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
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
          (item: PendingAdminPRNode) => item.status === PRStatus.Pending_Admin_Approval
        );
        setAdminQueue(adminTasks);
      }
    } catch (err) {
      console.error('Admin queue synchronization interrupted:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setSystemError('SECURITY VIOLATION: Operational profile lacks Admin Office regulatory clearance.');
      return;
    }

    if (!action) {
      setSystemError('VALIDATION FAILURE: You must authoritatively select an approval, correction, or decline command.');
      return;
    }

    if (action === 'APPROVE') {
      if (!checkedPR || !checkedPOAuth || !checkedPurchaseAuth) {
        setSystemError('COMPLIANCE EXCEPTION: All three regulatory authorization check-boxes must be actively validated.');
        return;
      }
      if (isOption1Enabled && (!option1ProofFilePath || option1ProofFilePath.trim().length === 0)) {
        setSystemError('AUDIT TRAIL FAILURE: Option 1 Remote Sign-Off is enabled, but no proof file has been attached.');
        return;
      }
    }

    const selectedPR = adminQueue.find((req) => req.id === prId);
    const finalRemarks = action === 'APPROVE'
      ? (remarks.trim().length >= 5 
          ? remarks 
          : (selectedPR?.isDirectPoBypass 
              ? 'Fast-Track Executive Logged: Verified with attached Executive Pre-Approved Letter. Authorized for Purchase Order generation.' 
              : `Executive approval granted by Admin Office.`))
      : remarks;

    if (action !== 'APPROVE' && finalRemarks.trim().length < 5) {
      setSystemError('COMPLIANCE EXCEPTION: Audit evaluation remarks are mandatory for returning or declining requests (min. 5 characters).');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          prId,
          action,
          remarks: finalRemarks,
          ...(action === 'APPROVE' && isOption1Enabled && option1ProofFilePath ? { adminProofFilePath: option1ProofFilePath } : {}),
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
          throw new Error(result.error || 'The remote execution node rolled back the database transaction.');
        }

        setSuccessStatus(`Executive order finalized. Request [${prId.substring(0, 8)}...] transitioned to: ${action}.`);

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
        setSystemError(err.message || 'A network or server disconnect interrupted ledger propagation.');
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
          Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized for Executive Administration Sign-off.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = adminQueue.map((task) => ({
    id: task.id,
    title: deriveItemSummaryTitle(task.itemsPayload),
    subtitle: task.isDirectPoBypass ? `${task.department?.code || 'OVPA'} • PRE-APPROVED` : (task.department?.code || 'OVPA'),
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
    justificationPreview: task.justification,
  }));

  const selectedPR = adminQueue.find((req) => req.id === prId);
  const itemsList: ItemPayloadNode[] = selectedPR && Array.isArray(selectedPR.itemsPayload)
    ? (selectedPR.itemsPayload as ItemPayloadNode[])
    : [];

  const hasPrices = itemsList.some((item) => typeof item.unitPrice === 'number' && item.unitPrice > 0);
  const calculatedGrandTotal = itemsList.reduce((acc, item) => {
    const price = item.unitPrice || 0;
    return acc + (price * item.quantity);
  }, 0);

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 3 of 6 · Executive Administration Approval"
        title="Executive Administration Approval Terminal"
        description="Grant executive authorization, request calibration, or decline purchase requisitions under institutional governance."
        meta={{ label: 'Institutional Signatory', value: `${activeUser.departmentCode} • Executive Node` }}
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
        <form onSubmit={handleAdminApproval} className="space-y-6">
          <div>
            <FieldLabel>Target Requisition (Requisition Ref Code)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!fieldErrors?.prId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select a record from the ledger queue to populate…"
              value={prId}
            />
            {fieldErrors?.prId?._errors && <FieldError>{fieldErrors.prId._errors[0]}</FieldError>}
          </div>

          {/* REQUISITION INSPECTION PANEL WITH DOCUMENT VIEWER */}
          {selectedPR ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Originating Department
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedPR.department.name} ({selectedPR.department.code})
                  </span>
                </div>
                {selectedPR.isDirectPoBypass && (
                  <span className="px-2.5 py-1 text-[9px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                    Pre-Approved Letter Attached
                  </span>
                )}
              </div>

              {/* REQUESTER'S ATTACHED PRE-APPROVED LETTER DOCUMENT VIEWER */}
              {selectedPR.adminProofFilePath && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <span>📜</span> Requesting Office Attached Approval Letter
                    </span>
                    <a
                      href={selectedPR.adminProofFilePath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold font-mono text-emerald-800 hover:text-emerald-950 underline bg-white px-2 py-0.5 rounded border border-emerald-300"
                    >
                      🔗 Open Document in New Tab
                    </a>
                  </div>

                  {isImageFile(selectedPR.adminProofFilePath) ? (
                    <div className="mt-2 bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <img
                        src={selectedPR.adminProofFilePath}
                        alt="Pre-Approved Executive Letter"
                        className="max-h-64 mx-auto rounded border border-slate-200 object-contain shadow-xs"
                      />
                      <span className="block text-[10px] font-mono text-slate-400 mt-1 truncate">
                        Path: {selectedPR.adminProofFilePath}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-slate-700">
                      <div className="flex items-center gap-2 font-mono">
                        <span>📄</span>
                        <span className="font-bold text-slate-800 truncate max-w-xs">{selectedPR.adminProofFilePath}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">PDF Document</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-mono">
                  Operational Justification & Purpose
                </span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedPR.justification}"
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Itemized Schedule ({itemsList.length} {itemsList.length === 1 ? 'Line Item' : 'Line Items'})
                  </span>
                  {hasPrices && (
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      Est. Total: ₱{calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase font-mono">
                        <th className="p-2.5">Item Description & Specifications</th>
                        <th className="p-2.5 text-center whitespace-nowrap">Qty</th>
                        {hasPrices && <th className="p-2.5 text-right whitespace-nowrap">Unit Price</th>}
                        {hasPrices && <th className="p-2.5 text-right whitespace-nowrap">Subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {itemsList.map((item, idx) => {
                        const unitPrice = item.unitPrice || 0;
                        const subtotal = unitPrice * item.quantity;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-medium text-slate-900">{item.itemName}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-700">{item.quantity}</td>
                            {hasPrices && (
                              <td className="p-2.5 text-right font-mono text-slate-500">
                                {unitPrice > 0 ? `₱${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            )}
                            {hasPrices && (
                              <td className="p-2.5 text-right font-mono text-slate-800">
                                {subtotal > 0 ? `₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
              Select a requisition from the queue list on the left to inspect its details.
            </div>
          )}

          <div>
            <FieldLabel>Authoritative Executive Action Selection</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAction('APPROVE')}
                className={`h-11 px-3 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center ${
                  action === 'APPROVE'
                    ? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
              >
                ✓ Grant Approval
              </button>

              <button
                type="button"
                onClick={() => setAction('RETURN_FOR_CORRECTION')}
                className={`h-11 px-3 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center ${
                  action === 'RETURN_FOR_CORRECTION'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50 hover:text-amber-800'
                }`}
              >
                ↶ Return for Correction
              </button>

              <button
                type="button"
                onClick={() => setAction('DECLINE')}
                className={`h-11 px-3 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center ${
                  action === 'DECLINE'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                }`}
              >
                ✕ Absolute Reject
              </button>
            </div>
            {fieldErrors?.action?._errors && <FieldError>{fieldErrors.action._errors[0]}</FieldError>}
          </div>

          {action === 'APPROVE' && (
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3 font-mono">
                  Mandatory Regulatory Authorization Clearances
                </span>
                <div className="space-y-2.5">
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
              </div>

              {/* CLEAN OPTION 1 TOGGLE & SIMPLIFIED ATTACH PROOF WIDGET */}
              <div className="border-t border-slate-200 pt-3.5 space-y-3">
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
                  description="Check this strictly if the Head of Office is off-campus and granted remote approval via messaging."
                />

                {isOption1Enabled && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    <FieldLabel>Attach Proof File</FieldLabel>
                    
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:border-emerald-600 transition">
                      {attachedFileName || option1ProofFilePath ? (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <span className="text-xl shrink-0">📎</span>
                            <div className="truncate">
                              <span className="block text-xs font-bold text-emerald-900 truncate">
                                {attachedFileName || 'Proof Document Attached'}
                              </span>
                              <span className="block text-[10px] font-mono text-emerald-700 truncate">
                                {option1ProofFilePath}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOption1ProofFilePath('');
                              setAttachedFileName(null);
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2.5 py-1 rounded bg-white border border-rose-200 hover:bg-rose-50 transition shrink-0 cursor-pointer active:scale-95"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="text-center space-y-2">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={handleProofFileUpload}
                            className="hidden"
                            id="proof-file-input"
                          />
                          <label
                            htmlFor="proof-file-input"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs active:scale-95"
                          >
                            <span>📎</span>
                            <span>Attach Proof</span>
                          </label>
                          <p className="text-[10px] text-slate-400">
                            Upload messaging screenshot or remote sign-off document (PDF / Image)
                          </p>
                        </div>
                      )}
                    </div>

                    {fieldErrors?.adminProofFilePath?._errors && (
                      <FieldError>{fieldErrors.adminProofFilePath._errors[0]}</FieldError>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(action === 'RETURN_FOR_CORRECTION' || action === 'DECLINE') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <FieldLabel>
                {action === 'RETURN_FOR_CORRECTION' ? 'Reason for Return for Correction' : 'Reason for Rejection'}
              </FieldLabel>
              <textarea
                required
                rows={3}
                className={`${inputClass(!!fieldErrors?.remarks)} h-auto py-2.5`}
                placeholder={
                  action === 'RETURN_FOR_CORRECTION'
                    ? 'Detail specific corrections required for the department...'
                    : 'Document justification for rejecting this executive request...'
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              {fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}
            </div>
          )}

          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Committing Executive Order…' : 'Commit Executive Order'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}