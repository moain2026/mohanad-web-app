import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { configValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { RolesModule } from './modules/roles/roles.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // ─── Env (validated by Zod) ─────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (env) => configValidationSchema.parse(env),
    }),

    // ─── Logger (Pino) ──────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.LOG_PRETTY === 'true'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:HH:MM:ss',
                  ignore: 'pid,hostname,req.headers,res.headers',
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'res.headers["set-cookie"]',
          ],
          censor: '***',
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),

    // ─── Rate Limiting (global) ─────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // ─── Core ───────────────────────────────────
    PrismaModule,
    // JwtModule registered globally so middleware (IdempotencyMiddleware)
    // can decode access tokens to scope the cache to the correct user.
    JwtModule.register({ global: true }),

    // ─── Foundation feature modules ─────────────
    HealthModule,

    // ─── Phase 2 placeholders (return 501) ──────
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,

    // ─── Phase 3 ────────────────────────────────
    CustomersModule,
    NotificationsModule,

    // ─── Phase 4 ────────────────────────────────
    SuppliersModule,
    PurchasesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseFormatInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: requestId first (logs all requests), then idempotency
    // (which may short-circuit replays before the guards/handlers run).
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer.apply(IdempotencyMiddleware).forRoutes('*');
  }
}
