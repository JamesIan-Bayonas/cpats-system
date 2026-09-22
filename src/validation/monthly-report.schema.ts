import { z } from 'zod';

export const MonthlyReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use the YYYY-MM format.'),
  format: z.enum(['json', 'csv']).default('json'),
});

export type MonthlyReportQueryInput = z.infer<typeof MonthlyReportQuerySchema>;
