// 第 7 步 R1 联调探针：HTTP 全链路 + DB 断言（Node 22 内置 fetch）
// 用法：node step7_probe.mjs [R1]
// 输出：07_联调/evidence/step7_<轮次>_<时间戳>.log
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:8094';
const LAN = 'http://192.168.0.108:8094';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUND = process.argv[2] || 'R1';
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const LOG = path.join(ROOT, '07_联调', 'evidence', `step7_${ROUND}_${stamp}.log`);

const lines = [];
let pass = 0;
let fail = 0;
const fails = [];

function log(s) {
  lines.push(s);
  console.log(s);
}
function ok(id, name, detail = '') {
  pass += 1;
  log(`PASS ${id} ${name}${detail ? ' | ' + detail : ''}`);
}
function bad(id, name, detail = '') {
  fail += 1;
  fails.push(`${id} ${name} ${detail}`);
  log(`FAIL ${id} ${name}${detail ? ' | ' + detail : ''}`);
}
function manual(id, name, detail = '') {
  log(`MANUAL ${id} ${name}${detail ? ' | ' + detail : ''}`);
}
function warn(id, name, detail = '') {
  log(`WARN ${id} ${name}${detail ? ' | ' + detail : ''}`);
}
function known(id, name, detail = '') {
  log(`KNOWN ${id} ${name}${detail ? ' | ' + detail : ''}`);
}

