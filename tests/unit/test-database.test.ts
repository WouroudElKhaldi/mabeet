import { describe, expect, it } from "vitest";
import { testDatabaseUrl } from "../integration/test-database";

const development = "postgresql://postgres:secret@localhost:5433/mabeet";
const test = "postgresql://postgres:secret@localhost:5433/mabeet_test";

describe("the integration tests' database", () => {
  it("is the separate test database", () => {
    expect(testDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: test })).toBe(test);
  });

  it("refuses to run on the development database, or on any database not named _test", () => {
    expect(() => testDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: development })).toThrow(
      /must not be the same/,
    );
    expect(() =>
      testDatabaseUrl({ DATABASE_URL: test, TEST_DATABASE_URL: "postgresql://localhost:5433/mabeet_live" }),
    ).toThrow(/_test/);
    expect(() => testDatabaseUrl({ DATABASE_URL: development })).toThrow(/not set/);
  });
});
