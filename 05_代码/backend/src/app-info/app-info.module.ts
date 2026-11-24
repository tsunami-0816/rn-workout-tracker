import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

@Module({
  controllers: [VersionController, HealthController],
  providers: [VersionService],
})
export class AppInfoModule {}
