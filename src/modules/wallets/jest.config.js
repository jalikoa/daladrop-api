/** @type {import('jest').Config} */
module.exports = {
  displayName: 'wallets',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: ['**/src/modules/wallets/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/src/modules/wallets/tsconfig.jest.json' },
    ],
  },
  collectCoverageFrom: [
    'src/modules/wallets/domain/**/*.ts',
    'src/modules/wallets/use-cases/wallet-mirroring.service.ts',
    'src/modules/wallets/use-cases/settlement.service.ts',
    'src/modules/wallets/use-cases/finance-dashboard.service.ts',
  ],
  coverageDirectory: 'coverage/wallets',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
