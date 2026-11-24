/**
 * config 读取口径（F-04）：EXPO_PUBLIC_* 必须是静态字面量访问，
 * 在 Jest 里等价于「模块加载时读 process.env」。打包后由 Expo 内联成常量。
 */
describe('config（F-04）', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  it('EXPO_PUBLIC_PERF_FIXTURE=1 时夹具开关为 true', () => {
    process.env.EXPO_PUBLIC_PERF_FIXTURE = '1';
    jest.isolateModules(() => {
      const config = require('../config') as typeof import('../config');
      expect(config.perfFixtureEnabled()).toBe(true);
    });
  });

  it('未设置夹具变量时为 false', () => {
    delete process.env.EXPO_PUBLIC_PERF_FIXTURE;
    jest.isolateModules(() => {
      const config = require('../config') as typeof import('../config');
      expect(config.perfFixtureEnabled()).toBe(false);
    });
  });

  it('EXPO_PUBLIC_API_BASE_URL 优先，且去掉末尾斜杠', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.20:8094/api/';
    jest.isolateModules(() => {
      const config = require('../config') as typeof import('../config');
      expect(config.resolveApiBaseUrl()).toBe('http://192.168.1.20:8094/api');
    });
  });
});
