import { PaymentType, PRStatus } from '@prisma/client';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface MonthlyReportItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface MonthlyReportRow {
  poNumber: string;
  transactionDate: string;
  purchaseRequestId: string;
  departmentCode: string;
  departmentName: string;
  itemSummary: string;
  lineItemCount: number;
  totalQuantity: number;
  totalAmount: number;
  paymentType: string;
  financialStatus: string;
  workflowStatus: string;
  receivingStatus: string;
  receivedDate: string;
  preparedBy: string;
  justification: string;
}

export function getManilaMonthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - MANILA_OFFSET_MS),
    end: new Date(Date.UTC(year, monthNumber, 1) - MANILA_OFFSET_MS),
  };
}

export function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

export function formatManilaDate(value: Date | string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

export function normalizeReportItems(payload: unknown): MonthlyReportItem[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const itemName = typeof item.itemName === 'string' ? item.itemName.trim() : '';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (!itemName || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{
      itemName,
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
    }];
  });
}

export function describePaymentType(paymentType: PaymentType) {
  return paymentType === PaymentType.CREDIT_TERMS ? 'Credit / Charge Terms' : 'Cash / Check';
}

export function describeFinancialStatus(paymentType: PaymentType, isCheckIssued: boolean) {
  if (paymentType === PaymentType.CREDIT_TERMS) return 'Credit Terms Cleared';
  return isCheckIssued ? 'Check Issued' : 'Awaiting Check Issuance';
}

export function describeWorkflowStatus(status: PRStatus) {
  return status.replaceAll('_', ' ');
}

function protectSpreadsheetCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number) {
  const safeValue = protectSpreadsheetCell(String(value));
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function buildMonthlyReportCsv(
  monthLabel: string,
  exportedAt: string,
  exportedBy: string,
  rows: MonthlyReportRow[],
) {
  const headers = [
    'Report Month',
    'PO Number',
    'Transaction Date (PHT)',
    'Purchase Request ID',
    'Department Code',
    'Department Name',
    'Items',
    'Line Item Count',
    'Total Quantity',
    'Total Amount (PHP)',
    'Payment Method',
    'Financial Status',
    'Workflow Status',
    'Receiving Status',
    'Received Date (PHT)',
    'Prepared By',
    'Justification',
    'Exported At (PHT)',
    'Exported By',
  ];

  const lines = rows.map((row) => [
    monthLabel,
    row.poNumber,
    row.transactionDate,
    row.purchaseRequestId,
    row.departmentCode,
    row.departmentName,
    row.itemSummary,
    row.lineItemCount,
    row.totalQuantity,
    row.totalAmount.toFixed(2),
    row.paymentType,
    row.financialStatus,
    row.workflowStatus,
    row.receivingStatus,
    row.receivedDate,
    row.preparedBy,
    row.justification,
    exportedAt,
    exportedBy,
  ].map(csvCell).join(','));

  return `\uFEFF${[headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}
