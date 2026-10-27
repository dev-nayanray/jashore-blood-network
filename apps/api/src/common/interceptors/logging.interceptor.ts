import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  Logger,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

/**
 * Lightweight request logging interceptor.
 *
 * Logs method, URL, status code, and response time for every request.
 * Excludes request bodies and response bodies to avoid leaking PII into logs.
 */

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip: string;
    }>();
    const { method, url, ip } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} ${ip} — ${ms}ms`);
        },
        error: (err) => {
          const ms = Date.now() - start;
          const status = err?.status ?? 500;
          this.logger.warn(`${method} ${url} ${ip} — ${status} — ${ms}ms`);
        },
      }),
    );
  }
}
