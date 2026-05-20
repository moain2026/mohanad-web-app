import {
  type UpsertManySettingsInput,
  type UpsertSettingInput,
  upsertManySettingsSchema,
  upsertSettingSchema,
} from '@grocery/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('system.settings.view')
  @ApiOperation({ summary: 'قائمة جميع الإعدادات (مع الافتراضيات)' })
  list(@CurrentUser() actor: AuthUser) {
    return this.settings.getAll(this.scope(actor));
  }

  @Get(':key')
  @RequirePermission('system.settings.view')
  @ApiOperation({ summary: 'إعداد واحد بالمفتاح' })
  getOne(@CurrentUser() actor: AuthUser, @Param('key') key: string) {
    return this.settings.getOne(this.scope(actor), key).then((value) => ({ key, value }));
  }

  @Put(':key')
  @RequirePermission('system.settings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تحديث إعداد واحد' })
  @UsePipes(new ZodValidationPipe(upsertSettingSchema))
  upsertOne(
    @CurrentUser() actor: AuthUser,
    @Param('key') keyParam: string,
    @Body() body: UpsertSettingInput,
  ) {
    // Force the key from the URL to prevent mismatched-key sneaks.
    return this.settings
      .upsert(this.scope(actor), { ...body, key: keyParam })
      .then((value) => ({ key: keyParam, value }));
  }

  @Put()
  @RequirePermission('system.settings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تحديث عدة إعدادات دفعة واحدة' })
  @UsePipes(new ZodValidationPipe(upsertManySettingsSchema))
  upsertMany(@CurrentUser() actor: AuthUser, @Body() body: UpsertManySettingsInput) {
    return this.settings.upsertMany(this.scope(actor), body);
  }
}
