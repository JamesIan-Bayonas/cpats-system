// src/app/dashboard/pr/new/page.tsx
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

interface PurchaseItemState {
  category: string;
  specs: string;
  quantity: number;
}

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  justification?: ZodSubErrors;
  adminProofFilePath?: ZodSubErrors;
  items?: Record<string, unknown>;
}

const ITEM_CATEGORIES = [
  'Monitors & Displays',
  'Cables & Connectors (HDMI, VGA, LAN)',
  'Desktop Computers & Laptops',
  'Peripherals (Mouse, Keyboard, Webcam)',
  'Printers, Scanners & Consumables',
  'Networking Equipment (Switches, Routers)',
  'Office Supplies & Stationery',
  'Other / Custom Item',
];

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  const [justification, setJustification] = useState<string>('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState<boolean>(false);
  const [adminProofFilePath, setAdminProofFilePath] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const [items, setItems] = useState<PurchaseItemState[]>([
    { category: 'Monitors & Displays', specs: '', quantity: 1 },
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

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setAdminProofFilePath(data.url);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  };

  const handleItemChange = (index: number, field: keyof PurchaseItemState, value: string | number) => {
    const updatedItems = [...items];
    if (field === 'quantity') {
      updatedItems[index][field] = Number(value);
    } else {
      updatedItems[index][field] = value as string;
    }
    setItems(updatedItems);
  };

  const addItemRow = () => setItems([...items, { category: 'Monitors & Displays', specs: '', quantity: 1 }]);

  const removeItemRow = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);

    if (!activeUser || activeUser.role !== Role.Requesting_Office) {
      setSystemError('SECURITY EXCEPTION: Only Requesting Office accounts can create a new Purchase Request.');
      return;
    }

    // Format items into standard schema payload [{ itemName: string, quantity: number }]
    const formattedPayloadItems = items.map((item) => {
      const isOther = item.category === 'Other / Custom Item';
      const synthesizedName = !isOther && item.category
        ? (item.specs.trim() ? `${item.category} — ${item.specs.trim()}` : item.category)
        : (item.specs.trim() || 'Custom Item');

      return {
        itemName: synthesizedName,
        quantity: item.quantity,
      };
    });

    startTransition(async () => {
      try {
        const payload = {
          justification,
          isDirectPoBypass,
          ...(isDirectPoBypass && { adminProofFilePath }),
          items: formattedPayloadItems,
        };

        const response = await fetch('/api/pr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Validation exception: Please review the highlighted fields below.');
          }
          throw new Error(result.error || 'A transaction exception occurred while submitting your request.');
        }

        router.refresh();
        router.push('/dashboard/pr/track');
      } catch (err: unknown) {
        setSystemError(err instanceof Error ? err.message : 'An unclassified system exception occurred.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500 font-sans">
        Loading active session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Requesting_Office) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-sm mt-2">
          Your account ({activeUser?.role.replace(/_/g, ' ') || 'Guest'}) is not authorized to initialize Purchase Requests.
        </p>
      </Card>
    );
  }

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 1 of 6 · New Purchase Request"
        title="Requisition Initiation Console"
        description="Specify required departmental equipment or supplies. Upon submission, this request will be dispatched to the Business Office for fiscal evaluation."
        meta={{ label: 'Requesting Unit', value: `${activeUser.departmentName} [${activeUser.departmentCode}]` }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* JUSTIFICATION & PURPOSE SECTION */}
        <Card className="space-y-3">
          <div className="flex justify-between items-center">
            <FieldLabel>Operational Justification &amp; Purpose</FieldLabel>
            <span className="text-[10px] font-mono text-slate-400">
              Min. 10 Characters Required
            </span>
          </div>

          <textarea
            required
            rows={3}
            className={inputClass(!!fieldErrors?.justification)}
            placeholder="e.g., Procurement of lab equipment for CCS Laboratory 3 to support coursework."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />

          {fieldErrors?.justification?._errors && (
            <FieldError>{fieldErrors.justification._errors[0]}</FieldError>
          )}
        </Card>

        {/* DIRECT PO BYPASS OPTION WITH FAST-TRACK AUDIT TRAIL EXPLANATION */}
        <Card className="bg-emerald-50/40 border-emerald-200/80 p-4 space-y-3">
          <div className="flex items-start gap-3.5">
            <input
              id="bypass-toggle"
              type="checkbox"
              className="h-4 w-4 mt-0.5 accent-emerald-700 rounded cursor-pointer shrink-0"
              checked={isDirectPoBypass}
              onChange={(e) => {
                setIsDirectPoBypass(e.target.checked);
                if (!e.target.checked) {
                  setAdminProofFilePath('');
                  setAttachedFileName(null);
                }
              }}
            />
            <div className="text-xs">
              <label htmlFor="bypass-toggle" className="font-bold text-emerald-950 cursor-pointer block">
                Executive Pre-Approved Letter Fast-Track (Dispatches with Attached Approval Letter)
              </label>
              <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">
                Enable this option if an officially signed executive approval letter is already on file. Attaching the physical signed letter allows the Business Office and Admin Office to fast-track digital recording while preserving a 100% auditable system trail.
              </p>
            </div>
          </div>

          {isDirectPoBypass && (
            <div className="pt-3 border-t border-emerald-200/80 space-y-3">
              <FieldLabel>Attach Officially Signed Executive Approval Letter (PDF / Image)</FieldLabel>
              
              <div className="grid grid-cols-1 gap-3 items-center">
                <div className="border-2 border-dashed border-emerald-300 rounded-xl p-4 bg-white text-center hover:border-emerald-600 transition">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleProofFileUpload}
                    className="hidden"
                    id="bypass-proof-input"
                  />
                  <label htmlFor="bypass-proof-input" className="cursor-pointer block space-y-1">
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 inline-block">
                      📁 {attachedFileName ? 'Change Attached Approval Letter' : 'Upload Signed Executive Letter'}
                    </span>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {attachedFileName || adminProofFilePath || 'Select scanned PDF or photo of signed letter'}
                    </p>
                  </label>
                </div>
              </div>

              {fieldErrors?.adminProofFilePath?._errors && (
                <FieldError>{fieldErrors.adminProofFilePath._errors[0]}</FieldError>
              )}
            </div>
          )}
        </Card>

        {/* CATEGORIZED ITEMS REQUESTED SCHEDULE */}
        <Card className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Requested Items Schedule</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select item category and specify technical details or quantities.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-200">
              {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
            </span>
          </div>

          {/* Desktop/Tablet Column Header Legend */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            <div className="col-span-4">Item Category</div>
            <div className="col-span-5">Technical Specifications &amp; Details</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-center bg-slate-50/80 p-3 rounded-xl border border-slate-200/90 hover:border-slate-300 transition"
              >
                {/* Category Dropdown */}
                <div className="col-span-12 sm:col-span-4">
                  <label className="block sm:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Item Category
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none transition font-sans cursor-pointer"
                    value={item.category}
                    onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                  >
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Technical Specifications / Details */}
                <div className="col-span-12 sm:col-span-5">
                  <label className="block sm:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Technical Specifications
                  </label>
                  <input
                    type="text"
                    required={item.category === 'Other / Custom Item'}
                    placeholder={
                      item.category === 'Other / Custom Item'
                        ? 'Specify item description and technical details...'
                        : 'e.g., 27-inch IPS 1080p 75Hz monitor with HDMI'
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none transition font-sans"
                    value={item.specs}
                    onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-10 sm:col-span-2">
                  <label className="block sm:hidden text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Qty"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none transition font-mono"
                    value={item.quantity || ''}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>

                {/* Remove Action */}
                <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-20 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <ActionButton type="button" variant="outline" onClick={addItemRow}>
            + Add Line Item
          </ActionButton>
        </Card>

        {/* SUBMISSION ACTION CARD */}
        <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 text-white">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">
              Requisition Dispatch Payload
            </span>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {items.length} {items.length === 1 ? 'Item Specification Line' : 'Item Specification Lines'} Configured
            </div>
          </div>

          <ActionButton 
            type="submit" 
            disabled={isPending}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase tracking-wider text-xs"
          >
            {isPending ? 'Dispatching Requisition…' : 'Submit Purchase Request'}
          </ActionButton>
        </Card>

      </form>
    </PageShell>
  );
}