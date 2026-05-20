import {
  type ConfirmPasswordResetInput,
  type RequestPasswordResetInput,
  confirmPasswordResetSchema,
  requestPasswordResetSchema,
} from '@grocery/shared';
import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { PasswordResetsService } from './password-resets.service';

@ApiTags('Password Reset')
@Controller('auth/password-reset')
export class PasswordResetsController {
  constructor(private readonly svc: PasswordResetsService) {}

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(requestPasswordResetSchema))
  @ApiOperation({ summary: 'طلب رابط إعادة تعيين كلمة المرور (لا يكشف وجود الحساب)' })
  async request(@Body() body: RequestPasswordResetInput) {
    const r = await this.svc.request(body);
    // Always 200 — same response shape regardless of existence.
    return { ok: true, ...(r.devToken ? { devToken: r.devToken } : {}) };
  }

  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(confirmPasswordResetSchema))
  @ApiOperation({ summary: 'تأكيد إعادة التعيين بالرمز' })
  confirm(@Body() body: ConfirmPasswordResetInput) {
    return this.svc.confirm(body);
  }
}
