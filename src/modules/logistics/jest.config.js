/** @type {import('jest').Config} */
module.exports = {
  displayName: 'logistics',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/logistics/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/logistics/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/logistics/domain/**/*.ts',
    'src/modules/logistics/use-cases/delivery-quote.service.ts',
  ],
  coverageDirectory: 'coverage/logistics',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
