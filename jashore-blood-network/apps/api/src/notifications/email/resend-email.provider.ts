/**
 * Resend email provider.
 *
 * Uses the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email)
 * to send transactional emails. No SDK dependency — uses fetch directly
 * to keep the dependency tree small.
 *
 * Configuration:
 *   - RESEND_API_KEY: API key from Resend dashboard (server-only)
 *   - EMAIL_FROM: From address (e.g. noreply@jashore-blood-network.org)
 *
 * If RESEND_API_KEY is not set, the provider is not registered and email
 * notifications are silently skipped.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailMessage, EmailSendResult, EmailProvider } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider, OnModuleInit {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private apiKey: string | null = null;
  private apiUrl = 'https://api.resend.com/emails';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? null;
    if (this.apiKey) {
      this.logger.log('Resend email provider configured');
    } else {
      this.logger.warn('RESEND_API_KEY not set — email notifications will be skipped');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Email provider not configured (RESEND_API_KEY not set)',
      };
    }

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          success: false,
          error: `Resend API error ${res.status}: ${errorBody}`,
        };
      }

      const data = (await res.json()) as { id?: string };
      return {
        success: true,
        providerMessageId: data.id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown email send error',
      };
    }
  }
}
