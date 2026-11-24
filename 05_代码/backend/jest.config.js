// jest 配置（NestJS 12 为纯 ESM 包，测试必须走 ESM 模式）
// 运行：NODE_OPTIONS=--experimental-vm-modules npx jest
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.spec.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs', 'cjs'],
  collectCoverageFrom: [
    'src/auth/**/*.ts',
    'src/workouts/**/*.ts',
    'src/stats/**/*.ts',
    'src/plans/**/*.ts',
    'src/common/**/*.ts',
    '!src/generated/**',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: '../../10_交付/test-report/coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