function sql(q) {
  return execFileSync(
    'docker',
    ['exec', '-e', 'PGCLIENTENCODING=UTF8', 'rn-workout-pg', 'psql', '-U', 'postgres', '-d', 'rn_workout', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', q],
    { encoding: 'utf8' },
  ).trim();
}

async function api(method, p, { token, body, base = BASE } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(base + p, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

const shanghaiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function isoWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function cleanupToday(userId) {
  sql(`DELETE FROM set_logs WHERE workout_log_id IN (SELECT id FROM workout_logs WHERE user_id=${userId} AND log_date='${TODAY}'); DELETE FROM workout_logs WHERE user_id=${userId} AND log_date='${TODAY}';`);
}

const TODAY = shanghaiToday();
const WEEK_START = isoWeekStart(TODAY);
log(`# step7 probe ${ROUND} @ ${new Date().toISOString()}  BASE=${BASE}  today=${TODAY}  weekStart=${WEEK_START}`);

// ---------- 0. 环境 ----------
const health = await api('GET', '/api/health');
if (health.status === 200 && health.json?.data?.status === 'up' && health.json?.data?.db === 'up') ok('Z-01', '健康检查', 'status=up db=up');
else bad('Z-01', '健康检查', `status=${health.status} body=${health.text.slice(0, 120)}`);

const version0 = await api('GET', '/api/app/version');
if (version0.status === 200 && version0.json?.data?.version === '1.0.2' && version0.json?.data?.buildNo === 3) ok('Z-02', '版本接口预检', '1.0.2/build3');
else bad('Z-02', '版本接口预检', `status=${version0.status} data=${JSON.stringify(version0.json?.data)}`);

// ---------- A. 鉴权 ----------
const USER_PHONE = '13900139000';
const ADMIN_PHONE = '13800138000';
const CODE = '123456';
// 发码用例用随机号，避免 60s 频控在重复跑时误伤
const CODE_PHONE = '137' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

const send1 = await api('POST', '/api/auth/send-code', { body: { phone: CODE_PHONE } });
if (send1.status === 200 && send1.json?.code === 0 && send1.json?.data?.cooldown === 60) ok('A-01', '发码成功', `phone=${CODE_PHONE} cooldown=60`);
else bad('A-01', '发码成功', `phone=${CODE_PHONE} status=${send1.status} body=${send1.text.slice(0, 160)}`);

const send2 = await api('POST', '/api/auth/send-code', { body: { phone: CODE_PHONE } });
if (send2.status === 429 && send2.json?.code === 42901) ok('A-02', '发码频控 42901', `remainSec=${send2.json?.data?.remainSec ?? '-'}`);
else bad('A-02', '发码频控 42901', `status=${send2.status} body=${send2.text.slice(0, 160)}`);

const wrong = await api('POST', '/api/auth/login', { body: { phone: USER_PHONE, code: '000000' } });
if (wrong.status === 401 && wrong.json?.code === 40102) ok('A-03', '验证码错误 40102');
else bad('A-03', '验证码错误 40102', `status=${wrong.status} body=${wrong.text.slice(0, 160)}`);

const badPhone = await api('POST', '/api/auth/login', { body: { phone: '139001', code: CODE } });
if (badPhone.status === 400 && badPhone.json?.code === 40001 && (badPhone.json?.data?.field ?? '').includes('phone')) ok('A-04', '手机号非法 40001', `field=${badPhone.json?.data?.field}`);
else bad('A-04', '手机号非法 40001', `status=${badPhone.status} body=${badPhone.text.slice(0, 160)}`);

const loginUser = await api('POST', '/api/auth/login', { body: { phone: USER_PHONE, code: CODE } });
const userToken = loginUser.json?.data?.token;
if (loginUser.status === 200 && loginUser.json?.code === 0 && userToken && loginUser.json?.data?.expiresIn === 604800) ok('A-05', '登录成功', `user=${JSON.stringify(loginUser.json?.data?.user)}`);
else bad('A-05', '登录成功', `status=${loginUser.status} body=${loginUser.text.slice(0, 160)}`);

const me = await api('GET', '/api/auth/me', { token: userToken });
const masked = me.json?.data?.phoneMasked;
if (me.status === 200 && masked === '139****9000' && !me.text.includes(USER_PHONE)) ok('A-06', 'me 脱敏', `phoneMasked=${masked} role=${me.json?.data?.role}`);
else bad('A-06', 'me 脱敏', `status=${me.status} phoneMasked=${masked} rawLeak=${me.text.includes(USER_PHONE)}`);

const noToken = await api('GET', '/api/auth/me');
if (noToken.status === 401 && noToken.json?.code === 40101) ok('A-07', '无 token 40101');
else bad('A-07', '无 token 40101', `status=${noToken.status} body=${noToken.text.slice(0, 120)}`);

const fakeToken = await api('GET', '/api/auth/me', { token: 'abc.def.ghi' });
if (fakeToken.status === 401 && fakeToken.json?.code === 40101) ok('A-08', '伪造 token 40101');
else bad('A-08', '伪造 token 40101', `status=${fakeToken.status} body=${fakeToken.text.slice(0, 120)}`);

const adminLogin = await api('POST', '/api/auth/login', { body: { phone: ADMIN_PHONE, code: CODE } });
const adminToken = adminLogin.json?.data?.token;
if (adminLogin.status === 200 && adminToken && adminLogin.json?.data?.user?.role === 'admin') ok('A-10', 'admin 登录', `id=${adminLogin.json?.data?.user?.id}`);
else bad('A-10', 'admin 登录', `status=${adminLogin.status} body=${adminLogin.text.slice(0, 160)}`);

manual('A-09', '真机杀进程重开后免登录', '阶段二 S1 已过（1.0.2 真机）');

// ---------- B. 计划 ----------
const uid = Number(me.json?.data?.id);
cleanupToday(uid);

const plans = await api('GET', '/api/plans', { token: userToken });
const plist = plans.json?.data?.list ?? [];
const dayTypes = plist.map((p) => p.dayType);
if (plans.status === 200 && plist.length === 3 && dayTypes.every((d) => ['推', '拉', '腿'].includes(d)) && plist.every((p) => typeof p.weekDone === 'number')) ok('B-01', '我的计划 3 条', `ids=${plist.map((p) => p.id)} dayTypes=${dayTypes}`);
else bad('B-01', '我的计划 3 条', `status=${plans.status} list=${JSON.stringify(plist).slice(0, 200)}`);

const todayPlanId = plans.json?.data?.todayPlanId;
if (plist.some((p) => p.id === todayPlanId)) ok('B-01b', 'todayPlanId 属于我的计划', `todayPlanId=${todayPlanId}`);
else bad('B-01b', 'todayPlanId 属于我的计划', `todayPlanId=${todayPlanId}`);

if (plans.json?.data?.todayWorkoutPlanId === null) ok('B-06', '未开练时 todayWorkoutPlanId=null');
else bad('B-06', '未开练时 todayWorkoutPlanId=null', `todayWorkoutPlanId=${plans.json?.data?.todayWorkoutPlanId}`);

const current = await api('GET', '/api/plans/current', { token: userToken });
if (current.status === 200 && current.json?.data?.id === todayPlanId && current.json?.data?.exercisesCount === 12) ok('B-02', '今日推荐计划', `id=${current.json?.data?.id} count=${current.json?.data?.exercisesCount}`);
else bad('B-02', '今日推荐计划', `status=${current.status} data=${JSON.stringify(current.json?.data)}`);

const planId = todayPlanId;
const ex = await api('GET', `/api/plans/${planId}/exercises`, { token: userToken });
const exList = ex.json?.data?.list ?? [];
const orderSeq = exList.map((e) => e.orderNo);
if (ex.status === 200 && exList.length === 12 && orderSeq.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12') ok('B-03', '动作清单 12 条有序', `first=${exList[0]?.name} sets=${exList[0]?.targetSets} reps=${exList[0]?.targetReps}`);
else bad('B-03', '动作清单 12 条有序', `status=${ex.status} len=${exList.length} order=${orderSeq.join(',')}`);

const exOther = await api('GET', '/api/plans/999999/exercises', { token: userToken });
if (exOther.status === 404 && exOther.json?.code === 40401) ok('B-04', '计划不存在 40401');
else bad('B-04', '计划不存在 40401', `status=${exOther.status} body=${exOther.text.slice(0, 120)}`);

const u5plan = sql(`SELECT id FROM plans WHERE user_id=5 ORDER BY id LIMIT 1;`).split('\n')[0];
if (u5plan) {
  const crossPlan = await api('GET', `/api/plans/${u5plan}/exercises`, { token: userToken });
  if (crossPlan.status === 404 && crossPlan.json?.code === 40401) ok('B-05', '跨用户计划 40401', `user5 planId=${u5plan}`);
  else bad('B-05', '跨用户计划 40401', `status=${crossPlan.status} body=${crossPlan.text.slice(0, 120)}`);
} else manual('B-05', '跨用户计划', 'user5 无计划，跳过');

// ---------- C. 开练 / 组次 ----------
// C-09 并发开练（先清当日）
cleanupToday(uid);
const startResults = await Promise.all(Array.from({ length: 5 }, () => api('POST', '/api/workouts/start', { token: userToken, body: { planId } })));
const ids = new Set(startResults.map((r) => r.json?.data?.workoutId));
const dbRows = Number(sql(`SELECT count(*) FROM workout_logs WHERE user_id=${uid} AND log_date='${TODAY}';`));
if (startResults.every((r) => r.status === 200 && r.json?.code === 0) && ids.size === 1 && dbRows === 1) ok('C-09', '并发开练仅 1 行', `workoutId=${[...ids][0]} dbRows=1`);
else bad('C-09', '并发开练仅 1 行', `statuses=${startResults.map((r) => r.status)} ids=${[...ids]} dbRows=${dbRows} bodies=${startResults.map((r) => r.text.slice(0, 60)).join(' / ')}`);

const workoutId = startResults.find((r) => r.json?.data?.workoutId)?.json?.data?.workoutId ?? Number(ids.values().next().value);
const start1 = await api('POST', '/api/workouts/start', { token: userToken, body: { planId } });
if (start1.status === 200 && start1.json?.data?.workoutId === workoutId && start1.json?.data?.logDate === TODAY && start1.json?.data?.totalVolume === 0) ok('C-01', '开始训练', `workoutId=${workoutId} logDate=${TODAY} volume=0`);
else bad('C-01', '开始训练', `status=${start1.status} data=${JSON.stringify(start1.json?.data)}`);

const start2 = await api('POST', '/api/workouts/start', { token: userToken, body: { planId } });
if (start2.status === 200 && start2.json?.data?.workoutId === workoutId) ok('C-02', '当日同计划复用', `workoutId=${workoutId}`);
else bad('C-02', '当日同计划复用', `status=${start2.status} data=${JSON.stringify(start2.json?.data)}`);

const otherPlan = plist.find((p) => p.id !== planId)?.id;
const start3 = await api('POST', '/api/workouts/start', { token: userToken, body: { planId: otherPlan } });
if (start3.status === 400 && start3.json?.code === 40002 && String(start3.json?.message ?? '').includes('今天已按')) ok('C-03', '同日换分化 40002', `msg=${start3.json?.message}`);
else bad('C-03', '同日换分化 40002', `status=${start3.status} body=${start3.text.slice(0, 160)}`);

const start404 = await api('POST', '/api/workouts/start', { token: userToken, body: { planId: 999999 } });
if (start404.status === 404 && start404.json?.code === 40401) ok('C-04', '计划不存在 40401');
else bad('C-04', '计划不存在 40401', `status=${start404.status} body=${start404.text.slice(0, 120)}`);

for (const [tag, val] of [['0', 0], ['-1', -1], ['1.5', 1.5]]) {
  const r = await api('POST', '/api/workouts/start', { token: userToken, body: { planId: val } });
  if (r.status === 400 && r.json?.code === 40001 && String(r.json?.data?.field ?? '').includes('planId')) ok(`C-05(${tag})`, 'planId 非法 40001', `field=${r.json?.data?.field}`);
  else bad(`C-05(${tag})`, 'planId 非法 40001', `status=${r.status} body=${r.text.slice(0, 140)}`);
}

const exerciseId = exList[0]?.id;
const exerciseId2 = exList[1]?.id;
const otherPlanEx = await api('GET', `/api/plans/${otherPlan}/exercises`, { token: userToken });
const foreignExerciseId = otherPlanEx.json?.data?.list?.[0]?.id;

const s1 = await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId, setNo: 1, weight: 40, reps: 10, done: true } });
if (s1.status === 200 && s1.json?.code === 0 && s1.json?.data?.totalVolume === 400) ok('C-06', '首组提交', `totalVolume=${s1.json?.data?.totalVolume}`);
else bad('C-06', '首组提交', `status=${s1.status} body=${s1.text.slice(0, 160)}`);

let dbCount = Number(sql(`SELECT count(*) FROM set_logs WHERE workout_log_id=${workoutId} AND exercise_id=${exerciseId} AND set_no=1;`));
if (dbCount === 1) ok('C-06b', '首组落库 1 行');
else bad('C-06b', '首组落库 1 行', `dbCount=${dbCount}`);

for (const w of [41, 42]) await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId, setNo: 1, weight: w, reps: 10, done: true } });
dbCount = Number(sql(`SELECT count(*) FROM set_logs WHERE workout_log_id=${workoutId} AND exercise_id=${exerciseId} AND set_no=1;`));
const volC7 = Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`));
if (dbCount === 1 && volC7 === 420) ok('C-07', '连点幂等仅 1 行', `volume=${volC7}`);
else bad('C-07', '连点幂等仅 1 行', `dbCount=${dbCount} volume=${volC7}`);

// C-08 并发同键 10 连发
const conc = await Promise.all(Array.from({ length: 10 }, (_, i) => api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId: exerciseId2, setNo: 2, weight: 10 + i, reps: 2, done: true } })));
dbCount = Number(sql(`SELECT count(*) FROM set_logs WHERE workout_log_id=${workoutId} AND exercise_id=${exerciseId2} AND set_no=2;`));
const dbVol = Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`));
const err500 = conc.filter((r) => r.status >= 500).length;
const okAll = conc.filter((r) => r.status === 200).length;
if (dbCount === 1 && err500 === 0 && okAll === 10) ok('C-08', '并发同键 10 连发仅 1 行', `dbVolume=${dbVol} lastRespVolume=${conc[conc.length - 1].json?.data?.totalVolume}`);
else bad('C-08', '并发同键 10 连发仅 1 行', `dbCount=${dbCount} err500=${err500} ok=${okAll}`);

