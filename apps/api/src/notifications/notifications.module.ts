/**
 * NotificationsModule — notification system wiring.
 *
 * The email provider is conditionally registered: if RESEND_API_KEY is
 * set, the ResendEmailProvider is available; otherwise it's null and
 * email notifications are silently skipped.
 */

import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ResendEmailProvider } from './email/resend-email.provider';
import { EMAIL_PROVIDER } from './email/email-provider.interface';

@Module({
  controllers: [NotificationsController],
  providers: [
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (resend: ResendEmailProvider) => {
        // Only provide the email sender if Resend is configured.
        // The NotificationsService receives `null` if email is not configured.
        return resend.isConfigured() ? resend : null;
      },
      inject: [ResendEmailProvider],
    },
    {
      provide: NotificationsService,
      useFactory: (prisma: unknown, emailProvider: unknown, config: unknown) => {
        return new NotificationsService(
          prisma as never,
          emailProvider as never,
          config as never,
        );
      },
      inject: ['PRISMA_CLIENT', EMAIL_PROVIDER, 'ConfigService'],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
