const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");

const configPath = path.resolve(__dirname, "../.env.test.local");
const loaded = dotenv.config({ path: configPath });
if (loaded.error) {
    throw new Error(`Missing disposable test configuration: ${configPath}`);
}

const databaseUrl = process.env.TEST_DATABASE_URL;
let parsedUrl;
try {
    parsedUrl = new URL(databaseUrl);
} catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
}

if (parsedUrl.protocol !== "postgresql:" ||
    parsedUrl.hostname !== "127.0.0.1" ||
    parsedUrl.port !== "55432" ||
    parsedUrl.pathname !== "/apaar_ci_test" ||
    parsedUrl.username !== "apaar_app" ||
    parsedUrl.password) {
    throw new Error(
        "TEST_DATABASE_URL must target local apaar_ci_test on 127.0.0.1:55432 without a password"
    );
}

process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
process.env.TEST_ACTIVE_LOGIN_EMAIL =
    process.env.TEST_ACTIVE_LOGIN_EMAIL ||
    `ci.active.${crypto.randomUUID()}@example.invalid`;
process.env.TEST_ACTIVE_LOGIN_PASSWORD =
    process.env.TEST_ACTIVE_LOGIN_PASSWORD || crypto.randomBytes(24).toString("base64url");