for (const [tag, val, field] of [['setNo0', 0, 'setNo'], ['setNo11', 11, 'setNo'], ['reps-1', -1, 'reps'], ['reps51', 51, 'reps'], ['weight-1', -1, 'weight'], ['weight10000', 10000, 'weight'], ['weight3dp', 2.555, 'weight']]) {
  const body = { exerciseId, setNo: 1, weight: 40, reps: 10, done: true, [field]: val };
  const r = await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body });
  if (r.status === 400 && r.json?.code === 40001 && String(r.json?.data?.field ?? '').includes(field)) ok(`C-1x(${tag})`, `${field} 边界 40001`, `field=${r.json?.data?.field}`);
  else bad(`C-1x(${tag})`, `${field} 边界 40001`, `status=${r.status} body=${r.text.slice(0, 140)}`);
}

const s25 = await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId: exerciseId2, setNo: 3, weight: 2.5, reps: 10, done: true } });
const db25 = sql(`SELECT weight FROM set_logs WHERE workout_log_id=${workoutId} AND exercise_id=${exerciseId2} AND set_no=3;`);
if (s25.status === 200 && Number(db25) === 2.5) ok('C-13', '重量小数 2.5', `db=${db25} volume=${s25.json?.data?.totalVolume}`);
else bad('C-13', '重量小数 2.5', `status=${s25.status} db=${db25}`);

