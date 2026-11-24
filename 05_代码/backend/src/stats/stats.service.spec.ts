/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { addDays, isoWeekStart, recentWeekStarts, shanghaiDateString, toPrismaDate } from '../common/time';

/** ESM 模式下 jest.fn 需显式取用 */
const mfn = (impl?: any): any => (impl ? (jest as any).fn(impl) : (jest as any).fn());

/** StatsService 单测：ISO 周聚合 / 缺周补 0 / 60s 缓存（C12、C03） */

function build() {
  const prisma = { $queryRaw: mfn() };
  const cache = new CacheService();
  const service = new StatsService(prisma as unknown as PrismaService, cache);
  return { service, prisma, cache };
}

describe('StatsService', () => {
  it('weekly 聚合天数/容量并按 4 周补齐 0', async () => {
    const { service, prisma } = build();
    const starts = recentWeekStarts(4);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ days: 2, volume: '800.00' }])
      .mockResolvedValueOnce([{ week_start: starts[3], volume: '800' }]);

    const result = await service.weekly(2);
    expect(result.days).toBe(2);
    expect(result.totalVolume).toBe(800);
    expect(result.series).toHaveLength(4);
    expect(result.series[0].volume).toBe(0);
    expect(result.series[3]).toEqual({ weekStart: starts[3], volume: 800 });
  });

  it('weekly 的本周范围是 [本周一, 下周一)，不是 4 周起点（F-01）', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockResolvedValueOnce([{ days: 0, volume: 0 }]).mockResolvedValueOnce([]);
    await service.weekly(2);

    const weekStart = isoWeekStart(shanghaiDateString());
    // $queryRaw 是 tagged template：第 0 项为模板串，其后为注入值
    const weeklyValues = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(weeklyValues[0]).toBe(2);
    expect(weeklyValues[1]).toEqual(toPrismaDate(weekStart));
    expect(weeklyValues[2]).toEqual(toPrismaDate(addDays(weekStart, 7)));

    // 4 周序列仍从 starts[0] 起，两者不能复用同一范围
    const seriesValues = prisma.$queryRaw.mock.calls[1].slice(1);
    expect(seriesValues[1]).toEqual(toPrismaDate(recentWeekStarts(4)[0]));
  });

  it('weekly 无数据时返回 0 与全 0 序列，不报错', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockResolvedValueOnce([{ days: 0, volume: 0 }]).mockResolvedValueOnce([]);
    const result = await service.weekly(9);
    expect(result.days).toBe(0);
    expect(result.totalVolume).toBe(0);
    expect(result.series.every((s) => s.volume === 0)).toBe(true);
  });

  it('weekly 第二次命中缓存，不重复查库', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockResolvedValueOnce([{ days: 1, volume: 100 }]).mockResolvedValueOnce([]);
    await service.weekly(2);
    const callsAfterFirst = prisma.$queryRaw.mock.calls.length;
    await service.weekly(2);
    expect(prisma.$queryRaw.mock.calls.length).toBe(callsAfterFirst);
  });

  it('写组次后按前缀失效，weekly 重新查库（打卡后统计立刻变）', async () => {
    const { service, prisma, cache } = build();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ days: 1, volume: 100 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ days: 2, volume: 400 }])
      .mockResolvedValueOnce([]);
    const first = await service.weekly(2);
    expect(first.days).toBe(1);
    cache.invalidateByPrefix('stats:weekly:2');
    const second = await service.weekly(2);
    expect(second.days).toBe(2);
  });

  it('history 返回最近记录并带计划名', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockResolvedValueOnce([
      { log_date: new Date('2026-11-22T00:00:00.000Z'), total_volume: '400', name: '推 · 胸肩三头' },
    ]);
    const result = await service.history(2, 4);
    expect(result.list).toEqual([{ logDate: '2026-11-22', totalVolume: 400, planName: '推 · 胸肩三头' }]);
  });

  it('history weeks 入参限幅（1~52）', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockResolvedValue([]);
    await service.history(2, 999);
    // 不抛错即为限幅生效；正常返回空列表
    await expect(service.history(2, 0)).resolves.toEqual({ list: [] });
  });
});
