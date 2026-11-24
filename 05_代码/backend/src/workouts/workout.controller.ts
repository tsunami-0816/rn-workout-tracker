import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../common/decorators';
import { CreateSetDto, StartWorkoutDto, UpdateSetDto } from './dtos';
import { WorkoutService } from './workout.service';

/** G3 训练与记录（7 端点） */
@ApiTags('workouts')
@Controller('workouts')
export class WorkoutController {
  constructor(private readonly workouts: WorkoutService) {}

  @Get()
  @ApiOperation({ summary: '我的训练记录（分页，size 上限 50）' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'size', required: false, example: 20 })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(1, size));
    return this.workouts.list(user.sub, safePage, safeSize);
  }

  @Post('start')
  @HttpCode(200)
  @ApiOperation({ summary: '开始今日训练（同一天复用同一 workout）' })
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartWorkoutDto) {
    return this.workouts.start(user.sub, dto.planId);
  }

  @Get(':id')
  @ApiOperation({ summary: '训练详情（含组次）' })
  detail(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.workouts.detail(user.sub, id);
  }

  @Post(':id/sets')
  @HttpCode(200)
  @ApiOperation({ summary: '提交组次（复合唯一键幂等，事务重算容量）' })
  createSet(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSetDto,
  ) {
    return this.workouts.createSet(user.sub, id, dto);
  }

  @Patch(':id/sets/:setId')
  @ApiOperation({ summary: '修改组次（重量/次数/完成态）' })
  updateSet(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('setId', ParseIntPipe) setId: number,
    @Body() dto: UpdateSetDto,
  ) {
    return this.workouts.updateSet(user.sub, id, setId, dto);
  }

  @Delete(':id/sets/:setId')
  @ApiOperation({ summary: '删除组次（容量回落）' })
  deleteSet(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Param('setId', ParseIntPipe) setId: number,
  ) {
    return this.workouts.deleteSet(user.sub, id, setId);
  }

  @Post(':id/finish')
  @HttpCode(200)
  @ApiOperation({ summary: '结束本次训练（幂等）' })
  finish(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.workouts.finish(user.sub, id);
  }
}
