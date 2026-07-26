/** @type {import('jest').Config} */
module.exports = {
  displayName: 'orders',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/orders/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/orders/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/orders/use-cases/multi-checkout.service.ts',
    'src/modules/orders/helpers/**/*.ts',
  ],
  coverageDirectory: 'coverage/orders',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
