import nodemailer from 'nodemailer';

export type EmailDeliveryMode = 'log' | 'smtp' | 'off';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export function getEmailDeliveryMode(): EmailDeliveryMode {
  const configured = process.env.EMAIL_DELIVERY_MODE?.toLowerCase();
  if (configured === 'smtp' || configured === 'off' || configured === 'log') return configured;
  return process.env.NODE_ENV === 'production' ? 'off' : 'log';
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const mode = getEmailDeliveryMode();
  if (mode === 'off') throw new Error('Email delivery is disabled.');

  if (mode === 'log') {
    console.info('[CPATS EMAIL - DEVELOPMENT]', message);
    return;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !password || !from) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required in SMTP mode.');
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transport.sendMail({ from, ...message });
}
