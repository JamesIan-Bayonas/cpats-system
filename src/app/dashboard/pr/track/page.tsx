// src/app/dashboard/pr/track/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import { deriveItemSummaryTitle } from '@/components/ui/WorkflowUI';

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

function mapStatusToBadge(status: PRStatus): { label: string; badgeClass: string; dotClass: string } {
  switch (status) {
    case PRStatus.Draft:
      return { 
        label: 'Draft', 
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', 
        dotClass: 'bg-slate-400' 
      };
    case PRStatus.Pending_Business_Approval:
      return { 
        label: 'Pending Budget Check', 
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', 
        dotClass: 'bg-amber-500' 
      };
    case PRStatus.Pending_Admin_Approval:
      return { 
        label: 'Pending Executive Sign-off', 
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200', 
        dotClass: 'bg-sky-500' 
      };
    case PRStatus.Approved_Awaiting_PO:
      return { 
        label: 'Approved (Awaiting PO)', 
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200', 
        dotClass: 'bg-indigo-500' 
      };
    case PRStatus.Awaiting_Check_Issuance:
      return { 
        label: 'Financial Clearance Pending', 
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', 
        dotClass: 'bg-blue-500' 
      };
    case PRStatus.Ready_for_Purchase:
      return { 
        label: 'Ready for Purchase / Delivery', 
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200', 
        dotClass: 'bg-teal-500' 
      };
    case PRStatus.Received_and_Closed:
      return { 
        label: 'Cargo Received & Closed', 
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', 
        dotClass: 'bg-emerald-600' 
      };
    case PRStatus.Returned_for_Correction:
      return { 
        label: 'Action Needed: Returned', 
        badgeClass: 'bg-orange-50 text-orange-900 border-orange-300 ring-1 ring-orange-400/20', 
        dotClass: 'bg-orange-500 animate-pulse' 
      };
    case PRStatus.Declined:
      return { 
        label: 'Declined', 
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', 
        dotClass: 'bg-rose-500' 
      };
    default:
      return { 
        label: String(status).replace(/_/g, ' '), 
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', 
        dotClass: 'bg-slate-400' 
      };
  }
}

