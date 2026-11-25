/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProjectRoot, defaultReleasePath } from './paths';

/** Q-002 回归：项目根解析必须锚定 `_项目状态.md`，不能被 `05_代码/release.json` 同名副本截胡 */
describe('paths 项目根解析（Q-002）', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'proj-root-'));
    writeFileSync(join(root, '_项目状态.md'), '# 状态');
    writeFileSync(join(root, 'release.json'), JSON.stringify({ version: '9.9.9' }));
    mkdirSync(join(root, '05_代码'));
    // 故意放一个同名副本：若实现按 release.json 判根，会错误停在这里
    writeFileSync(join(root, '05_代码', 'release.json'), JSON.stringify({ version: '0.0.0' }));
    mkdirSync(join(root, '05_代码', 'backend'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('从 backend 目录向上命中 _项目状态.md 锚点，返回真正的项目根', () => {
    expect(findProjectRoot(join(root, '05_代码', 'backend'))).toBe(root);
  });

  it('同名 release.json 副本不会截胡项目根', () => {
    const found = findProjectRoot(join(root, '05_代码', 'backend'));
    expect(found).not.toBe(join(root, '05_代码'));
    expect(defaultReleasePath(join(root, '05_代码', 'backend'))).toBe(join(root, 'release.json'));
  });

  it('无锚点时退回含 release.json 的目录（兜底路径）', () => {
    rmSync(join(root, '_项目状态.md'));
    expect(findProjectRoot(join(root, '05_代码', 'backend'))).toBe(join(root, '05_代码'));
  });
});
