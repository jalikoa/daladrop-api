/** @type {import('jest').Config} */
module.exports = {
  displayName: 'food',
  rootDir: '../../..',
  testEnvironment: 'node',
  testMatch: [
    '**/src/modules/{merchants,catalog}/**/__tests__/**/*.spec.ts',
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
    'src/modules/merchants/use-cases/restaurant-discovery.service.ts',
    'src/modules/merchants/domain/geo.util.ts',
    'src/modules/catalog/use-cases/food-categories.service.ts',
    'src/modules/catalog/use-cases/restaurant-menu.service.ts',
  ],
  coverageDirectory: 'coverage/food',
  coverageReporters: ['text', 'text-summary'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
