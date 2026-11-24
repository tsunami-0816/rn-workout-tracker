import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * 从 start 向上找项目根（含 release.json 或 _项目状态.md 的目录）。
 * 不用 `resolve(cwd, '..')` 写死层级：从 backend 启动、从仓库根启动、从 dist 启动
 * 三种 cwd 下都能落到同一个 release.json（F-03 的根因就是写死了 `..`）。
 */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'release.json')) || existsSync(join(dir, '_项目状态.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start, '..', '..');
}

/** 项目根下的 release.json 绝对路径 */
export function defaultReleasePath(start: string = process.cwd()): string {
  return join(findProjectRoot(start), 'release.json');
}
