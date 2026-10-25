import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { ApiEnv } from '@jbn/validation';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Trust the first proxy (Render terminates TLS for us)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers
  app.use(helmet());

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

  // Health check endpoint is unauthenticated; everything else will be guarded
  // in Phase 4 when auth lands. For Phase 2, only /health exists.
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
