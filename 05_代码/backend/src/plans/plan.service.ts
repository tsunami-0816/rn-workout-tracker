import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { ERR } from '../common/error-codes';
import { isoWeekday, isoWeekStart, shanghaiDateString, toPrismaDate } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

const DAY_TYPE_LABELS: Record<string, string> = { push: '推', pull: '拉', legs: '腿' };

/**
 * 计划与动作清单：
 * - 列表含本周完成度（本周该计划已结束训练次数）
 * - current 用「ISO 星期 % 3」轮换今日推荐（架构 §L3）
 */
@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /plans */
  async list(userId: number): Promise<{
    list: Array<{ id: number; name: string; dayType: string; weekDone: number }>;
    todayPlanId: number | null;
    todayWorkoutPlanId: number | null;
  }> {
    const plans = await this.prisma.plan.findMany({
      where: { userId: BigInt(userId) },
      orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
    });
    const weekStart = toPrismaDate(isoWeekStart(shanghaiDateString()));

    const grouped = await this.prisma.workoutLog.groupBy({
      by: ['planId'],
      where: {
        userId: BigInt(userId),
        logDate: { gte: weekStart },
        finishedAt: { not: null },
      },
      _count: { _all: true },
    });
    const doneMap = new Map(grouped.map((g) => [Number(g.planId), g._count._all]));

    const list = plans.map((p) => ({
      id: Number(p.id),
      name: p.name,
      dayType: DAY_TYPE_LABELS[p.dayType] ?? p.dayType,
      weekDone: doneMap.get(Number(p.id)) ?? 0,
    }));
    const todayPlanId = plans.length > 0 ? list[(isoWeekday() - 1) % plans.length].id : null;

    // 今天是否已经真的开练、练的是哪份分化：前端据此把另外两张卡置灰（F-02）
    const todayLog = await this.prisma.workoutLog.findFirst({
      where: { userId: BigInt(userId), logDate: toPrismaDate(shanghaiDateString()) },
      orderBy: { id: 'desc' },
      select: { planId: true },
    });
    const todayWorkoutPlanId = todayLog ? Number(todayLog.planId) : null;

    return { list, todayPlanId, todayWorkoutPlanId };
  }

  /** GET /plans/current */
  async current(userId: number): Promise<{ id: number; name: string; dayType: string; exercisesCount: number }> {
    const plans = await this.prisma.plan.findMany({
      where: { userId: BigInt(userId) },
      orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { exercises: true } } },
    });
    if (plans.length === 0) throw new AppError(ERR.NOT_FOUND, '还没有训练计划');
    const plan = plans[(isoWeekday() - 1) % plans.length];
    return {
      id: Number(plan.id),
      name: plan.name,
      dayType: DAY_TYPE_LABELS[plan.dayType] ?? plan.dayType,
      exercisesCount: plan._count.exercises,
    };
  }

  /** GET /plans/:id/exercises（只允许自己的计划） */
  async exercises(
    userId: number,
    planId: number,
  ): Promise<{ list: Array<{ id: number; name: string; targetSets: number; targetReps: number; orderNo: number }> }> {
    const plan = await this.prisma.plan.findFirst({
      where: { id: BigInt(planId), userId: BigInt(userId) },
    });
    if (!plan) throw new AppError(ERR.NOT_FOUND, '计划不存在');

    const rows = await this.prisma.exercise.findMany({
      where: { planId: BigInt(planId) },
      orderBy: { orderNo: 'asc' },
    });
    return {
      list: rows.map((e) => ({
        id: Number(e.id),
        name: e.name,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        orderNo: e.orderNo,
      })),
    };
  }
}
