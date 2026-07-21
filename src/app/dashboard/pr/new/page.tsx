// src/app/dashboard/pr/new/page.tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface PurchaseItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  justification?: ZodSubErrors;
  items?: Record<string, any>;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // 1. SECURITY CONTEXT MATRIX (Explicit Type Widening to prevent TS2367 literal narrowing)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "user-uuid-from-session-123", 
    role: Role.Requesting_Office,
    departmentId: "some-department-uuid-abc"
  };

  // 2. STATE MANAGEMENT CORE
  const [justification, setJustification] = useState<string>('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState<boolean>(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0.00 }
  ]);
  
  // Validation Error States Mapped to Server Output Forms
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);

  // 3. DYNAMIC ARRAY MUTATION HANDLERS
  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const updatedItems = [...items];
    if (field === 'itemName') {
      updatedItems[index][field] = value as string;
    } else {
      updatedItems[index][field] = Number(value);
    }
    setItems(updatedItems);
  };

  const addItemRow = () => {
    setItems([...items, { itemName: '', quantity: 1, unitPrice: 0.00 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // 4. FINANCIAL CALCULATION AGGREGATION
  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  // 5. TRANSACTION SUBMISSION PIPELINE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);

    // Guard Authorization Block at User Interface Layer
    if (activeUser.role !== Role.Requesting_Office) {
      setSystemError("FORBIDDEN: Institutional security layout restricts creation to Requesting Office profiles.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            justification,
            isDirectPoBypass,
            items
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error("Payload Validation Error: Please verify item structure format rules.");
          }
          throw new Error(result.error || "An unexpected server error halted requisition logging.");
        }

        // On successful initialization, force route cache refresh and route downstream to tracking index
        router.refresh();
        router.push('/dashboard');
        
      } catch (err: any) {
        setSystemError(err.message || "A critical communication interrupt occurred during submission.");
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 my-8 text-slate-900">
      
      {/* Workflow Navigation Header Context Panel */}
      <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 1: Requisition Initialization Phase</h2>
          <p className="text-xs text-slate-500 mt-1">
            CPATS Ledger Node Deployment Group: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational Compliance Loop</span>
          <span className="text-xs font-semibold text-teal-600">Formulated under Internal Audit Guidelines</span>
        </div>
      </div>

      {/* Centralized System Message Interceptor */}
      {systemError && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
          <span className="font-bold block uppercase tracking-wide mb-1">System Execution Alert</span>
          {systemError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Justification Text Block */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            Procurement Justification / Core Purpose
          </label>
          <textarea
            required
            rows={3}
            className={`w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm placeholder:text-slate-400
              ${fieldErrors?.justification ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
            placeholder="Provide clear, auditable institutional logic or departmental rationale for this asset request..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          {fieldErrors?.justification?._errors && (
            <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.justification._errors[0]}</p>
          )}
        </div>

        {/* FR-2: Direct PO Bypass Functional Checkbox Toggle */}
        <div className="flex items-start bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
          <div className="flex items-center h-5">
            <input
              id="bypass-toggle"
              type="checkbox"
              className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer"
              checked={isDirectPoBypass}
              onChange={(e) => setIsDirectPoBypass(e.target.checked)}
            />
          </div>
          <div className="ml-3 text-xs">
            <label htmlFor="bypass-toggle" className="font-bold text-slate-800 cursor-pointer uppercase tracking-wide">
              Direct PO Stage Bypass (Executive Document Authorization)
            </label>
            <p className="text-slate-500 mt-0.5 leading-relaxed">
              Enable this toggle only if an approved request letter has already been acquired. The system will automatically attach a verification bypass flag, route past downstream approval nodes, and drop straight into the Purchase Order processing stream.
            </p>
          </div>
        </div>

        {/* Dynamic Multi-Item Line Specification Matrix Grid */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Requested Asset Item Specifications
            </label>
            {fieldErrors?.items && !Array.isArray(fieldErrors.items) && (
              <span className="text-[11px] text-rose-500 font-medium">Matrix Validation Alert: At least one item line must be completely provisioned.</span>
            )}
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                
                {/* Item Naming Description Parameter */}
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Item Description / Technical Specifications"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:border-transparent outline-none shadow-sm"
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                  />
                </div>

                {/* Quantitative Metric Parameter */}
                <div className="w-24">
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Qty"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:border-transparent outline-none shadow-sm"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>

                {/* Estimated Unit Financial Cost Parameter */}
                <div className="w-36">
                  <div className="relative rounded shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-xs">₱</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={0.01}
                      step="0.01"
                      placeholder="Unit Price"
                      className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:border-transparent outline-none"
                      value={item.unitPrice || ''}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    />
                  </div>
                </div>

                {/* Computed Subtotal Line Aggregation display field */}
                <div className="text-xs font-mono font-bold text-slate-600 w-24 text-right">
                  ₱{(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                {/* Row Destruct Command Button Object */}
                <button
                  type="button"
                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition disabled:opacity-30 disabled:hover:text-slate-400"
                  onClick={() => removeItemRow(index)}
                  disabled={items.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 inline-flex items-center text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded-lg transition shadow-sm"
            onClick={addItemRow}
          >
            + Add Line Specification Item
          </button>
        </div>

        {/* Master Calculation Summary Sticky Footer Bar */}
        <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Consolidated Budget Total</span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              ₱{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98]"
          >
            {isPending ? 'Writing to Ledger Node...' : 'Commit Purchase Request'}
          </button>
        </div>
      </form>
    </div>
  );
}