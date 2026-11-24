const base = require('./jest.config.js');

/**
 * 单测专用配置：只跑 src/**\/*.spec.ts，不把 e2e 混进来。
 * 服务器没起时 e2e 会连接失败，过去会被误读成「测试全红」（F-08）。
 * e2e 用 npm run test:e2e（test/jest-e2e.json）。
 */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
