// File: src/app/dashboard/pr/new/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell,
  StageHeader,
  Card,
  ErrorBanner,
  FieldLabel,
  FieldError,
  inputClass,
  ActionButton,
} from '@/components/ui/WorkflowUI';

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

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [justification, setJustification] = useState<string>('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState<boolean>(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0.0 },
  ]);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
        }
      })
      .catch(() => setSystemError('Could not load session. Please refresh the page.'))
      .finally(() => setUserLoading(false));
  }, []);

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const updatedItems = [...items];
    if (field === 'itemName') {
      updatedItems[index][field] = value as string;
    } else {
      updatedItems[index][field] = Number(value);
    }
    setItems(updatedItems);
  };

  const addItemRow = () => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0.0 }]);

  const removeItemRow = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);

    if (!activeUser || activeUser.role !== Role.Requesting_Office) {
      setSystemError('Only Requesting Office accounts can create a new Purchase Request.');
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
            throw new Error('Please review the highlighted fields below and try again.');
          }
          throw new Error(result.error || 'Something went wrong while submitting your request.');
        }

        router.refresh();
        router.push('/dashboard/audit');
      } catch (err: unknown) {
        setSystemError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500 font-sans">
        Loading your session…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Requesting_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-sm mt-2">
          Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized to create Purchase Requests.
        </p>
      </Card>
    );
  }

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 1 of 6 · New Purchase Request"
        title="New Purchase Request"
        description="Describe what your department needs and why. Once submitted, this request will be routed to the Business Office for evaluation."
        meta={{ label: 'Requesting Department', value: `${activeUser.departmentName} [${activeUser.departmentCode}]` }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <FieldLabel>Justification / Purpose</FieldLabel>
          <textarea
            required
            rows={3}
            className={inputClass(!!fieldErrors?.justification)}
            placeholder="Explain why this purchase is needed and how it supports your department's operations…"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          {fieldErrors?.justification?._errors && (
            <FieldError>{fieldErrors.justification._errors[0]}</FieldError>
          )}
        </Card>

        <Card className="bg-emerald-50/40 border-emerald-200 flex items-start gap-3.5">
          <input
            id="bypass-toggle"
            type="checkbox"
            className="h-4 w-4 mt-1 accent-emerald-700 rounded cursor-pointer"
            checked={isDirectPoBypass}
            onChange={(e) => setIsDirectPoBypass(e.target.checked)}
          />
          <div className="text-sm">
            <label htmlFor="bypass-toggle" className="font-semibold text-emerald-900 cursor-pointer block">
              Skip to Purchase Order — approved request letter already on file
            </label>
            <p className="text-slate-500 mt-1 leading-relaxed text-xs">
              Check this box only if you have a signed request letter approved outside this system. The request will skip Business and Admin Office reviews and proceed directly to PO generation.
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">Items Requested</h3>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {items.length} {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200"
              >
                <div className="col-span-12 sm:col-span-5">
                  <input
                    type="text"
                    required
                    placeholder="Item description / specs"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-transparent outline-none transition"
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                  />
                </div>

                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Qty"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-transparent outline-none transition"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>

                <div className="col-span-5 sm:col-span-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm font-mono">₱</span>
                    <input
                      type="number"
                      required
                      min={0.01}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-transparent outline-none transition font-mono"
                      value={item.unitPrice || ''}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-2">
                  <span className="hidden lg:inline text-xs font-mono text-slate-500 font-bold">
                    ₱{(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-20 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <ActionButton type="button" variant="outline" onClick={addItemRow}>
            + Add Another Item
          </ActionButton>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wide block">Estimated Total</span>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 font-mono">
              ₱{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <ActionButton type="submit" disabled={isPending}>
            {isPending ? 'Submitting…' : 'Submit Purchase Request'}
          </ActionButton>
        </Card>
      </form>
    </PageShell>
  );
}