import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo 打包时只会内联 **静态字面量** 的 `process.env.EXPO_PUBLIC_*`，
 * 不能写成 `env[key]` 动态读取（否则 hbc 里保留的是变量名，真机永远拿不到值）。
 * 这里保留字面量访问；如果未来改成 app.config.ts extra 注入，必须同步改本文件与打包断言。
 */
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const ENV_PERF_FIXTURE = process.env.EXPO_PUBLIC_PERF_FIXTURE;

/** 本地版本号：来自 app.json 的 android.versionCode（D-12 比较基准） */
export function localBuildNo(): number {
  const versionCode = Constants.expoConfig?.android?.versionCode;
  return typeof versionCode === 'number' ? versionCode : 1;
}

export function localVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * API 根地址优先级：
 * 1. EXPO_PUBLIC_API_BASE_URL（显式覆盖，真机联调写局域网 IP）
 * 2. Expo dev server 的 hostUri 推导同机 8094（真机扫码时自动走局域网）
 * 3. Android 模拟器 10.0.2.2 / iOS 127.0.0.1 兜底
 */
export function resolveApiBaseUrl(): string {
  const explicit = ENV_API_BASE_URL;
  if (explicit && explicit.trim().length > 0) return explicit.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  const effectiveHost =
    host && host !== 'localhost' && host !== '127.0.0.1' ? host : fallbackHost;
  return `http://${effectiveHost}:8094/api`;
}

/** 100 条性能夹具开关（C02）：EXPO_PUBLIC_PERF_FIXTURE=1 时启用 */
export function perfFixtureEnabled(): boolean {
  return ENV_PERF_FIXTURE === '1';
}
