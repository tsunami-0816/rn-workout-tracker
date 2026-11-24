/**
 * F-07 并发 start 验证：同一账号同日并发发起 8 次 start，应全部拿到同一个 workoutId，
 * 且 DB 只有 1 行（唯一索引 uk_workout_user_date 兜底）。
 * 用法：node scripts/verify_f07_concurrency.mjs
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8094/api';
const PHONE = process.env.PHONE ?? '13800138000';
const CODE = process.env.DEMO_CODE ?? '123456';
const PLAN_ID = Number(process.env.PLAN_ID ?? 1);

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: PHONE, code: CODE }),
}).then((r) => r.json());

if (login.code !== 0) {
  console.error('login failed', login);
  process.exit(1);
}

const token = login.data.token;
const results = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    fetch(`${BASE}/workouts/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: PLAN_ID, clientSeq: i }),
    }).then((r) => r.json()),
  ),
);

console.log(JSON.stringify(results, null, 2));
const ids = new Set(results.filter((r) => r.code === 0).map((r) => r.data.workoutId));
const failures = results.filter((r) => r.code !== 0);
console.log(`success=${results.length - failures.length} distinctWorkoutIds=${[...ids].join(',')}`);
if (ids.size !== 1 || failures.length > 0) {
  console.error('F-07 FAIL');
  process.exit(2);
}
