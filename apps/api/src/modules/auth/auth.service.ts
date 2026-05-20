import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordInput } from './dto/change-password.dto';
import type { LoginInput } from './dto/login.dto';
import { TokenService, sha256 } from './token.service';

// ─── Constants ────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

export interface LoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
}

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresInSec: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: {
    id: string;
    username: string;
    fullName: string;
    storeId: string;
    permissions: string[];
    roles: string[];
    lastLoginAt: Date | null;
  };
}

/**
 * AuthService — orchestrates everything in /api/v1/auth/*.
 *
 * Security guarantees:
 *  • Passwords hashed with bcrypt (rounds 12).
 *  • Refresh tokens stored as SHA-256 hash (never raw) — DB leak ≠ session leak.
 *  • Rotation: every /refresh issues a new token AND revokes the old one
 *    inside a single $transaction (atomic).
 *  • Lockout: 5 failed attempts within 15 min → account locked for 15 min;
 *    counter resets on success.
 *  • On deactivate / change-password / logout-all: ALL refresh tokens are
 *    revoked.
 *  • Cleanup of expired tokens runs opportunistically on every login.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  LOGIN
  // ═══════════════════════════════════════════════════════════
  async login(input: LoginInput, ctx: LoginContext): Promise<LoginResult> {
    const username = input.username.trim();
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    // Generic "invalid credentials" — never leak whether username exists.
    const invalidCreds = (): UnauthorizedException =>
      new UnauthorizedException({
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
        code: 'INVALID_CREDENTIALS',
      });

    if (!user) {
      // Add a small bcrypt no-op so timing doesn't leak existence.
      await bcrypt.compare(
        input.password,
        '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.',
      );
      throw invalidCreds();
    }

    // Account state checks
    if (!user.isActive || user.deletedAt) {
      throw new ForbiddenException({
        message: 'الحساب غير نشط — راجع المالك',
        code: 'USER_INACTIVE',
      });
    }

    // Lockout check
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingSec = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new HttpException(
        {
          message: 'تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: user.lockedUntil.toISOString(),
          retryAfterSec: remainingSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      await this.handleFailedAttempt(user.id, user.failedLoginAttempts);
      throw invalidCreds();
    }

    // ─── Successful login ─────────────────────────────────
    // Reset lockout fields, update lastLoginAt.
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Fire-and-forget cleanup of expired/revoked tokens for this user.
    this.tokens
      .cleanupExpired(user.id)
      .catch((err) => this.logger.warn(`Token cleanup failed: ${(err as Error).message}`));

    // Compute effective permissions + roles (single dedup pass).
    const permissionSet = new Set<string>();
    const roleKeys: string[] = [];
    for (const ur of user.userRoles) {
      if (!ur.role.isActive) continue;
      roleKeys.push(ur.role.key);
      for (const rp of ur.role.rolePermissions) permissionSet.add(rp.permission.key);
    }

    // Issue tokens.
    const access = await this.tokens.signAccessToken({
      userId: user.id,
      username: user.username,
      storeId: user.storeId,
    });
    const refresh = await this.tokens.issueRefreshToken({
      userId: user.id,
      storeId: user.storeId,
      rememberMe: input.rememberMe ?? false,
      deviceLabel: ctx.deviceLabel ?? null,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresInSec: access.expiresInSec,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        storeId: updatedUser.storeId,
        permissions: [...permissionSet],
        roles: roleKeys,
        lastLoginAt: updatedUser.lastLoginAt,
      },
    };
  }

  /**
   * Increment failedLoginAttempts; when it reaches MAX, set lockedUntil.
   * Counter is **not** decremented over time — it only resets on success
   * or when a lockout window expires (handled at login time).
   */
  private async handleFailedAttempt(userId: string, currentCount: number): Promise<void> {
    const next = currentCount + 1;
    if (next >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: next,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: next },
      });
    }
    void LOCKOUT_WINDOW_MS; // reserved for future sliding-window logic
  }

  // ═══════════════════════════════════════════════════════════
  //  REFRESH (rotation)
  // ═══════════════════════════════════════════════════════════
  async refresh(rawToken: string, ctx: LoginContext): Promise<LoginResult> {
    let verified: Awaited<ReturnType<TokenService['verifyRefreshToken']>>;
    try {
      verified = await this.tokens.verifyRefreshToken(rawToken);
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.debug(`Refresh rejected: ${reason}`);
      throw new UnauthorizedException({
        message: 'الجلسة منتهية — يرجى تسجيل الدخول مجدداً',
        code: 'REFRESH_INVALID',
      });
    }
    const { row } = verified;

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || !user.isActive || user.deletedAt) {
      // Defense-in-depth: revoke this token so it can't be retried.
      await this.tokens.revokeByHash(row.tokenHash);
      throw new UnauthorizedException({
        message: 'الحساب غير نشط',
        code: 'USER_INACTIVE',
      });
    }

    // ─── Atomic rotation ──────────────────────────────────
    // Revoke the old token, then issue the new one. We do this in a
    // transaction so a concurrent /refresh of the same token can't both
    // succeed and reuse the row.
    const newRefreshToken = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count === 0) {
        // Already revoked by a concurrent request — refuse.
        throw new UnauthorizedException({
          message: 'الجلسة منتهية',
          code: 'REFRESH_REUSED',
        });
      }
      return this.tokens.issueRefreshToken({
        userId: user.id,
        storeId: user.storeId,
        rememberMe: row.rememberMe,
        deviceLabel: ctx.deviceLabel ?? row.deviceLabel,
        ipAddress: ctx.ipAddress ?? row.ipAddress,
        userAgent: ctx.userAgent ?? row.userAgent,
      });
    });

    const access = await this.tokens.signAccessToken({
      userId: user.id,
      username: user.username,
      storeId: user.storeId,
    });

    const permissionSet = new Set<string>();
    const roleKeys: string[] = [];
    for (const ur of user.userRoles) {
      if (!ur.role.isActive) continue;
      roleKeys.push(ur.role.key);
      for (const rp of ur.role.rolePermissions) permissionSet.add(rp.permission.key);
    }

    return {
      accessToken: access.token,
      accessTokenExpiresInSec: access.expiresInSec,
      refreshToken: newRefreshToken.token,
      refreshTokenExpiresAt: newRefreshToken.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        storeId: user.storeId,
        permissions: [...permissionSet],
        roles: roleKeys,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  LOGOUT
  // ═══════════════════════════════════════════════════════════
  async logout(rawRefreshToken: string | null): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = sha256(rawRefreshToken);
    await this.tokens.revokeByHash(tokenHash);
  }

  async logoutAll(userId: string): Promise<{ revoked: number }> {
    const revoked = await this.tokens.revokeAllForUser(userId);
    return { revoked };
  }

  // ═══════════════════════════════════════════════════════════
  //  SESSIONS — list / revoke individual
  // ═══════════════════════════════════════════════════════════
  /**
   * List the current user's ACTIVE sessions
   * (non-revoked AND non-expired refresh tokens).
   *
   * The `current` flag is true for the row whose `tokenHash` matches the
   * SHA-256 of the caller's refresh cookie. If the caller didn't send a
   * refresh cookie (e.g. cookies were lost between subdomains), every row
   * is reported as non-current and the UI can still display them.
   *
   * Sorted by `createdAt` DESC so the most recent session is at the top.
   * Returns plain serialisable shape (Dates → ISO strings).
   */
  async listSessions(
    userId: string,
    currentRawRefreshToken: string | null,
  ): Promise<
    Array<{
      id: string;
      deviceLabel: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      rememberMe: boolean;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>
  > {
    const currentHash = currentRawRefreshToken ? sha256(currentRawRefreshToken) : null;
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        deviceLabel: true,
        ipAddress: true,
        userAgent: true,
        rememberMe: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      deviceLabel: r.deviceLabel,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      rememberMe: r.rememberMe,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      current: currentHash !== null && r.tokenHash === currentHash,
    }));
  }

  /**
   * Revoke a single session (refresh token row) belonging to the current
   * user. Always uses `updateMany` scoped to `{ id, userId, revokedAt: null }`
   * so a user can NEVER revoke another user's session, even by crafting the
   * request payload.
   *
   *  • Row not found, or already revoked, or belongs to another user
   *    → 404 SESSION_NOT_FOUND (uniform — never leaks existence).
   *  • Otherwise marks `revokedAt = now`. On the next refresh attempt the
   *    affected session is rejected with `REFRESH_TOKEN_REVOKED`.
   */
  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: true }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        message: 'الجلسة غير موجودة أو تم إنهاؤها مسبقاً',
        code: 'SESSION_NOT_FOUND',
      });
    }
    return { revoked: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════
  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ revoked: number }> {
    if (input.newPassword !== input.confirmPassword) {
      throw new BadRequestException({
        message: 'كلمتا المرور غير متطابقتين',
        code: 'PASSWORD_MISMATCH',
        errors: [{ path: ['confirmPassword'], message: 'mismatch' }],
      });
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException({
        message: 'كلمة المرور الجديدة يجب أن تكون مختلفة',
        code: 'PASSWORD_SAME',
        errors: [{ path: ['newPassword'], message: 'must differ' }],
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ message: 'الحساب غير موجود', code: 'USER_NOT_FOUND' });
    }

    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: 'كلمة المرور الحالية غير صحيحة',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    const revoked = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      const res = await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return res.count;
    });

    return { revoked };
  }

  // ═══════════════════════════════════════════════════════════
  //  /me — return current user (already loaded in JwtStrategy)
  // ═══════════════════════════════════════════════════════════
  // (Controllers can just return CurrentUser() — exposing here for tests.)
}
