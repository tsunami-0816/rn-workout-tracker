/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { AuthService, maskPhone } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ERR } from '../common/error-codes';
import { AppError } from '../common/app-error';

/** ESM 模式下 jest.fn 需显式取用（@jest/globals 类型签名较严，包一层保 any 语义） */
const mfn = (impl?: any): any => (impl ? (jest as any).fn(impl) : (jest as any).fn());

/** AuthService 单测：频控 / 验证码校验 / 建号不产生 admin / 脱敏（C05、C03） */

function buildService(overrides: {
  demoCode?: string;
  cooldownSec?: string;
  user?: any;
  createdUser?: any;
} = {}) {
  const prisma = {
    user: {
      findUnique: mfn().mockResolvedValue(overrides.user ?? null),
      create: mfn().mockResolvedValue(overrides.createdUser ?? { id: 7, phone: '13900139000', role: 'user', nickname: '新手' }),
    },
  };
  const jwt = { signAsync: mfn().mockResolvedValue('signed.jwt.token') };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'DEMO_CODE') return overrides.demoCode ?? 'demo-code-from-env';
      if (key === 'SEND_CODE_COOLDOWN_SEC') return overrides.cooldownSec ?? '60';
      if (key === 'JWT_EXPIRES_IN') return '7d';
      return undefined;
    }),
  };
  const service = new AuthService(prisma as unknown as PrismaService, jwt as any, config as any);
  return { service, prisma, jwt, config };
}

describe('AuthService', () => {
  it('sendCode 首次返回 60s 冷却', () => {
    const { service } = buildService();
    expect(service.sendCode('13900139000')).toEqual({ cooldown: 60 });
  });

  it('sendCode 60s 内重复 → 42901 且带剩余秒数', () => {
    const { service } = buildService();
    service.sendCode('13900139000');
    let caught: AppError | null = null;
    try {
      service.sendCode('13900139000');
    } catch (err) {
      caught = err as AppError;
    }
    expect(caught?.code).toBe(ERR.CODE_TOO_FREQUENT);
    expect((caught?.bizData as any)?.remainSec).toBeGreaterThan(0);
  });

  it('login 验证码错误 → 40102', async () => {
    const { service } = buildService();
    await expect(service.login('13900139000', '000000')).rejects.toMatchObject({ code: ERR.CODE_INVALID });
  });

  it('login 新手机号自动建号且角色固定为 user（绝不产生 admin）', async () => {
    const { service, prisma } = buildService();
    prisma.user.create.mockResolvedValue({ id: 8, phone: '13900139000', role: 'user', nickname: '新手' });
    const result = await service.login('13900139000', 'demo-code-from-env');
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { phone: '13900139000', role: 'user' } });
    expect(result.token).toBe('signed.jwt.token');
    expect(result.user.role).toBe('user');
    expect(result.expiresIn).toBe(604800);
  });

  it('login 已存在的 admin 保留 admin 角色', async () => {
    const { service } = buildService({ user: { id: 1, phone: '13800138000', role: 'admin', nickname: '管理员' } });
    const result = await service.login('13800138000', 'demo-code-from-env');
    expect(result.user.role).toBe('admin');
  });

  it('login 缺 DEMO_CODE 配置 → 50001（不猜默认码）', async () => {
    const { service } = buildService({ demoCode: '' });
    await expect(service.login('13900139000', '123456')).rejects.toMatchObject({ code: ERR.INTERNAL });
  });

  it('me 返回脱敏手机号', async () => {
    const { service } = buildService({ user: { id: 1, phone: '13800138000', role: 'user', nickname: '张三' } });
    const me = await service.me(1);
    expect(me.phoneMasked).toBe('138****8000');
    expect(me.nickname).toBe('张三');
  });

  it('me 用户不存在 → 40401', async () => {
    const { service } = buildService();
    await expect(service.me(999)).rejects.toMatchObject({ code: ERR.NOT_FOUND });
  });

  it('maskPhone 非 11 位返回 ***', () => {
    expect(maskPhone('123')).toBe('***');
    expect(maskPhone('13900139000')).toBe('139****9000');
  });
});
