import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { seedDemoData, DEMO_ADMIN_PHONE } from './seed/demo-seed';
import { prisma } from './lib/prisma';
import type { ApiEnv } from '@jbn/validation';

const execAsync = promisify(exec);

/**
 * Apply pending Prisma migrations, then seed demo data when the database
 * is empty (skip with DEMO_SEED=false). Best-effort: a failure is logged
 * loudly but never blocks the API from booting.
 */
async function prepareDatabase(logger: Logger, config: ConfigService<ApiEnv, true>) {
  const apiRoot = join(__dirname, '..'); // apps/api (dist/..)
  try {
    logger.log('Applying pending database migrations...');
    const { stdout } = await execAsync(
      'npx --yes prisma migrate deploy --schema=prisma/schema.prisma',
      { cwd: apiRoot, env: process.env },
    );
    logger.log(`Migrations applied:\n${stdout.trim()}`);
  } catch (err) {
    logger.error(
      `prisma migrate deploy failed (continuing boot): ${err instanceof Error ? err.message : err}`,
    );
  }

  if (config.get<string>('DEMO_SEED') === 'false') {
    logger.log('DEMO_SEED=false — skipping demo data seed');
    return;
  }
  try {
    const profiles = await prisma.profile.count();
    if (profiles > 0) {
      logger.log(`Database already has ${profiles} profiles — skipping demo seed`);
      return;
    }
    const result = await seedDemoData(prisma);
    logger.log(
      `Demo data seeded: ${result.donors} donors, ${result.requests} requests, ${result.hospitals} hospitals. ` +
        `Demo admin phone: ${DEMO_ADMIN_PHONE}`,
    );
  } catch (err) {
    logger.error(
      `Demo seed failed (continuing boot): ${err instanceof Error ? err.message : err}`,
    );
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await prepareDatabase(logger, app.get(ConfigService<ApiEnv, true>));

  // Trust the first proxy (Render terminates TLS for us)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // Cookie parser — required for the auth cookie-based session
  app.use(cookieParser());

  // Restrictive CORS — never wildcard with credentials
  const config = app.get(ConfigService<ApiEnv, true>);
  const allowedOrigins = config
    .get<string>('CORS_ALLOWED_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length === 0 ? false : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 3600,
  });

  // Global validation: reject unknown properties, validate on every request
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Global exception filter: consistent RFC 7807-style error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Strip @Exclude() fields from response DTOs
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global prefix: all routes are under /api/v1 except /health.
  // Auth routes are at /api/v1/auth/*, user routes at /api/v1/users/*.
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
  });

  const port = config.get<number>('PORT', 3001);
  await app.listen(port, () => {
    logger.log(`API listening on http://localhost:${port}`);
    logger.log(`CORS allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
    logger.log(`Environment: ${config.get<string>('NODE_ENV', 'development')}`);
  });
}

bootstrap().catch((err) => {
   
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
   
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
   
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
