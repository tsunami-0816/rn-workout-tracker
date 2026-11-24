/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VersionService } from './version.service';
import { defaultReleasePath } from '../common/paths';

/** VersionService 单测：release.json 优先 + env 只兜底缺失字段 + 默认路径真实可读（C09、F-03） */

function build(env: Record<string, string> = {}) {
  const config = { get: (key: string) => env[key] };
  return new VersionService(config as any);
}

describe('VersionService', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'release-'));
    file = join(dir, 'release.json');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('release.json 优先于内置默认值', async () => {
    writeFileSync(file, JSON.stringify({ version: '1.0.1', buildNo: 2, apkUrl: 'http://x/a.apk', notes: '修复' }));
    const svc = build({ RELEASE_FILE: file });
    await expect(svc.get()).resolves.toEqual({
      version: '1.0.1',
      buildNo: 2,
      apkUrl: 'http://x/a.apk',
      notes: '修复',
    });
  });

  it('env 只兜底文件里缺失的字段，不能盖住 release.json（F-03）', async () => {
    writeFileSync(file, JSON.stringify({ version: '1.0.1', buildNo: 2 }));
    const svc = build({ RELEASE_FILE: file, APP_VERSION: '1.0.2', APP_BUILD_NO: '3', APK_URL: 'http://env/x.apk' });
    const info = await svc.get();
    expect(info.version).toBe('1.0.1');
    expect(info.buildNo).toBe(2);
    // 文件没写 apkUrl → 才用 env 兜底
    expect(info.apkUrl).toBe('http://env/x.apk');
  });

  it('默认路径能从 backend cwd 向上找到项目根 release.json（F-03 回归）', async () => {
    const projectRootRelease = defaultReleasePath(process.cwd());
    expect(existsSync(projectRootRelease)).toBe(true);
    const fileJson = JSON.parse(readFileSync(projectRootRelease, 'utf8')) as { version: string; buildNo: number };
    const svc = build({});
    const info = await svc.get();
    expect(info.version).toBe(fileJson.version);
    expect(info.buildNo).toBe(Number(fileJson.buildNo));
  });

  it('文件缺失时用 env 兜底，不抛错', async () => {
    const svc = build({ RELEASE_FILE: join(dir, 'not-exist.json'), APP_VERSION: '1.0.0' });
    await expect(svc.get()).resolves.toEqual({ version: '1.0.0', buildNo: 1, apkUrl: '', notes: '' });
  });
  it('非法 JSON 时走兜底，不 500', async () => {
    writeFileSync(file, '{ broken json');
    const svc = build({ RELEASE_FILE: file });
    const info = await svc.get();
    expect(info.version).toBe('1.0.0');
  });
});
