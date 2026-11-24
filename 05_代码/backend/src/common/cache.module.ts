import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/** 全局缓存模块：统计服务与训练服务共用同一个 60s Map */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
