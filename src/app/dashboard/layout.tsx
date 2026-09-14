// src/app/dashboard/layout.tsx
import React from 'react';
import EnterpriseHeader from '@/components/ui/EnterpriseHeader';
import DmcCrestWatermark from '@/components/ui/DmcCrestWatermark';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-50 font-sans text-slate-900 antialiased flex flex-col">
      {/* Centralized Institutional Seal Watermark */}
      <DmcCrestWatermark />

      {/* Centralized Header rendered for ALL dashboard pages */}
      <EnterpriseHeader />

      {/* Page Content elevated above background watermark */}
      <div className="flex-1 relative z-10">
        {children}
      </div>
    </div>
  );
}