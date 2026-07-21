// src/app/page.tsx
import React from 'react';
import Link from 'next/link';

interface WorkflowNode {
  step: string;
  title: string;
  route: string;
  role: string;
  color: string;
  description: string;
}

export default function Home() {
  const workflowNodes: WorkflowNode[] = [
    {
      step: "Step 1",
      title: "Requisition Initialization",
      route: "/dashboard/pr/new",
      role: "Requesting Office",
      color: "border-teal-500 hover:bg-teal-50/30 text-teal-700",
      description: "Initialize new purchase requests with structural multi-item specification line items formatted in binary JSON."
    },
    {
      step: "Step 2",
      title: "Business Office Evaluation",
      route: "/dashboard/pr/evaluate-business",
      role: "Business Office",
      color: "border-amber-500 hover:bg-amber-50/30 text-amber-700",
      description: "Verify purchase necessity parameters, evaluate budgetary line balances, and assign state updates."
    },
    {
      step: "Step 3",
      title: "Executive Admin Approval",
      route: "/dashboard/pr/approve-admin",
      role: "Admin Office",
      color: "border-sky-500 hover:bg-sky-50/30 text-sky-700",
      description: "Enforce mandatory tripartite checkbox authorization constraints and bind out-of-band signature verification links."
    },
    {
      step: "Step 4-A",
      title: "Purchase Order Generation",
      route: "/dashboard/po/new",
      role: "Purchasing Office",
      color: "border-indigo-500 hover:bg-indigo-50/30 text-indigo-700",
      description: "Bind approved requisition models to unique database codes and produce unique cryptographic authentication tokens."
    },
    {
      step: "Step 4-B",
      title: "Check Release Terminal",
      route: "/dashboard/po/release-check",
      role: "Business Office (Finance)",
      color: "border-purple-500 hover:bg-purple-50/30 text-purple-700",
      description: "Log physical bank disbursement codes to clear the cash lock block, moving states to Ready for Purchase."
    },
    {
      step: "Step 5",
      title: "Cargo Intake & Inspection",
      route: "/dashboard/receiving/new",
      role: "Receiving Custodian",
      color: "border-emerald-500 hover:bg-emerald-50/30 text-emerald-700",
      description: "Assess arrival condition metadata, attach digital supplier invoices, and commit camera scan file records."
    },
    {
      step: "Monitor",
      title: "Global Auditor Portal",
      route: "/dashboard/audit",
      role: "Global Auditor",
      color: "border-slate-800 hover:bg-slate-100 text-slate-900",
      description: "Access read-only cross-departmental auditing ledgers. Filter, track, and examine complete historical trail logs."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        
        {/* Core Identity Panel */}
        <div className="border-b border-slate-200 pb-6 mb-8 text-center sm:text-left sm:flex sm:justify-between sm:items-center">
          <div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
              Prototype Environment Control Unit
            </span>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-2">
              Centralized Purchasing & Asset Tracking System
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Institutional Compliance Architecture Framework designed for DMC College Foundation
            </p>
          </div>
          <div className="mt-4 sm:mt-0 text-center sm:text-right">
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 inline-block">
              ● Local Ledger Sync: Active
            </span>
          </div>
        </div>

        {/* Informational Advisory Notice */}
        <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-amber-800 text-xs font-medium leading-relaxed shadow-inner">
          <strong className="uppercase block text-[10px] tracking-wide mb-1">Architectural Notice: Proto-Auth Bypassing Online</strong>
          This system is currently running inside an isolated validation state wrapper. Centralized authentication input fields are bypassed; navigating to any node listed below automatically injects the exact role credentials required to clear server-side RBAC token logic.
        </div>

        {/* Mapping Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowNodes.map((node, idx) => (
            <Link 
              key={idx} 
              href={node.route}
              className={`border-2 rounded-xl p-5 transition-all transform hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${node.color}`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono opacity-80">
                    {node.step}
                  </span>
                  <span className="text-[9px] font-bold uppercase bg-white/80 border border-current px-2 py-0.5 rounded-md font-mono">
                    {node.role}
                  </span>
                </div>
                <h3 className="text-sm font-black tracking-tight text-slate-900">
                  {node.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">
                  {node.description}
                </p>
              </div>
              <div className="text-right mt-4 text-[11px] font-bold uppercase tracking-wider pt-2 border-t border-slate-100 group-hover:underline">
                Launch Environment →
              </div>
            </Link>
          ))}
        </div>

        {/* Footer Audit Signature */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-center">
          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
            Formulated under Internal Audit Compliance Blueprint guidelines // Bergil Diamond A. Lugo, CPA
          </p>
        </div>

      </div>
    </div>
  );
}