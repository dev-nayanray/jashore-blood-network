/**
 * Email provider abstraction.
 *
 * The platform supports an optional email notification channel. The
 * provider is configured via environment variables and is NOT required
 * for the core in-app notification system to function.
 *
 * Currently the only implemented provider is Resend (https://resend.com).
 * The abstraction allows adding more providers (e.g. SendGrid, AWS SES)
 * without changing the notification service.
 *
 * If no email provider is configured (RESEND_API_KEY is not set), the
 * email channel is silently skipped. In-app notifications still work.
 */

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