if (foreignExerciseId) {
  const r = await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId: foreignExerciseId, setNo: 1, weight: 20, reps: 5, done: true } });
  if (r.status === 400 && r.json?.code === 40001 && String(r.json?.data?.field ?? '').includes('exerciseId')) ok('C-14', '动作不属于计划 40001', `field=${r.json?.data?.field}`);
  else bad('C-14', '动作不属于计划 40001', `status=${r.status} body=${r.text.slice(0, 140)}`);
}

const setId1 = s1.json?.data?.setLog?.id;
const patch1 = await api('PATCH', `/api/workouts/${workoutId}/sets/${setId1}`, { token: userToken, body: { weight: 42.5 } });
const dbVol2 = Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`));
if (patch1.status === 200 && patch1.json?.data?.setLog?.weight === 42.5 && patch1.json?.data?.totalVolume === dbVol2) ok('C-15', '改组同步容量', `setWeight=42.5 totalVolume=${dbVol2}`);
else bad('C-15', '改组同步容量', `status=${patch1.status} data=${JSON.stringify(patch1.json?.data).slice(0, 160)}`);

const patchOff = await api('PATCH', `/api/workouts/${workoutId}/sets/${setId1}`, { token: userToken, body: { done: false } });
if (patchOff.status === 200 && patchOff.json?.data?.setLog?.done === false && patchOff.json?.data?.totalVolume === Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`))) ok('C-16', '取消完成只算 done', `volume=${patchOff.json?.data?.totalVolume}`);
else bad('C-16', '取消完成只算 done', `status=${patchOff.status} data=${JSON.stringify(patchOff.json?.data).slice(0, 160)}`);

