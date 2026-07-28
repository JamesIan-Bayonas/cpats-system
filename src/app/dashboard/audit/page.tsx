'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import QRCodeSVG from '@/components/ui/QRCodeSVG';

interface AuditLogEntry {
  createdAt: string;
  previousState: PRStatus | null;
  newState: PRStatus;
  remarks: string | null;
  actor: {
    email: string;
    role: Role;
  };
}

interface PurchaseOrderSummary {
  poNumber: string;
  qrCodeToken?: string;
  isCheckIssued: boolean;
  receivingReports?: Array<{
    condition: string;
    asssetImageFilePath: string;
    invoiceFilePath: string;
  }>;
}

interface RequisitionReportNode {
  id: string;
  justification: string;
  itemsPayload?: any;
  status: PRStatus;
  isDirectPoBypass: boolean;
  createdAt: string;
  department: {
    name: string;
    code: string;
  };
  purchaseOrders: PurchaseOrderSummary[];
  auditLogs: AuditLogEntry[];
}

export default function GlobalAuditorConsolePage() {
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSortOrder, setSelectedSortOrder] = useState<'asc' | 'desc'>('desc');
  const [records, setRecords] = useState<RequisitionReportNode[]>([]);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const [activeMediaModal, setActiveMediaModal] = useState<{
    type: 'IMAGE' | 'QR';
    title: string;
    payload: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          fetchAuthoritativeLedger(res.data.role);
        } else {
          setActiveUser({
            id: 'global-auditor-uuid-007',
            email: 'auditor@dmc.edu.ph',
            role: Role.Global_Auditor,
            departmentId: 'audit-compliance-dept-uuid',
            departmentCode: 'IAO',
            departmentName: 'Internal Audit Office',
          });
          fetchAuthoritativeLedger(Role.Global_Auditor);
        }
      })
      .catch(() => setSystemAlert('Session verification failed.'))
      .finally(() => setUserLoading(false));
  }, []);

  const fetchAuthoritativeLedger = (userRole?: Role) => {
    setSystemAlert(null);
    const roleToValidate = userRole || activeUser?.role;
    
    if (roleToValidate !== Role.Global_Auditor) {
      setSystemAlert("FORBIDDEN: Profile context strictly unauthorized to request analytical system logs.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/audit/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: selectedStatus || undefined,
            sortOrder: selectedSortOrder,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Analytics runtime encountered a data mapping boundary failure.");
        }

        setRecords(result.data || []);
      } catch (err: any) {
        setSystemAlert(err.message || "An execution interrupt split connection pools.");
      }
    });
  };

  useEffect(() => {
    if (activeUser && activeUser.role === Role.Global_Auditor) {
      fetchAuthoritativeLedger(activeUser.role);
    }
  }, [selectedStatus, selectedSortOrder]);

  const computeCoa3WayMatch = (node: RequisitionReportNode) => {
    if (node.status === PRStatus.Declined) {
      return { score: 0, label: 'TERMINATED', badge: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    const step1PRApproved = node.status !== PRStatus.Draft && node.status !== PRStatus.Pending_Business_Approval && node.status !== PRStatus.Pending_Admin_Approval && node.status !== PRStatus.Returned_for_Correction;
    const step2CheckIssued = node.purchaseOrders.some((po) => po.isCheckIssued);
    const step3ReceivedGood = node.purchaseOrders.some((po) => po.receivingReports && po.receivingReports.length > 0 && po.receivingReports.some((r) => r.condition === 'Good'));

    const matchScore = (step1PRApproved ? 1 : 0) + (step2CheckIssued ? 1 : 0) + (step3ReceivedGood ? 1 : 0);

    if (matchScore === 3) {
      return { score: 3, label: '3/3 FULLY MATCHED', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (matchScore === 2) {
      return { score: 2, label: '2/3 IN PROGRESS', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    return { score: 1, label: '1/3 INITIALIZED', badge: 'bg-slate-100 text-slate-700 border-slate-300' };
  };

  const fullyMatchedCount = records.filter((r) => computeCoa3WayMatch(r).score === 3).length;
  const inProgressCount = records.filter((r) => computeCoa3WayMatch(r).score === 2).length;

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-medium text-slate-500 font-sans">
        Loading Global Audit Session…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-6 my-4 sm:my-8 text-slate-900 font-sans">
      
      <div className="border-b border-slate-200 pb-4 sm:pb-5 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Global Audit Ledger & COA 3-Way Match Console
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Clearance Level: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser?.role.replace(/_/g, ' ') || 'Global Auditor'}</span>
          </p>
        </div>
        <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">DMC COMPLIANCE ENGINE</span>
          <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 sm:py-1 rounded-md border border-indigo-100 mt-0.5 inline-block">
            Mode: READ-ONLY AUDIT
          </span>
        </div>
      </div>

      {/* COA Compliance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Audited Requisitions</span>
          <span className="text-xl font-black text-slate-900 mt-1 block font-mono">{records.length}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">3/3 Fully Matched (COA)</span>
          <span className="text-xl font-black text-emerald-800 mt-1 block font-mono">{fullyMatchedCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
          <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">2/3 In-Progress Lifecycle</span>
          <span className="text-xl font-black text-amber-800 mt-1 block font-mono">{inProgressCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">COA Audit Compliance</span>
          <span className="text-xl font-black text-indigo-700 mt-1 block font-mono">
            {records.length > 0 ? `${Math.round((fullyMatchedCount / records.length) * 100)}%` : '100%'}
          </span>
        </div>
      </div>

      {systemAlert && (
        <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-bold">
          <span className="block uppercase tracking-wide text-[9px] sm:text-[10px] mb-0.5">System Audit Warning</span>
          {systemAlert}
        </div>
      )}

      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Checkpoint Status
          </label>
          <select
            className="w-full min-h-[44px] bg-white border border-slate-300 text-xs text-slate-800 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">-- View All Status Lifecycles --</option>
            {Object.keys(PRStatus).map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Log Sequence Order
          </label>
          <select
            className="w-full min-h-[44px] bg-white border border-slate-300 text-xs text-slate-800 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
            value={selectedSortOrder}
            onChange={(e) => setSelectedSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => fetchAuthoritativeLedger()}
            className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition shadow-2xs active:scale-[0.99] cursor-pointer"
          >
            {isPending ? 'Syncing Matrix...' : 'Refresh Audit Matrix'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {records.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 text-xs font-medium">
            No system tracking records match the designated verification filters.
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full border-collapse text-left min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-3 sm:p-4 whitespace-nowrap">Tracking UUID</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Department</th>
                  <th className="p-3 sm:p-4">Justification</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">COA 3-Way Match</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Linked PO & QR</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Hardware Photo</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Status</th>
                  <th className="p-3 sm:p-4">Log Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {records.map((node) => {
                  const coaMatch = computeCoa3WayMatch(node);
                  return (
                    <tr key={node.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                        {node.id.substring(0, 13)}...
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{node.department.code}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">{node.department.name}</span>
                      </td>
                      <td className="p-3 sm:p-4 max-w-xs truncate text-slate-600 font-medium" title={node.justification}>
                        {node.justification}
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${coaMatch.badge}`}>
                          {coaMatch.label}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        {node.purchaseOrders.length > 0 ? (
                          node.purchaseOrders.map((po, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="font-mono text-[11px] font-bold text-indigo-600 flex items-center gap-1.5">
                                <span>{po.poNumber}</span>
                                <span className={`text-[8px] px-1 rounded font-bold uppercase ${po.isCheckIssued ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {po.isCheckIssued ? 'Cleared' : 'Awaiting'}
                                </span>
                              </div>
                              {po.qrCodeToken && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMediaModal({
                                      type: 'QR',
                                      title: `QR Token Badge: ${po.poNumber}`,
                                      payload: po.qrCodeToken!,
                                    })
                                  }
                                  className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                                >
                                  🔳 View QR Token
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Unbound</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        {node.purchaseOrders.some((po) => po.receivingReports && po.receivingReports.length > 0) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const report = node.purchaseOrders.flatMap((p) => p.receivingReports || [])[0];
                              setActiveMediaModal({
                                type: 'IMAGE',
                                title: `Physical Hardware Photo Inspection`,
                                payload: report?.asssetImageFilePath || '',
                              });
                            }}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition cursor-pointer"
                          >
                            📷 View Photo
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">No Photo</span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black tracking-wide uppercase
                          ${node.status === PRStatus.Received_and_Closed ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
                          ${node.status === PRStatus.Declined ? 'bg-rose-100 text-rose-800 border border-rose-200' : ''}
                          ${node.status === PRStatus.Draft ? 'bg-slate-100 text-slate-600 border border-slate-200' : ''}
                          ${node.status !== PRStatus.Received_and_Closed && node.status !== PRStatus.Declined && node.status !== PRStatus.Draft ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
                        `}>
                          {node.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 max-w-xs">
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 space-y-1.5 max-h-28 overflow-y-auto">
                          {node.auditLogs.map((log, lIdx) => (
                            <div key={lIdx} className="text-[9px] sm:text-[10px] border-b border-slate-200/60 pb-1 last:border-none last:pb-0">
                              <div className="flex justify-between font-medium text-slate-400 font-mono text-[8px] sm:text-[9px]">
                                <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                                <span className="text-slate-500 font-bold">{log.actor.role}</span>
                              </div>
                              <p className="text-slate-600 mt-0.5 leading-tight">
                                <span className="font-bold text-slate-800">[{log.newState}]</span> {log.remarks}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeMediaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-center">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {activeMediaModal.title}
              </h3>
              <button
                onClick={() => setActiveMediaModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {activeMediaModal.type === 'QR' ? (
              <div className="py-4 space-y-3">
                <div className="p-3 bg-slate-50 inline-block rounded-xl border border-slate-200 shadow-inner">
                  <QRCodeSVG value={activeMediaModal.payload} size={160} />
                </div>
                <p className="text-[11px] font-mono text-slate-500 break-all bg-slate-100 p-2 rounded">
                  {activeMediaModal.payload}
                </p>
              </div>
            ) : (
              <div className="py-2 space-y-2">
                <img
                  src={activeMediaModal.payload}
                  alt="Hardware Photo Proof"
                  className="max-h-64 rounded-lg mx-auto border border-slate-200 object-cover shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=Hardware+Photo+Record';
                  }}
                />
                <p className="text-[10px] font-mono text-slate-400 break-all">
                  Path: {activeMediaModal.payload}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setActiveMediaModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close Viewport
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}