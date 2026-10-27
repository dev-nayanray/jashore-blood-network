import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 *
 * Transforms all uncaught exceptions into RFC 7807 problem-details JSON
 * responses with a consistent shape. Internal stack traces are NEVER
 * exposed to clients in production.
 */

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: Array<{ field: string; code: string; message: string }>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let problem: ProblemDetails;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      problem = this.buildProblem(status, res, request.url);
    } else {
      // Unknown error — log full detail server-side, return generic to client
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      problem = {
        type: 'https://jashore-blood-network.org/errors/internal',
        title: 'Internal Server Error',
        status,
        detail:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred.'
            : (exception instanceof Error ? exception.message : String(exception)),
        instance: request.url,
      };
    }

    response.status(status).setHeader('Content-Type', 'application/problem+json').json(problem);
  }

  private buildProblem(
    status: number,
    res: unknown,
    instance: string,
  ): ProblemDetails {
    const isProduction = process.env.NODE_ENV === 'production';

    if (typeof res === 'string') {
      return {
        type: `https://jashore-blood-network.org/errors/${status}`,
        title: this.titleFor(status),
        status,
        detail: res,
        instance,
      };
    }

    const r = (res ?? {}) as Record<string, unknown>;

    // NestJS ValidationPipe shape: { message: string[], error: string }
    if (Array.isArray(r.message)) {
      return {
        type: `https://jashore-blood-network.org/errors/validation`,
        title: 'Validation failed',
        status,
        detail: 'One or more fields failed validation.',
        instance,
        errors: r.message.map((m: unknown) => {
          const msg = typeof m === 'string' ? m : String(m);
          const firstToken = msg.split(' ')[0];
          return {
            field: firstToken ?? 'unknown',
            code: 'invalid',
            message: msg,
          };
        }),
      };
    }

    return {
      type: `https://jashore-blood-network.org/errors/${status}`,
      title: typeof r.error === 'string' ? r.error : this.titleFor(status),
      status,
      detail:
        typeof r.message === 'string'
          ? r.message
          : isProduction
            ? 'Request could not be processed.'
            : 'Request could not be processed.',
      instance,
    };
  }

  private titleFor(status: number): string {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return titles[status] ?? 'Error';
  }
}
