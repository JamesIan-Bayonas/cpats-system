'use client';

import { useEffect, useMemo, useState } from 'react';
import { PaymentType, PRStatus, Role } from '@prisma/client';
import { ErrorBanner, PageShell, StageHeader } from '@/components/ui/WorkflowUI';

interface ItemNode {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface AuditLogNode {
  id: string;
  previousState: PRStatus | null;
  newState: PRStatus;
  remarks: string | null;
  createdAt: string;
  actor: { email: string; role: Role };
}

interface PurchaseOrderNode {
  id: string;
  poNumber: string;
  paymentType: PaymentType;
  isCheckIssued: boolean;
  createdAt: string;
  receivingReports: Array<{
    condition: 'Good' | 'Damaged';
    remarks: string | null;
    createdAt: string;
  }>;
}

interface TrackingNode {
  id: string;
  justification: string;
  itemsPayload: unknown;
  status: PRStatus;
  isDirectPoBypass: boolean;
  createdAt: string;
  updatedAt: string;
  department: { code: string; name: string };
  purchaseOrders: PurchaseOrderNode[];
  auditLogs: AuditLogNode[];
}

const STAGES = [
  { label: 'PO Prep', description: 'Official PO preparation' },
  { label: 'Finance', description: 'Payment clearance' },
  { label: 'Purchase', description: 'Cleared for fulfillment' },
  { label: 'Received', description: 'Custodian intake' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All purchasing stages' },
  { value: PRStatus.Approved_Awaiting_PO, label: 'PO preparation' },
  { value: PRStatus.Awaiting_Check_Issuance, label: 'Finance clearance' },
  { value: PRStatus.Ready_for_Purchase, label: 'Purchase / fulfillment' },
  { value: PRStatus.Received_and_Closed, label: 'Received and closed' },
] as const;

function stageIndex(status: PRStatus) {
  switch (status) {
    case PRStatus.Approved_Awaiting_PO: return 0;
    case PRStatus.Awaiting_Check_Issuance: return 1;
    case PRStatus.Ready_for_Purchase: return 2;
    case PRStatus.Received_and_Closed: return 3;
    default: return 0;
  }
}

function statusPresentation(status: PRStatus) {
  switch (status) {
    case PRStatus.Approved_Awaiting_PO:
      return { label: 'PO Preparation', className: 'border-indigo-200 bg-indigo-50 text-indigo-800' };
    case PRStatus.Awaiting_Check_Issuance:
      return { label: 'Finance Clearance', className: 'border-blue-200 bg-blue-50 text-blue-800' };
    case PRStatus.Ready_for_Purchase:
      return { label: 'Ready for Purchase', className: 'border-amber-200 bg-amber-50 text-amber-800' };
    case PRStatus.Received_and_Closed:
      return { label: 'Received & Closed', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
    default:
      return { label: status.replaceAll('_', ' '), className: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
}

function normalizeItems(payload: unknown): ItemNode[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const itemName = typeof item.itemName === 'string' ? item.itemName : '';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!itemName || !Number.isFinite(quantity)) return [];
    return [{
      itemName,
      quantity,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    }];
  });
}

function summarizeItems(items: ItemNode[]) {
  if (items.length === 0) return 'Purchase requisition';
  const first = `${items[0].itemName} (x${items[0].quantity})`;
  return items.length === 1 ? first : `${first} +${items.length - 1} more item${items.length > 2 ? 's' : ''}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
}

async function fetchTrackingRecords(signal?: AbortSignal): Promise<TrackingNode[]> {
  const response = await fetch('/api/po/tracking', { cache: 'no-store', signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The tracking register could not be loaded.');
  return result.data || [];
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" strokeLinecap="round" /></svg>;
}

function RefreshIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4"><path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.1 9a7 7 0 0 1 11.5-2L20 9M4 15l2.4 2a7 7 0 0 0 11.5-2" strokeLinecap="round" /></svg>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}><path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="m5 12.5 4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PurchasingProgress({ status }: { status: PRStatus }) {
  const activeIndex = stageIndex(status);
  const closed = status === PRStatus.Received_and_Closed;

  return (
    <nav aria-label="Purchasing transaction progress" className="relative pt-1">
      <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[17px] h-0.5 bg-slate-200" />
      <div
        aria-hidden="true"
        className="absolute left-[12.5%] top-[17px] h-0.5 bg-emerald-700 transition-all"
        style={{ width: `${closed ? 75 : (activeIndex / 3) * 75}%` }}
      />
      <ol className="relative grid grid-cols-4 gap-1">
        {STAGES.map((stage, index) => {
          const complete = closed || index < activeIndex;
          const current = !closed && index === activeIndex;
          return (
            <li key={stage.label} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-col items-center text-center">
              <span className={`z-10 flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                complete
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : current
                    ? 'border-emerald-700 bg-white text-emerald-800 ring-4 ring-emerald-100'
                    : 'border-slate-200 bg-white text-slate-300'
              }`}>
                {complete ? <CheckIcon /> : index + 1}
              </span>
              <span className={`mt-2 text-[10px] font-bold sm:text-[11px] ${complete || current ? 'text-slate-800' : 'text-slate-400'}`}>
                {stage.label}
              </span>
              <span className="mt-0.5 hidden text-[9px] leading-3 text-slate-400 sm:block">{stage.description}</span>
              <span className="sr-only">{complete ? 'Completed' : current ? 'Current stage' : 'Upcoming'}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TrackingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading tracking records" role="status">
      {[0, 1, 2].map((key) => (
        <div key={key} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-48 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-72 max-w-full rounded bg-slate-100" />
          <div className="mt-6 h-14 rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

export default function PurchasingTrackingPage() {
  const [records, setRecords] = useState<TrackingNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchTrackingRecords(controller.signal)
      .then(setRecords)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'The tracking register could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await fetchTrackingRecords());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'The tracking register could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== 'ALL' && record.status !== statusFilter) return false;
      if (!query) return true;
      const items = normalizeItems(record.itemsPayload);
      const searchable = [
        record.id,
        record.department.code,
        record.department.name,
        record.justification,
        ...record.purchaseOrders.map((po) => po.poNumber),
        ...items.map((item) => item.itemName),
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [records, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    total: records.length,
    active: records.filter((record) => record.status !== PRStatus.Received_and_Closed).length,
    finance: records.filter((record) => record.status === PRStatus.Awaiting_Check_Issuance).length,
    received: records.filter((record) => record.status === PRStatus.Received_and_Closed).length,
  }), [records]);

  return (
    <PageShell>
      <StageHeader
        eyebrow="Purchasing Office · Read-only transaction visibility"
        title="Track Purchasing Requests"
        description="Follow every request that has reached Purchasing—from official PO preparation through finance clearance, purchase readiness, and final receipt."
        meta={{ label: 'Visible scope', value: `${counts.total} purchasing record${counts.total === 1 ? '' : 's'}` }}
      />

      {error && <div className="mb-4"><ErrorBanner>{error}</ErrorBanner></div>}

      <section aria-label="Tracking summary" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Records', value: counts.total, tone: 'text-slate-900' },
          { label: 'In Progress', value: counts.active, tone: 'text-indigo-700' },
          { label: 'At Finance', value: counts.finance, tone: 'text-blue-700' },
          { label: 'Received', value: counts.received, tone: 'text-emerald-700' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
            <p className={`mt-1 font-mono text-xl font-bold ${metric.tone}`}>{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Tracking filters">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search PO, request ID, department, or item…"
              aria-label="Search purchasing tracking records"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 [&+svg]:pointer-events-none"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by purchasing stage"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          >
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshIcon />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      {loading && records.length === 0 ? (
        <TrackingSkeleton />
      ) : error && records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rose-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-bold text-slate-700">Tracking records are temporarily unavailable.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">Use Refresh to try loading the authoritative register again.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-bold text-slate-700">{records.length === 0 ? 'No requests have reached Purchasing yet.' : 'No records match these filters.'}</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
            {records.length === 0 ? 'Approved requests will appear here as soon as they enter the PO preparation stage.' : 'Try a different search term or select all purchasing stages.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4" aria-live="polite">
          <p className="text-[10px] font-semibold text-slate-400">Showing {filteredRecords.length} of {records.length} records</p>
          {filteredRecords.map((record) => {
            const items = normalizeItems(record.itemsPayload);
            const po = record.purchaseOrders[0];
            const receipt = po?.receivingReports[0];
            const presentation = statusPresentation(record.status);
            const expanded = expandedId === record.id;
            const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            return (
              <article key={record.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={`h-1 ${record.status === PRStatus.Received_and_Closed ? 'bg-emerald-600' : 'bg-indigo-600'}`} />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-indigo-700">{po?.poNumber || 'PO not yet assigned'}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${presentation.className}`}>{presentation.label}</span>
                      </div>
                      <h2 className="mt-2 text-sm font-bold leading-5 text-slate-900">{summarizeItems(items)}</h2>
                      <p className="mt-1 text-[11px] text-slate-500">{record.department.code} · {record.department.name}</p>
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Last updated</p>
                      <time className="mt-1 block font-mono text-[10px] text-slate-600">{formatDate(record.updatedAt)}</time>
                    </div>
                  </div>

