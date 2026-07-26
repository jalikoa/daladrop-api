/** @type {import('jest').Config} */
module.exports = {
  displayName: 'payments',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/payments/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/identity/tsconfig.jest.json' },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
