/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { WorkoutService } from './workout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { ERR } from '../common/error-codes';

/** ESM 模式下 jest.fn 需显式取用 */
const mfn = (impl?: any): any => (impl ? (jest as any).fn(impl) : (jest as any).fn());

/** WorkoutService 单测：当日复用 / 幂等 upsert / 容量重算 / 结束与归属校验（C04、C05） */

interface Row {
  id: bigint;
  userId: bigint;
  planId: bigint;
  logDate: Date;
  totalVolume: number | string;
  finishedAt: Date | null;
  plan?: { name: string };
  setLogs?: any[];
}

function row(partial: Partial<Row> = {}): Row {
  return {
    id: 1n,
    userId: 2n,
    planId: 3n,
    logDate: new Date('2026-11-23T00:00:00.000Z'),
    totalVolume: 0,
    finishedAt: null,
    plan: { name: '推 · 胸肩三头' },
    ...partial,
  };
}

function build() {
  const prisma = {
    plan: { findFirst: mfn() },
    workoutLog: {
      findFirst: mfn(),
      findUnique: mfn(),
      create: mfn(),
      update: mfn(),
      findMany: mfn(),
      count: mfn(),
    },
    exercise: { findFirst: mfn() },
    setLog: {
      findFirst: mfn(),
      upsert: mfn(),
      update: mfn(),
      delete: mfn(),
    },
    $executeRaw: mfn(),
    $transaction: mfn(),
  };
  const cache = { invalidateByPrefix: mfn() };
  const service = new WorkoutService(prisma as unknown as PrismaService, cache as unknown as CacheService);
  return { service, prisma, cache };
}

/** 事务回调形态：把 tx 与 prisma 共用同一批 mock */
function txForm(prisma: any) {
  prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
}

