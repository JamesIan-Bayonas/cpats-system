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
        description="Monitor status progression, processing stages, and official decision logs for your department's submitted purchase requests."
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
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-3 sm:p-4 whitespace-nowrap">Tracking Ref</th>
                  <th className="p-3 sm:p-4">Requested Equipment</th>
                  <th className="p-3 sm:p-4">Operational Justification</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Submission Date</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Status Indicator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {requests.map((req) => {
                  const lugoBadge = mapStatusToLugoBadge(req.status);
                  const itemTitle = deriveItemSummaryTitle(req.itemsPayload, req.justification);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                        {req.id.substring(0, 13)}...
                        {req.isDirectPoBypass && (
                          <span className="block text-[8px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200 mt-0.5 font-bold uppercase">
                            Bypass Active
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}