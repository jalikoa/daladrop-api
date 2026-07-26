/** @type {import('jest').Config} */
module.exports = {
  displayName: 'accounting',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/accounting/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/identity/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/accounting/domain/**/*.ts',
    'src/modules/accounting/use-cases/posting-engine.service.ts',
    'src/modules/accounting/use-cases/financial-reports.service.ts',
  ],
  coverageDirectory: 'coverage/accounting',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