describe('WorkoutService', () => {
  it('start 计划不存在 → 40401', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue(null);
    await expect(service.start(2, 3)).rejects.toMatchObject({ code: ERR.NOT_FOUND });
  });

  it('start 同日已有记录 → 复用同一 workoutId，不再建新记录', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue({ id: 3n });
    prisma.workoutLog.findFirst.mockResolvedValue(row({ id: 11n, totalVolume: 120 }));
    const result = await service.start(2, 3);
    expect(result.workoutId).toBe(11);
    expect(prisma.workoutLog.create).not.toHaveBeenCalled();
  });

  it('start 无当日记录 → 事务内二次查重后创建', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue({ id: 3n });
    prisma.workoutLog.findFirst.mockResolvedValue(null);
    prisma.workoutLog.create.mockResolvedValue(row({ id: 12n }));
    txForm(prisma);
    const created = await service.start(2, 3);
    expect(created.workoutId).toBe(12);
    expect(prisma.workoutLog.create).toHaveBeenCalledTimes(1);
  });

  it('start 同日换分化卡 → 40002 并给出中文原因（F-02）', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue({ id: 4n, name: '拉 · 背二头' });
    prisma.workoutLog.findFirst.mockResolvedValue(
      row({ id: 11n, planId: 3n, plan: { name: '推 · 胸肩三头' } }),
    );
    const err = await service.start(2, 4).catch((e) => e);
    expect(err.code).toBe(ERR.STATE_CONFLICT);
    expect((err.getResponse() as { message: string }).message).toContain('今天已按「推 · 胸肩三头」开练');
    expect(err.bizData).toMatchObject({ field: 'planId' });
  });

  it('start 并发撞唯一索引 P2002 → 重查返回同一 workoutId（F-07）', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue({ id: 3n });
    prisma.workoutLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ id: 13n, planId: 3n, totalVolume: 60 }));
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    const result = await service.start(2, 3);
    expect(result.workoutId).toBe(13);
    expect(prisma.workoutLog.create).not.toHaveBeenCalled();
  });

  it('createSet 已结束的训练 → 40002', async () => {
    const { service, prisma } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(row({ finishedAt: new Date() }));
    await expect(
      service.createSet(2, 1, { exerciseId: 5, setNo: 1, weight: 40, reps: 10, done: true }),
    ).rejects.toMatchObject({ code: ERR.STATE_CONFLICT });
  });

  it('createSet 动作不属于该计划 → 40001 并指出字段', async () => {
    const { service, prisma } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(row());
    prisma.exercise.findFirst.mockResolvedValue(null);
    const err = await service
      .createSet(2, 1, { exerciseId: 5, setNo: 1, weight: 40, reps: 10, done: true })
      .catch((e) => e);
    expect(err.code).toBe(ERR.PARAM_INVALID);
    expect(err.bizData).toMatchObject({ field: 'exerciseId' });
  });

  it('createSet 走 upsert（幂等键 workoutLogId_exerciseId_setNo）并返回重算后的容量', async () => {
    const { service, prisma, cache } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(row());
    prisma.exercise.findFirst.mockResolvedValue({ id: 5n });
    prisma.setLog.upsert.mockResolvedValue({
      id: 21n,
      exerciseId: 5n,
      setNo: 1,
      weight: 40,
      reps: 10,
      done: true,
    });
    prisma.workoutLog.findUnique.mockResolvedValue(row({ totalVolume: 400 }));
    txForm(prisma);
    const result = await service.createSet(2, 1, { exerciseId: 5, setNo: 1, weight: 40, reps: 10, done: true });
    expect(prisma.setLog.upsert).toHaveBeenCalledTimes(1);
    const args = prisma.setLog.upsert.mock.calls[0][0];
    expect(args.where.workoutLogId_exerciseId_setNo).toEqual({
      workoutLogId: 1n,
      exerciseId: 5n,
      setNo: 1,
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.totalVolume).toBe(400);
    // 写后失效统计缓存（打卡后统计立刻变）
    expect(cache.invalidateByPrefix).toHaveBeenCalledWith('stats:weekly:2');
    expect(cache.invalidateByPrefix).toHaveBeenCalledWith('stats:history:2');
  });

  it('finish 已结束 → 幂等返回原时间，不重复 update', async () => {
    const { service, prisma } = build();
    const finishedAt = new Date('2026-11-23T03:00:00.000Z');
    prisma.workoutLog.findFirst.mockResolvedValue(row({ finishedAt, totalVolume: 500 }));
    const result = await service.finish(2, 1);
    expect(result.finishedAt).toBe(finishedAt.toISOString());
    expect(prisma.workoutLog.update).not.toHaveBeenCalled();
  });

  it('detail 非本人 workout → 40401（只认 JWT sub）', async () => {
    const { service, prisma } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(null);
    await expect(service.detail(2, 99)).rejects.toMatchObject({ code: ERR.NOT_FOUND });
  });

  it('detail 返回组次与容量', async () => {
    const { service, prisma } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(
      row({
        totalVolume: 400,
        setLogs: [{ id: 21n, exerciseId: 5n, setNo: 1, weight: 40, reps: 10, done: true }],
      }),
    );
    const detail = await service.detail(2, 1);
    expect(detail.totalVolume).toBe(400);
    expect(detail.sets[0]).toEqual({ id: 21, exerciseId: 5, setNo: 1, weight: 40, reps: 10, done: true });
  });

  it('deleteSet 删除后容量回落', async () => {
    const { service, prisma } = build();
    prisma.workoutLog.findFirst.mockResolvedValue(row());
    prisma.setLog.findFirst.mockResolvedValue({ id: 21n });
    prisma.workoutLog.findUnique.mockResolvedValue(row({ totalVolume: 0 }));
    txForm(prisma);
    const result = await service.deleteSet(2, 1, 21);
    expect(prisma.setLog.delete).toHaveBeenCalledTimes(1);
    expect(result.totalVolume).toBe(0);
  });
});
