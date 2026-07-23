'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import EnterpriseHeader from '@/components/ui/EnterpriseHeader';

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
  items?: Record<string, unknown>;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Explicit Type Widening to bypass TS2367 literal narrowing
  const activeUser: { id: string; role: Role; departmentId: string; departmentCode: string } = {
    id: "6a2f7b1e-3c9d-4e5f-a6b7-8c9d0e1f2a3b",
    role: Role.Requesting_Office,
    departmentId: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    departmentCode: "CCS"
  };

  const [justification, setJustification] = useState<string>('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState<boolean>(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0.00 }
  ]);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);

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

  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);

    if (activeUser.role !== Role.Requesting_Office) {
      setSystemError("FORBIDDEN: Institutional security layout restricts creation to Requesting Office profiles.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/pr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ justification, isDirectPoBypass, items }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error("Payload Validation Error: Please verify item structure format rules.");
          }
          throw new Error(result.error || "An unexpected server error halted requisition logging.");
        }

        router.refresh();
        router.push('/dashboard/audit');
      } catch (err: unknown) {
        if (err instanceof Error) {
          setSystemError(err.message);
        } else {
          setSystemError("A critical communication interrupt occurred during submission.");
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <EnterpriseHeader activeRole={activeUser.role} departmentCode={activeUser.departmentCode} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Step Heading Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-md uppercase tracking-wider">
                Step 1 of 5 // Requisition Gate [source: 3]
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight mt-3">
                Initialize Purchase Request
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Submit structural multi-item requisition payloads directly into the central audit matrix. Items are encoded into native binary JSON objects [source: 2].
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Department Allocation</span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-950 px-3 py-1 rounded border border-slate-800 inline-block mt-1">
                College of Computer Studies
              </span>
            </div>
          </div>
        </div>

        {systemError && (
          <div className="mb-6 p-4 bg-rose-950/50 border-l-4 border-rose-500 rounded-r-xl text-rose-300 text-xs font-mono">
            <strong className="block uppercase text-[10px] text-rose-400 mb-1">System Execution Alert</strong>
            {systemError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Justification Field */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
              Procurement Justification & Operational Rationale [source: 3]
            </label>
            <textarea
              required
              rows={3}
              className={`w-full px-4 py-3 text-xs bg-slate-950 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-100 placeholder:text-slate-600 transition font-sans ${
                fieldErrors?.justification ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-800'
              }`}
              placeholder="Detail clear institutional reasons and operational department requirements for this purchase..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            {fieldErrors?.justification?._errors && (
              <p className="text-[11px] text-rose-400 font-mono mt-2">{fieldErrors.justification._errors[0]}</p>
            )}
          </div>

          {/* FR-2 Direct PO Stage Bypass Toggle */}
          <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900/80 border border-emerald-900/60 p-5 rounded-2xl shadow-xl flex items-start space-x-4">
            <input
              id="bypass-toggle"
              type="checkbox"
              className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-950 rounded cursor-pointer mt-0.5 accent-emerald-500"
              checked={isDirectPoBypass}
              onChange={(e) => setIsDirectPoBypass(e.target.checked)}
            />
            <div className="text-xs">
              <label htmlFor="bypass-toggle" className="font-bold text-emerald-300 cursor-pointer uppercase tracking-wide block font-mono">
                Direct Purchase Order Stage Bypass (FR-2) [source: 2, 3]
              </label>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Check this box if an approved request letter exists [source: 3]. The system appends an executive bypass flag, skipping downstream Business and Admin Office reviews, dropping directly into PO generation [source: 2, 3].
              </p>
            </div>
          </div>

          {/* Item Specification Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Item Line Specifications (3NF JSON Schema) [source: 2]
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
                  
                  {/* Item Description */}
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      type="text"
                      required
                      placeholder="Item Naming / Specs Description"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-none"
                      value={item.itemName}
                      onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-5 sm:col-span-2">
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Qty"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-none"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-5 sm:col-span-3">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500 text-xs font-mono">₱</span>
                      <input
                        type="number"
                        required
                        min={0.01}
                        step="0.01"
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-none"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Remove Item Button */}
                  <div className="col-span-2 sm:col-span-2 flex items-center justify-end space-x-2">
                    <span className="hidden lg:inline text-[10px] font-mono text-slate-500">
                      ₱{(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      disabled={items.length === 1}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg disabled:opacity-20 transition"
                    >
                      ✕
                    </button>
                  </div>

                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="mt-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-800/80 px-4 py-2 rounded-xl transition shadow-sm"
            >
              + Add Specification Line
            </button>
          </div>

          {/* Submission & Calculation Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex items-center justify-between shadow-2xl backdrop-blur-md">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-widest">
                Consolidated Requisition Value
              </span>
              <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                ₱{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-900/30 transition-all transform active:scale-[0.98]"
            >
              {isPending ? 'Committing to Database Node...' : 'Commit Requisition Entry'}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}