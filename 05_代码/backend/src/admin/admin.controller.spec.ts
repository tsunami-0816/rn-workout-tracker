/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ERR } from '../common/error-codes';

/** Q-012 回归：admin 日期参数必须是「真实存在的日历日」，不只是 YYYY-MM-DD 形状 */
function build() {
  const svc = { workouts: (jest as any).fn(), users: (jest as any).fn(), summary: (jest as any).fn() };
  const controller = new AdminController(svc as unknown as AdminService);
  return { controller, svc };
}

function expectParamInvalid(fn: () => unknown, field: string) {
  let caught: any = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught).not.toBeNull();
  expect(caught.code).toBe(ERR.PARAM_INVALID);
  expect(caught.bizData).toEqual({ field });
}

describe('AdminController 日期校验（Q-012）', () => {
  it.each(['2026-13-01', '2026-02-30', '2026-11-31', '2026-00-10', '2026-04-00'])(
    '非法日历日 from=%s → 40001，field=from（此前会透传到 Prisma 变 500）',
    (value) => {
      const { controller } = build();
      expectParamInvalid(() => controller.workouts(1, 20, value, undefined), 'from');
    },
  );

  it.each(['2026-13-01', '2026-02-30'])('非法日历日 to=%s → 40001，field=to', (value) => {
    const { controller } = build();
    expectParamInvalid(() => controller.workouts(1, 20, undefined, value), 'to');
  });

  it.each(['2026-1-1', '20261101', '2026/11/01', 'abc'])('形状非法 from=%s → 40001', (value) => {
    const { controller } = build();
    expectParamInvalid(() => controller.workouts(1, 20, value, undefined), 'from');
  });

  it.each(['2026-11-25', '2028-02-29', '2000-01-01'])('合法日期 %s 透传给 service', (value) => {
    const { controller, svc } = build();
    svc.workouts.mockReturnValue('ok');
    expect(controller.workouts(1, 20, value, value)).toBe('ok');
    expect(svc.workouts).toHaveBeenCalledWith(1, 20, { from: value, to: value });
  });

  it('不传日期时 from/to 均为 undefined，不抛错', () => {
    const { controller, svc } = build();
    svc.workouts.mockReturnValue('ok');
    expect(controller.workouts(1, 20)).toBe('ok');
    expect(svc.workouts).toHaveBeenCalledWith(1, 20, { from: undefined, to: undefined });
  });

  it('page/size 仍按 1/50 钳制（修复日期时不能回归分页口径）', () => {
    const { controller, svc } = build();
    svc.workouts.mockReturnValue('ok');
    controller.workouts(0, 999);
    expect(svc.workouts).toHaveBeenCalledWith(1, 50, { from: undefined, to: undefined });
  });
});
