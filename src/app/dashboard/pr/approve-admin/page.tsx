// File: src/app/dashboard/pr/approve-admin/page.tsx
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
  unitPrice: number;
}

interface PendingAdminPRNode {
  id: string;
  justification: string;
  status: PRStatus;
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
  return `${firstItemName} (+${items.length - 1} more item${items.length > 2 ? 's' : ''})`;
}

export default function AdminOfficeApprovalPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [prId, setPrId] = useState<string>('');
  const [action, setAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');
  const [adminProofFilePath, setAdminProofFilePath] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // Mandatory Signatory Verification Checkboxes
  const [checkedPR, setCheckedPR] = useState<boolean>(false);
  const [checkedPOAuth, setCheckedPOAuth] = useState<boolean>(false);
  const [checkedPurchaseAuth, setCheckedPurchaseAuth] = useState<boolean>(false);

  // Queue Storage Pools
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
          // Fallback static profile if unauthenticated in dev
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
        // Sets a real, clickable link like "/uploads/1785080140890-send-image.png"
        setAdminProofFilePath(data.url);
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

    // Strict Enforcement of Signatory Safeguards on Approval Events
    if (action === 'APPROVE') {
      if (!checkedPR || !checkedPOAuth || !checkedPurchaseAuth) {
        setSystemError('COMPLIANCE EXCEPTION: All three regulatory authorization check-boxes must be actively validated.');
        return;
      }
      if (!adminProofFilePath) {
        setSystemError('AUDIT TRAIL FAILURE: Attached signature verification proof path or file upload is required for executive sign-off.');
        return;
      }
    }

    startTransition(async () => {
      try {
        const payload = {
          prId,
          action,
          remarks,
          ...(action === 'APPROVE' && { adminProofFilePath }),
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

        setSuccessStatus(`Executive order finalized. Request [${prId}] successfully transitioned to state: ${action}.`);

        setPrId('');
        setAction('');
        setRemarks('');
        setAdminProofFilePath('');
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
    subtitle: task.department?.code || 'OVPA',
    dateLabel: new Date(task.createdAt).toLocaleDateString(),
    description: task.justification,
  }));

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
        onSelect={setPrId}
      >
        <form onSubmit={handleAdminApproval} className="space-y-6">
          <div>
            <FieldLabel>Target Requisition Transaction String (UUIDv4)</FieldLabel>
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

          <div>
            <FieldLabel>Authoritative Executive Action Selection</FieldLabel>
            
            {/* Color Hierarchy Restored: Emerald for Approve, Amber for Recalibrate, Rose for Reject */}
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
                ↶ Recalibrate
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
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-4">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
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

              {/* DUAL FILE UPLOAD & URL RESOLVER COMPONENT */}
              <div className="border-t border-slate-200 pt-3.5 space-y-3">
                <FieldLabel>Executive Approval Proof Attachment (PDF / Image / URL)</FieldLabel>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  
                  {/* Option A: Direct File Upload Picker */}
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-white text-center hover:border-emerald-600 transition">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleProofFileUpload}
                      className="hidden"
                      id="proof-file-input"
                    />
                    <label
                      htmlFor="proof-file-input"
                      className="cursor-pointer block space-y-1"
                    >
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                        📁 {attachedFileName ? 'Change Attached File' : 'Upload Proof File (PDF / Image)'}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {attachedFileName || 'Select Viber screenshot or signed approval letter'}
                      </p>
                    </label>
                  </div>

                  {/* Option B: Direct Path String Preview */}
                  <div>
                    <input
                      type="url"
                      required={action === 'APPROVE'}
                      className={`${inputClass(!!fieldErrors?.adminProofFilePath)} font-mono text-xs`}
                      placeholder="https://storage.dmc.edu.ph/compliance/proofs/sign-auth-2026.pdf"
                      value={adminProofFilePath}
                      onChange={(e) => setAdminProofFilePath(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      System auto-populates resolved URL path upon file selection.
                    </p>
                  </div>

                </div>

                {fieldErrors?.adminProofFilePath?._errors && (
                  <FieldError>{fieldErrors.adminProofFilePath._errors[0]}</FieldError>
                )}
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Executive Audit Evaluation Remarks</FieldLabel>
            <textarea
              required
              rows={3}
              className={`${inputClass(!!fieldErrors?.remarks)} h-auto py-2.5`}
              placeholder="Provide transparent procedural evaluation log detailing the reasoning for this command…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            {fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}
          </div>

          <div className="border-t border-slate-200/80 pt-4 flex justify-end">
            <ActionButton
              type="submit"
              disabled={isPending}
              className="? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'"
            >
              {isPending ? 'Committing Executive Order…' : 'Commit Executive Order'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>
    </PageShell>
  );
}