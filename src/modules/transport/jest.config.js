/** @type {import('jest').Config} */
module.exports = {
  displayName: 'transport',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/transport/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/transport/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/transport/domain/**/*.ts',
    'src/modules/transport/use-cases/rides.service.ts',
    'src/modules/transport/use-cases/ride-quote.service.ts',
    'src/modules/transport/use-cases/ride-dispatch.service.ts',
    'src/modules/transport/use-cases/mpesa-payment-status.service.ts',
  ],
  coverageDirectory: 'coverage/transport',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
