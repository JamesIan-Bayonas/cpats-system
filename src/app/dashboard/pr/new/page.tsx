// src/app/dashboard/pr/new/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role } from '@prisma/client';
import { AuthUser } from '@/shared/session';

interface PurchaseItemState {
  id: string;
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

  // Form States
  const [justification, setJustification] = useState<string>('');
  const [isDirectPoBypass, setIsDirectPoBypass] = useState<boolean>(false);
  const [adminProofFilePath, setAdminProofFilePath] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);

  const [items, setItems] = useState<PurchaseItemState[]>([
    { id: 'item-1', category: 'Monitors & Displays', specs: '', quantity: 1 },
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
      .catch(() => setSystemError('Failed to verify active institutional session.'))
      .finally(() => setUserLoading(false));
  }, []);

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
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
      } else {
        throw new Error(data.error || 'Failed to upload attachment.');
      }
    } catch (err: unknown) {
      setSystemError(err instanceof Error ? err.message : 'Error uploading memo attachment.');
      setAttachedFileName(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleItemChange = (
    id: string,
    field: keyof Omit<PurchaseItemState, 'id'>,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'quantity') {
          return { ...item, quantity: Math.max(1, Number(value) || 1) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const adjustQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      })
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        category: 'Monitors & Displays',
        specs: '',
        quantity: 1,
      },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const totalPhysicalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);

    if (!activeUser || activeUser.role !== Role.Requesting_Office) {
      setSystemError('Access Restricted: Only authorized Requesting Offices can submit purchase requests.');
      return;
    }

    if (isDirectPoBypass && !adminProofFilePath) {
      setSystemError('Compliance Notice: Please attach the signed executive memo to submit under the Pre-Approved protocol.');
      return;
    }

    const formattedPayloadItems = items.map((item) => {
      const isOther = item.category === 'Other / Custom Item';
      const synthesizedName = !isOther && item.category
        ? item.specs.trim()
          ? `${item.category} — ${item.specs.trim()}`
          : item.category
        : item.specs.trim() || 'Custom Item';

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
            throw new Error('Please review highlighted fields before proceeding.');
          }
          throw new Error(result.error || 'A system exception occurred while submitting your request.');
        }

        router.refresh();
        router.push('/dashboard/pr/track');
      } catch (err: unknown) {
        setSystemError(err instanceof Error ? err.message : 'An unexpected exception occurred.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 tracking-wide">
          Loading Department Workspace…
        </span>
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Requesting_Office) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-rose-200 rounded-2xl shadow-sm text-center font-sans space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your account (<span className="font-semibold text-slate-700">{activeUser?.role.replace(/_/g, ' ') || 'Guest'}</span>) is not permitted to initiate purchase requests.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-xs font-bold text-emerald-700 hover:text-emerald-800 underline pt-2"
        >
          Return to Dashboard →
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-28 lg:pb-8 font-sans antialiased text-slate-900">
      {/* Breadcrumb & Header */}
      <div className="mb-4 sm:mb-6 space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 font-medium">
          <Link href="/dashboard" className="hover:text-emerald-700 transition">
            Portal
          </Link>
          <span>/</span>
          <Link href="/dashboard/pr/track" className="hover:text-emerald-700 transition truncate max-w-[140px] sm:max-w-none">
            Department Requests
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold truncate">New Requisition</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              New Purchase Request
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
              Submit required departmental equipment or supplies for administrative evaluation and processing.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-full sm:w-auto bg-emerald-50 border border-emerald-200/80 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-left shadow-2xs">
              <span className="block text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Requesting Department
              </span>
              <span className="text-xs font-bold text-emerald-950">
                {activeUser.departmentName} ({activeUser.departmentCode})
              </span>
            </div>
          </div>
        </div>
      </div>

      {systemError && (
        <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl text-rose-900 text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-2xs">
          <span className="text-base leading-none">✕</span>
          <div className="flex-1">{systemError}</div>
          <button
            type="button"
            onClick={() => setSystemError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Responsive Grid Workspace */}
      <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* Left Column: Form Canvas (12 cols on mobile, 8 cols on desktop) */}
        <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          
          {/* 1. Itemized Schedule Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                  1. Requested Items Schedule
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Itemize equipment or materials needed by your department.
                </p>
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 sm:px-3 py-1 rounded-full border border-emerald-200 shrink-0">
                {items.length} {items.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>

            {/* Desktop Table Header Legend (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-1 text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-2">
              <div className="col-span-4">Item Category</div>
              <div className="col-span-5">Technical Specifications &amp; Details</div>
              <div className="col-span-3 text-center">Quantity</div>
            </div>

            {/* Dynamic Items: Structured Mobile Card / Desktop Row */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 transition space-y-3 md:space-y-0 md:grid md:grid-cols-12 md:gap-3 md:items-center"
                >
                  {/* Mobile Header Sub-Bar (Visible on phones only) */}
                  <div className="flex md:hidden items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                      Line Item #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItemRow(item.id)}
                      disabled={items.length === 1}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-20 transition cursor-pointer p-1"
                    >
                      ✕ Remove
                    </button>
                  </div>

                  {/* Category Dropdown */}
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 md:hidden">
                      Item Category
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 outline-none transition cursor-pointer"
                    >
                      {ITEM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Technical Specifications */}
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 md:hidden">
                      Technical Specifications &amp; Details
                    </label>
                    <input
                      type="text"
                      required={item.category === 'Other / Custom Item'}
                      placeholder={
                        item.category === 'Other / Custom Item'
                          ? 'Specify brand, model, and item description…'
                          : 'e.g., 27-inch IPS 1080p 75Hz monitor'
                      }
                      value={item.specs}
                      onChange={(e) => handleItemChange(item.id, 'specs', e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 outline-none transition"
                    />
                  </div>

                  {/* Quantity Stepper & Desktop Delete Button */}
                  <div className="md:col-span-3 flex items-center justify-between md:justify-center gap-2 pt-1 md:pt-0">
                    <span className="text-[11px] font-semibold text-slate-600 md:hidden">
                      Quantity Required:
                    </span>

                    {/* Integrated Touch Stepper */}
                    <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs h-11">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(item.id, -1)}
                        className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 transition text-base font-bold cursor-pointer shrink-0"
                        aria-label="Decrease quantity"
                      >
                        –
                      </button>
                      <input
                        type="number"
                        min={1}
                        required
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        className="w-12 text-center text-xs sm:text-sm font-bold text-slate-900 outline-none tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => adjustQuantity(item.id, 1)}
                        className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 transition text-base font-bold cursor-pointer shrink-0"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Desktop Remove Button (Hidden on Mobile) */}
                    <button
                      type="button"
                      onClick={() => removeItemRow(item.id)}
                      disabled={items.length === 1}
                      title={items.length === 1 ? 'Schedule must contain at least one item' : 'Remove item'}
                      className="hidden md:flex w-10 h-11 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Line Item Button */}
            <button
              type="button"
              onClick={addItemRow}
              className="w-full min-h-[44px] py-2.5 border-2 border-dashed border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>+ Add Another Line Item</span>
            </button>
          </div>

          {/* 2. Operational Justification */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                  2. Operational Justification &amp; Purpose <span className="text-rose-600">*</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  State the administrative or curricular necessity for budget evaluation.
                </p>
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
                Min. 10 chars
              </span>
            </div>

            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g., Replacement monitors and connection cables for CCS Laboratory 2 to support second-semester programming courses."
              className="w-full p-3 sm:p-3.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 outline-none transition leading-relaxed min-h-[88px]"
            />

            {fieldErrors?.justification?._errors && (
              <p className="text-xs text-rose-600 font-medium">
                {fieldErrors.justification._errors[0]}
              </p>
            )}
          </div>

          {/* 3. Requisition Protocol */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                3. Requisition Protocol
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Select your authorization pathway.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Standard */}
              <label
                className={`flex flex-col p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                  !isDirectPoBypass
                    ? 'border-emerald-700 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Standard Department Requisition</span>
                  <input
                    type="radio"
                    name="filingProtocol"
                    checked={!isDirectPoBypass}
                    onChange={() => {
                      setIsDirectPoBypass(false);
                      setAdminProofFilePath('');
                      setAttachedFileName(null);
                    }}
                    className="h-4 w-4 accent-emerald-700 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Sequentially reviewed by the Business Office and Administration before PO creation.
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800">
                  <span>● Standard Sequential Review</span>
                </div>
              </label>

              {/* Option B: Pre-Approved Letter */}
              <label
                className={`flex flex-col p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                  isDirectPoBypass
                    ? 'border-emerald-700 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">
                    Executive Pre-Approved Memo
                  </span>
                  <input
                    type="radio"
                    name="filingProtocol"
                    checked={isDirectPoBypass}
                    onChange={() => setIsDirectPoBypass(true)}
                    className="h-4 w-4 accent-emerald-700 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  For items with a signed executive approval letter already on file.
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                  <span>⚡ Fast-Track Recording Protocol</span>
                </div>
              </label>
            </div>

            {/* Document Uploader */}
            {isDirectPoBypass && (
              <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-800">
                    Upload Signed Executive Document <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">PDF, PNG, or JPG</span>
                </div>

                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/30 hover:border-emerald-500 rounded-xl p-4 text-center transition">
                  {attachedFileName || adminProofFilePath ? (
                    <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="text-lg">📎</span>
                        <div className="text-left truncate">
                          <span className="block text-xs font-bold text-slate-900 truncate">
                            {attachedFileName || 'Executive_Approval_Document.pdf'}
                          </span>
                          <span className="block text-[10px] text-emerald-700 font-medium">
                            Document attached for compliance logging[cite: 1]
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminProofFilePath('');
                          setAttachedFileName(null);
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2.5 py-1 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        capture="environment"
                        onChange={handleProofFileUpload}
                        className="hidden"
                        id="memo-file-input"
                      />
                      <label
                        htmlFor="memo-file-input"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition shadow-2xs active:scale-95"
                      >
                        <span>{uploadingFile ? 'Uploading…' : 'Take Photo or Select File'}</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Attach a photo of the signed document or upload a scanned PDF.
                      </p>
                    </div>
                  )}
                </div>

                {fieldErrors?.adminProofFilePath?._errors && (
                  <p className="text-xs text-rose-600 font-medium">
                    {fieldErrors.adminProofFilePath._errors[0]}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Summary Rail on Desktop (Hidden on Mobile) */}
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Requisition Scope
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Totaling {totalPhysicalUnits} physical units requested.
              </p>
            </div>

            {/* Scope Breakdown */}
            <div className="grid grid-cols-2 gap-2.5 py-3 border-y border-slate-100 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="block text-[10px] font-semibold text-slate-400">Unique Items</span>
                <span className="text-sm font-bold text-slate-800">{items.length} Entries</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="block text-[10px] font-semibold text-slate-400">Total Quantity</span>
                <span className="text-sm font-bold text-slate-800">{totalPhysicalUnits} Units</span>
              </div>
            </div>

            {/* Workflow Roadmap */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                Subsequent Approval Stages
              </span>
              <ol className="space-y-3 text-xs">
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-2xs">
                    1
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900">Requesting Office (Current)</span>
                    <span className="text-[11px] text-slate-500">Submission of specifications and justification</span>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800">Business Office</span>
                    <span className="text-[11px] text-slate-500">Item necessity & budget checking</span>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800">Office of Administration</span>
                    <span className="text-[11px] text-slate-500">Executive authorization to procure</span>
                  </div>
                </li>

                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800">Purchasing &amp; Custodian</span>
                    <span className="text-[11px] text-slate-500">PO binding, financial release & cargo intake</span>
                  </div>
                </li>
              </ol>
            </div>

            {/* Desktop Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={isPending || uploadingFile}
                className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Request…</span>
                  </>
                ) : (
                  <span>Submit Purchase Request</span>
                )}
              </button>

              <Link
                href="/dashboard/pr/track"
                className="w-full min-h-[40px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center cursor-pointer"
              >
                Cancel &amp; Return to List
              </Link>
            </div>

            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-normal">
                Compliant with DMC College Foundation IT Procurement Governance &amp; COA audit standards[cite: 1].
              </p>
            </div>
          </div>
        </aside>

        {/* Floating Mobile Sticky Action Bar (Visible exclusively on mobile/tablet) */}
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 sm:p-4 z-40 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Scope
              </span>
              <span className="block text-xs font-extrabold text-slate-900">
                {items.length} {items.length === 1 ? 'item' : 'items'} ({totalPhysicalUnits} units)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/pr/track"
                className="min-h-[44px] px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center transition cursor-pointer"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isPending || uploadingFile}
                className="min-h-[44px] px-5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <span>Submit PR</span>
                )}
              </button>
            </div>
          </div>
        </div>

      </form>
    </main>
  );
}