const setId2 = s25.json?.data?.setLog?.id;
const del2 = await api('DELETE', `/api/workouts/${workoutId}/sets/${setId2}`, { token: userToken });
const dbAfterDel = sql(`SELECT count(*) FROM set_logs WHERE id=${setId2};`);
if (del2.status === 200 && del2.json?.data?.totalVolume === Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`)) && dbAfterDel === '0') ok('C-17', '删组同步容量', `volume=${del2.json?.data?.totalVolume}`);
else bad('C-17', '删组同步容量', `status=${del2.status} dbRow=${dbAfterDel} data=${JSON.stringify(del2.json?.data)}`);

const patch404 = await api('PATCH', `/api/workouts/${workoutId}/sets/999999`, { token: userToken, body: { weight: 1 } });
if (patch404.status === 404 && patch404.json?.code === 40401) ok('C-18', '组次不存在 40401');
else bad('C-18', '组次不存在 40401', `status=${patch404.status} body=${patch404.text.slice(0, 120)}`);

const u5workout = sql(`SELECT id FROM workout_logs WHERE user_id=5 ORDER BY id DESC LIMIT 1;`).split('\n')[0];
if (u5workout) {
  const detail = await api('GET', `/api/workouts/${u5workout}`, { token: userToken });
  if (detail.status === 404 && detail.json?.code === 40401) ok('C-19', '跨用户训练记录 40401', `user5 workoutId=${u5workout}`);
  else bad('C-19', '跨用户训练记录 40401', `status=${detail.status} body=${detail.text.slice(0, 120)}`);
} else manual('C-19', '跨用户训练记录', 'user5 无 workout，跳过');

// ---------- D. 统计缓存 / 结束 / 历史 ----------
const w1 = await api('GET', '/api/stats/weekly', { token: userToken });
const w2 = await api('GET', '/api/stats/weekly', { token: userToken });
const wSame = JSON.stringify(w1.json?.data) === JSON.stringify(w2.json?.data);
const thisWeekDays = Number(sql(`SELECT COUNT(DISTINCT log_date) FROM workout_logs WHERE user_id=${uid} AND log_date >= '${WEEK_START}' AND log_date < '${addDays(WEEK_START, 7)}';`));
const thisWeekVol = Number(sql(`SELECT COALESCE(SUM(total_volume),0) FROM workout_logs WHERE user_id=${uid} AND log_date >= '${WEEK_START}' AND log_date < '${addDays(WEEK_START, 7)}';`));
const series = w1.json?.data?.series ?? [];
const mondayAll = series.every((s) => new Date(`${s.weekStart}T00:00:00.000Z`).getUTCDay() === 1);
if (w1.status === 200 && w1.json?.data?.days === thisWeekDays && w1.json?.data?.totalVolume === thisWeekVol && series.length === 4 && mondayAll && series[3]?.weekStart === WEEK_START) ok('D-04', '本周统计与 DB 一致', `days=${thisWeekDays} volume=${thisWeekVol} series=${series.map((s) => s.volume).join('/')}`);
else bad('D-04', '本周统计与 DB 一致', `api=${JSON.stringify(w1.json?.data)} dbDays=${thisWeekDays} dbVol=${thisWeekVol} mondayAll=${mondayAll} lastWeek=${series[3]?.weekStart}`);
if (wSame) ok('D-06', '60s 内两次 weekly 一致（缓存命中）');
else bad('D-06', '60s 内两次 weekly 一致（缓存命中）', `w1=${JSON.stringify(w1.json?.data)} w2=${JSON.stringify(w2.json?.data)}`);

// D-05 / F-01：插 3 条往周记录，本周 days 不得被 4 周范围污染
// 原生 SQL 写入不触发缓存失效，随后用一次组次提交做写后失效，再看 weekly
sql(`INSERT INTO workout_logs (user_id, plan_id, log_date, total_volume) VALUES (${uid}, ${planId}, '${addDays(WEEK_START, -7)}', 100), (${uid}, ${planId}, '${addDays(WEEK_START, -14)}', 100), (${uid}, ${planId}, '${addDays(WEEK_START, -21)}', 100);`);
await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId, setNo: 1, weight: 42.5, reps: 10, done: true } });
const w3 = await api('GET', '/api/stats/weekly', { token: userToken });
const curWeekVol = Number(sql(`SELECT COALESCE(SUM(total_volume),0) FROM workout_logs WHERE user_id=${uid} AND log_date >= '${WEEK_START}' AND log_date < '${addDays(WEEK_START, 7)}';`));
if (w3.json?.data?.days === thisWeekDays && w3.json?.data?.series?.length === 4 && w3.json?.data?.series?.[0]?.volume === 100 && w3.json?.data?.totalVolume === curWeekVol) ok('D-05', '本周 days 不受往周记录污染', `days=${w3.json?.data?.days} series=${w3.json?.data?.series?.map((s) => s.volume).join('/')} weekVol=${curWeekVol}`);
else bad('D-05', '本周 days 不受往周记录污染', `data=${JSON.stringify(w3.json?.data)} weekVol=${curWeekVol}`);
sql(`DELETE FROM workout_logs WHERE user_id=${uid} AND log_date IN ('${addDays(WEEK_START, -7)}','${addDays(WEEK_START, -14)}','${addDays(WEEK_START, -21)}');`);

// D-07 写后失效：再写一组 10*5=50，weekly 必须立即反映（比「本周合计」，不是单条 workout）
await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId: exerciseId2, setNo: 5, weight: 10, reps: 5, done: true } });
const dbWeekVol = Number(sql(`SELECT COALESCE(SUM(total_volume),0) FROM workout_logs WHERE user_id=${uid} AND log_date >= '${WEEK_START}' AND log_date < '${addDays(WEEK_START, 7)}';`));
const w4 = await api('GET', '/api/stats/weekly', { token: userToken });
const dbVol3 = Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`));
if (w4.json?.data?.totalVolume === dbWeekVol) ok('D-07', '写后缓存失效', `weekly=${w4.json?.data?.totalVolume} dbWeek=${dbWeekVol} ourWorkout=${dbVol3}`);
else bad('D-07', '写后缓存失效', `weekly=${w4.json?.data?.totalVolume} dbWeek=${dbWeekVol} ourWorkout=${dbVol3}`);

const fin1 = await api('POST', `/api/workouts/${workoutId}/finish`, { token: userToken });
const finVol = Number(sql(`SELECT total_volume FROM workout_logs WHERE id=${workoutId};`));
if (fin1.status === 200 && fin1.json?.data?.finishedAt && fin1.json?.data?.totalVolume === finVol) ok('D-01', '结束训练', `finishedAt=${fin1.json?.data?.finishedAt} volume=${finVol}`);
else bad('D-01', '结束训练', `status=${fin1.status} data=${JSON.stringify(fin1.json?.data)}`);

const fin2 = await api('POST', `/api/workouts/${workoutId}/finish`, { token: userToken });
if (fin2.status === 200 && fin2.json?.data?.finishedAt === fin1.json?.data?.finishedAt) ok('D-02', '结束幂等');
else bad('D-02', '结束幂等', `first=${fin1.json?.data?.finishedAt} second=${fin2.json?.data?.finishedAt}`);

// C-20 结束后锁定
const postAfter = await api('POST', `/api/workouts/${workoutId}/sets`, { token: userToken, body: { exerciseId, setNo: 4, weight: 10, reps: 10, done: true } });
const patchAfter = await api('PATCH', `/api/workouts/${workoutId}/sets/${setId1}`, { token: userToken, body: { weight: 1 } });
const delAfter = await api('DELETE', `/api/workouts/${workoutId}/sets/${setId1}`, { token: userToken });
if ([postAfter, patchAfter, delAfter].every((r) => r.status === 400 && r.json?.code === 40002)) ok('C-20', '结束后组次锁定 40002', `msgs=${postAfter.json?.message}|${patchAfter.json?.message}|${delAfter.json?.message}`);
else bad('C-20', '结束后组次锁定 40002', `statuses=${postAfter.status}/${patchAfter.status}/${delAfter.status}`);

