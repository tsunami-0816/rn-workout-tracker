/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { ERR } from '../error-codes';

/** 守卫单测：@Public 豁免 / 无 token 40101 / 越权 40301（C05 关键项） */
const mfn = (v?: any): any => (v ? (jest as any).fn(v) : (jest as any).fn());

function ctx(req: any) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('JwtAuthGuard', () => {
  it('@Public 路由直接放行', async () => {
    const reflector = { getAllAndOverride: mfn(() => true) };
    const jwt = { verifyAsync: mfn() };
    const guard = new JwtAuthGuard(reflector as any, jwt as any);
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('无 Authorization → 40101', async () => {
    const reflector = { getAllAndOverride: mfn(() => false) };
    const guard = new JwtAuthGuard(reflector as any, { verifyAsync: mfn() } as any);
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toMatchObject({ code: ERR.UNAUTHORIZED });
  });

  it('非 Bearer scheme → 40101', async () => {
    const reflector = { getAllAndOverride: mfn(() => false) };
    const guard = new JwtAuthGuard(reflector as any, { verifyAsync: mfn() } as any);
    await expect(guard.canActivate(ctx({ headers: { authorization: 'Basic abc' } }))).rejects.toMatchObject({
      code: ERR.UNAUTHORIZED,
    });
  });

  it('token 验签失败 → 40101', async () => {
    const reflector = { getAllAndOverride: mfn(() => false) };
    const jwt = { verifyAsync: mfn(() => Promise.reject(new Error('bad signature'))) };
    const guard = new JwtAuthGuard(reflector as any, jwt as any);
    await expect(guard.canActivate(ctx({ headers: { authorization: 'Bearer x.y.z' } }))).rejects.toMatchObject({
      code: ERR.UNAUTHORIZED,
    });
  });

  it('token 有效 → 注入 req.user 并放行', async () => {
    const reflector = { getAllAndOverride: mfn(() => false) };
    const jwt = {
      verifyAsync: mfn(() => Promise.resolve({ sub: '2', role: 'user', phone: '13900139000' })),
    };
    const req: any = { headers: { authorization: 'Bearer good.token' } };
    const guard = new JwtAuthGuard(reflector as any, jwt as any);
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual({ sub: 2, role: 'user', phone: '13900139000' });
  });
});

describe('RolesGuard', () => {
  it('无 @Roles 元数据 → 放行', () => {
    const reflector = { getAllAndOverride: mfn(() => undefined) };
    const guard = new RolesGuard(reflector as any);
    expect(guard.canActivate(ctx({}))).toBe(true);
  });

  it('@Roles 命中但没有登录用户 → 40101', () => {
    const reflector = { getAllAndOverride: mfn(() => ['admin']) };
    const guard = new RolesGuard(reflector as any);
    expect(() => guard.canActivate(ctx({}))).toThrow();
    try {
      guard.canActivate(ctx({}));
    } catch (err: any) {
      expect(err.code).toBe(ERR.UNAUTHORIZED);
    }
  });

  it('普通用户访问 admin → 40301', () => {
    const reflector = { getAllAndOverride: mfn(() => ['admin']) };
    const guard = new RolesGuard(reflector as any);
    expect(() => guard.canActivate(ctx({ user: { sub: 2, role: 'user' } }))).toThrow();
    try {
      guard.canActivate(ctx({ user: { sub: 2, role: 'user' } }));
    } catch (err: any) {
      expect(err.code).toBe(ERR.FORBIDDEN);
    }
  });

  it('admin 访问 admin → 放行', () => {
    const reflector = { getAllAndOverride: mfn(() => ['admin']) };
    const guard = new RolesGuard(reflector as any);
    expect(guard.canActivate(ctx({ user: { sub: 1, role: 'admin' } }))).toBe(true);
  });
});
