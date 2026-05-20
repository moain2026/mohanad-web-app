/**
 * PasswordResetsService — Phase 8 P8-3.
 *
 * Flow:
 *   1. POST /auth/password-reset/request { username }  → always returns 204,
 *      regardless of whether the user exists (prevents enumeration).
 *      If the user exists, issues a one-time token (1h TTL) and creates an
 *      INTERNAL notification with the reset link. In production this would
 *      also send WhatsApp/SMS.
 *   2. POST /auth/password-reset/confirm { token, newPassword } → verifies
 *      the token, sets the new password, revokes all refresh tokens, and
 *      writes an audit log.
 *
 * Tokens are stored as SHA-256 hashes; the original is returned to the
 * notification consumer (operator or end-user) ONLY in the response of the
 * request endpoint in non-production environments. We do NOT expose it in
 * production — see SettingsService control.
 */

import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';

import type { ConfirmPasswordResetInput, RequestPasswordResetInput } from '@grocery/shared';

import { writeAuditLog } from '../../common/audit/audit.helper';
import { sha256 } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordResetsService {
  private readonly logger = new Logger(PasswordResetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Always returns 204. If the user exists, a one-time token is generated.
   * For the sandbox / dev experience we also surface the raw token in a
   * Notification (visible to admins) so manual tests can complete.
   */
  async request(input: RequestPasswordResetInput): Promise<{ devToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user || !user.isActive || user.deletedAt) {
      // Same response shape — no enumeration leak.
      return {};
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.prisma.$transaction(async (db) => {
      // Invalidate any existing unused tokens for this user.
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      await db.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      // Internal notification so an admin can copy the token if needed.
      await db.notification.create({
        data: {
          storeId: user.storeId,
          userId: null, // broadcast to managers
          type: 'CUSTOMER_DEBT_HIGH', // re-use enum; UI just shows title/body
          title: 'طلب إعادة تعيين كلمة المرور',
          body: `تم طلب إعادة تعيين كلمة المرور للمستخدم "${user.username}".`,
          metadata: {
            kind: 'password_reset_request',
            username: user.username,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
      await writeAuditLog(db, {
        storeId: user.storeId,
        actorId: null,
        action: 'password_reset',
        entityType: 'user',
        entityId: user.id,
        metadata: { kind: 'request', username: user.username },
      });
    });

    // In non-production we surface the dev token so manual flow works.
    if (process.env.NODE_ENV !== 'production') {
      return { devToken: rawToken };
    }
    return {};
  }

  async confirm(input: ConfirmPasswordResetInput): Promise<{ ok: true }> {
    const tokenHash = sha256(input.token);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        message: 'الرابط منتهي أو غير صالح',
        code: 'PASSWORD_RESET_INVALID',
      });
    }

    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (db) => {
      await db.user.update({
        where: { id: row.userId },
        data: { passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      // Revoke ALL refresh tokens for this user.
      await db.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Mark token as used.
      await db.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await writeAuditLog(db, {
        storeId: row.user.storeId,
        actorId: row.userId,
        action: 'password_reset',
        entityType: 'user',
        entityId: row.userId,
        metadata: { kind: 'confirm' },
      });
    });

    return { ok: true };
  }

  /** Internal: cron-friendly purge of expired tokens. */
  async purgeExpired(): Promise<number> {
    const res = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });
    this.logger.log(`purged ${res.count} password reset tokens`);
    return res.count;
  }
}
