import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { StatsService } from './stats.service';

/** G4 统计（2 端点，另 5 个在 admin / version / health） */
@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('weekly')
  @ApiOperation({ summary: '本周打卡天数 / 总容量 / 近 4 周序列' })
  weekly(@CurrentUser() user: JwtPayload) {
    return this.stats.weekly(user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: '历史训练列表（按周回溯，最多 100 条）' })
  @ApiQuery({ name: 'weeks', required: false, example: 4 })
  history(
    @CurrentUser() user: JwtPayload,
    @Query('weeks', new DefaultValuePipe(4), ParseIntPipe) weeks: number,
  ) {
    return this.stats.history(user.sub, weeks);
  }
}
