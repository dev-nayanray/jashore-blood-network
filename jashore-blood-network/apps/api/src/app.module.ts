import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { apiEnvSchema } from '@jbn/validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Validate env vars on startup using the shared Zod schema.
      // If validation fails, the process exits with a clear error.
      validate: (env) => {
        const result = apiEnvSchema.safeParse(env);
        if (!result.success) {
           
          console.error(
            '\n❌ Invalid API environment configuration:\n' +
              result.error.issues
                .map((issue: { path: (string | number)[]; message: string }) => `  ${issue.path.join('.')}: ${issue.message}`)
                .join('\n') +
              '\n',
          );
          process.exit(1);
        }
        return result.data as Record<string, unknown>;
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
