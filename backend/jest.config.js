module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/migrations/**/*',
    '!src/scripts/**/*',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  // setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  testSequencer: '<rootDir>/src/tests/testSequencer.js',
  // Temporarily disable global setup/teardown for testing
  // globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  // globalTeardown: '<rootDir>/src/tests/globalTeardown.ts',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/'
  ],
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  // Removed projects configuration to avoid timeout conflicts
};