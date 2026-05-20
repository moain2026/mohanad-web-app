import {
  type CreateTemplateInput,
  type ListTemplatesQuery,
  type UpdateTemplateInput,
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { NotificationTemplatesService } from './notification-templates.service';

@ApiTags('Notification Templates')
@ApiBearerAuth('access-token')
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templates: NotificationTemplatesService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  @Get()
  @RequirePermission('notifications.manage_templates')
  @ApiOperation({ summary: 'قائمة قوالب الإشعارات' })
  @UsePipes(new ZodValidationPipe(listTemplatesQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListTemplatesQuery) {
    return this.templates.list(this.scope(actor), query);
  }

  @Get(':id')
  @RequirePermission('notifications.manage_templates')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.templates.findOne(this.scope(actor), id);
  }

  @Post()
  @RequirePermission('notifications.manage_templates')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createTemplateSchema))
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateTemplateInput) {
    return this.templates.create(this.scope(actor), body);
  }

  @Patch(':id')
  @RequirePermission('notifications.manage_templates')
  @UsePipes(new ZodValidationPipe(updateTemplateSchema))
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateTemplateInput,
  ) {
    return this.templates.update(this.scope(actor), id, body);
  }

  @Delete(':id')
  @RequirePermission('notifications.manage_templates')
  delete(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.templates.delete(this.scope(actor), id);
  }
}
