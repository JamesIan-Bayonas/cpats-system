// src/app/dashboard/pr/track/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell,
  StageHeader,
  Card,
  ErrorBanner,
  deriveItemSummaryTitle,
} from '@/components/ui/WorkflowUI';
import Link from 'next/link';

interface AuditLogNode {
  id?: string;
  createdAt: string;
  previousState: PRStatus | null;
  newState: PRStatus;
  remarks: string | null;
  actor: {
    email: string;
    role: Role;
  };
}

interface DepartmentPRNode {
  id: string;
  justification: string;
  itemsPayload?: any;
  status: PRStatus;
  isDirectPoBypass: boolean;
  createdAt: string;
  updatedAt: string;
  department: {
    code: string;
    name: string;
  };
  auditLogs?: AuditLogNode[];
}

function mapStatusToLugoBadge(status: PRStatus): { label: string; badgeClass: string } {
  switch (status) {
    case PRStatus.Draft:
      return { label: 'Draft', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
    case PRStatus.Pending_Business_Approval:
    case PRStatus.Pending_Admin_Approval:
      return { label: 'Pending Approval', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
    case PRStatus.Approved_Awaiting_PO:
    case PRStatus.Awaiting_Check_Issuance:
      return { label: 'Under Processing', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' };
    case PRStatus.Ready_for_Purchase:
      return { label: 'Purchased / Ready', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    case PRStatus.Received_and_Closed:
      return { label: 'Received', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case PRStatus.Returned_for_Correction:
      return { label: 'Returned for Correction', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' };
    case PRStatus.Declined:
      return { label: 'Declined', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
    default:
      return { label: String(status).replace(/_/g, ' '), badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
  }
}

export default function RequestTrackingPage() {
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [requests, setRequests] = useState<DepartmentPRNode[]>([]);
  const [systemError, setSystemError] = useState<string | null>(null);

  // Selected Requisition for Detailed Audit & Feedback Modal Inspection
  const [activeInspectionNode, setActiveInspectionNode] = useState<DepartmentPRNode | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          fetchDepartmentRequests(res.data.role, res.data.departmentId);
        }
      })
      .catch(() => setSystemError('Failed to verify session authentication.'))
      .finally(() => setUserLoading(false));
  }, []);

  const fetchDepartmentRequests = (role: Role, departmentId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, departmentId }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch departmental requests.');
        }

        setRequests(result.data || []);
      } catch (err: any) {
        setSystemError(err.message || 'Network interrupt prevented loading request log.');
      }
    });
  };

  const getLatestFeedbackRemark = (req: DepartmentPRNode) => {
    if (!req.auditLogs || req.auditLogs.length === 0) return null;
    return req.auditLogs.find(
      (log) =>
        log.newState === PRStatus.Returned_for_Correction ||
        log.newState === PRStatus.Declined ||
        (log.remarks && log.remarks.trim().length > 0)
    );
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading departmental tracking ledger…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Requesting_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Request tracking is restricted to Requesting Office profiles.
        </p>
      </Card>
    );
  }

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 1 of 6 · Track My Requests"
        title="Departmental Requisition Monitor"
        description="Monitor status progression, processing stages, evaluator feedback, and official decision logs for your department's submitted purchase requests."
        meta={{ label: 'Department Unit', value: `${activeUser.departmentCode} • Requisition Ledger` }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Requisitions</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Showing records originating from {activeUser.departmentCode} department</p>
        </div>
        <Link
          href="/dashboard/pr/new"
          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition shadow-2xs inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <span>+</span> New Purchase Request
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 text-xs font-medium space-y-3">
            <p>No purchase requests have been recorded for your department yet.</p>
            <Link
              href="/dashboard/pr/new"
              className="inline-block text-xs text-emerald-700 font-bold hover:underline"
            >
              Create your first Purchase Request →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full border-collapse text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-3 sm:p-4 whitespace-nowrap">Requisition Ref Code</th>
                  <th className="p-3 sm:p-4">Requested Equipment</th>
                  <th className="p-3 sm:p-4">Operational Justification</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Submission Date</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Status Indicator</th>
                  <th className="p-3 sm:p-4 text-right whitespace-nowrap">Action / Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {requests.map((req) => {
                  const lugoBadge = mapStatusToLugoBadge(req.status);
                  const itemTitle = deriveItemSummaryTitle(req.itemsPayload, req.justification);
                  const latestFeedback = getLatestFeedbackRemark(req);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                        {req.id.substring(0, 13)}...
                        {req.isDirectPoBypass && (
                          <span className="block text-[8px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200 mt-0.5 font-bold uppercase">
                            Pre-Approved Letter
                          </span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 font-bold text-slate-900 max-w-xs truncate">
                        {itemTitle}
                      </td>
                      <td className="p-3 sm:p-4 max-w-xs truncate text-slate-500 font-medium" title={req.justification}>
                        "{req.justification}"
                      </td>
                      <td className="p-3 sm:p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase border ${lugoBadge.badgeClass}`}>
                          {lugoBadge.label}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setActiveInspectionNode(req)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 ${
                            req.status === PRStatus.Returned_for_Correction
                              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                              : req.status === PRStatus.Declined
                              ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {req.status === PRStatus.Returned_for_Correction ? '⚠️ View Reason for Return' : '📜 View History'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DETAILED FEEDBACK & AUDIT TRAIL INSPECTION MODAL */}
      {activeInspectionNode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Requisition Feedback &amp; Audit Trail
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Ref Code: {activeInspectionNode.id}
                </span>
              </div>
              <button
                onClick={() => setActiveInspectionNode(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* CORRECTION FEEDBACK CALLOUT (IF RETURNED OR DECLINED) */}
            {(activeInspectionNode.status === PRStatus.Returned_for_Correction ||
              activeInspectionNode.status === PRStatus.Declined) && (
              <div className={`p-4 rounded-xl border space-y-2 ${
                activeInspectionNode.status === PRStatus.Returned_for_Correction
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">
                    {activeInspectionNode.status === PRStatus.Returned_for_Correction
                      ? '⚠️ Reason for Return for Correction'
                      : '✕ Rejection Reason'}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                    Evaluator Feedback
                  </span>
                </div>

                {(() => {
                  const feedback = getLatestFeedbackRemark(activeInspectionNode);
                  return feedback ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200/80">
                        "{feedback.remarks || 'No specific remark entered.'}"
                      </p>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
                        <span>Issued by: <strong>{feedback.actor.role.replace(/_/g, ' ')}</strong> ({feedback.actor.email})</span>
                        <span>{new Date(feedback.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs italic text-slate-500">No evaluation remarks recorded.</p>
                  );
                })()}
              </div>
            )}

            {/* REQUISITION DETAILS SUMMARY */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900">
                  {deriveItemSummaryTitle(activeInspectionNode.itemsPayload, activeInspectionNode.justification)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${mapStatusToLugoBadge(activeInspectionNode.status).badgeClass}`}>
                  {mapStatusToLugoBadge(activeInspectionNode.status).label}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Operational Justification</span>
                <p className="text-slate-700 italic mt-0.5">"{activeInspectionNode.justification}"</p>
              </div>
            </div>

            {/* FULL AUDIT TRAIL HISTORY TIMELINE */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                Full Workflow Audit Timeline
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeInspectionNode.auditLogs && activeInspectionNode.auditLogs.length > 0 ? (
                  activeInspectionNode.auditLogs.map((log, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {log.actor.role.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        <strong className="text-slate-900">[{log.newState.replace(/_/g, ' ')}]</strong> {log.remarks}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No timeline entries recorded.</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setActiveInspectionNode(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close Viewport
              </button>
            </div>

          </div>
        </div>
      )}

    </PageShell>
  );
}