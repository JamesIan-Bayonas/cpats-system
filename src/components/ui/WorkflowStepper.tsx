import React from 'react';
import { PRStatus } from '@prisma/client';

interface Step {
  id: string;
  label: string;
  roles: string;
}

const STAGES: Step[] = [
  { id: 'REQUEST', label: '1. Requisition', roles: 'Requesting Dept' },
  { id: 'BUSINESS', label: '2. Fiscal Eval', roles: 'Business Office' },
  { id: 'ADMIN', label: '3. Admin Sign-Off', roles: 'VP Administration' },
  { id: 'PO', label: '4. PO & Clearance', roles: 'Purchasing / Finance' },
  { id: 'RECEIVING', label: '5. Inspection', roles: 'Asset Custodian' },
  { id: 'CLOSED', label: '6. COA Audit', roles: 'Internal Audit' },
];

export function WorkflowStepper({ currentStatus }: { currentStatus: PRStatus }) {
  const getActiveIndex = (status: PRStatus): number => {
    switch (status) {
      case PRStatus.Draft: return 0;
      case PRStatus.Pending_Business_Approval: return 1;
      case PRStatus.Pending_Admin_Approval: return 2;
      case PRStatus.Approved_Awaiting_PO:
      case PRStatus.Awaiting_Check_Issuance: return 3;
      case PRStatus.Ready_for_Purchase: return 4;
      case PRStatus.Received_and_Closed: return 5;
      default: return 1;
    }
  };

  const activeIdx = getActiveIndex(currentStatus);

  return (
    <nav aria-label="Procurement Progress" className="w-full bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
      <ol className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STAGES.map((stage, idx) => {
          const isDone = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          return (
            <li key={stage.id} className="flex flex-col border-t-2 pt-2 transition-colors duration-200"
                style={{ borderColor: isDone ? '#047857' : isCurrent ? '#0ea5e9' : '#e2e8f0' }}>
              <span className={`text-[10px] font-mono font-bold uppercase ${
                isDone ? 'text-emerald-700' : isCurrent ? 'text-sky-700' : 'text-slate-400'
              }`}>
                {isDone ? '✓ Completed' : isCurrent ? '● Active' : 'Upcoming'}
              </span>
              <span className="text-xs font-bold text-slate-800 mt-0.5">{stage.label}</span>
              <span className="text-[10px] text-slate-400">{stage.roles}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}