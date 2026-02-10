module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e.ts',
    '!src/index.ts',              // Barrel export only
    '!src/types.ts',              // Type definitions only
    '!src/firestore/index.ts',    // Barrel export only
    '!src/firestore-rest.ts',     // Compatibility layer (re-exports only)
  ],
};
