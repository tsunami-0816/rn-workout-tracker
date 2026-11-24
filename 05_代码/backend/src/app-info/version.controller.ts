import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { VersionService } from './version.service';

/** 版本接口（#19，公开、不缓存） */
@ApiTags('app')
@Controller('app')
export class VersionController {
  constructor(private readonly version: VersionService) {}

  @Public()
  @Get('version')
  @ApiOperation({ summary: '最新版本信息（读 release.json + env 覆盖）' })
  getVersion() {
    return this.version.get();
  }
}