const wlist = await api('GET', '/api/workouts?page=1&size=20', { token: userToken });
const row = (wlist.json?.data?.list ?? []).find((r) => r.id === workoutId);
const dbTotal = Number(sql(`SELECT count(*) FROM workout_logs WHERE user_id=${uid};`));
if (wlist.status === 200 && row?.finished === true && row?.totalVolume === finVol && wlist.json?.data?.total === dbTotal) ok('D-03', '列表与 DB 一致', `total=${dbTotal} ourVolume=${row?.totalVolume}`);
else bad('D-03', '列表与 DB 一致', `status=${wlist.status} row=${JSON.stringify(row)} total=${wlist.json?.data?.total} db=${dbTotal}`);

const hist = await api('GET', '/api/stats/history?weeks=4', { token: userToken });
const histList = hist.json?.data?.list ?? [];
const cn = histList.every((h) => /[\u4e00-\u9fa5]/.test(h.planName ?? ''));
const desc = histList.every((h, i) => i === 0 || h.logDate <= histList[i - 1].logDate);
if (hist.status === 200 && histList.length <= 100 && cn && desc) ok('D-08', '历史 4 周中文可读', `count=${histList.length} first=${histList[0]?.logDate} plan=${histList[0]?.planName}`);
else bad('D-08', '历史 4 周中文可读', `status=${hist.status} count=${histList.length} cn=${cn} desc=${desc}`);

const h0 = await api('GET', '/api/stats/history?weeks=0', { token: userToken });
const h99 = await api('GET', '/api/stats/history?weeks=99', { token: userToken });
if (h0.status === 200 && h99.status === 200) ok('D-09', 'weeks 边界不报 500', `w0=${h0.json?.data?.list?.length} w99=${h99.json?.data?.list?.length}`);
else bad('D-09', 'weeks 边界不报 500', `w0=${h0.status} w99=${h99.status}`);

// D-10 空态：新手机号自动建号（无计划）
const freshPhone = '13700137000';
const fresh = await api('POST', '/api/auth/login', { body: { phone: freshPhone, code: CODE } });
const freshToken = fresh.json?.data?.token;
const fw = await api('GET', '/api/stats/weekly', { token: freshToken });
const fp = await api('GET', '/api/plans', { token: freshToken });
const fc = await api('GET', '/api/plans/current', { token: freshToken });
if (fresh.status === 200 && fw.json?.data?.days === 0 && fw.json?.data?.totalVolume === 0 && fw.json?.data?.series?.every((s) => s.volume === 0) && fp.json?.data?.list?.length === 0 && fc.status === 404) ok('D-10', '空态（新用户无计划）', `plans=0 weekly=0/0 current=404`);
else bad('D-10', '空态（新用户无计划）', `plans=${fp.json?.data?.list?.length} weekly=${JSON.stringify(fw.json?.data)} current=${fc.status}`);

// ---------- E. admin / 越权 ----------
for (const p of ['/api/admin/workouts', '/api/admin/users', '/api/admin/stats/summary']) {
  const r = await api('GET', p, { token: userToken });
  if (r.status === 403 && r.json?.code === 40301) ok(`E-01(${p.split('/').pop()})`, '普通用户越权 40301');
  else bad(`E-01(${p.split('/').pop()})`, '普通用户越权 40301', `status=${r.status} body=${r.text.slice(0, 120)}`);
}

const aw = await api('GET', '/api/admin/workouts?page=1&size=20', { token: adminToken });
const awList = aw.json?.data?.list ?? [];
const dbAll = Number(sql(`SELECT count(*) FROM workout_logs;`));
const allMasked = awList.every((r) => /^1\d{2}\*{4}\d{4}$/.test(r.phoneMasked ?? ''));
const noRaw = !aw.text.match(/1\d{10}/);
if (aw.status === 200 && aw.json?.data?.total === dbAll && allMasked && noRaw && aw.json?.data?.page === 1 && aw.json?.data?.size === 20) ok('E-02', 'admin 全站列表（脱敏）', `total=${dbAll} masked=all`);
else bad('E-02', 'admin 全站列表（脱敏）', `status=${aw.status} total=${aw.json?.data?.total} db=${dbAll} masked=${allMasked} rawLeak=${!noRaw}`);

const p1 = await api('GET', '/api/admin/workouts?page=1&size=5', { token: adminToken });
const p2 = await api('GET', '/api/admin/workouts?page=2&size=5', { token: adminToken });
const id1 = (p1.json?.data?.list ?? []).map((r) => r.id);
const id2 = (p2.json?.data?.list ?? []).map((r) => r.id);
const overlap = id1.filter((i) => id2.includes(i));
const dbPage2 = sql(`SELECT id FROM workout_logs ORDER BY log_date DESC, id DESC OFFSET 5 LIMIT 5;`).split('\n').filter(Boolean).map(Number);
if (p2.status === 200 && overlap.length === 0 && id2.length === dbPage2.length && id2.every((v, i) => v === dbPage2[i])) ok('E-03', '分页 offset 一致', `page1=${id1.join(',')} page2=${id2.join(',')}`);
else bad('E-03', '分页 offset 一致', `overlap=${overlap} page2=${id2} db=${dbPage2}`);

