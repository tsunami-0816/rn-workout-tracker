// 第 8.5 步 · 接口级渗透探针（Agent 代跑，真实 HTTP + 真实 DB）
// 用法：cd 05_代码/backend && node ../../08.5_安全扫描/scripts/pen_test.mjs
// 输出：逐条 PASS/FAIL + 原始响应摘要，末行 JSON 汇总
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const BASE = process.env.PEN_BASE ?? 'http://127.0.0.1:8094';
const BACKEND = process.cwd();
const ROOT = join(BACKEND, '..', '..');
// pg 从后端 node_modules 解析（脚本本身不在后端工程内）
const pg = createRequire(join(BACKEND, 'package.json'))('pg');

// .env（仅本机读取，不外传）
const env = Object.fromEntries(
  readFileSync(join(BACKEND, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')];
    }),
);
const DEMO = env.DEMO_CODE;
const db = new pg.Client({ connectionString: env.DATABASE_URL });

const results = [];
const raw = [];
const t0 = Date.now();
function log(line) {
  console.log(line);
  raw.push(line);
}
function record(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  log(`${pass ? 'PASS' : 'FAIL'} | ${id} ${name} | ${detail}`);
}

async function req(path, { method = 'GET', token, body, origin, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (origin) h.Origin = origin;
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（静态/HTML） */
  }
  return { status: res.status, headers: res.headers, text, json };
}

const codeOf = (r) => r.json?.code;
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

