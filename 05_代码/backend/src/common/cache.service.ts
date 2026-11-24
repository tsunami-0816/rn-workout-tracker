import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * 进程内 60s 缓存（默认）。写操作后按前缀失效，保证「打完卡统计立刻变」。
 * RN_CACHE=redis 时本实现不启用（本项目默认不引 Redis，见架构 §12 偏差 3）。
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  get<T>(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** 写后失效：如 invalidate('stats:weekly:2') */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