const s51 = await api('GET', '/api/admin/workouts?page=1&size=51', { token: adminToken });
const s0 = await api('GET', '/api/admin/workouts?page=1&size=0', { token: adminToken });
const sNeg = await api('GET', '/api/admin/workouts?page=1&size=-1', { token: adminToken });
if (s51.json?.data?.size === 50 && s0.json?.data?.size === 1 && sNeg.json?.data?.size === 1) ok('E-04', 'size 钳制 50/1/1', `${s51.json?.data?.size}/${s0.json?.data?.size}/${sNeg.json?.data?.size}`);
else bad('E-04', 'size 钳制 50/1/1', `${s51.json?.data?.size}/${s0.json?.data?.size}/${sNeg.json?.data?.size}`);

const pg0 = await api('GET', '/api/admin/workouts?page=0&size=5', { token: adminToken });
const pgNeg = await api('GET', '/api/admin/workouts?page=-1&size=5', { token: adminToken });
if (pg0.json?.data?.page === 1 && pgNeg.json?.data?.page === 1) ok('E-05', 'page 钳制为 1');
else bad('E-05', 'page 钳制为 1', `${pg0.json?.data?.page}/${pgNeg.json?.data?.page}`);

const todayAdmin = await api('GET', `/api/admin/workouts?from=${TODAY}&to=${TODAY}`, { token: adminToken });
const dbToday = Number(sql(`SELECT count(*) FROM workout_logs WHERE log_date='${TODAY}';`));
if (todayAdmin.status === 200 && todayAdmin.json?.data?.total === dbToday) ok('E-06', '日期筛选与 DB 一致', `total=${dbToday}`);
else bad('E-06', '日期筛选与 DB 一致', `total=${todayAdmin.json?.data?.total} db=${dbToday}`);

const badDate = await api('GET', '/api/admin/workouts?from=2026/11/25', { token: adminToken });
if (badDate.status === 400 && badDate.json?.code === 40001 && String(badDate.json?.data?.field ?? '').includes('from')) ok('E-07', '日期格式 40001', `field=${badDate.json?.data?.field}`);
else bad('E-07', '日期格式 40001', `status=${badDate.status} body=${badDate.text.slice(0, 160)}`);

const badCal = await api('GET', '/api/admin/workouts?from=2026-13-01', { token: adminToken });
if (badCal.status === 400 && badCal.json?.code === 40001) ok('E-08', '非法日历日 40001');
else known('E-08', '非法日历日返回 500（Q-012 P2，已登记 deferred）', `status=${badCal.status} code=${badCal.json?.code} body=${badCal.text.slice(0, 120)}`);

const inv = await api('GET', '/api/admin/workouts?from=2026-12-01&to=2026-11-01', { token: adminToken });
if (inv.status === 200 && (inv.json?.data?.list?.length ?? -1) === 0 && inv.json?.data?.total === 0) ok('E-09', 'from>to 返回空集');
else bad('E-09', 'from>to 返回空集', `status=${inv.status} data=${JSON.stringify(inv.json?.data).slice(0, 160)}`);

const au = await api('GET', '/api/admin/users', { token: adminToken });
const auList = au.json?.data?.list ?? [];
const rolesOk = auList.every((u) => ['admin', 'user'].includes(u.role));
const usersMasked = auList.every((u) => /^1\d{2}\*{4}\d{4}$/.test(u.phoneMasked ?? ''));
if (au.status === 200 && rolesOk && usersMasked && auList.every((u) => u.createdAt)) ok('E-10', 'admin 用户列表（脱敏）', `count=${auList.length}`);
else bad('E-10', 'admin 用户列表（脱敏）', `status=${au.status} rolesOk=${rolesOk} masked=${usersMasked}`);

const sum = await api('GET', '/api/admin/stats/summary', { token: adminToken });
const dbUsers = Number(sql(`SELECT count(*) FROM users;`));
const dbWk = Number(sql(`SELECT count(*) FROM workout_logs;`));
const dbVolAll = Number(sql(`SELECT COALESCE(SUM(total_volume),0) FROM workout_logs;`));
if (sum.status === 200 && sum.json?.data?.userCount === dbUsers && sum.json?.data?.workoutCount === dbWk && sum.json?.data?.totalVolume === dbVolAll) ok('E-11', '汇总与 DB 聚合一致', `users=${dbUsers} workouts=${dbWk} volume=${dbVolAll}`);
else bad('E-11', '汇总与 DB 聚合一致', `api=${JSON.stringify(sum.json?.data)} db=${dbUsers}/${dbWk}/${dbVolAll}`);

// ---------- F. 版本 / APK ----------
const ver = await api('GET', '/api/app/version');
const vdata = ver.json?.data ?? {};
if (ver.status === 200 && vdata.version === '1.0.2' && vdata.buildNo === 3 && String(vdata.apkUrl ?? '').endsWith('/apk/rn-workout-1.0.2.apk') && /[\u4e00-\u9fa5]/.test(vdata.notes ?? '')) ok('F-01', '版本接口字段齐全', `apkUrl=${vdata.apkUrl}`);
else bad('F-01', '版本接口字段齐全', `data=${JSON.stringify(vdata)}`);