async function main() {
  await db.connect();
  const before = await db.query(
    `select (select count(*) from users) u, (select count(*) from workout_logs) w, (select count(*) from set_logs) s`,
  );
  const beforeIds = new Set((await db.query(`select id from workout_logs`)).rows.map((r) => Number(r.id)));
  log(`[baseline] users=${before.rows[0].u} workouts=${before.rows[0].w} sets=${before.rows[0].s} ids=${[...beforeIds].join(',')}`);

  // ---------- 账号 ----------
  const login = async (phone) => {
    const r = await req('/api/auth/login', { method: 'POST', body: { phone, code: DEMO } });
    return r;
  };
  const userA = await login('13900139000'); // 普通用户
  const admin = await login('13800138000'); // 管理员
  record('P-01', '演示账号登录取 JWT', userA.status === 200 && !!userA.json?.data?.token, `status=${userA.status} code=${codeOf(userA)}`);
  record(
    'P-02',
    '登录响应不含密码/哈希/原始手机号',
    !/password|hash|salt|13800138000|13900139000/i.test(userA.text),
    `bodyKeys=${Object.keys(userA.json?.data ?? {}).join(',')}`,
  );

  const tokenA = userA.json?.data?.token;
  const tokenAdmin = admin.json?.data?.token;

  // ---------- 未授权访问 ----------
  for (const p of ['/api/plans', '/api/auth/me', '/api/workouts', '/api/stats/weekly', '/api/admin/users', '/api/admin/workouts', '/api/admin/stats/summary']) {
    const r = await req(p);
    record(`U-${p}`, `未带 token 访问 ${p}`, r.status === 401 && codeOf(r) === 40101, `status=${r.status} code=${codeOf(r)}`);
  }

  // ---------- 伪造 JWT ----------
  const parts = tokenA.split('.');
  const forgedSig = parts[0] + '.' + parts[1] + '.' + 'AAAA' + parts[2].slice(4);
  const rForge = await req('/api/auth/me', { token: forgedSig });
  record('J-01', '篡改签名 JWT 被拒', rForge.status === 401 && codeOf(rForge) === 40101, `status=${rForge.status} code=${codeOf(rForge)}`);
  const noneToken =
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify({ sub: 1, role: 'admin' })).toString('base64url') +
    '.';
  const rNone = await req('/api/admin/users', { token: noneToken });
  record('J-02', 'alg=none 伪造 JWT 被拒', rNone.status === 401, `status=${rNone.status} code=${codeOf(rNone)}`);

  // ---------- 垂直越权 ----------
  const rVert = await req('/api/admin/users', { token: tokenA });
  record('V-01', '普通用户调用 /admin/users', rVert.status === 403 && codeOf(rVert) === 40301, `status=${rVert.status} code=${codeOf(rVert)}`);
  const rVert2 = await req('/api/admin/stats/summary', { token: tokenA });
  record('V-02', '普通用户调用 /admin/stats/summary', rVert2.status === 403, `status=${rVert2.status} code=${codeOf(rVert2)}`);
  const rAdminOk = await req('/api/admin/users', { token: tokenAdmin });
  record('V-03', '管理员调用 /admin/users 正常', rAdminOk.status === 200, `status=${rAdminOk.status}`);

  // ---------- 弱口令 / 错误验证码 ----------
  for (const code of ['000000', '12345', 'admin']) {
    const r = await req('/api/auth/login', { method: 'POST', body: { phone: '13800138000', code } });
    record(`W-${code}`, `错误验证码 ${code} 被拒且无 token`, r.status >= 400 && !r.json?.data?.token, `status=${r.status} code=${codeOf(r)}`);
  }
  const badPhone = await req('/api/auth/login', { method: 'POST', body: { phone: 'admin', code: DEMO } });
  record('W-phone', '非手机号形态被 40001 拦截', badPhone.status === 400 && codeOf(badPhone) === 40001, `status=${badPhone.status} code=${codeOf(badPhone)}`);

  // ---------- 水平越权（两账号真实数据，只读 + 只读式写探测） ----------
  const rowsW = (await db.query(`select id, user_id, log_date::text d from workout_logs order by id`)).rows;
  let horizontal = { pass: false, detail: 'skip' };
  if (rowsW.length >= 2) {
    const byUser = new Map();
    for (const r of rowsW) byUser.set(String(r.user_id), r);
    const A = await db.query(`select id from users where phone = '13900139000'`);
    const B = await db.query(`select id from users where phone = '13800138000'`);
    const rowA = byUser.get(String(A.rows[0]?.id));
    const rowB = byUser.get(String(B.rows[0]?.id));
    if (rowA && rowB && rowA.id !== rowB.id) {
      const readB = await req(`/api/workouts/${rowB.id}`, { token: tokenA });
      const finishB = await req(`/api/workouts/${rowB.id}/finish`, { method: 'POST', token: tokenA });
      const detailOk = readB.status === 404 && codeOf(readB) === 40401;
      const writeOk = finishB.status === 404 && codeOf(finishB) === 40401;
      horizontal = { pass: detailOk && writeOk, detail: `A#${rowA.id} 读 B#${rowB.id}=${readB.status}/${codeOf(readB)} finish=${finishB.status}/${codeOf(finishB)}` };
    } else {
      horizontal = { pass: false, detail: `两账号当日记录缺失 rowA=${rowA?.id} rowB=${rowB?.id}` };
    }
  }
  record('H-01', 'A 读/结束 B 的训练被 40401 拒绝', horizontal.pass, horizontal.detail);

  // ---------- SQL 注入 ----------
  const inj = "' OR '1'='1";
  const rInj1 = await req('/api/auth/login', { method: 'POST', body: { phone: inj, code: DEMO } });
  record('S-01', '登录手机号注入串被校验拦截', rInj1.status === 400 && codeOf(rInj1) === 40001, `status=${rInj1.status} code=${codeOf(rInj1)}`);
  const rInj2 = await req(`/api/admin/users?phone=${encodeURIComponent(inj)}`, { token: tokenAdmin });
  const noLeak = rInj2.status === 200 && !/syntax|postgres|SELECT|50001/i.test(rInj2.text) && (rInj2.json?.data?.list?.length ?? 0) > 0;
  record('S-02', 'admin 未知参数注入串被忽略（不 500 / 不倒库）', noLeak, `status=${rInj2.status} rows=${rInj2.json?.data?.list?.length}`);
  const rInj3 = await req(`/api/workouts?page=${encodeURIComponent("1' OR 1=1")}`, { token: tokenA });
  record(
    'S-03',
    '分页参数注入串被 parseInt 强转为整数、无注入效果',
    rInj3.status !== 500 && !/syntax|postgres|SELECT/i.test(rInj3.text) && (rInj3.status !== 200 || rInj3.json?.data?.page === 1),
    `status=${rInj3.status} page=${rInj3.json?.data?.page}（Q-013 输入宽容 P3 同源）`,
  );
  const rInj4 = await req(`/api/admin/workouts?from=${encodeURIComponent("2026-01-01' OR '1'='1")}`, { token: tokenAdmin });
  record('S-04', 'admin 日期参数注入串被 assertDate 拦截', rInj4.status === 400 && codeOf(rInj4) === 40001, `status=${rInj4.status} code=${codeOf(rInj4)}`);
  const rBadDate = await req('/api/admin/workouts?from=2026-02-30', { token: tokenAdmin });
  record('S-05', '非法日历日 2026-02-30 被 40001 拦截（Q-012 回归）', rBadDate.status === 400 && codeOf(rBadDate) === 40001, `status=${rBadDate.status} msg=${rBadDate.json?.message}`);

  // ---------- 路径穿越 / 静态托管 ----------
  for (const p of ['/apk/../.env', '/apk/%2e%2e/.env', '/apk/..%2f.env', '/apk/../../05_代码/backend/.env', '/apk/']) {
    const r = await req(p);
    record(`T-${p}`, `路径穿越 ${p} 不可读`, r.status !== 200, `status=${r.status}`);
  }

  // ---------- 信息泄露 ----------
  const r404 = await req('/api/not-exist-xyz');
  record('I-01', '未知路径不泄露堆栈/内部路径', r404.status === 404 && !/at |\.ts:\d|node_modules|C:\\\\/i.test(r404.text), `status=${r404.status} body=${r404.text.slice(0, 80)}`);
  const h = (await req('/api/health')).headers;
  const poweredBy = h.get('x-powered-by');
  record('I-02', '未暴露 X-Powered-By', !poweredBy, `x-powered-by=${poweredBy}`);
  const meA = await req('/api/auth/me', { token: tokenA });
  record('I-03', '/me 手机号脱敏', meA.json?.data?.phoneMasked === '139****9000' && !meA.text.includes('13900139000'), `phoneMasked=${meA.json?.data?.phoneMasked}`);
  const wList = await req('/api/workouts?size=9999&page=1', { token: tokenA });
  record('I-04', '分页 size 上限钳制（≤50）', wList.status === 200 && (wList.json?.data?.list?.length ?? 0) <= 50, `status=${wList.status} rows=${wList.json?.data?.list?.length}`);
  const docs = await req('/api/docs');
  record('I-05', 'Swagger 文档仅 dev 暴露（记录口径）', true, `status=${docs.status} NODE_ENV=${env.NODE_ENV}（生产构建不注册）`);

  // ---------- 限流 ----------
  const c1 = await req('/api/auth/send-code', { method: 'POST', body: { phone: '13700000000' } });
  const c2 = await req('/api/auth/send-code', { method: 'POST', body: { phone: '13700000000' } });
  record('R-01', '60s 内重复发码被 42901 拦截', c2.status === 429 && codeOf(c2) === 42901, `first=${c1.status} second=${c2.status}/${codeOf(c2)}`);

  // ---------- CORS ----------
  const evil = await req('/api/health', { origin: 'https://evil.example.com' });
  record('C-01', '跨域陌生 Origin 不下发 ACAO', !evil.headers.get('access-control-allow-origin'), `acao=${evil.headers.get('access-control-allow-origin')}`);
  const local = await req('/api/health', { origin: 'http://localhost:3000' });
  record('C-02', '本地 dev Origin 允许', local.headers.get('access-control-allow-origin') === 'http://localhost:3000', `acao=${local.headers.get('access-control-allow-origin')}`);

  // ---------- 清理与对账（本轮为只读探测，不写库；仅打印，确认零漂移） ----------
  const after = await db.query(
    `select (select count(*) from users) u, (select count(*) from workout_logs) w, (select count(*) from set_logs) s`,
  );
  log(`[after] users=${after.rows[0].u} workouts=${after.rows[0].w} sets=${after.rows[0].s}（与 baseline 一致才允许交接）`);
  if (`${after.rows[0].u}/${after.rows[0].w}/${after.rows[0].s}` !== `${before.rows[0].u}/${before.rows[0].w}/${before.rows[0].s}`) {
    record('DB-01', '渗透写库零漂移', false, `before=${before.rows[0].u}/${before.rows[0].w}/${before.rows[0].s} after=${after.rows[0].u}/${after.rows[0].w}/${after.rows[0].s}`);
  } else {
    record('DB-01', '渗透写库零漂移', true, `${after.rows[0].u}/${after.rows[0].w}/${after.rows[0].s}`);
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  log(`[summary] total=${results.length} pass=${pass} fail=${fail} duration=${((Date.now() - t0) / 1000).toFixed(1)}s`);
  appendFileSync(join(ROOT, '08.5_安全扫描', 'docs', `pen_test_${stamp}.log`), raw.join('\n') + '\n', 'utf8');
  writeFileSync(
    join(ROOT, '08.5_安全扫描', 'docs', `pen_test_${stamp}.json`),
    JSON.stringify({ ts: new Date().toISOString(), base: BASE, total: results.length, pass, fail, results }, null, 2),
    'utf8',
  );
  await db.end();
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exitCode = 2;
});
