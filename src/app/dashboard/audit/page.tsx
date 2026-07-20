// src/app/dashboard/audit/page.tsx
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

  // 1. ROLE CLEARANCE VERIFICATION DEFINITIONS (Widened Explicitly)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "global-auditor-uuid-007",
    role: Role.Global_Auditor,
    departmentId: "audit-compliance-dept-uuid"
  };

  // 2. QUERY WORKSPACE CONTEXT STATES
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSortOrder, setSelectedSortOrder] = useState<'asc' | 'desc'>('desc');
  const [records, setRecords] = useState<RequisitionReportNode[]>([]);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  // 3. DATA REFRESH TRANSITION BLOCK
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

  // Run initial ledger hydration window
  useEffect(() => {
    fetchAuthoritativeLedger();
  }, [selectedStatus, selectedSortOrder]);

  return (
    <div className="max-w-7xl mx-auto bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 my-8 text-slate-900 font-sans">
      
      {/* Institutional Top Control Panel Bar */}
      <div className="border-b border-slate-200 pb-5 mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Real-Time Global Audit Ledger Console</h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative Clearance Security Level: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">DMC FOUNDATION COMPLIANCE</span>
          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 mt-1 inline-block">System State: READ-ONLY</span>
        </div>
      </div>

      {/* Internal Exception Catch Panels */}
      {systemAlert && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-bold">
          <span className="block uppercase tracking-wide text-[10px] mb-1">System Audit Warning</span>
          {systemAlert}
        </div>
      )}

      {/* Multi-Department Sorting & Filtering Filters Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6 grid grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter by Machine Checkpoint Status</label>
          <select
            className="w-full bg-white border border-slate-300 text-xs text-slate-800 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent transition"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">-- View All Active Status Lifecycles --</option>
            {Object.keys(PRStatus).map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Chronological Log Sequence</label>
          <select
            className="w-full bg-white border border-slate-300 text-xs text-slate-800 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-slate-900 focus:border-transparent transition"
            value={selectedSortOrder}
            onChange={(e) => setSelectedSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Newest Inceptions First</option>
            <option value="asc">Oldest Historical First</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            disabled={isPending}
            onClick={fetchAuthoritativeLedger}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg transition shadow-xs"
          >
            {isPending ? 'Syncing Record Matrices...' : 'Refresh Audit Matrix'}
          </button>
        </div>
      </div>

      {/* Primary Analytical Ledger Spreadsheet Panel */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            No system tracking records match the designated verification filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-4">Requisition tracking UUID</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Justification Summary</th>
                  <th className="p-4">Linked Purchase Order</th>
                  <th className="p-4">System Placement Status</th>
                  <th className="p-4">Deep Log Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {records.map((node) => (
                  <tr key={node.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 font-mono text-[11px] text-slate-500 font-semibold">{node.id}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-900">{node.department.code}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{node.department.name}</span>
                    </td>
                    <td className="p-4 max-w-xs truncate text-slate-600 font-medium">{node.justification}</td>
                    <td className="p-4">
                      {node.purchaseOrders.length > 0 ? (
                        node.purchaseOrders.map((po, idx) => (
                          <div key={idx} className="font-mono text-[11px] font-bold text-indigo-600">
                            {po.poNumber}
                            <span className={`text-[9px] ml-1.5 px-1 rounded font-bold uppercase ${po.isCheckIssued ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {po.isCheckIssued ? 'Check Cleared' : 'Awaiting Check'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 font-serif italic text-[11px]">No PO Bound Yet</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase shadow-inner
                        ${node.status === PRStatus.Received_and_Closed ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
                        ${node.status === PRStatus.Declined ? 'bg-rose-100 text-rose-800 border border-rose-200' : ''}
                        ${node.status === PRStatus.Draft ? 'bg-slate-100 text-slate-600 border border-slate-200' : ''}
                        ${node.status !== PRStatus.Received_and_Closed && node.status !== PRStatus.Declined && node.status !== PRStatus.Draft ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
                      `}>
                        {node.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 max-w-md">
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-2 max-h-36 overflow-y-auto">
                        {node.auditLogs.map((log, lIdx) => (
                          <div key={lIdx} className="text-[10px] border-b border-slate-200/60 pb-1.5 last:border-none last:pb-0">
                            <div className="flex justify-between font-medium text-slate-400 font-mono text-[9px]">
                              <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                              <span className="text-slate-500 font-bold">{log.actor.role}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5 font-sans leading-normal">
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