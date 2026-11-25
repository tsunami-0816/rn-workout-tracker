// OSV 直查 Python 依赖（替代 pip-audit，脚本由 Agent 代跑）
const pkgs = [
  ['pytest', '8.3.3'],
  ['allure-pytest', '2.13.5'],
  ['httpx', '0.27.2'],
  ['PyYAML', '6.0.2'],
];
const out = [];
for (const [name, version] of pkgs) {
  const res = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: { name, ecosystem: 'PyPI' }, version }),
  });
  const j = await res.json();
  const vulns = j.vulns ?? [];
  out.push({ name, version, count: vulns.length, ids: vulns.map((v) => v.id), severities: vulns.map((v) => v.database_specific?.severity ?? null) });
  console.log(`${name}@${version} -> ${vulns.length} vuln(s)`, vulns.map((v) => v.id).join(','));
}
console.log('[summary]', JSON.stringify(out));