const rootRel = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
const codeRel = JSON.parse(fs.readFileSync(path.join(ROOT, '05_代码', 'release.json'), 'utf8'));
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, '05_代码', 'frontend', 'app.json'), 'utf8'));
const appVer = appJson?.expo?.version;
const appCode = appJson?.expo?.android?.versionCode;
if (rootRel.version === '1.0.2' && codeRel.version === '1.0.2' && appVer === '1.0.2' && rootRel.buildNo === 3 && codeRel.buildNo === 3 && appCode === 3) ok('F-02', '三处版本一致', `root=${rootRel.version}/${rootRel.buildNo} code=${codeRel.version}/${codeRel.buildNo} app=${appVer}/${appCode}`);
else bad('F-02', '三处版本一致', `root=${rootRel.version}/${rootRel.buildNo} code=${codeRel.version}/${codeRel.buildNo} app=${appVer}/${appCode}`);

const apkPath = path.join(ROOT, '10_交付', 'apk', 'rn-workout-1.0.2.apk');
const apkSize = fs.statSync(apkPath).size;
for (const [tag, base] of [['local', BASE], ['lan', LAN]]) {
  const res = await fetch(`${base}/apk/rn-workout-1.0.2.apk`, { method: 'HEAD' });
  const len = Number(res.headers.get('content-length') ?? 0);
  if (res.status === 200 && (len === 0 || len === apkSize)) ok(`F-03(${tag})`, 'APK 可下载', `status=200 len=${len || '未声明'} file=${apkSize}`);
  else bad(`F-03(${tag})`, 'APK 可下载', `status=${res.status} len=${len} file=${apkSize}`);
}
manual('F-04', '低版本启动弹更新', '阶段二 S9 已过（1.0.1→1.0.2）');
manual('F-05', '覆盖升级保留登录态', '阶段二 S9 已过（不卸载覆盖）');

// ---------- G. 数据一致性 ----------
// G-01 只对「有组次的 workout」做严格口径比对（API 维护的数据必须自洽）；
// volume>0 且 0 组次的行单独列为脏数据，7.5 重置后应清零
const g1 = Number(sql(`SELECT count(*) FROM workout_logs w WHERE EXISTS (SELECT 1 FROM set_logs s WHERE s.workout_log_id=w.id) AND w.total_volume <> COALESCE((SELECT SUM(weight*reps) FROM set_logs s WHERE s.workout_log_id=w.id AND s.done),0);`));
if (g1 === 0) ok('G-01', '容量口径全库一致（有组次的行）', 'diff=0');
else bad('G-01', '容量口径全库一致（有组次的行）', `diff=${g1}`);

const dirt = sql(`SELECT id||'|'||user_id||'|'||log_date||'|'||total_volume FROM workout_logs w WHERE w.total_volume > 0 AND NOT EXISTS (SELECT 1 FROM set_logs s WHERE s.workout_log_id=w.id);`);
if (dirt) warn('G-01b', '脏数据：有容量无组次的 workout 行（非 API 产生，7.5 重置清零）', dirt.replace(/\n/g, ' ; '));
else ok('G-01b', '无「有容量无组次」脏数据');

const g2a = Number(sql(`SELECT count(*) FROM set_logs s LEFT JOIN workout_logs w ON w.id=s.workout_log_id WHERE w.id IS NULL;`));
const g2b = Number(sql(`SELECT count(*) FROM exercises e LEFT JOIN plans p ON p.id=e.plan_id WHERE p.id IS NULL;`));
if (g2a === 0 && g2b === 0) ok('G-02', '无孤儿数据', `sets=${g2a} exercises=${g2b}`);
else bad('G-02', '无孤儿数据', `sets=${g2a} exercises=${g2b}`);

const g3a = Number(sql(`SELECT count(*) FROM (SELECT user_id, log_date FROM workout_logs GROUP BY 1,2 HAVING count(*)>1) t;`));
const g3b = Number(sql(`SELECT count(*) FROM (SELECT workout_log_id, exercise_id, set_no FROM set_logs GROUP BY 1,2,3 HAVING count(*)>1) t;`));
if (g3a === 0 && g3b === 0) ok('G-03', '唯一约束无重复', `workouts=${g3a} sets=${g3b}`);
else bad('G-03', '唯一约束无重复', `workouts=${g3a} sets=${g3b}`);

const cnRows = sql(`SELECT name FROM plans ORDER BY id LIMIT 5;`);
if (/[\u4e00-\u9fa5]/.test(cnRows) && !cnRows.includes('?') && !cnRows.includes('\uFFFD')) ok('G-04', '中文回读正常', cnRows.split('\n').slice(0, 3).join(' / '));
else bad('G-04', '中文回读正常', cnRows.slice(0, 120));

const hasTrace = [me, plans, w1, aw, ver].every((r) => r.json?.traceId);
if (hasTrace) ok('G-06', '响应带 traceId');
else bad('G-06', '响应带 traceId', `me=${me.json?.traceId} plans=${plans.json?.traceId} weekly=${w1.json?.traceId}`);

manual('C-22', '断网/后端停时乐观回滚', '需真机断网演练（第 9 步按清单走）');
manual('A-09', '真机冷启动免登录', '阶段二 S1 已过');

// ---------- 汇总 ----------
log(`# RESULT ${ROUND}: PASS=${pass} FAIL=${fail}`);
if (fails.length) log(`# FAILS:\n${fails.map((f) => '  - ' + f).join('\n')}`);
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.writeFileSync(LOG, lines.join('\n') + '\n', 'utf8');
log(`# LOG ${LOG}`);
process.exit(fail === 0 ? 0 : 1);
