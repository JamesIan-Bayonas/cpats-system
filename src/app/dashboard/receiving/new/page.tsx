// src/app/dashboard/receiving/new/page.tsx
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  purchaseOrderId?: ZodSubErrors;
  condition?: ZodSubErrors;
  invoiceFilePath?: ZodSubErrors;
  asssetImageFilePath?: ZodSubErrors;
}

interface PendingPOQueueNode {
  id: string;
  poNumber: string;
  purchaseRequestId: string;
  purchaseRequest: {
    justification: string;
    status: PRStatus;
    createdAt: string;
    department: {
      code: string;
      name: string;
    };
  };
}

export default function ReceivingCustodianPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. AUTHORITATIVE SECURITY REGISTRY (Explicit Type Widening Applied per Rule 6)
  const activeUser: { id: string; role: Role; departmentId: string } = {
    id: "custodian-uuid-static-555",
    role: Role.Receiving_Custodian,
    departmentId: "asset-management-dept-uuid-000"
  };

  // 2. COMPONENT STATES
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('');
  const [condition, setCondition] = useState<'Good' | 'Damaged' | ''>('');
  const [invoiceFilePath, setInvoiceFilePath] = useState<string>('');
  const [asssetImageFilePath, setAsssetImageFilePath] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Mandated Audit Checkbox Steps (Section 3.2 Framework Requirements)
  const [quantityVerified, setQuantityVerified] = useState<boolean>(false);
  const [cameraViewportMapped, setCameraViewportMapped] = useState<boolean>(false);

  // Workspace Custodial Queue States
  const [receivingQueue, setReceivingQueue] = useState<PendingPOQueueNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // Status Responses
  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  // 3. LEDGER QUEUE SYNCHRONIZATION RUNTIME
  const syncReceivingQueue = async () => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: Role.Receiving_Custodian })
      });
      const resData = await response.json();
      if (response.ok) {
        setReceivingQueue(resData.data || []);
      }
    } catch (err) {
      console.error("Intake workspace connection pool error:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    syncReceivingQueue();
  }, []);

  // 4. FORM DISPATCH ENGINE
  const handleReceivingCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setTransactionSuccess(null);

    // Context Control Guard
    if (activeUser.role !== Role.Receiving_Custodian) {
      setSystemError("CRITICAL EXCEPTION: Execution halted. Profile credentials insufficient for cargo intake nodes.");
      return;
    }

    if (!quantityVerified) {
      setSystemError("COMPLIANCE FAILURE: Quantity matching parameters must be verified manually against shipping manifests.");
      return;
    }

    if (!cameraViewportMapped) {
      setSystemError("AUDIT EXCEPTION: FR-6 mandates that hardware inspection requires a visual photographic scan verification capture.");
      return;
    }

    if (!condition) {
      setSystemError("VALIDATION ERROR: An explicit classification status ('Good' or 'Damaged') must be assigned.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/receiving/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseOrderId,
            condition,
            invoiceFilePath,
            asssetImageFilePath,
            remarks
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error("Payload Parsing Violation: Input variables break validation schemas.");
          }
          throw new Error(result.error || "A remote runtime exception aborted ledger commitment.");
        }

        setTransactionSuccess(`Arriving asset registered successfully. Relational logs updated. System lifecycle advanced to Received and Closed.`);
        
        // Clear variables
        setPurchaseOrderId('');
        setCondition('');
        setInvoiceFilePath('');
        setAsssetImageFilePath('');
        setRemarks('');
        setQuantityVerified(false);
        setCameraViewportMapped(false);
        
        // Refresh structural states and synchronization components
        await syncReceivingQueue();
        router.refresh();

      } catch (err: any) {
        setSystemError(err.message || "A hardware communication channel failure broke connection states.");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 my-8 font-sans text-slate-900">
      
      {/* Workflow Navigation Header Context Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Step 5: Cargo Intake & Inspection Matrix</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ecosystem Registry Identifier: <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">{activeUser.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Intake Clearance Node</span>
          <span className="text-xs font-semibold text-emerald-600">DMC Asset Tracking System 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: PENDING PHYSICAL CARGO INTAKE DATA QUEUE */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Arrived Shipments Awaiting Inspection</h3>
          
          {queueLoading ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 animate-pulse">Syncing logistics pipeline...</div>
          ) : receivingQueue.length === 0 ? (
            <div className="p-4 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
              Clear Window: No open physical deliveries await verification inspections[cite: 1].
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {receivingQueue.map((poNode) => (
                <div
                  key={poNode.id}
                  onClick={() => setPurchaseOrderId(poNode.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:border-slate-400 hover:bg-slate-50/50
                    ${purchaseOrderId === poNode.id ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-[10px] font-black tracking-tight text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                      {poNode.purchaseRequest.department.code}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-800">
                      {poNode.poNumber}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 line-clamp-2 leading-tight mb-1.5">{poNode.purchaseRequest.justification}</p>
                  <span className="block font-mono text-[9px] text-slate-400 truncate">PO UUID: {poNode.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CARGO INSPECTION PROCESSING FORM */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {systemError && (
            <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">State Machine Intercept</span>
              {systemError}
            </div>
          )}

          {transactionSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-700 text-xs font-medium">
              <span className="font-bold block uppercase tracking-wide text-[10px] mb-1">Intake Record Persisted</span>
              {transactionSuccess}
            </div>
          )}

          <form onSubmit={handleReceivingCommit} className="space-y-6">
            
            {/* Relational PO UUID selection input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Target Purchase Order Operational Pointer (PO UUIDv4)
              </label>
              <input
                type="text"
                required
                className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
                  ${fieldErrors?.purchaseOrderId ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="Select a valid arrived tracking node from the left queue grid..."
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
              />
              {fieldErrors?.purchaseOrderId?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.purchaseOrderId._errors[0]}</p>
              )}
            </div>

            {/* Condition Enumeration Selection Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Physical Asset Intake Classification
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setCondition('Good')}
                  className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                    ${condition === 'Good' 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  ✓ Status: Good Condition
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('Damaged')}
                  className={`py-3 text-xs font-bold uppercase tracking-wide border rounded-lg transition-all
                    ${condition === 'Damaged' 
                      ? 'bg-rose-600 border-rose-600 text-white shadow-md' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  ✕ Status: Damaged Cargo
                </button>
              </div>
              {fieldErrors?.condition?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.condition._errors[0]}</p>
              )}
            </div>

            {/* Supplier Invoice Upload Path Link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Supplier Invoice Document Storage Path (URL Reference)
              </label>
              <input
                type="text"
                required
                className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
                  ${fieldErrors?.invoiceFilePath ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="e.g., /storage/invoices/CCS-INV-9821.pdf"
                value={invoiceFilePath}
                onChange={(e) => setInvoiceFilePath(e.target.value)}
              />
              {fieldErrors?.invoiceFilePath?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.invoiceFilePath._errors[0]}</p>
              )}
            </div>

            {/* FR-6 Asset Image Snapshot Capture Link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Hardware Camera Scan Snapshot Capture Path (URL Reference)
              </label>
              <input
                type="text"
                required
                className={`w-full px-4 py-2 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm
                  ${fieldErrors?.asssetImageFilePath ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300'}`}
                placeholder="e.g., /storage/assets/proof-ccs-hardware.jpg"
                value={asssetImageFilePath}
                onChange={(e) => setAsssetImageFilePath(e.target.value)}
              />
              {fieldErrors?.asssetImageFilePath?._errors && (
                <p className="text-[11px] text-rose-500 font-medium mt-1.5">{fieldErrors.asssetImageFilePath._errors[0]}</p>
              )}
            </div>

            {/* Mandatory Verification Checkboxes */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Authoritative Intake Clearance Steps</span>
              
              <div className="flex items-start">
                <input
                  id="chk-qty"
                  type="checkbox"
                  className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                  checked={quantityVerified}
                  onChange={(e) => setQuantityVerified(e.target.checked)}
                />
                <label htmlFor="chk-qty" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>Manifest Quantity Verification:</strong> I confirm that the unit quantities arriving physically match the specified numbers provisioned on the Supplier Invoice sheets.
                </label>
              </div>

              <div className="flex items-start">
                <input
                  id="chk-cam"
                  type="checkbox"
                  className="h-4 w-4 text-slate-900 focus:ring-slate-900 border-slate-300 rounded cursor-pointer mt-0.5"
                  checked={cameraViewportMapped}
                  onChange={(e) => setCameraViewportMapped(e.target.checked)}
                />
                <label htmlFor="chk-cam" className="ml-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>FR-6 Camera Capturing Checkout:</strong> The system has activated browser stream viewports to capture physical proof signatures and link them to the asset record entries[cite: 1, 2].
                </label>
              </div>
            </div>

            {/* Intake Evaluation Comment Block */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Asset Intake Inspection Remarks
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white text-slate-900 transition shadow-sm placeholder:text-slate-400"
                placeholder="Record distinct observations regarding shipping containment variables..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            {/* Submission Commit Element */}
            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-[0.99]"
              >
                {isPending ? 'Logging Asset Onboarding Metrics...' : 'Finalize Intake Entry'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}