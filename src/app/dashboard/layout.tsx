// File: src/app/dashboard/layout.tsx
import React from 'react';
import EnterpriseHeader from '@/components/ui/EnterpriseHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased flex flex-col">
      {/* Centralized Header rendered for ALL dashboard pages */}
      <EnterpriseHeader />
      
      {/* Page Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}