                  <div className="py-5"><PurchasingProgress status={record.status} /></div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-slate-500">
                      <span><strong className="text-slate-700">{items.reduce((sum, item) => sum + item.quantity, 0)}</strong> total units</span>
                      <span><strong className="text-slate-700">{total > 0 ? formatPeso(total) : 'Not recorded'}</strong> billed value</span>
                      <span><strong className="text-slate-700">{receipt ? `Received — ${receipt.condition}` : 'Awaiting intake'}</strong></span>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`tracking-detail-${record.id}`}
                      onClick={() => setExpandedId(expanded ? null : record.id)}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      {expanded ? 'Hide details' : 'View full details'}
                      <ChevronIcon open={expanded} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div id={`tracking-detail-${record.id}`} className="border-t border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Transaction details</h3>
                          <dl className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                            <div><dt className="text-[9px] font-bold uppercase text-slate-400">Request reference</dt><dd className="mt-1 break-all font-mono text-[10px] text-slate-700">{record.id}</dd></div>
                            <div><dt className="text-[9px] font-bold uppercase text-slate-400">PO created</dt><dd className="mt-1 text-xs font-semibold text-slate-700">{po ? formatDate(po.createdAt) : 'Pending preparation'}</dd></div>
                            <div><dt className="text-[9px] font-bold uppercase text-slate-400">Payment method</dt><dd className="mt-1 text-xs font-semibold text-slate-700">{po?.paymentType === PaymentType.CREDIT_TERMS ? 'Credit / Charge Terms' : po ? 'Cash / Check' : 'Not assigned'}</dd></div>
                            <div><dt className="text-[9px] font-bold uppercase text-slate-400">Finance clearance</dt><dd className="mt-1 text-xs font-semibold text-slate-700">{po?.isCheckIssued ? 'Cleared' : 'Pending'}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-[9px] font-bold uppercase text-slate-400">Justification</dt><dd className="mt-1 text-xs leading-5 text-slate-600">{record.justification}</dd></div>
                          </dl>
                        </div>

                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Item breakdown</h3>
                          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full min-w-[520px] text-left text-xs">
                              <thead><tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase text-slate-400"><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Unit price</th><th className="px-4 py-2.5 text-right">Subtotal</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                {items.length === 0 ? <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-400">No structured item data recorded.</td></tr> : items.map((item, index) => (
                                  <tr key={`${item.itemName}-${index}`}><td className="px-4 py-3 font-semibold text-slate-700">{item.itemName}</td><td className="px-4 py-3 text-right font-mono">{item.quantity}</td><td className="px-4 py-3 text-right font-mono">{item.unitPrice > 0 ? formatPeso(item.unitPrice) : '—'}</td><td className="px-4 py-3 text-right font-mono font-semibold">{item.unitPrice > 0 ? formatPeso(item.quantity * item.unitPrice) : '—'}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Purchasing-stage history</h3>
                        {record.auditLogs.length === 0 ? (
                          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400">No purchasing-stage audit entries are recorded yet.</p>
                        ) : (
                          <ol className="relative mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
                            {record.auditLogs.map((log) => {
                              const logStatus = statusPresentation(log.newState);
                              return (
                                <li key={log.id} className="relative rounded-xl border border-slate-200 bg-white p-3">
                                  <span aria-hidden="true" className="absolute -left-[21px] top-4 size-2.5 rounded-full border-2 border-white bg-emerald-700" />
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${logStatus.className}`}>{logStatus.label}</span>
                                    <time className="font-mono text-[9px] text-slate-400">{formatDate(log.createdAt)}</time>
                                  </div>
                                  {log.remarks && <p className="mt-2 text-[10px] leading-4 text-slate-600">{log.remarks}</p>}
                                  <p className="mt-2 break-all text-[9px] text-slate-400">{log.actor.role.replaceAll('_', ' ')} · {log.actor.email}</p>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
