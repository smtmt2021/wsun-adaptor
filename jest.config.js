module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/*.test.ts'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: 'tsconfig.test.json'
    }
  },
  collectCoverage: true,
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/__tests__/']
};
