'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '@prisma/client';

interface EnterpriseHeaderProps {
  activeRole: Role;
  departmentCode: string;
}

export default function EnterpriseHeader({ activeRole, departmentCode }: EnterpriseHeaderProps) {
  const pathname = usePathname();

  const navigationSteps = [
    { name: 'Step 1: Init PR', href: '/dashboard/pr/new', role: Role.Requesting_Office },
    { name: 'Step 2: Business', href: '/dashboard/pr/evaluate-business', role: Role.Business_Office },
    { name: 'Step 3: Admin Auth', href: '/dashboard/pr/approve-admin', role: Role.Admin_Office },
    { name: 'Step 4-A: PO Gen', href: '/dashboard/po/new', role: Role.Purchasing_Office },
    { name: 'Step 4-B: Check Release', href: '/dashboard/po/release-check', role: Role.Business_Office },
    { name: 'Step 5: Intake & QR', href: '/dashboard/receiving/new', role: Role.Receiving_Custodian },
    { name: 'Global Audit', href: '/dashboard/audit', role: Role.Global_Auditor },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-emerald-950/80 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Institutional Brand Title */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-mono font-black text-emerald-400 text-xs tracking-tighter">DMC</span>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-black tracking-tight text-white font-sans">CPATS ENTERPRISE</h1>
                <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  3NF ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Internal Audit Compliance Blueprint // Mr. Lugo, CPA</p>
            </div>
          </div>

          {/* Active Context Indicators */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Active Session Scope</span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  {activeRole.replace(/_/g, ' ')} [{departmentCode}]
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Step Workflow Navigation Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/60 no-scrollbar">
          {navigationSteps.map((step) => {
            const isActive = pathname === step.href;
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/30 border border-emerald-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                {step.name}
              </Link>
            );
          })}
        </nav>

      </div>
    </header>
  );
}