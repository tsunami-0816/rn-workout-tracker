import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * 从 start 向上找项目根：以 `_项目状态.md` 为唯一锚点，
 * 避免 `05_代码/release.json` 这类同名副本把项目根“截胡”，
 * 导致 `10_交付/apk` 静态目录解析到不存在的路径。
 * 找不到看板时退回“含 release.json”的目录，最后兜底 start/../..
 */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  let fallback = '';
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '_项目状态.md'))) return dir;
    if (!fallback && existsSync(join(dir, 'release.json'))) fallback = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fallback || resolve(start, '..', '..');
}

/** 项目根下的 release.json 绝对路径 */
export function defaultReleasePath(start: string = process.cwd()): string {
  return join(findProjectRoot(start), 'release.json');
}
