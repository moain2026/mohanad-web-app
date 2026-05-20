import { Module } from '@nestjs/common';

import { PasswordResetsController } from './password-resets.controller';
import { PasswordResetsService } from './password-resets.service';

@Module({
  controllers: [PasswordResetsController],
  providers: [PasswordResetsService],
  exports: [PasswordResetsService],
})
export class PasswordResetsModule {}
