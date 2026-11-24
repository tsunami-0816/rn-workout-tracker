// 契约自检：用 Node 以 UTF-8 读取 openapi.json，统计端点数并把结果写文件
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const openapiPath = path.join(projectRoot, '06.5_契约', 'openapi.json');
const outPath = path.join(projectRoot, '05_代码', 'backend', 'evidence', 'contract-check.txt');

const doc = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const ops = [];
for (const [p, item] of Object.entries(doc.paths || {})) {
  for (const m of Object.keys(item)) {
    if (['get', 'post', 'patch', 'delete'].includes(m)) ops.push(`${m.toUpperCase()} ${p}`);
  }
}

const expected = [
  'POST /api/auth/send-code', 'POST /api/auth/login', 'GET /api/auth/me',
  'GET /api/plans', 'GET /api/plans/current', 'GET /api/plans/{id}/exercises',
  'GET /api/workouts', 'POST /api/workouts/start', 'GET /api/workouts/{id}',
  'POST /api/workouts/{id}/sets', 'PATCH /api/workouts/{id}/sets/{setId}',
  'DELETE /api/workouts/{id}/sets/{setId}', 'POST /api/workouts/{id}/finish',
  'GET /api/stats/weekly', 'GET /api/stats/history',
  'GET /api/admin/workouts', 'GET /api/admin/users', 'GET /api/admin/stats/summary',
  'GET /api/app/version', 'GET /api/health',
];
const missing = expected.filter((e) => !ops.includes(e));
const extra = ops.filter((o) => !expected.includes(o));

const lines = [
  `openapi=${openapiPath}`,
  `paths=${Object.keys(doc.paths || {}).length}`,
  `operations=${ops.length}`,
  `expected=20 missing=${missing.length} extra=${extra.length}`,
  ...(missing.length ? ['MISSING:', ...missing] : []),
  ...(extra.length ? ['EXTRA:', ...extra] : []),
  ...ops.sort(),
];
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`operations=${ops.length} missing=${missing.length} extra=${extra.length}`);
