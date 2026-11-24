import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** 健康检查（#20，公开）：DB 不通返回 503 + db:'down' */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '服务与数据库健康状态' })
  async health(@Res({ passthrough: true }) res: Response): Promise<{
    status: 'up';
    db: 'up' | 'down';
    uptimeSec: number;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', db: 'up', uptimeSec: Math.round(process.uptime()) };
    } catch {
      res.status(503);
      return { status: 'up', db: 'down', uptimeSec: Math.round(process.uptime()) };
    }
  }
}
