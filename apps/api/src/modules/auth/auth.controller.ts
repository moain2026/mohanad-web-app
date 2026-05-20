import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto, changePasswordSchema } from './dto/change-password.dto';
import { LoginDto, loginSchema } from './dto/login.dto';
import type { AuthUser } from './types/auth-user';

const REFRESH_COOKIE_NAME = 'grocery_refresh';

/**
 * AuthController — public + authenticated auth endpoints.
 *
 * Cookie strategy:
 *  • Refresh token is sent ONLY in the `grocery_refresh` httpOnly cookie.
 *  • Access token is returned in the JSON body (frontend stores it in
 *    memory + Authorization header). Never set as a cookie.
 *
 * Endpoints:
 *   POST /auth/login                   — public, sets refresh cookie
 *   POST /auth/refresh                 — public (but cookie-gated), rotates token
 *   POST /auth/logout                  — auth, revokes current session
 *   POST /auth/logout-all              — auth, revokes all sessions for the user
 *   GET  /auth/me                      — auth, returns current user profile
 *   POST /auth/change-password         — auth, revokes all sessions
 *   GET  /auth/sessions                — auth, lists current user's active sessions
 *   POST /auth/sessions/:id/revoke     — auth, revokes a single session by id
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ─── Cookie helper ─────────────────────────────────────────
  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    const secure = this.config.get<boolean>('COOKIE_SECURE') ?? false;
    const sameSite = (this.config.get<string>('COOKIE_SAMESITE') ?? 'lax') as
      | 'lax'
      | 'strict'
      | 'none';
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure,
      sameSite,
      ...(domain ? { domain } : {}),
      path: '/',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      ...(domain ? { domain } : {}),
      path: '/',
    });
  }

  private extractContext(req: Request): {
    ipAddress: string | null;
    userAgent: string | null;
    deviceLabel: string | null;
  } {
    const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    return {
      ipAddress: xff || req.ip || null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      deviceLabel: (req.headers['x-device-label'] as string | undefined) ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/login
  // ═══════════════════════════════════════════════════════════
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @ApiOperation({ summary: 'تسجيل الدخول — يصدر access + refresh' })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresInSec: number;
    refreshTokenExpiresAt: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      storeId: string;
      permissions: string[];
      roles: string[];
      lastLoginAt: string | null;
    };
  }> {
    const ctx = this.extractContext(req);
    const result = await this.auth.login(body, ctx);
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    return {
      accessToken: result.accessToken,
      accessTokenExpiresInSec: result.accessTokenExpiresInSec,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
      user: {
        ...result.user,
        lastLoginAt: result.user.lastLoginAt?.toISOString() ?? null,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/refresh
  // ═══════════════════════════════════════════════════════════
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تجديد access token (rotation)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresInSec: number;
    refreshTokenExpiresAt: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      storeId: string;
      permissions: string[];
      roles: string[];
      lastLoginAt: string | null;
    };
  }> {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const token = cookies[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException({
        message: 'الجلسة غير موجودة',
        code: 'REFRESH_MISSING',
      });
    }
    const ctx = this.extractContext(req);
    const result = await this.auth.refresh(token, ctx);
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    return {
      accessToken: result.accessToken,
      accessTokenExpiresInSec: result.accessTokenExpiresInSec,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
      user: {
        ...result.user,
        lastLoginAt: result.user.lastLoginAt?.toISOString() ?? null,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/logout
  // ═══════════════════════════════════════════════════════════
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'تسجيل الخروج (الجلسة الحالية)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    await this.auth.logout(cookies[REFRESH_COOKIE_NAME] ?? null);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/logout-all
  // ═══════════════════════════════════════════════════════════
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'تسجيل الخروج من كل الأجهزة' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; revoked: number }> {
    const result = await this.auth.logoutAll(user.id);
    this.clearRefreshCookie(res);
    return { ok: true, revoked: result.revoked };
  }

  // ═══════════════════════════════════════════════════════════
  //  GET /auth/me
  // ═══════════════════════════════════════════════════════════
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'بيانات المستخدم الحالي + صلاحياته' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  // ═══════════════════════════════════════════════════════════
  //  GET /auth/sessions
  //  → list active sessions (refresh tokens) for current user.
  // ═══════════════════════════════════════════════════════════
  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'قائمة الجلسات النشطة للمستخدم الحالي' })
  async listSessions(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{
    sessions: Array<{
      id: string;
      deviceLabel: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      rememberMe: boolean;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>;
  }> {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const currentRaw = cookies[REFRESH_COOKIE_NAME] ?? null;
    const sessions = await this.auth.listSessions(user.id, currentRaw);
    return { sessions };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/sessions/:id/revoke
  //  → revoke a single session by id (must belong to current user).
  //  Uses POST (not DELETE) so the request goes through the
  //  IdempotencyMiddleware naturally.
  // ═══════════════════════════════════════════════════════════
  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'إنهاء جلسة محددة' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
  ): Promise<{ ok: true; revoked: true }> {
    const result = await this.auth.revokeSession(user.id, sessionId);
    return { ok: true, ...result };
  }

  // ═══════════════════════════════════════════════════════════
  //  POST /auth/change-password
  // ═══════════════════════════════════════════════════════════
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'تغيير كلمة المرور — يلغي كل الجلسات' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; revoked: number }> {
    const result = await this.auth.changePassword(user.id, body);
    this.clearRefreshCookie(res);
    return { ok: true, ...result };
  }
}
