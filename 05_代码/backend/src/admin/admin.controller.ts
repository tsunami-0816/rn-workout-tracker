import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { AppError } from '../common/app-error';
import { ERR } from '../common/error-codes';
import { AdminService } from './admin.service';

/** G4 运营（admin 3 端点，role=admin 才可达） */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('workouts')
  @ApiOperation({ summary: '全站训练记录（脱敏 + 日期筛选，size 上限 50）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-11-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-11-30' })
  workouts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.workouts(this.clampPage(page), this.clampSize(size), {
      from: this.assertDate(from, 'from'),
      to: this.assertDate(to, 'to'),
    });
  }

  @Get('users')
  @ApiOperation({ summary: '全站用户（脱敏）' })
  users(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.admin.users(this.clampPage(page), this.clampSize(size));
  }

  @Get('stats/summary')
  @ApiOperation({ summary: '全站汇总（用户数 / 训练数 / 总容量）' })
  summary() {
    return this.admin.summary();
  }

  private clampPage(page: number): number {
    return Math.max(1, page);
  }

  private clampSize(size: number): number {
    return Math.min(50, Math.max(1, size));
  }

  /** 日期筛选只接受 YYYY-MM-DD，其余 40001 指明字段 */
  private assertDate(value: string | undefined, field: string): string | undefined {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new AppError(ERR.PARAM_INVALID, `${field} 必须是 YYYY-MM-DD`, { field });
    }
    return value;
  }
}
