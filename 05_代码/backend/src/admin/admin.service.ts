import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { ERR } from '../common/error-codes';
import { maskPhone } from '../auth/auth.service';
import { shanghaiDateString, toPrismaDate } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Admin 只读接口（L6）：
 * - 全部脱敏，响应不含完整手机号
 * - size 上限 50；普通用户被 RolesGuard 挡在 40301
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /admin/workouts?page&size&from&to */
  async workouts(
    page: number,
    size: number,
    range: DateRange,
  ): Promise<{
    list: Array<{ id: number; phoneMasked: string; logDate: string; totalVolume: number }>;
    total: number;
    page: number;
    size: number;
  }> {
    const where = {
      ...(range.from || range.to
        ? {
            logDate: {
              ...(range.from ? { gte: toPrismaDate(range.from) } : {}),
              ...(range.to ? { lte: toPrismaDate(range.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workoutLog.findMany({
        where,
        orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * size,
        take: size,
        include: { user: { select: { phone: true } } },
      }),
      this.prisma.workoutLog.count({ where }),
    ]);

    return {
      list: rows.map((r) => ({
        id: Number(r.id),
        phoneMasked: maskPhone(r.user.phone),
        logDate: r.logDate.toISOString().slice(0, 10),
        totalVolume: Number(r.totalVolume),
      })),
      total,
      page,
      size,
    };
  }

  /** GET /admin/users?page&size */
  async users(
    page: number,
    size: number,
  ): Promise<{
    list: Array<{ id: number; phoneMasked: string; role: string; createdAt: string }>;
    total: number;
  }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.user.count(),
    ]);
    return {
      list: rows.map((u) => ({
        id: Number(u.id),
        phoneMasked: maskPhone(u.phone),
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** GET /admin/stats/summary */
  async summary(): Promise<{ userCount: number; workoutCount: number; totalVolume: number }> {
    const [userCount, workoutAgg] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.workoutLog.aggregate({ _count: { _all: true }, _sum: { totalVolume: true } }),
    ]);
    return {
      userCount,
      workoutCount: workoutAgg._count._all,
      totalVolume: Number(workoutAgg._sum.totalVolume ?? 0),
    };
  }
}
