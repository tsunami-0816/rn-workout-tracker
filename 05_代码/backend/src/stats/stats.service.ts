import { Injectable } from '@nestjs/common';
import { CacheService } from '../common/cache.service';
import { addDays, isoWeekStart, recentWeekStarts, shanghaiDateString, toPrismaDate } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

interface WeeklyRow {
  days: number | string;
  volume: string | number;
}
interface SeriesRow {
  week_start: Date | string;
  volume: string | number;
}
interface HistoryRow {
  log_date: Date | string;
  total_volume: string | number;
  name: string;
}

/**
 * 统计（L5）：
 * - 本周 = ISO 周（Asia/Shanghai，周一 00:00 起）
 * - 打卡天数 = COUNT(DISTINCT log_date)，总容量 = SUM(total_volume)
 * - 近 4 周序列用 date_trunc('week') 分组，缺周补 0
 * - 60s 进程内缓存，写组次后按用户前缀失效（打卡后立刻变）
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** GET /stats/weekly */
  async weekly(userId: number): Promise<{
    days: number;
    totalVolume: number;
    series: Array<{ weekStart: string; volume: number }>;
  }> {
    const weekStart = isoWeekStart(shanghaiDateString());
    const cacheKey = `stats:weekly:${userId}:${weekStart}`;
    const cached = this.cache.get<{ days: number; totalVolume: number; series: Array<{ weekStart: string; volume: number }> }>(
      cacheKey,
    );
    if (cached) return cached;

    const starts = recentWeekStarts(4);
    const rangeStart = toPrismaDate(starts[0]);
    // 「本周」与 4 周序列是两个范围：周累计必须用 [本周一, 下周一) 闭开区间，
    // 不能复用 4 周起点，否则「本周打卡 12 天」这类不可能值会直接暴露给用户（F-01）。
    const thisWeekStart = toPrismaDate(weekStart);
    const nextWeekStart = toPrismaDate(addDays(weekStart, 7));

    const weeklyRows = (await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT log_date)::int AS days,
             COALESCE(SUM(total_volume), 0) AS volume
      FROM workout_logs
      WHERE user_id = ${userId}
        AND log_date >= ${thisWeekStart}
        AND log_date < ${nextWeekStart}
    `) as unknown as WeeklyRow[];

    const seriesRows = (await this.prisma.$queryRaw`
      SELECT date_trunc('week', log_date)::date AS week_start,
             COALESCE(SUM(total_volume), 0) AS volume
      FROM workout_logs
      WHERE user_id = ${userId} AND log_date >= ${rangeStart}
      GROUP BY 1
      ORDER BY 1
    `) as unknown as SeriesRow[];

    const volumeMap = new Map<string, number>();
    for (const row of seriesRows) {
      const key = (row.week_start instanceof Date
        ? row.week_start.toISOString()
        : String(row.week_start)
      ).slice(0, 10);
      volumeMap.set(key, Number(row.volume));
    }

    const result = {
      days: Number(weeklyRows[0]?.days ?? 0),
      totalVolume: Number(weeklyRows[0]?.volume ?? 0),
      series: starts.map((s) => ({ weekStart: s, volume: volumeMap.get(s) ?? 0 })),
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  /** GET /stats/history?weeks=4 */
  async history(userId: number, weeks: number): Promise<{
    list: Array<{ logDate: string; totalVolume: number; planName: string }>;
  }> {
    const key = `stats:history:${userId}:${weeks}`;
    const cached = this.cache.get<{ list: Array<{ logDate: string; totalVolume: number; planName: string }> }>(key);
    if (cached) return cached;

    const starts = recentWeekStarts(Math.min(52, Math.max(1, weeks)));
    const rangeStart = toPrismaDate(starts[0]);
    const rows = (await this.prisma.$queryRaw`
      SELECT w.log_date, w.total_volume, p.name
      FROM workout_logs w
      JOIN plans p ON p.id = w.plan_id
      WHERE w.user_id = ${userId} AND w.log_date >= ${rangeStart}
      ORDER BY w.log_date DESC, w.id DESC
      LIMIT 100
    `) as unknown as HistoryRow[];

    const result = {
      list: rows.map((r) => ({
        logDate: (r.log_date instanceof Date ? r.log_date.toISOString() : String(r.log_date)).slice(0, 10),
        totalVolume: Number(r.total_volume),
        planName: r.name,
      })),
    };
    this.cache.set(key, result);
    return result;
  }
}
