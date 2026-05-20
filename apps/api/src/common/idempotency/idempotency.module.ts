import { Module } from '@nestjs/common';

import { IdempotencyCleanerService } from './idempotency-cleaner.service';

/**
 * IdempotencyModule — Phase 2 polish.
 *
 * Provides the `IdempotencyCleanerService` (GC for the IdempotencyKey
 * table). The middleware (`IdempotencyMiddleware`) itself is wired in
 * `AppModule.configure()` because middleware lives at the HTTP layer
 * and is registered via `MiddlewareConsumer`, not via providers.
 *
 * The cleaner is exported so the CLI bootstrap (NestFactory.createApplicationContext)
 * can resolve and call it without spinning up the full HTTP layer.
 */
@Module({
  providers: [IdempotencyCleanerService],
  exports: [IdempotencyCleanerService],
})
export class IdempotencyModule {}
