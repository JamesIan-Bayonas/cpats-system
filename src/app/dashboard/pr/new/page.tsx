// src/app/dashboard/pr/new/page.tsx
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface PurchaseItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Form State Elements
  const [justification, setJustification] = useState('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0 }
  ]);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Dynamic Array Management Logic
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
    setItems([...items, { itemName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Calculate Running Total
  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  // Form Submission Execution
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFeedback(null);

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
          throw new Error(result.error || 'Validation failed. Please verify item schemas.');
        }

        // On successful creation, reroute to tracking system view
        router.refresh();
        router.push('/dashboard');
        
      } catch (err: any) {
        setErrorFeedback(err.message || 'An unexpected runtime submission error occurred.');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden p-6">
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Create New Purchase Request</h2>
        <p className="text-sm text-slate-500 mt-1">Initiate a procurement track inside the CPATS ledger engine.</p>
      </div>

      {errorFeedback && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded text-rose-700 text-sm font-medium">
          {errorFeedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Justification Text Field */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Procurement Justification</label>
          <textarea
            required
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-slate-800"
            placeholder="Provide architectural or institutional reasoning for this procurement request..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </div>

        {/* Direct PO Bypass Checkbox Edge Case */}
        <div className="flex items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
          <input
            id="bypass-toggle"
            type="checkbox"
            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
            checked={isDirectPoBypass}
            onChange={(e) => setIsDirectPoBypass(e.target.checked)}
          />
          <div className="ml-3">
            <label htmlFor="bypass-toggle" className="text-sm font-semibold text-slate-800 cursor-pointer">
              Direct PO Bypass (Executive Authorization)
            </label>
            <p className="text-xs text-slate-500">Enable only if pre-approved documentation exists. Skips steps 1-3 straight to routing state.</p>
          </div>
        </div>

        {/* Dynamic Items Input Grid Matrix */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Requested Item Specifications</label>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Item Descriptive Name"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm text-slate-800"
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Qty"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm text-slate-800"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                    placeholder="Unit Price"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm text-slate-800"
                    value={item.unitPrice || ''}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                  />
                </div>
                <div className="text-sm font-semibold text-slate-600 w-24 text-right">
                  ₱{(item.quantity * item.unitPrice).toFixed(2)}
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition"
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
            className="mt-3 inline-flex items-center text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition"
            onClick={addItemRow}
          >
            + Add Line Item
          </button>
        </div>

        {/* Master Calculation Summary Banner & Submit */}
        <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Cost Total</span>
            <div className="text-2xl font-black text-slate-900">₱{grandTotal.toFixed(2)}</div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg disabled:bg-slate-400 transition"
          >
            {isPending ? 'Committing Entry...' : 'Submit Purchase Request'}
          </button>
        </div>
      </form>
    </div>
  );
}