export default function RequestTrackingPage() {
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [requests, setRequests] = useState<DepartmentPRNode[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [systemError, setSystemError] = useState<string | null>(null);

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
      .catch(() => setSystemError('Failed to verify session credentials.'))
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
      } catch (err: unknown) {
        setSystemError(err instanceof Error ? err.message : 'Network interrupt prevented loading requests.');
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

  const filteredRequests = requests.filter((req) => {
    const q = searchQuery.toLowerCase().trim();
    const title = deriveItemSummaryTitle(req.itemsPayload, req.justification).toLowerCase();
    const matchesSearch = !q || title.includes(q) || req.id.toLowerCase().includes(q) || req.justification.toLowerCase().includes(q);

    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'ACTION_REQUIRED') return matchesSearch && req.status === PRStatus.Returned_for_Correction;
    if (statusFilter === 'IN_PROGRESS') {
      return (
        matchesSearch &&
        req.status !== PRStatus.Received_and_Closed &&
        req.status !== PRStatus.Declined &&
        req.status !== PRStatus.Returned_for_Correction
      );
    }
    if (statusFilter === 'CLOSED') return matchesSearch && req.status === PRStatus.Received_and_Closed;
    return matchesSearch;
  });

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 tracking-wide">
          Loading Department Ledger…
        </span>
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Requesting_Office) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-rose-200 rounded-2xl shadow-sm text-center font-sans space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Request tracking is strictly authorized for Requesting Office personnel.
        </p>
      </div>
    );
  }

  const returnedCount = requests.filter((r) => r.status === PRStatus.Returned_for_Correction).length;

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 font-sans antialiased text-slate-900 space-y-4 sm:space-y-6">
      
      {/* Header & Department Context */}
      <div className="space-y-2 border-b border-slate-200/80 pb-4 sm:pb-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 font-medium">
          <Link href="/dashboard" className="hover:text-emerald-700 transition">
            Portal
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Track Requests</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              Department Requisition Tracker
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
              Track approval progression, evaluative notes, and delivery statuses for your department's requests.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 sm:py-2 rounded-xl text-left shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Monitoring Ledger
              </span>
              <span className="text-xs font-bold text-emerald-950">
                {activeUser.departmentName} ({activeUser.departmentCode})
              </span>
            </div>
          </div>
        </div>
      </div>

      {systemError && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl text-rose-900 text-xs sm:text-sm font-medium flex items-start justify-between gap-2.5 shadow-2xs">
          <span>{systemError}</span>
          <button type="button" onClick={() => setSystemError(null)} className="text-rose-600 hover:text-rose-800 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Control Sub-Bar: Search, Filters & Action Button */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by equipment, reference ID, or reason…"
              className="w-full h-11 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none transition"
            />
            <span className="absolute left-3 top-3 text-slate-400 text-sm">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* New PR Trigger */}
          <Link
            href="/dashboard/pr/new"
            className="min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-2xs inline-flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98]"
          >
            <span>+</span>
            <span>New Purchase Request</span>
          </Link>
        </div>

        {/* Filter Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Requests ({requests.length})
          </button>

          {returnedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('ACTION_REQUIRED')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg border transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'ACTION_REQUIRED'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                  : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
              }`}
            >
              <span>⚠️ Action Needed</span>
              <span className="px-1.5 py-0.2 bg-white text-orange-900 rounded-full text-[10px] font-black">
                {returnedCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            In Progress
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('CLOSED')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg border transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'CLOSED'
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Received &amp; Completed
          </button>
        </div>
      </div>

      {/* Main Records Presentation */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center text-slate-400 text-xs sm:text-sm font-medium space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mx-auto">
            📋
          </div>
          <p className="text-slate-600 font-semibold">No purchase requisitions match your criteria.</p>
          <p className="text-slate-400 text-xs">
            {searchQuery ? 'Try adjusting your search query or reset filters.' : 'Submit your department’s first request to begin tracking.'}
          </p>
          {!searchQuery && (
            <Link
              href="/dashboard/pr/new"
              className="inline-block text-xs text-emerald-700 font-bold hover:underline pt-1"
            >
              Create New Request →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. MOBILE VIEW: SELF-CONTAINED STATUS CARDS (Hidden on Desktop)           */}
          {/* ========================================================================= */}
          <div className="space-y-3 md:hidden">
            {filteredRequests.map((req) => {
              const badge = mapStatusToBadge(req.status);
              const itemTitle = deriveItemSummaryTitle(req.itemsPayload, req.justification);
              const isReturned = req.status === PRStatus.Returned_for_Correction;

              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl p-4 border transition-all shadow-2xs space-y-3 ${
                    isReturned ? 'border-orange-300 ring-1 ring-orange-200 bg-orange-50/20' : 'border-slate-200/90'
                  }`}
                >
                  {/* Card Header: Status Badge & Date */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badge.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Card Body: Equipment Name & Justification */}
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-slate-900 leading-snug">
                      {itemTitle}
                    </h2>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
                      "{req.justification}"
                    </p>
                  </div>

                  {/* Card Meta Footnote */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-semibold">
                      Ref: {req.id.substring(0, 13)}…
                    </span>

                    {req.isDirectPoBypass && (
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                        Pre-Approved Letter
                      </span>
                    )}
                  </div>

                  {/* Prominent Action Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveInspectionNode(req)}
                      className={`w-full min-h-[44px] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] border shadow-2xs ${
                        isReturned
                          ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600 shadow-orange-200'
                          : req.status === PRStatus.Declined
                          ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      {isReturned ? (
                        <span>⚠️ View Evaluator Reason for Return</span>
                      ) : (
                        <span>📜 View Progress &amp; Audit Trail</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 2. DESKTOP / TABLET VIEW: HIGH-DENSITY TABULAR LEDGER (Hidden on Mobile)  */}
          {/* ========================================================================= */}
          <div className="hidden md:block bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-3.5 sm:p-4 whitespace-nowrap">Reference Code</th>
                    <th className="p-3.5 sm:p-4">Requested Item Specifications</th>
                    <th className="p-3.5 sm:p-4">Department Justification</th>
                    <th className="p-3.5 sm:p-4 whitespace-nowrap">Date Filed</th>
                    <th className="p-3.5 sm:p-4 whitespace-nowrap">Current Stage</th>
                    <th className="p-3.5 sm:p-4 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredRequests.map((req) => {
                    const badge = mapStatusToBadge(req.status);
                    const itemTitle = deriveItemSummaryTitle(req.itemsPayload, req.justification);
                    const isReturned = req.status === PRStatus.Returned_for_Correction;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 sm:p-4 font-mono text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                          {req.id.substring(0, 13)}…
                          {req.isDirectPoBypass && (
                            <span className="block text-[9px] font-sans font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 uppercase w-fit">
                              Pre-Approved
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 sm:p-4 font-bold text-slate-900 max-w-xs">
                          <span className="line-clamp-2">{itemTitle}</span>
                        </td>
                        <td className="p-3.5 sm:p-4 max-w-xs truncate text-slate-500 font-medium" title={req.justification}>
                          "{req.justification}"
                        </td>
                        <td className="p-3.5 sm:p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 sm:p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badge.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="p-3.5 sm:p-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActiveInspectionNode(req)}
                            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border shadow-2xs active:scale-95 ${
                              isReturned
                                ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600 shadow-orange-200'
                                : req.status === PRStatus.Declined
                                ? 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isReturned ? '⚠️ Reason for Return' : '📜 View History'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail, Feedback & Audit Trail Modal (Optimized for Mobile Touch) */}
      {activeInspectionNode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Requisition Progress &amp; Audit Trail
                </h3>
                <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">
                  Reference: {activeInspectionNode.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveInspectionNode(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* Evaluator Return Note Callout (If Returned or Declined) */}
              {(activeInspectionNode.status === PRStatus.Returned_for_Correction ||
                activeInspectionNode.status === PRStatus.Declined) && (
                <div className={`p-3.5 sm:p-4 rounded-xl border space-y-2 ${
                  activeInspectionNode.status === PRStatus.Returned_for_Correction
                    ? 'bg-orange-50 border-orange-300 text-orange-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                      {activeInspectionNode.status === PRStatus.Returned_for_Correction
                        ? '⚠️ Required Revision Note'
                        : '✕ Reason for Rejection'}
                    </span>
                    <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">
                      Evaluator Feedback
                    </span>
                  </div>

                  {(() => {
                    const feedback = getLatestFeedbackRemark(activeInspectionNode);
                    return feedback ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200">
                          "{feedback.remarks || 'No specific note provided.'}"
                        </p>
                        <div className="flex flex-col sm:flex-row sm:justify-between text-[10px] text-slate-500 pt-0.5 gap-0.5">
                          <span>Issued by: <strong>{feedback.actor.role.replace(/_/g, ' ')}</strong></span>
                          <span>{new Date(feedback.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs italic text-slate-500">No specific evaluation remarks logged.</p>
                    );
                  })()}
                </div>
              )}

              {/* Scope Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-2 gap-1">
                  <span className="font-bold text-slate-900 text-sm">
                    {deriveItemSummaryTitle(activeInspectionNode.itemsPayload, activeInspectionNode.justification)}
                  </span>
                  <span className={`w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${mapStatusToBadge(activeInspectionNode.status).badgeClass}`}>
                    {mapStatusToBadge(activeInspectionNode.status).label}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Operational Justification
                  </span>
                  <p className="text-slate-700 italic mt-0.5 leading-relaxed">
                    "{activeInspectionNode.justification}"
                  </p>
                </div>
              </div>

              {/* Audit Timeline */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Official Decision &amp; Progress History
                </span>
                <div className="space-y-2">
                  {activeInspectionNode.auditLogs && activeInspectionNode.auditLogs.length > 0 ? (
                    activeInspectionNode.auditLogs.map((log, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {log.actor.role.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700 text-xs leading-relaxed pt-0.5">
                          <strong className="text-slate-900">[{log.newState.replace(/_/g, ' ')}]</strong> {log.remarks}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No timeline entries recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 text-right shrink-0">
              <button
                type="button"
                onClick={() => setActiveInspectionNode(null)}
                className="w-full sm:w-auto min-h-[44px] px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Viewport
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}