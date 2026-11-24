import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Seed：2 账号 + 3 计划（各 12 动作）
 * 幂等：按 phone / (user, dayType) / (plan, orderNo) 先查后写，可重复执行
 */
const PLANS: Array<{ dayType: 'push' | 'pull' | 'legs'; name: string; exercises: string[] }> = [
  {
    dayType: 'push',
    name: '推日 · 胸肩三头',
    exercises: [
      '杠铃卧推',
      '上斜哑铃卧推',
      '哑铃飞鸟',
      '双杠臂屈伸',
      '坐姿推肩',
      '哑铃侧平举',
      '绳索下压',
      '仰卧臂屈伸',
      '窄距卧推',
      '史密斯机推举',
      '俯卧撑',
      '器械夹胸',
    ],
  },
  {
    dayType: 'pull',
    name: '拉日 · 背二头',
    exercises: [
      '引体向上',
      '高位下拉',
      '杠铃划船',
      '坐姿划船',
      '单臂哑铃划船',
      '直臂下压',
      '面拉',
      '杠铃弯举',
      '哑铃锤式弯举',
      '牧师凳弯举',
      '反向飞鸟',
      '耸肩',
    ],
  },
  {
    dayType: 'legs',
    name: '腿日 · 腿臀',
    exercises: [
      '杠铃深蹲',
      '腿举',
      '罗马尼亚硬拉',
      '腿屈伸',
      '腿弯举',
      '站姿提踵',
      '箭步蹲',
      '保加利亚分腿蹲',
      '臀桥',
      '髋外展',
      '坐姿提踵',
      '山羊挺身',
    ],
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL 未配置');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const admin = await prisma.user.upsert({
      where: { phone: '13800138000' },
      create: { phone: '13800138000', nickname: '管理员', role: 'admin' },
      update: { role: 'admin', nickname: '管理员' },
    });
    const user = await prisma.user.upsert({
      where: { phone: '13900139000' },
      create: { phone: '13900139000', nickname: '训练者', role: 'user' },
      update: { role: 'user' },
    });

    for (const owner of [admin, user]) {
      for (const [index, spec] of PLANS.entries()) {
        let plan = await prisma.plan.findFirst({ where: { userId: owner.id, dayType: spec.dayType } });
        if (!plan) {
          plan = await prisma.plan.create({
            data: { userId: owner.id, name: spec.name, dayType: spec.dayType, sortNo: index + 1 },
          });
        }
        for (const [orderIndex, name] of spec.exercises.entries()) {
          const orderNo = orderIndex + 1;
          const exists = await prisma.exercise.findFirst({ where: { planId: plan.id, orderNo } });
          if (!exists) {
            await prisma.exercise.create({
              data: {
                planId: plan.id,
                name,
                targetSets: 4,
                targetReps: 10,
                orderNo,
              },
            });
          }
        }
      }
    }

    const [users, plans, exercises] = await Promise.all([
      prisma.user.count(),
      prisma.plan.count(),
      prisma.exercise.count(),
    ]);
    console.log(`seed 完成：users=${users} plans=${plans} exercises=${exercises}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
