'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Role, PRStatus } from '@prisma/client';
import { AuthUser } from '@/shared/session';
import {
  PageShell,
  StageHeader,
  Card,
  ErrorBanner,
  SuccessBanner,
  FieldLabel,
  FieldError,
  inputClass,
  CheckItem,
  ReviewWorkspace,
  ActionButton,
  QueueTask,
  deriveItemSummaryTitle,
} from '@/components/ui/WorkflowUI';

interface ZodSubErrors {
  _errors?: string[];
}

interface ZodFormErrors {
  purchaseOrderId?: ZodSubErrors;
  condition?: ZodSubErrors;
  invoiceFilePath?: ZodSubErrors;
  asssetImageFilePath?: ZodSubErrors;
  remarks?: ZodSubErrors;
}

interface PendingPOQueueNode {
  id: string;
  poNumber: string;
  qrCodeToken?: string;
  purchaseRequestId: string;
  purchaseRequest: {
    justification: string;
    itemsPayload?: any;
    status: PRStatus;
    createdAt: string;
    department: { code: string; name: string };
  };
}

export default function ReceivingCustodianPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  // Form State
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>('');
  const [condition, setCondition] = useState<'Good' | 'Damaged' | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  // Clean Upload States (No raw URLs exposed)
  const [invoiceFilePath, setInvoiceFilePath] = useState<string>('');
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  
  const [asssetImageFilePath, setAsssetImageFilePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Clearances
  const [quantityVerified, setQuantityVerified] = useState<boolean>(false);
  const [cameraViewportMapped, setCameraViewportMapped] = useState<boolean>(false);

  // Queues
  const [receivingQueue, setReceivingQueue] = useState<PendingPOQueueNode[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(true);

  // WebRTC Live QR Scanner Modal State
  const [showQrDecoderModal, setShowQrDecoderModal] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [scannedQrInput, setScannedQrInput] = useState<string>('');
  const [qrScanStatus, setQrScanStatus] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [systemError, setSystemError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ZodFormErrors | null>(null);
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setActiveUser(res.data);
          syncReceivingQueue(res.data.role);
        }
      })
      .catch(() => setSystemError('Failed to load session context. Please refresh.'))
      .finally(() => setUserLoading(false));

    return () => {
      stopCameraStream();
    };
  }, []);

  const syncReceivingQueue = async (userRole: Role) => {
    try {
      const response = await fetch('/api/pr/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userRole }),
      });
      const resData = await response.json();
      if (response.ok) {
        setReceivingQueue(resData.data || []);
      }
    } catch (err) {
      console.error('Intake queue sync error:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const stopCameraStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCameraStream = async () => {
    setQrScanStatus(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC Camera stream API is not supported on this browser context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        initBarcodeFrameScanner();
      }
    } catch (err: any) {
      console.warn('Native camera stream unavailable:', err);
      setQrScanStatus('Camera stream unavailable. Please use manual token entry or a USB hardware scanner.');
      setIsCameraActive(false);
    }
  };

  const initBarcodeFrameScanner = () => {
    if (!('BarcodeDetector' in window)) return;

    try {
      // @ts-ignore - Native Web API
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'data_matrix'] });

      const scanFrame = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const detectedCodes = await barcodeDetector.detect(videoRef.current);
            if (detectedCodes && detectedCodes.length > 0) {
              const rawToken = detectedCodes[0].rawValue;
              if (rawToken) {
                matchAndSelectPO(rawToken);
                return;
              }
            }
          } catch {
            // Frame analysis skip
          }
        }
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      };
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (e) {
      console.warn('BarcodeDetector initialization error:', e);
    }
  };

  const matchAndSelectPO = (tokenQuery: string) => {
    const cleanQuery = tokenQuery.trim();
    const matchedPO = receivingQueue.find(
      (po) =>
        po.qrCodeToken === cleanQuery ||
        po.poNumber === cleanQuery ||
        po.id === cleanQuery
    );

    if (matchedPO) {
      setPurchaseOrderId(matchedPO.id);
      setQrScanStatus(null);
      stopCameraStream();
      setShowQrDecoderModal(false);
      setScannedQrInput('');
      setTransactionSuccess(`QR Tag matched cleanly to Purchase Order [${matchedPO.poNumber}]. Workspace auto-populated.`);
    } else {
      setQrScanStatus(`Discrepancy: Token [${cleanQuery.substring(0, 16)}...] does not match any shipment in active queue.`);
    }
  };

  const handleManualQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedQrInput.trim()) {
      setQrScanStatus('Please provide a valid PO QR Token code.');
      return;
    }
    matchAndSelectPO(scannedQrInput);
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInvoiceFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok && result.url) {
        setInvoiceFilePath(result.url);
      } else {
        setSystemError(result.error || 'Failed to upload invoice.');
      }
    } catch (err) {
      setSystemError('A network error interrupted the invoice upload.');
    }
  };

  const handleHardwarePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreviewUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok && result.url) {
        setAsssetImageFilePath(result.url);
        setCameraViewportMapped(true); // Auto-check the clearance box
      } else {
        setSystemError(result.error || 'Failed to upload hardware photo.');
      }
    } catch (err) {
      setSystemError('A network error interrupted the hardware photo upload.');
    }
  };

  const handleReceivingCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null);
    setFieldErrors(null);
    setTransactionSuccess(null);

    if (!activeUser || activeUser.role !== Role.Receiving_Custodian) {
      setSystemError('Access denied. Profile credentials insufficient for cargo intake.');
      return;
    }

    if (!quantityVerified || !cameraViewportMapped) {
      setSystemError('Please confirm manifest quantity verification and visual inspection before finalizing.');
      return;
    }

    if (!condition) {
      setSystemError('Please select an asset condition status (Good or Damaged).');
      return;
    }

    if (!invoiceFilePath) {
      setSystemError('COMPLIANCE EXCEPTION: You must upload a scan or photo of the supplier invoice.');
      return;
    }

    // Dynamic Remarks Verification
    const finalRemarks = condition === 'Good' 
      ? 'Asset received in good condition. Quantities match supplier manifest.' 
      : remarks;

    if (condition === 'Damaged' && finalRemarks.trim().length < 5) {
      setSystemError('COMPLIANCE EXCEPTION: You must detail the damage in the inspection remarks (min 5 characters).');
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
            remarks: finalRemarks,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 422 && result.errors) {
            setFieldErrors(result.errors);
            throw new Error('Please review highlighted fields below.');
          }
          throw new Error(result.error || 'A remote exception occurred while recording intake.');
        }

        setTransactionSuccess('Cargo intake report generated successfully and hardware photo record bound.');

        setPurchaseOrderId('');
        setCondition('');
        setInvoiceFilePath('');
        setInvoiceFileName(null);
        setAsssetImageFilePath('');
        setImagePreviewUrl(null);
        setRemarks('');
        setQuantityVerified(false);
        setCameraViewportMapped(false);

        await syncReceivingQueue(activeUser.role);
        router.refresh();
      } catch (err: any) {
        setSystemError(err.message || 'Something went wrong. Please try again.');
      }
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500 font-sans">
        Loading session context…
      </div>
    );
  }

  if (!activeUser || activeUser.role !== Role.Receiving_Custodian) {
    return (
      <Card className="max-w-md w-full text-center mx-auto my-12">
        <h2 className="text-rose-700 font-bold text-sm">Access Restricted</h2>
        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
          Your account is not authorized for cargo receiving inspections. Available to Receiving Custodians only.
        </p>
      </Card>
    );
  }

  const queueTasks: QueueTask[] = receivingQueue.map((poNode) => ({
    id: poNode.id,
    title: deriveItemSummaryTitle(poNode.purchaseRequest.itemsPayload, poNode.purchaseRequest.justification),
    subtitle: poNode.poNumber,
    dateLabel: new Date(poNode.purchaseRequest.createdAt).toLocaleDateString(),
    justificationPreview: poNode.purchaseRequest.justification,
  }));

  const selectedPONode = receivingQueue.find((po) => po.id === purchaseOrderId);

  return (
    <PageShell>
      <StageHeader
        eyebrow="Step 5 of 6 · Cargo Intake & Photo Inspection"
        title="Cargo Intake & Physical Photo Inspection Terminal"
        description="Inspect arriving shipments, scan asset QR tags via WebRTC or hardware scanners, capture physical hardware photos, and record compliance intake reports."
        meta={{ label: 'Signed in as', value: activeUser.email }}
      />

      {systemError && <ErrorBanner>{systemError}</ErrorBanner>}
      {transactionSuccess && <SuccessBanner>{transactionSuccess}</SuccessBanner>}

      <ReviewWorkspace
        queueTitle="Arrived Shipments Awaiting Inspection"
        tasks={queueTasks}
        loading={queueLoading}
        emptyMessage="No open physical deliveries are waiting for inspection."
        selectedId={purchaseOrderId}
        onSelect={setPurchaseOrderId}
      >
        <form onSubmit={handleReceivingCommit} className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shipment Identification</span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {selectedPONode ? `PO: ${selectedPONode.poNumber} (${selectedPONode.purchaseRequest.department.code})` : 'No Shipment Selected'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowQrDecoderModal(true);
                startCameraStream();
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <span>🔳 Open WebRTC QR Scanner</span>
            </button>
          </div>

          <div>
            <FieldLabel>Target Purchase Order (UUID Reference)</FieldLabel>
            <input
              type="text"
              required
              readOnly
              className={`${inputClass(!!fieldErrors?.purchaseOrderId)} font-mono bg-slate-100 text-slate-600 cursor-not-allowed`}
              placeholder="Select a shipment from the queue or scan QR badge..."
              value={purchaseOrderId}
            />
            {fieldErrors?.purchaseOrderId?._errors && (
              <FieldError>{fieldErrors.purchaseOrderId._errors[0]}</FieldError>
            )}
          </div>

          {/* DUAL UPLOAD PANELS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. INVOICE UPLOAD (CLEAN UX) */}
            <div>
              <FieldLabel>Supplier Invoice Attachment</FieldLabel>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:border-emerald-600 transition h-[160px] flex flex-col justify-center">
                {invoiceFileName || invoiceFilePath ? (
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <span className="text-xl shrink-0">🧾</span>
                      <div className="truncate">
                        <span className="block text-xs font-bold text-emerald-900 truncate">
                          {invoiceFileName || 'Invoice Document Attached'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceFilePath('');
                        setInvoiceFileName(null);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 mt-2 px-2.5 py-1.5 rounded bg-white border border-rose-200 hover:bg-rose-50 transition shrink-0 cursor-pointer active:scale-95 text-center"
                    >
                      Remove Invoice
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleInvoiceUpload}
                      className="hidden"
                      id="invoice-file-input"
                    />
                    <label
                      htmlFor="invoice-file-input"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      <span>📁</span>
                      <span>Upload Invoice</span>
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Scan or photo of delivery receipt
                    </p>
                  </div>
                )}
              </div>
              {fieldErrors?.invoiceFilePath?._errors && (
                <FieldError>{fieldErrors.invoiceFilePath._errors[0]}</FieldError>
              )}
            </div>

            {/* 2. HARDWARE PHOTO UPLOAD */}
            <div>
              <FieldLabel>Physical Hardware Photographic Proof</FieldLabel>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 hover:border-emerald-600 transition h-[160px] flex flex-col justify-center">
                {imagePreviewUrl ? (
                  <div className="relative group h-full">
                    <img
                      src={imagePreviewUrl}
                      alt="Physical Hardware Intake"
                      className="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAsssetImageFilePath('');
                        setImagePreviewUrl(null);
                        setCameraViewportMapped(false);
                      }}
                      className="absolute inset-0 bg-slate-900/60 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      ✕ Remove Photo
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleHardwarePhotoSelect}
                      className="hidden"
                      id="hardware-photo-input"
                    />
                    <label
                      htmlFor="hardware-photo-input"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      <span>📷</span>
                      <span>Capture Photo</span>
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Proof of physical equipment condition
                    </p>
                  </div>
                )}
              </div>
              {fieldErrors?.asssetImageFilePath?._errors && (
                <FieldError>{fieldErrors.asssetImageFilePath._errors[0]}</FieldError>
              )}
            </div>

          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
              Inspection Clearances
            </span>
            <CheckItem
              id="chk-qty"
              checked={quantityVerified}
              onChange={setQuantityVerified}
              label="Manifest Quantity Verification"
              description="I confirm unit quantities arriving physically match the numbers on the supplier invoice."
            />
            <CheckItem
              id="chk-cam"
              checked={cameraViewportMapped}
              onChange={setCameraViewportMapped}
              label="Physical Photo Record Captured"
              description="Photographic proof of physical condition has been captured and linked to the asset record."
            />
          </div>

          <div>
            <FieldLabel>Asset Physical Condition</FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCondition('Good');
                  setRemarks('');
                }}
                className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition min-h-[44px] cursor-pointer active:scale-95 ${
                  condition === 'Good'
                    ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs font-bold'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ✓ Good Condition
              </button>
              <button
                type="button"
                onClick={() => setCondition('Damaged')}
                className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition min-h-[44px] cursor-pointer active:scale-95 ${
                  condition === 'Damaged'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs font-bold'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ✕ Damaged Cargo
              </button>
            </div>
            {fieldErrors?.condition?._errors && <FieldError>{fieldErrors.condition._errors[0]}</FieldError>}
          </div>

          {/* DYNAMIC DAMAGE REMARKS (Hidden unless damaged is selected) */}
          {condition === 'Damaged' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <FieldLabel>Damage Inspection Remarks</FieldLabel>
              <textarea
                required
                rows={3}
                className={inputClass(!!fieldErrors?.remarks)}
                placeholder="Detail the extent of the damage, missing components, or packaging compromises..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              {fieldErrors?.remarks?._errors && <FieldError>{fieldErrors.remarks._errors[0]}</FieldError>}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 flex justify-end">
            <ActionButton type="submit" disabled={isPending}>
              {isPending ? 'Saving Intake...' : 'Finalize Cargo Intake'}
            </ActionButton>
          </div>
        </form>
      </ReviewWorkspace>

      {/* Live WebRTC Camera & Hardware Scanner Decoder Modal */}
      {showQrDecoderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Live WebRTC &amp; Hardware Scanner Terminal
              </h3>
              <button
                onClick={() => {
                  stopCameraStream();
                  setShowQrDecoderModal(false);
                  setQrScanStatus(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Live Camera Feed Viewport */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video border border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-900/80 text-slate-400 text-xs">
                  <span>📷 Live Viewport Offline</span>
                  <span className="text-[10px] mt-1 text-slate-500">Camera stream stopped or permissions blocked</span>
                </div>
              )}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/40 rounded-xl flex items-center justify-center">
                  <div className="w-48 h-28 border-2 border-dashed border-emerald-400 rounded-lg animate-pulse" />
                </div>
              )}
            </div>

            {qrScanStatus && (
              <div className="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r text-rose-700 text-xs font-semibold">
                {qrScanStatus}
              </div>
            )}

            <form onSubmit={handleManualQrSubmit} className="space-y-3">
              <div>
                <FieldLabel>QR Cryptographic Token / PO Number</FieldLabel>
                <input
                  type="text"
                  autoFocus
                  className="w-full h-10 px-3 font-mono text-xs border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  placeholder="e.g. PO-TOKEN-XXXX-XXXX or PO-2026-8891"
                  value={scannedQrInput}
                  onChange={(e) => setScannedQrInput(e.target.value)}
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Unreceived Orders</span>
                <div className="flex flex-wrap gap-1 justify-center max-h-24 overflow-y-auto">
                  {receivingQueue.map((po) => (
                    <button
                      key={po.id}
                      type="button"
                      onClick={() => setScannedQrInput(po.qrCodeToken || po.poNumber)}
                      className="text-[9px] font-mono font-bold bg-white hover:bg-emerald-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                    >
                      {po.poNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setShowQrDecoderModal(false);
                  }}
                  className="px-3 py-2 text-slate-600 font-semibold text-xs rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Decode &amp; Select PO
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </PageShell>
  );
}