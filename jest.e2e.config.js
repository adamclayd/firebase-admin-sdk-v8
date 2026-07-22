module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.ts'],
  testTimeout: 30000, // 30 seconds for real API calls
  roots: ['<rootDir>/src'],
  globalSetup: '<rootDir>/jest.e2e.setup.js',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e.ts',
    '!src/types.ts',
    '!src/index.ts',
  ],
};
