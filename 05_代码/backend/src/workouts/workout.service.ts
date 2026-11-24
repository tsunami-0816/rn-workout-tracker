import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { ERR } from '../common/error-codes';
import { CacheService } from '../common/cache.service';
import { shanghaiDateString, toPrismaDate } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateSetDto, UpdateSetDto } from './dtos';

interface SetDto {
  id: number;
  exerciseId: number;
  setNo: number;
  weight: number;
  reps: number;
  done: boolean;
}

/**
 * 训练与组次（M6 幂等核心）：
 * - start 先查当日记录，有则复用；同一天换了分化卡 → 40002 明确告知（F-02）
 * - 组次 POST 用复合唯一键 upsert：连点 3 次数据库仍 1 行
 * - 每次写组次都在同一事务内重算 total_volume（只算 done 组）
 * - (user_id, log_date) 唯一索引兜底并发双开，P2002 后重查返回同一 id（F-07）
 */
@Injectable()
export class WorkoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** POST /workouts/start */
  async start(userId: number, planId: number): Promise<{ workoutId: number; logDate: string; totalVolume: number }> {
    const plan = await this.prisma.plan.findFirst({ where: { id: BigInt(planId), userId: BigInt(userId) } });
    if (!plan) throw new AppError(ERR.NOT_FOUND, '计划不存在');

    const logDate = shanghaiDateString();
    const existing = await this.prisma.workoutLog.findFirst({
      where: { userId: BigInt(userId), logDate: toPrismaDate(logDate) },
      orderBy: { id: 'desc' },
      include: { plan: { select: { name: true } } },
    });
    if (existing) {
      // 一天一次训练：已按别的分化开练时明确拒绝，附带中文原因和替代路径（F-02）
      this.assertSamePlan(existing.planId, planId, plan.name, existing.plan.name);
      return {
        workoutId: Number(existing.id),
        logDate,
        totalVolume: Number(existing.totalVolume),
      };
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const again = await tx.workoutLog.findFirst({
          where: { userId: BigInt(userId), logDate: toPrismaDate(logDate) },
          include: { plan: { select: { name: true } } },
        });
        if (again) {
          this.assertSamePlan(again.planId, planId, plan.name, again.plan.name);
          return again;
        }
        return tx.workoutLog.create({
          data: { userId: BigInt(userId), planId: BigInt(planId), logDate: toPrismaDate(logDate) },
        });
      });
      return { workoutId: Number(created.id), logDate, totalVolume: Number(created.totalVolume) };
    } catch (error) {
      // 并发双开被唯一索引拦下：重查当日记录，按同一套 plan 语义返回或拒绝
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const winner = await this.prisma.workoutLog.findFirst({
        where: { userId: BigInt(userId), logDate: toPrismaDate(logDate) },
        orderBy: { id: 'desc' },
        include: { plan: { select: { name: true } } },
      });
      if (!winner) throw error;
      this.assertSamePlan(winner.planId, planId, plan.name, winner.plan.name);
      return { workoutId: Number(winner.id), logDate, totalVolume: Number(winner.totalVolume) };
    }
  }

  /** 当天已有训练且换了一份计划 → 40002，文案直接可展示 */
  private assertSamePlan(existingPlanId: bigint, planId: number, planName: string, existingPlanName: string): void {
    if (Number(existingPlanId) !== planId) {
      throw new AppError(
        ERR.STATE_CONFLICT,
        `今天已按「${existingPlanName}」开练，明天再练「${planName}」`,
        { field: 'planId' },
      );
    }
  }

  /** GET /workouts?page&size */
  async list(
    userId: number,
    page: number,
    size: number,
  ): Promise<{
    list: Array<{ id: number; logDate: string; totalVolume: number; finished: boolean }>;
    total: number;
    page: number;
    size: number;
  }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workoutLog.findMany({
        where: { userId: BigInt(userId) },
        orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.workoutLog.count({ where: { userId: BigInt(userId) } }),
    ]);

    return {
      list: rows.map((r) => ({
        id: Number(r.id),
        logDate: r.logDate.toISOString().slice(0, 10),
        totalVolume: Number(r.totalVolume),
        finished: r.finishedAt !== null,
      })),
      total,
      page,
      size,
    };
  }

  /** GET /workouts/:id */
  async detail(
    userId: number,
    workoutId: number,
  ): Promise<{
    id: number;
    planId: number;
    logDate: string;
    totalVolume: number;
    finished: boolean;
    sets: SetDto[];
  }> {
    const workout = await this.prisma.workoutLog.findFirst({
      where: { id: BigInt(workoutId), userId: BigInt(userId) },
      include: { setLogs: { orderBy: [{ exerciseId: 'asc' }, { setNo: 'asc' }] } },
    });
    if (!workout) throw new AppError(ERR.NOT_FOUND, '训练记录不存在');

    return {
      id: Number(workout.id),
      planId: Number(workout.planId),
      logDate: workout.logDate.toISOString().slice(0, 10),
      totalVolume: Number(workout.totalVolume),
      finished: workout.finishedAt !== null,
      sets: workout.setLogs.map((s) => ({
        id: Number(s.id),
        exerciseId: Number(s.exerciseId),
        setNo: s.setNo,
        weight: Number(s.weight),
        reps: s.reps,
        done: s.done,
      })),
    };
  }

  /** POST /workouts/:id/sets —— 幂等 upsert + 事务重算容量 */
  async createSet(
    userId: number,
    workoutId: number,
    dto: CreateSetDto,
  ): Promise<{ setLog: SetDto; totalVolume: number }> {
    const workout = await this.requireWorkout(userId, workoutId);
    if (workout.finishedAt) throw new AppError(ERR.STATE_CONFLICT, '本次训练已结束');

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: BigInt(dto.exerciseId), planId: workout.planId },
    });
    if (!exercise) throw new AppError(ERR.PARAM_INVALID, '动作不属于本次训练的计划', { field: 'exerciseId' });

    const result = await this.prisma.$transaction(async (tx) => {
      const setLog = await tx.setLog.upsert({
        where: {
          workoutLogId_exerciseId_setNo: {
            workoutLogId: BigInt(workoutId),
            exerciseId: BigInt(dto.exerciseId),
            setNo: dto.setNo,
          },
        },
        create: {
          workoutLogId: BigInt(workoutId),
          exerciseId: BigInt(dto.exerciseId),
          setNo: dto.setNo,
          weight: dto.weight,
          reps: dto.reps,
          done: dto.done,
        },
        update: { weight: dto.weight, reps: dto.reps, done: dto.done, updatedAt: new Date() },
      });
      const totalVolume = await this.recalcVolume(tx, workoutId);
      return { setLog, totalVolume };
    });

    this.invalidateStats(userId);
    return {
      setLog: {
        id: Number(result.setLog.id),
        exerciseId: Number(result.setLog.exerciseId),
        setNo: result.setLog.setNo,
        weight: Number(result.setLog.weight),
        reps: result.setLog.reps,
        done: result.setLog.done,
      },
      totalVolume: result.totalVolume,
    };
  }

  /** PATCH /workouts/:id/sets/:setId */
  async updateSet(
    userId: number,
    workoutId: number,
    setId: number,
    dto: UpdateSetDto,
  ): Promise<{ setLog: SetDto; totalVolume: number }> {
    const workout = await this.requireWorkout(userId, workoutId);
    if (workout.finishedAt) throw new AppError(ERR.STATE_CONFLICT, '本次训练已结束');

    const target = await this.prisma.setLog.findFirst({
      where: { id: BigInt(setId), workoutLogId: BigInt(workoutId) },
    });
    if (!target) throw new AppError(ERR.NOT_FOUND, '组次不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      const setLog = await tx.setLog.update({
        where: { id: BigInt(setId) },
        data: {
          ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
          ...(dto.reps !== undefined ? { reps: dto.reps } : {}),
          ...(dto.done !== undefined ? { done: dto.done } : {}),
          updatedAt: new Date(),
        },
      });
      const totalVolume = await this.recalcVolume(tx, workoutId);
      return { setLog, totalVolume };
    });

    this.invalidateStats(userId);
    return {
      setLog: {
        id: Number(result.setLog.id),
        exerciseId: Number(result.setLog.exerciseId),
        setNo: result.setLog.setNo,
        weight: Number(result.setLog.weight),
        reps: result.setLog.reps,
        done: result.setLog.done,
      },
      totalVolume: result.totalVolume,
    };
  }

  /** DELETE /workouts/:id/sets/:setId */
  async deleteSet(userId: number, workoutId: number, setId: number): Promise<{ totalVolume: number }> {
    const workout = await this.requireWorkout(userId, workoutId);
    if (workout.finishedAt) throw new AppError(ERR.STATE_CONFLICT, '本次训练已结束');

    const target = await this.prisma.setLog.findFirst({
      where: { id: BigInt(setId), workoutLogId: BigInt(workoutId) },
    });
    if (!target) throw new AppError(ERR.NOT_FOUND, '组次不存在');

    const totalVolume = await this.prisma.$transaction(async (tx) => {
      await tx.setLog.delete({ where: { id: BigInt(setId) } });
      return this.recalcVolume(tx, workoutId);
    });
    this.invalidateStats(userId);
    return { totalVolume };
  }

  /** POST /workouts/:id/finish（幂等：已结束直接返回原时间） */
  async finish(userId: number, workoutId: number): Promise<{ finishedAt: string; totalVolume: number }> {
    const workout = await this.requireWorkout(userId, workoutId);
    if (workout.finishedAt) {
      return { finishedAt: workout.finishedAt.toISOString(), totalVolume: Number(workout.totalVolume) };
    }
    const updated = await this.prisma.workoutLog.update({
      where: { id: BigInt(workoutId) },
      data: { finishedAt: new Date() },
    });
    this.invalidateStats(userId);
    return { finishedAt: (updated.finishedAt ?? new Date()).toISOString(), totalVolume: Number(updated.totalVolume) };
  }

  /** 归属校验：只认 JWT sub，客户端传不了 userId */
  private async requireWorkout(userId: number, workoutId: number) {
    const workout = await this.prisma.workoutLog.findFirst({
      where: { id: BigInt(workoutId), userId: BigInt(userId) },
    });
    if (!workout) throw new AppError(ERR.NOT_FOUND, '训练记录不存在');
    return workout;
  }

  /** 事务内重算容量（参数化 SQL，禁字符串拼接） */
  private async recalcVolume(tx: Prisma.TransactionClient, workoutId: number): Promise<number> {
    await tx.$executeRaw`
      UPDATE workout_logs
      SET total_volume = COALESCE((
        SELECT SUM(weight * reps) FROM set_logs
        WHERE workout_log_id = ${workoutId} AND done = true
      ), 0)
      WHERE id = ${workoutId}
    `;
    const row = await tx.workoutLog.findUnique({ where: { id: BigInt(workoutId) } });
    return Number(row?.totalVolume ?? 0);
  }

  /** 写后失效：统计缓存按用户前缀清掉，保证打卡后立刻变 */
  private invalidateStats(userId: number): void {
    this.cache.invalidateByPrefix(`stats:weekly:${userId}`);
    this.cache.invalidateByPrefix(`stats:history:${userId}`);
  }
}
