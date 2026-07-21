// src/app/dashboard/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function DashboardGatewayPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
          Centralized Gateway Node
        </span>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-3">
          CPATS Dashboard Workspace
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Operational routing successfully captured. Use the option below to return to the master control launchpad matrix.
        </p>
        
        <div className="mt-8 pt-6 border-t border-slate-100">
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
          >
            ← Return to Control Matrix
          </Link>
        </div>
      </div>
    </div>
  );
}