import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { defaultReleasePath } from '../common/paths';

interface ReleaseFile {
  version?: string;
  buildNo?: number;
  apkUrl?: string;
  notes?: string;
}

/**
 * 版本服务（L7）：读 release.json（不缓存，改文件立即生效）
 * 优先级：**release.json 优先，env 只在该字段缺失时兜底**（T-701「改文件立即返回新值」）。
 * 无 release.json 时用 env 兜底，接口永不 500（版本检查失败不阻塞登录）
 */
@Injectable()
export class VersionService {
  private readonly logger = new Logger('VersionService');

  constructor(private readonly config: ConfigService) {}

  async get(): Promise<{ version: string; buildNo: number; apkUrl: string; notes: string }> {
    const filePath = this.releasePath();
    let file: ReleaseFile = {};
    try {
      file = JSON.parse(await readFile(filePath, 'utf8')) as ReleaseFile;
    } catch (err) {
      this.logger.warn(`release.json 读取失败（${filePath}）：${err instanceof Error ? err.message : String(err)}`);
    }
    // 文件优先：env 只补文件里没有的字段。否则 .env 的 APP_* 会永久盖住 release.json，
    // 「改 release.json 立即生效」和 C09 更新弹窗演示都无法成立（F-03）。
    return {
      version: file.version ?? this.config.get<string>('APP_VERSION') ?? '1.0.0',
      buildNo: Number(file.buildNo ?? this.config.get<string>('APP_BUILD_NO') ?? 1),
      apkUrl: file.apkUrl ?? this.config.get<string>('APK_URL') ?? '',
      notes: file.notes ?? this.config.get<string>('APP_NOTES') ?? '',
    };
  }

  /** 默认向上找项目根的 release.json；可用 RELEASE_FILE 覆盖（F-03） */
  private releasePath(): string {
    const custom = this.config.get<string>('RELEASE_FILE');
    if (custom) return isAbsolute(custom) ? custom : resolve(process.cwd(), custom);
    return defaultReleasePath(process.cwd());
  }
}
