// src/app/dashboard/pr/approve-admin/page.tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  prId?: ZodSubErrors;
  action?: ZodSubErrors;
  remarks?: ZodSubErrors;
  adminProofFilePath?: ZodSubErrors;
}

export default function AdminOfficeApprovalPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. SECURITY CONTEXT MATRIX (Explicit Type Widening to bypass TS2367 literal locks)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "admin-approver-uuid-static-789",
    role: Role.Admin_Office,
    departmentId: "administration-dept-uuid-hq"
  };

  // 2. STATE MANAGEMENT FOR OPERATIONAL FLOW
  const [prId, setPrId] = useState<string>('');
  const [action, setAction] = useState<'APPROVE' | 'DECLINE' | 'RETURN_FOR_CORRECTION' | ''>('');
  const [remarks, setRemarks] = useState<string>('');
  const [adminProofFilePath, setAdminProofFilePath] = useState<string>('');

  // Fixed Mandatory Signatory Verification Checkboxes (Section 3.2 & Step 3 Manual Specifications)
  const [checkedPR, setCheckedPR] = useState<boolean>(false);
  const [checkedPOAuth, setCheckedPOAuth] = useState<boolean>(false);
  const [checkedPurchaseAuth, setCheckedPurchaseAuth] = useState<boolean>(false);

  // Status Responses
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  // 3. EXECUTION DISPATCH PIPELINE
  const handleAdminApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setSuccessStatus(null);

    // Layer 1 Architecture Guards
    if (activeUser.role !== Role.Admin_Office) {
      setSystemError("SECURITY VIOLATION: Access restricted. Operational profile lacks Admin Office regulatory clearance.");
      return;
    }

    if (!action) {
      setSystemError("VALIDATION FAILURE: You must authoritatively select an approval or deprecation action vector.");
      return;
    }

    // Strict Enforcement of CPA Signatory Safeguards on Approval Events
    if (action === 'APPROVE') {
      if (!checkedPR || !checkedPOAuth || !checkedPurchaseAuth) {
        setSystemError("COMPLIANCE EXCEPTION: All three regulatory authorization check-boxes must be actively validated to bind executive authority to a standard approval state.");
        return;
      }
      if (!adminProofFilePath) {
        setSystemError("AUDIT TRAIL FAILURE: Option 1 operational directives dictate that a verifiable document cloud storage path must be attached to substantiate out-of-band signatures.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const payload = {
          prId,
          action,
          remarks,
          ...(action === 'APPROVE' && { adminProofFilePath })
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
            throw new Error("Payload Schema Error: Mismatched structural definitions encountered.");
          }
          throw new Error(result.error || "The remote execution node rolled back the database mutation sequence.");
        }

        setSuccessStatus(`Ledger modification finalized. Request ${prId} successfully transitioned to state: ${action}.`);
        
        // Reset state controllers
        setPrId('');
        setAction('');
        setRemarks('');
        setAdminProofFilePath('');
        setCheckedPR(false);
        setCheckedPOAuth(false);
        setCheckedPurchaseAuth(false);
        
        router.refresh();

      } catch (err: any) {
        setSystemError(err.message || "A hardware or interface disconnect interrupted ledger propagation.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 my-8 text-slate-900">
      
      {/* Structural Compliance Header Banner */}
      <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 3: Executive Administration Approval Terminal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Governance Namespace Scope: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Institutional Signatory Node</span>
          <span className="text-xs font-semibold text-teal-600">DMC Procurement Framework 2026</span>
        </div>
      </div>

      {/* Real-time System Message Broadcast Panels */}
      {systemError && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">Ecosystem Constraint Intercept</span>
          {systemError}
        </div>
      )}

      {successStatus && (
        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">State Modification Confirmed</span>
          {successStatus}
        </div>
      )}

      <form onSubmit={handleAdminApproval} className="space-y-6">
        
        {/* Target PR Target Token Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Target Requisition Transaction String (UUIDv4)
          </label>
          <input
            type="text"
            required
            className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
              ${fieldErrors?.prId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="Enter exact purchase request tracking ID..."
            value={prId}
            onChange={(e) => setPrId(e.target.value)}
          />
          {fieldErrors?.prId?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.prId._errors[0]}</p>
          )}
        </div>

        {/* Action Vector Allocation Options */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Authoritative Executive Action Selection
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setAction('APPROVE')}
              className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                ${action === 'APPROVE' 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              ✓ Grant Executive Approval
            </button>
            <button
              type="button"
              onClick={() => setAction('RETURN_FOR_CORRECTION')}
              className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                ${action === 'RETURN_FOR_CORRECTION' 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              ↶ Recalibrate for Correction
            </button>
            <button
              type="button"
              onClick={() => setAction('DECLINE')}
              className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                ${action === 'DECLINE' 
                  ? 'bg-rose-600 border-rose-600 text-white shadow-md' 
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              ✕ Absolute Reject Command
            </button>
          </div>
        </div>

        {/* Conditional Layout: Mandatory CPA Authorization Checkboxes & Option 1 File Upload Path */}
        {action === 'APPROVE' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-fadeIn">
            
            {/* Auditable Checkboxes Section */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Mandatory Regulatory Verification Checkboxes (Fixed Compliance Specs)
              </span>
              <div className="space-y-2.5">
                <div className="flex items-start">
                  <input
                    id="chk-pr"
                    type="checkbox"
                    className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                    checked={checkedPR}
                    onChange={(e) => setCheckedPR(e.target.checked)}
                  />
                  <label htmlFor="chk-pr" className="ml-3 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Approval of Purchase Request
                  </label>
                </div>
                <div className="flex items-start">
                  <input
                    id="chk-po"
                    type="checkbox"
                    className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                    checked={checkedPOAuth}
                    onChange={(e) => setCheckedPOAuth(e.target.checked)}
                  />
                  <label htmlFor="chk-po" className="ml-3 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Authorization to Prepare Purchase Order
                  </label>
                </div>
                <div className="flex items-start">
                  <input
                    id="chk-item"
                    type="checkbox"
                    className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                    checked={checkedPurchaseAuth}
                    onChange={(e) => setCheckedPurchaseAuth(e.target.checked)}
                  />
                  <label htmlFor="chk-item" className="ml-3 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Authorization to Purchase the Requested Items
                  </label>
                </div>
              </div>
            </div>

            {/* Option 1 Upload Link Bridge */}
            <div className="border-t border-slate-200 pt-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Option 1 Signature Proof Attachment Path (URL)
              </label>
              <input
                type="url"
                required={action === 'APPROVE'}
                className={`w-full px-3 py-1.5 font-mono text-xs border rounded bg-white text-slate-900 focus:ring-1 focus:ring-slate-900 focus:border-transparent outline-none shadow-sm
                  ${fieldErrors?.adminProofFilePath ? 'border-rose-400' : 'border-slate-300'}`}
                placeholder="https://storage.dmc.edu.ph/compliance/proofs/sign-auth-2026.pdf"
                value={adminProofFilePath}
                onChange={(e) => setAdminProofFilePath(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Attach the captured validation payload from official communication layouts verifying executive sign-off.
              </p>
              {fieldErrors?.adminProofFilePath?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.adminProofFilePath._errors[0]}</p>
              )}
            </div>

          </div>
        )}

        {/* Audit Comment Section */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Executive Audit Evaluation Remarks
          </label>
          <textarea
            required
            rows={3}
            className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm placeholder:text-slate-400
              ${fieldErrors?.remarks ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="Provide transparent procedural evaluation log detailing the reasoning for this command..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          {fieldErrors?.remarks?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.remarks._errors[0]}</p>
          )}
        </div>

        {/* Submit Commit Segment */}
        <div className="border-t border-slate-200 pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
          >
            {isPending ? 'Executing State Modification Execution...' : 'Commit Executive Order'}
          </button>
        </div>

      </form>
    </div>
  );
}