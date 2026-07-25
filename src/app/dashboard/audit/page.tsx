'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Role, PRStatus } from '@prisma/client';

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
  isCheckIssued: boolean;
}

interface RequisitionReportNode {
  id: string;
  justification: string;
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

  // Role clearance verification context
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "global-auditor-uuid-007",
    role: Role.Global_Auditor,
    departmentId: "audit-compliance-dept-uuid"
  };

  // State management
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSortOrder, setSelectedSortOrder] = useState<'asc' | 'desc'>('desc');
  const [records, setRecords] = useState<RequisitionReportNode[]>([]);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const fetchAuthoritativeLedger = () => {
    setSystemAlert(null);
    
    if (activeUser.role !== Role.Global_Auditor) {
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
    fetchAuthoritativeLedger();
  }, [selectedStatus, selectedSortOrder]);

  return (
    <div className="max-w-7xl mx-auto bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-6 my-4 sm:my-8 text-slate-900 font-sans">
      
      {/* Top Institutional Header Panel (Mobile Stacked / Desktop Flex) */}
      <div className="border-b border-slate-200 pb-4 sm:pb-5 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Global Audit Ledger
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Security Clearance: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">DMC COMPLIANCE ENGINE</span>
          <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 sm:py-1 rounded-md border border-indigo-100 mt-0.5 inline-block">
            Mode: READ-ONLY
          </span>
        </div>
      </div>

      {/* Internal Warning Banner */}
      {systemAlert && (
        <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-bold">
          <span className="block uppercase tracking-wide text-[9px] sm:text-[10px] mb-0.5">System Audit Warning</span>
          {systemAlert}
        </div>
      )}

      {/* Multi-Department Filters Box (Mobile: 1 Column | Tablet+: 3 Columns) */}
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
            onClick={fetchAuthoritativeLedger}
            className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition shadow-2xs active:scale-[0.99] cursor-pointer"
          >
            {isPending ? 'Syncing Matrix...' : 'Refresh Matrix'}
          </button>
        </div>
      </div>

      {/* Primary Analytical Ledger Spreadsheet Panel (Touch Scrollable on Smartphone) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {records.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 text-xs font-medium">
            No system tracking records match the designated verification filters.
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-3 sm:p-4 whitespace-nowrap">Tracking UUID</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Department</th>
                  <th className="p-3 sm:p-4">Justification</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Linked PO</th>
                  <th className="p-3 sm:p-4 whitespace-nowrap">Placement Status</th>
                  <th className="p-3 sm:p-4">Log Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {records.map((node) => (
                  <tr key={node.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                      {node.id.substring(0, 13)}...
                    </td>
                    <td className="p-3 sm:p-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{node.department.code}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{node.department.name}</span>
                    </td>
                    <td className="p-3 sm:p-4 max-w-xs truncate text-slate-600 font-medium">
                      {node.justification}
                    </td>
                    <td className="p-3 sm:p-4 whitespace-nowrap">
                      {node.purchaseOrders.length > 0 ? (
                        node.purchaseOrders.map((po, idx) => (
                          <div key={idx} className="font-mono text-[11px] font-bold text-indigo-600">
                            {po.poNumber}
                            <span className={`text-[8px] sm:text-[9px] ml-1 px-1 rounded font-bold uppercase ${po.isCheckIssued ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {po.isCheckIssued ? 'Cleared' : 'Awaiting'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[10px] sm:text-[11px]">Unbound</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}