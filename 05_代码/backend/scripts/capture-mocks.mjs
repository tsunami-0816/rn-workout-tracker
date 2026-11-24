// 采集真实响应作为前端联调样例（不是替身实现：接口本身是真的，这里只存 fixture）
// 用法：node scripts/capture-mocks.mjs [baseUrl] [outFile]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const base = process.argv[2] ?? 'http://127.0.0.1:8094/api';
const outFile = process.argv[3] ?? path.resolve(process.cwd(), 'mock', 'samples.json');

/** 采集前重置 admin 当天训练（否则 finished 状态会挡住写组，二次采集必 40002） */
function resetAdminWorkout() {
  try {
    execSync(
      `docker exec rn-workout-pg psql -U postgres -d rn_workout -c "UPDATE workout_logs SET finished_at = NULL WHERE user_id = (SELECT id FROM users WHERE phone='13800138000')"`,
      { stdio: 'ignore' },
    );
  } catch {
    console.warn('跳过 admin workout 重置（docker/psql 不可用），若采集 40002 请先手动重置');
  }
}

async function call(method, p, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const samples = {};
const record = async (key, method, p, token, body) => {
  samples[key] = await call(method, p, token, body);
  console.log(`${key} -> ${samples[key].status}`);
};

// 公开端点
await record('POST /api/auth/send-code', 'POST', '/auth/send-code', null, { phone: '13600136000' });
await record('GET /api/app/version', 'GET', '/app/version');
await record('GET /api/health', 'GET', '/health');

const user = await call('POST', '/auth/login', null, { phone: '13900139000', code: '123456' });
samples['POST /api/auth/login'] = { status: user.status, body: user.body };
const userToken = user.body?.data?.token;

// 用 admin 走写链路，避免把普通用户当天 workout 提前结束（冒烟要复用）
const admin = await call('POST', '/auth/login', null, { phone: '13800138000', code: '123456' });
samples['POST /api/auth/login (admin)'] = { status: admin.status, body: admin.body };
const adminToken = admin.body?.data?.token;

await record('GET /api/auth/me', 'GET', '/auth/me', userToken);
await record('GET /api/plans', 'GET', '/plans', userToken);
await record('GET /api/plans/current', 'GET', '/plans/current', userToken);
const plans = await call('GET', '/plans', adminToken);
const planId = plans.body.data.list[0].id;
await record('GET /api/plans/{id}/exercises', 'GET', `/plans/${planId}/exercises`, adminToken);
await record('GET /api/workouts', 'GET', '/workouts?page=1&size=5', userToken);
resetAdminWorkout();
const start = await call('POST', '/workouts/start', adminToken, { planId });
samples['POST /api/workouts/start'] = { status: start.status, body: start.body };
const workoutId = start.body.data.workoutId;
await record('GET /api/workouts/{id}', 'GET', `/workouts/${workoutId}`, adminToken);
const ex = await call('GET', `/plans/${planId}/exercises`, adminToken);
const exerciseId = ex.body.data.list[0].id;
const created = await call('POST', `/workouts/${workoutId}/sets`, adminToken, {
  exerciseId, setNo: 8, weight: 40, reps: 10, done: true,
});
samples['POST /api/workouts/{id}/sets'] = { status: created.status, body: created.body };
const setId = created.body?.data?.setLog?.id;
if (setId) {
  await record('PATCH /api/workouts/{id}/sets/{setId}', 'PATCH', `/workouts/${workoutId}/sets/${setId}`, adminToken, { weight: 42.5 });
  await record('DELETE /api/workouts/{id}/sets/{setId}', 'DELETE', `/workouts/${workoutId}/sets/${setId}`, adminToken);
} else {
  console.warn('组次写入失败，跳过 PATCH/DELETE 样例（其余样例照常输出）');
}
await record('POST /api/workouts/{id}/finish', 'POST', `/workouts/${workoutId}/finish`, adminToken);
resetAdminWorkout();
await record('GET /api/stats/weekly', 'GET', '/stats/weekly', userToken);
await record('GET /api/stats/history', 'GET', '/stats/history?weeks=4', userToken);
await record('GET /api/admin/workouts', 'GET', '/admin/workouts?page=1&size=5', adminToken);
await record('GET /api/admin/users', 'GET', '/admin/users?page=1&size=5', adminToken);
await record('GET /api/admin/stats/summary', 'GET', '/admin/stats/summary', adminToken);
await record('GET /api/admin/workouts (403 样例)', 'GET', '/admin/workouts', userToken);
await record('GET /api/plans (401 样例)', 'GET', '/plans', null);

// 递归脱敏：token 一律替换占位符，避免真实 JWT 落盘被安全扫描判为泄露
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = k === 'token' ? '<JWT_TOKEN_7D>' : redact(v);
    }
    return out;
  }
  return value;
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), base, samples: redact(samples) }, null, 2)}\n`,
  'utf8',
);
console.log(`saved ${Object.keys(samples).length} samples -> ${outFile}`);
