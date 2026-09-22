import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "<rootDir>/jest.environment.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // .next/standalone duplicates package.json and confuses jest-haste-map
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  // e2e specs belong to Playwright; jest must not try to run them
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/test/**",
    "!src/generated/**",
    "!src/app/sw.ts",
  ],
};

export default createJestConfig(config);
