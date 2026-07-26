/** @type {import('jest').Config} */
module.exports = {
  displayName: 'notifications',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/notifications/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/wallets/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/notifications/use-cases/notifications.service.ts',
    'src/modules/notifications/use-cases/push-token.service.ts',
  ],
  coverageDirectory: 'coverage/notifications',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
