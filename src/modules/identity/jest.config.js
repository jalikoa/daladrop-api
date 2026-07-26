/** @type {import('jest').Config} */
module.exports = {
  displayName: 'auth',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: [
    '**/src/modules/{identity,authorization,notifications,customer}/**/__tests__/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/src/modules/identity/tsconfig.jest.json',
      },
    ],
  },
  collectCoverageFrom: [
    'src/modules/identity/domain/auth-token.service.ts',
    'src/modules/identity/domain/auth.config.ts',
    'src/modules/identity/domain/auth-identity.util.ts',
    'src/modules/identity/adapters/human-challenge.verifier.ts',
    'src/modules/identity/guards/auth-token.guard.ts',
    'src/modules/identity/use-cases/auth.service.ts',
    'src/modules/identity/use-cases/profile.service.ts',
    'src/modules/identity/use-cases/admin-users.service.ts',
    'src/modules/authorization/use-cases/authorization.service.ts',
    'src/modules/authorization/guards/authorization.guard.ts',
    'src/modules/notifications/use-cases/auth-job.dispatcher.ts',
    'src/modules/notifications/processors/auth-notification.processor.ts',
    'src/modules/customer/use-cases/customer-places.service.ts',
    'src/modules/customer/use-cases/customer-activity.service.ts',
  ],
  coverageDirectory: 'coverage/auth',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};

