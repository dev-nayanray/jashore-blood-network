/**
 * AuthModule — wires the auth services, guards, and policies.
 *
 * JwtAuthGuard is registered as a GLOBAL guard so every route is
 * authenticated by default. Routes that should be public MUST use @Public().
 *
 * RolesGuard and PoliciesGuard are NOT global — they are applied per-route
 * via @UseGuards() so routes can opt in to role/policy enforcement.
 *
 * ThrottlerModule is registered here with a sensible default (60 req/min/IP)
 * — individual routes override via @Throttle().
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseServerService } from './supabase-server.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PoliciesGuard } from './guards/policies.guard';
import { IsOwnerPolicy } from './policies/is-owner.policy';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60_000,
          limit: config.get<number>('RATE_LIMIT_DEFAULT_PER_MINUTE', 60),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    SupabaseServerService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    PoliciesGuard,
    IsOwnerPolicy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // global rate-limiter
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // global authentication
    },
  ],
  exports: [AuthService, SupabaseServerService, JwtAuthGuard, RolesGuard, PoliciesGuard],
})
export class AuthModule {}
