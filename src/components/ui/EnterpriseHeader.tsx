// File: src/components/ui/EnterpriseHeader.tsx
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
    { name: '01. Init PR', href: '/dashboard/pr/new', role: Role.Requesting_Office },
    { name: '02. Business Eval', href: '/dashboard/pr/evaluate-business', role: Role.Business_Office },
    { name: '03. Admin Sign-Off', href: '/dashboard/pr/approve-admin', role: Role.Admin_Office },
    { name: '04-A. PO Generation', href: '/dashboard/po/new', role: Role.Purchasing_Office },
    { name: '04-B. Check Release', href: '/dashboard/po/release-check', role: Role.Business_Office },
    { name: '05. Cargo Intake', href: '/dashboard/receiving/new', role: Role.Receiving_Custodian },
    { name: 'Audit Console', href: '/dashboard/audit', role: Role.Global_Auditor },
  ];

  return (
    <header className="sticky top-0 z-50 bg-stone-950 border-b border-stone-800 text-stone-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-stone-900">
          
          <div className="flex items-center space-x-3.5">
            <div className="h-9 w-9 rounded-md bg-emerald-950 border border-emerald-700/80 flex items-center justify-center shadow-inner">
              <span className="font-mono font-black text-emerald-400 text-xs tracking-tight">DMC</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xs font-bold tracking-wider text-stone-100 uppercase font-mono">
                  CPATS Procurement Control Node
                </h1>
                <span className="text-[9px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                  3NF Verified
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-mono tracking-tight mt-0.5">
                Institutional Audit Compliance Infrastructure // Mr. Lugo, CPA
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="text-[9px] font-mono text-stone-500 uppercase tracking-widest block">
                Session Scope
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-xs font-bold text-emerald-300 tracking-tight">
                  {activeRole.replace(/_/g, ' ')} [{departmentCode}]
                </span>
              </div>
            </div>
          </div>

        </div>

        <nav className="flex space-x-1 overflow-x-auto py-2 no-scrollbar">
          {navigationSteps.map((step) => {
            const isActive = pathname === step.href;
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-mono transition-all border ${
                  isActive
                    ? 'bg-emerald-900/90 text-emerald-200 border-emerald-600/80 font-bold shadow-xs'
                    : 'text-stone-400 border-transparent hover:text-stone-200 hover:bg-stone-900'
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