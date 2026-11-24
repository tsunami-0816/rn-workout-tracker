/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { PlanService } from './plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { ERR } from '../common/error-codes';

/** PlanService 单测：本周完成度映射 / 今日推荐 / 越权读他人计划（C03） */
const mfn = (v?: any): any => (v ? (jest as any).fn(v) : (jest as any).fn());

function build() {
  const prisma = {
    plan: { findMany: mfn(), findFirst: mfn() },
    workoutLog: { groupBy: mfn(), findFirst: mfn() },
    exercise: { findMany: mfn() },
  };
  return { service: new PlanService(prisma as unknown as PrismaService), prisma };
}

describe('PlanService', () => {
  it('list 把 groupBy 结果映射到 weekDone，并给出今日推荐', async () => {
    const { service, prisma } = build();
    prisma.plan.findMany.mockResolvedValue([
      { id: 1n, name: '推 · 胸肩三头', dayType: 'push' },
      { id: 2n, name: '拉 · 背二头', dayType: 'pull' },
      { id: 3n, name: '腿 · 臀腿', dayType: 'legs' },
    ]);
    prisma.workoutLog.groupBy.mockResolvedValue([{ planId: 1n, _count: { _all: 2 } }]);
    prisma.workoutLog.findFirst.mockResolvedValue(null);
    const result = await service.list(2);
    expect(result.list.map((p) => p.weekDone)).toEqual([2, 0, 0]);
    expect(result.list[0].dayType).toBe('推');
    expect(result.todayPlanId).toBeGreaterThan(0);
    expect(result.todayWorkoutPlanId).toBeNull();
  });

  it('list 今天已开练时返回 todayWorkoutPlanId（前端据此置灰其他分化卡，F-02）', async () => {
    const { service, prisma } = build();
    prisma.plan.findMany.mockResolvedValue([
      { id: 1n, name: '推 · 胸肩三头', dayType: 'push' },
      { id: 2n, name: '拉 · 背二头', dayType: 'pull' },
      { id: 3n, name: '腿 · 臀腿', dayType: 'legs' },
    ]);
    prisma.workoutLog.groupBy.mockResolvedValue([]);
    prisma.workoutLog.findFirst.mockResolvedValue({ planId: 2n });
    const result = await service.list(2);
    expect(result.todayWorkoutPlanId).toBe(2);
  });

  it('list 无计划 → todayPlanId=null 且不报错', async () => {
    const { service, prisma } = build();
    prisma.plan.findMany.mockResolvedValue([]);
    prisma.workoutLog.groupBy.mockResolvedValue([]);
    prisma.workoutLog.findFirst.mockResolvedValue(null);
    const result = await service.list(2);
    expect(result.list).toEqual([]);
    expect(result.todayPlanId).toBeNull();
    expect(result.todayWorkoutPlanId).toBeNull();
  });

  it('current 无计划 → 40401', async () => {
    const { service, prisma } = build();
    prisma.plan.findMany.mockResolvedValue([]);
    await expect(service.current(2)).rejects.toMatchObject({ code: ERR.NOT_FOUND });
  });

  it('current 返回动作数量', async () => {
    const { service, prisma } = build();
    prisma.plan.findMany.mockResolvedValue([
      { id: 1n, name: '推', dayType: 'push', _count: { exercises: 12 } },
      { id: 2n, name: '拉', dayType: 'pull', _count: { exercises: 12 } },
      { id: 3n, name: '腿', dayType: 'legs', _count: { exercises: 12 } },
    ]);
    const result = await service.current(2);
    expect(result.exercisesCount).toBe(12);
  });

  it('exercises 读他人计划 → 40401（只认自己的 userId）', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue(null);
    await expect(service.exercises(2, 99)).rejects.toMatchObject({ code: ERR.NOT_FOUND });
  });

  it('exercises 返回动作清单（order 升序由查询保证）', async () => {
    const { service, prisma } = build();
    prisma.plan.findFirst.mockResolvedValue({ id: 1n });
    prisma.exercise.findMany.mockResolvedValue([
      { id: 5n, name: '卧推', targetSets: 4, targetReps: 10, orderNo: 1 },
    ]);
    const result = await service.exercises(2, 1);
    expect(result.list[0]).toEqual({ id: 5, name: '卧推', targetSets: 4, targetReps: 10, orderNo: 1 });
  });
});
