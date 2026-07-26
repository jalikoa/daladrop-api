/** @type {import('jest').Config} */
module.exports = {
  displayName: 'verticals',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: [
    '**/src/modules/{events,compliance}/**/__tests__/**/*.spec.ts',
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
    'src/modules/events/use-cases/events-discovery.service.ts',
    'src/modules/events/use-cases/event-booking.service.ts',
    'src/modules/events/use-cases/admin-events.service.ts',
    'src/modules/compliance/use-cases/age-verification.service.ts',
  ],
  coverageDirectory: 'coverage/verticals',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
