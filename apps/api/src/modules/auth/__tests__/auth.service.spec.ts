/**
 * AuthService — comprehensive Jest spec.
 *
 * Coverage targets (≥85%):
 *   • login: invalid creds, lockout, inactive, success
 *   • refresh: rotation revokes old, replay → 401, inactive user
 *   • logout / logoutAll
 *   • changePassword: validation, wrong current, success revokes sessions
 *
 * PrismaService and TokenService are mocked — no DB required.
 */

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';

import bcrypt from 'bcrypt';

// ─── Helpers ───────────────────────────────────────────────────
const mockUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  username: 'owner',
  fullName: 'مالك المتجر',
  storeId: 'store-1',
  isActive: true,
  deletedAt: null,
  passwordHash: '$2b$12$hashplaceholder',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  userRoles: [
    {
      role: {
        key: 'Owner',
        isActive: true,
        rolePermissions: [
          { permission: { key: 'users.view' } },
          { permission: { key: 'roles.view' } },
        ],
      },
    },
  ],
  ...overrides,
});

const buildPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

const buildTokensMock = () => ({
  signAccessToken: jest.fn().mockResolvedValue({ token: 'access.jwt', expiresInSec: 900 }),
  issueRefreshToken: jest.fn().mockResolvedValue({
    token: 'refresh.jwt',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    row: { tokenHash: 'hash-new' },
  }),
  verifyRefreshToken: jest.fn(),
  revokeByHash: jest.fn().mockResolvedValue(undefined),
  revokeAllForUser: jest.fn().mockResolvedValue(2),
  cleanupExpired: jest.fn().mockResolvedValue(0),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tokens: ReturnType<typeof buildTokensMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    tokens = buildTokensMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ─── login ────────────────────────────────────────────────
  describe('login', () => {
    it('throws 401 INVALID_CREDENTIALS when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ username: 'ghost', password: 'p', rememberMe: false }, {}),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('throws 403 USER_INACTIVE when account is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ isActive: false }));
      await expect(
        service.login({ username: 'owner', password: 'p', rememberMe: false }, {}),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'USER_INACTIVE' },
      });
    });

    it('throws 429 ACCOUNT_LOCKED when lockedUntil is in future', async () => {
      const future = new Date(Date.now() + 5 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue(mockUser({ lockedUntil: future }));
      await expect(
        service.login({ username: 'owner', password: 'p', rememberMe: false }, {}),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'ACCOUNT_LOCKED', lockedUntil: future.toISOString() },
      });
    });

    it('increments failedLoginAttempts on wrong password (and locks at 5)', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      prisma.user.findUnique.mockResolvedValue(mockUser({ failedLoginAttempts: 4 }));
      await expect(
        service.login({ username: 'owner', password: 'wrong', rememberMe: false }, {}),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
      // The single update call should set lockedUntil and counter=5.
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const call = prisma.user.update.mock.calls[0][0];
      expect(call.data.failedLoginAttempts).toBe(5);
      expect(call.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('issues tokens, resets counter, updates lastLoginAt on success', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prisma.user.findUnique.mockResolvedValue(mockUser({ failedLoginAttempts: 3 }));
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        username: 'owner',
        fullName: 'مالك المتجر',
        storeId: 'store-1',
        lastLoginAt: new Date(),
      });

      const result = await service.login(
        { username: 'owner', password: 'Owner@12345', rememberMe: true },
        { ipAddress: '1.2.3.4' },
      );
      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshToken).toBe('refresh.jwt');
      expect(result.user.permissions).toEqual(expect.arrayContaining(['users.view', 'roles.view']));
      expect(result.user.roles).toEqual(['Owner']);
      // counter reset to 0 on success
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        }),
      );
      expect(tokens.issueRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ rememberMe: true, ipAddress: '1.2.3.4' }),
      );
    });

    it('soft-deleted user is treated as inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ deletedAt: new Date() }));
      await expect(
        service.login({ username: 'owner', password: 'p', rememberMe: false }, {}),
      ).rejects.toMatchObject({
        response: { code: 'USER_INACTIVE' },
      });
    });
  });

  // ─── refresh (rotation) ────────────────────────────────────
  describe('refresh', () => {
    it('throws 401 REFRESH_INVALID when verify fails', async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error('expired'));
      await expect(service.refresh('badtoken', {})).rejects.toMatchObject({
        status: 401,
        response: { code: 'REFRESH_INVALID' },
      });
    });

    it('revokes the old token then issues a new one (rotation)', async () => {
      tokens.verifyRefreshToken.mockResolvedValue({
        payload: { sub: 'user-1', jti: 'jti-1', type: 'refresh' },
        row: {
          id: 'rt-1',
          userId: 'user-1',
          tokenHash: 'hash-old',
          rememberMe: false,
          deviceLabel: null,
          ipAddress: null,
          userAgent: null,
        },
      });
      prisma.user.findUnique.mockResolvedValue(mockUser());
      // Simulate an interactive transaction: it receives a tx object and runs callback
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          refreshToken: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      });

      const result = await service.refresh('oldtoken', {});
      expect(result.accessToken).toBe('access.jwt');
      expect(tokens.issueRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('replay of revoked token → 401 REFRESH_REUSED', async () => {
      tokens.verifyRefreshToken.mockResolvedValue({
        payload: { sub: 'user-1', jti: 'j', type: 'refresh' },
        row: {
          id: 'rt-1',
          userId: 'user-1',
          tokenHash: 'hash',
          rememberMe: false,
          deviceLabel: null,
          ipAddress: null,
          userAgent: null,
        },
      });
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return cb(tx);
      });
      await expect(service.refresh('replay', {})).rejects.toMatchObject({
        response: { code: 'REFRESH_REUSED' },
      });
    });

    it('inactive user → revokes token + 401 USER_INACTIVE', async () => {
      tokens.verifyRefreshToken.mockResolvedValue({
        payload: { sub: 'user-1', jti: 'j', type: 'refresh' },
        row: {
          id: 'rt-1',
          userId: 'user-1',
          tokenHash: 'hash',
          rememberMe: false,
          deviceLabel: null,
          ipAddress: null,
          userAgent: null,
        },
      });
      prisma.user.findUnique.mockResolvedValue(mockUser({ isActive: false }));
      await expect(service.refresh('t', {})).rejects.toMatchObject({
        response: { code: 'USER_INACTIVE' },
      });
      expect(tokens.revokeByHash).toHaveBeenCalledWith('hash');
    });
  });

  // ─── logout / logoutAll ────────────────────────────────────
  describe('logout', () => {
    it('logout(null) is a no-op', async () => {
      await service.logout(null);
      expect(tokens.revokeByHash).not.toHaveBeenCalled();
    });

    it('logout(token) revokes by sha256 hash', async () => {
      await service.logout('rawtoken');
      expect(tokens.revokeByHash).toHaveBeenCalledTimes(1);
      // hash is 64 hex chars
      expect(tokens.revokeByHash.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('logoutAll → revokeAllForUser', async () => {
      const r = await service.logoutAll('user-1');
      expect(r.revoked).toBe(2);
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── changePassword ────────────────────────────────────────
  describe('changePassword', () => {
    it('throws 400 PASSWORD_MISMATCH when confirm differs', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'a',
          newPassword: 'b',
          confirmPassword: 'c',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PASSWORD_MISMATCH' } });
    });

    it('throws 400 PASSWORD_SAME when newPassword === currentPassword', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'same',
          newPassword: 'same',
          confirmPassword: 'same',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'PASSWORD_SAME' } });
    });

    it('throws 401 INVALID_CURRENT_PASSWORD when current is wrong', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      prisma.user.findUnique.mockResolvedValue(mockUser());
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'New@12345',
          confirmPassword: 'New@12345',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CURRENT_PASSWORD' } });
    });

    it('hashes new password and revokes all sessions on success', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue({}) },
          refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
        };
        return cb(tx);
      });

      const r = await service.changePassword('user-1', {
        currentPassword: 'Old@12345',
        newPassword: 'New@12345',
        confirmPassword: 'New@12345',
      } as any);
      expect(r.revoked).toBe(3);
      expect(bcrypt.hash).toHaveBeenCalledWith('New@12345', 12);
    });
  });

  // ─── listSessions ──────────────────────────────────────────
  describe('listSessions', () => {
    it('returns active sessions sorted DESC with `current` flagged via cookie hash', async () => {
      // Hash of literal "refresh-cookie-raw" — we let the service compute it
      // (it uses sha256 from token.service which is the real impl), and we
      // align the mocked row's tokenHash with that hash for one of two rows.
      const { sha256 } = await import('../token.service');
      const rawCookie = 'refresh-cookie-raw-token';
      const currentHash = sha256(rawCookie);

      const now = new Date();
      prisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-cur',
          tokenHash: currentHash,
          deviceLabel: 'iPhone 15',
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
          rememberMe: true,
          createdAt: now,
          expiresAt: new Date(now.getTime() + 7 * 86400_000),
        },
        {
          id: 'rt-other',
          tokenHash: 'other-hash',
          deviceLabel: null,
          ipAddress: null,
          userAgent: null,
          rememberMe: false,
          createdAt: new Date(now.getTime() - 1000),
          expiresAt: new Date(now.getTime() + 86400_000),
        },
      ]);

      const out = await service.listSessions('user-1', rawCookie);

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            revokedAt: null,
            expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ id: 'rt-cur', current: true, deviceLabel: 'iPhone 15' });
      expect(out[1]).toMatchObject({ id: 'rt-other', current: false });
      // ISO strings, never Date objects
      expect(typeof out[0].createdAt).toBe('string');
      expect(typeof out[0].expiresAt).toBe('string');
    });

    it('flags no row as `current` when no refresh cookie is provided', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          tokenHash: 'h1',
          deviceLabel: null,
          ipAddress: null,
          userAgent: null,
          rememberMe: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400_000),
        },
      ]);
      const out = await service.listSessions('user-1', null);
      expect(out[0].current).toBe(false);
    });

    it('returns empty array when no active sessions exist', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([]);
      const out = await service.listSessions('user-1', 'whatever');
      expect(out).toEqual([]);
    });
  });

  // ─── revokeSession ─────────────────────────────────────────
  describe('revokeSession', () => {
    it('revokes a session owned by the user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.revokeSession('user-1', 'rt-1');
      expect(result).toEqual({ revoked: true });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws 404 SESSION_NOT_FOUND when row does not exist / not owned / already revoked', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeSession('user-1', 'rt-x')).rejects.toMatchObject({
        status: 404,
        response: { code: 'SESSION_NOT_FOUND' },
      });
    });

    it('cannot revoke another user`s session — scoping is enforced via updateMany WHERE', async () => {
      // Even if the attacker passes a real session id from another user,
      // the WHERE clause filters by `userId` so updateMany returns count=0,
      // which then surfaces as 404.
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeSession('attacker', 'victim-session-id')).rejects.toMatchObject({
        response: { code: 'SESSION_NOT_FOUND' },
      });
      // Confirm the scoping was indeed applied
      const callArgs = prisma.refreshToken.updateMany.mock.calls[0][0];
      expect(callArgs.where.userId).toBe('attacker');
    });
  });
});
