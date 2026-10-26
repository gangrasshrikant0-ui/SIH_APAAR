
const path = require("node:path");
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const { Pool } = require("pg");

const poolConfig = process.env.TEST_DATABASE_URL
    ? { connectionString: process.env.TEST_DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    };

const pool = new Pool({
    ...poolConfig,
    max: 10,
    connectionTimeoutMillis: 5000
});

module.exports = pool;
