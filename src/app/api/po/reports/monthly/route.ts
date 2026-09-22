import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { MonthlyReportQuerySchema } from '@/validation/monthly-report.schema';
import {
  buildMonthlyReportCsv,
  describeFinancialStatus,
  describePaymentType,
  describeWorkflowStatus,
  formatManilaDate,
  getManilaMonthRange,
  getMonthLabel,
  normalizeReportItems,
  type MonthlyReportRow,
} from '@/shared/monthly-report';

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Purchasing_Office);
    if (!auth.success) return auth.response;

    const validation = MonthlyReportQuerySchema.safeParse({
      month: request.nextUrl.searchParams.get('month'),
      format: request.nextUrl.searchParams.get('format') || 'json',
    });

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Select a valid report month.', errors: validation.error.format() },
        { status: 422 },
      );
    }

    const { month, format } = validation.data;
    const { start, end } = getManilaMonthRange(month);
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            justification: true,
            itemsPayload: true,
            status: true,
            department: { select: { code: true, name: true } },
            auditLogs: {
              where: { newState: PRStatus.Awaiting_Check_Issuance },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { actor: { select: { email: true } } },
            },
          },
        },
        receivingReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { condition: true, createdAt: true },
        },
      },
    });

    const rows: MonthlyReportRow[] = purchaseOrders.map((po) => {
      const items = normalizeReportItems(po.purchaseRequest.itemsPayload);
      const receipt = po.receivingReports[0];
      return {
        poNumber: po.poNumber,
        transactionDate: formatManilaDate(po.createdAt),
        purchaseRequestId: po.purchaseRequest.id,
        departmentCode: po.purchaseRequest.department.code,
        departmentName: po.purchaseRequest.department.name,
        itemSummary: items.map((item) => `${item.itemName} (x${item.quantity})`).join(' | '),
        lineItemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        paymentType: describePaymentType(po.paymentType),
        financialStatus: describeFinancialStatus(po.paymentType, po.isCheckIssued),
        workflowStatus: describeWorkflowStatus(po.purchaseRequest.status),
        receivingStatus: receipt ? `Received - ${receipt.condition}` : 'Pending Receipt',
        receivedDate: formatManilaDate(receipt?.createdAt || null),
        preparedBy: po.purchaseRequest.auditLogs[0]?.actor.email || 'Not recorded',
        justification: po.purchaseRequest.justification,
      };
    });

    const monthLabel = getMonthLabel(month);
    const exportedAt = formatManilaDate(new Date());
    const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const totalQuantity = rows.reduce((sum, row) => sum + row.totalQuantity, 0);
    const receivedCount = rows.filter((row) => row.receivingStatus.startsWith('Received')).length;

    if (format === 'csv') {
      const csv = buildMonthlyReportCsv(monthLabel, exportedAt, auth.user.email, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="purchasing-monthly-report-${month}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        month,
        monthLabel,
        generatedAt: exportedAt,
        summary: { transactionCount: rows.length, totalQuantity, totalAmount, receivedCount },
        rows,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    console.error('PURCHASING MONTHLY REPORT FAILURE:', error);
    return NextResponse.json(
      { success: false, error: 'The monthly purchasing report could not be generated.' },
      { status: 500 },
    );
  }
}
