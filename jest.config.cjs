/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': '<rootDir>/tests/jest-esbuild-transform.cjs',
  },
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
};
