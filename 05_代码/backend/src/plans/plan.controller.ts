import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { PlanService } from './plan.service';

/** G2 计划（3 端点） */
@ApiTags('plans')
@Controller('plans')
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Get()
  @ApiOperation({ summary: '我的三日分化计划 + 本周完成度 + 今日推荐' })
  list(@CurrentUser() user: JwtPayload) {
    return this.plans.list(user.sub);
  }

  @Get('current')
  @ApiOperation({ summary: '今日推荐计划（ISO 星期 % 3）' })
  current(@CurrentUser() user: JwtPayload) {
    return this.plans.current(user.sub);
  }

  @Get(':id/exercises')
  @ApiOperation({ summary: '计划动作清单（order_no 升序，100 条性能口径）' })
  exercises(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.plans.exercises(user.sub, id);
  }
}
