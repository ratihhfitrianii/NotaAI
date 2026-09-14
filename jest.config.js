/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/index.ts",
    "!src/db/postgres.ts",
  ],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { branches: 60, functions: 65, lines: 70, statements: 70 },
  },
};
