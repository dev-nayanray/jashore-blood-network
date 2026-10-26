import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { apiEnvSchema } from '@jbn/validation';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

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
    DatabaseModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
