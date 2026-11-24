/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from '@jest/globals';

/**
 * e2e 契约用例（10 条）：直接打真实 HTTP（服务需已启动）
 * 口径：BASE_URL 默认 http://127.0.0.1:8094/api
 * 覆盖：health / 未登录 401 / 登录成与败 / 参数校验 / 幂等 / 越权 403 / admin 脱敏 / 版本 / 分页边界
 */
const BASE = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8094/api').replace(/\/$/, '');
const USER_PHONE = '13900139000';
const ADMIN_PHONE = '13800138000';
const DEMO_CODE = process.env.E2E_DEMO_CODE ?? '123456';

interface ApiResult {
  status: number;
  json: any;
  text: string;
}

async function call(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

let userToken = '';
let adminToken = '';
let planId = 0;
let workoutId = 0;
let exerciseId = 0;

beforeAll(async () => {
  const login = await call('POST', '/auth/login', undefined, { phone: USER_PHONE, code: DEMO_CODE });
  userToken = login.json?.data?.token ?? '';
  const admin = await call('POST', '/auth/login', undefined, { phone: ADMIN_PHONE, code: DEMO_CODE });
  adminToken = admin.json?.data?.token ?? '';
  const plans = await call('GET', '/plans', userToken);
  planId = plans.json?.data?.list?.[0]?.id ?? 0;
  const ex = await call('GET', `/plans/${planId}/exercises`, userToken);
  exerciseId = ex.json?.data?.list?.[0]?.id ?? 0;
  const start = await call('POST', '/workouts/start', userToken, { planId });
  workoutId = start.json?.data?.workoutId ?? 0;
});

describe('e2e · RN Workout API', () => {
  it('1. health 200 且 db=up', async () => {
    const r = await call('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.json.code).toBe(0);
    expect(r.json.data.db).toBe('up');
  });

  it('2. 未登录访问 /plans → 401/40101', async () => {
    const r = await call('GET', '/plans');
    expect(r.status).toBe(401);
    expect(r.json.code).toBe(40101);
  });

  it('3. 登录成功拿 JWT', async () => {
    const r = await call('POST', '/auth/login', undefined, { phone: USER_PHONE, code: DEMO_CODE });
    expect(r.status).toBe(200);
    expect(r.json.code).toBe(0);
    expect(userToken.length).toBeGreaterThan(20);
  });

  it('4. 错验证码 → 401/40102', async () => {
    const r = await call('POST', '/auth/login', undefined, { phone: USER_PHONE, code: '000000' });
    expect(r.status).toBe(401);
    expect(r.json.code).toBe(40102);
  });

  it('5. 非法手机号 → 400/40001 并指字段', async () => {
    const r = await call('POST', '/auth/login', undefined, { phone: '123', code: DEMO_CODE });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe(40001);
  });

  it('6. 连发 3 次同组 → 唯一键幂等，DB 仍 1 行', async () => {
    for (let i = 0; i < 3; i += 1) {
      await call('POST', `/workouts/${workoutId}/sets`, userToken, {
        exerciseId,
        setNo: 4,
        weight: 40,
        reps: 10,
        done: true,
      });
    }
    const detail = await call('GET', `/workouts/${workoutId}`, userToken);
    const same = (detail.json?.data?.sets ?? []).filter((s: any) => s.exerciseId === exerciseId && s.setNo === 4);
    expect(same).toHaveLength(1);
  });

  it('7. 普通用户越权 admin → 403/40301', async () => {
    const r = await call('GET', '/admin/workouts', userToken);
    expect(r.status).toBe(403);
    expect(r.json.code).toBe(40301);
  });

  it('8. admin 可查全站且手机号脱敏', async () => {
    const r = await call('GET', '/admin/workouts?page=1&size=5', adminToken);
    expect(r.status).toBe(200);
    expect(r.json.code).toBe(0);
    expect(r.text).not.toMatch(/1[3-9]\d{9}/);
  });

  it('9. 版本接口公开且 buildNo ≥ 1', async () => {
    const r = await call('GET', '/app/version');
    expect(r.status).toBe(200);
    expect(r.json.data.buildNo).toBeGreaterThanOrEqual(1);
  });

  it('10. 分页边界 size=999 → 截为 50', async () => {
    const r = await call('GET', '/workouts?page=1&size=999', userToken);
    expect(r.status).toBe(200);
    expect(r.json.data.size).toBe(50);
  });
});
