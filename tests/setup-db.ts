// Test-database isolation + guard. Registered as a vitest setupFile AFTER `dotenv/config` (see
// vitest.config.ts), so .env is already loaded when this runs.
//
// The app DB layer connects via APP_DATABASE_URL (getConfig, lazy + memoized), and the integration
// suites TRUNCATE tables in beforeEach/afterEach. Historically APP_DATABASE_URL, PGBOSS_DATABASE_URL
// and TEST_DATABASE_URL all defaulted to the same dev database, so every test run silently wiped the
// developer's configured sources/scans/signals. This file makes that impossible:
//   1. it refuses to run when TEST_DATABASE_URL is not a dedicated test database, and
//   2. it remaps the test process (app + pg-boss) onto TEST_DATABASE_URL, so tests never touch the dev DB.

const testUrl = process.env.TEST_DATABASE_URL;

// No TEST_DATABASE_URL: the integration suites skip (describe.skipIf(!url)) and touch no database, so
// there is nothing to guard or remap. Unit-only runs land here.
if (testUrl) {
  let dbName = "";
  try {
    dbName = new URL(testUrl).pathname.replace(/^\//, "");
  } catch {
    dbName = "";
  }

  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL points at "${dbName || testUrl}", which is not a ` +
        `dedicated test database (its name must contain "test"). The integration suites truncate ` +
        `tables, so running them against the dev database would delete your data. Point ` +
        `TEST_DATABASE_URL at a separate database (e.g. wisery_crm_test).`,
    );
  }

  // getConfig reads these lazily, so remapping before the first call routes every test - the app
  // pool and the pg-boss pool - to the test database, leaving the dev DB (APP_DATABASE_URL in .env)
  // untouched by the test run.
  process.env.APP_DATABASE_URL = testUrl;
  process.env.PGBOSS_DATABASE_URL = testUrl;
}
