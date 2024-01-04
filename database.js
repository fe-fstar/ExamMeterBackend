const Pool = require("pg").Pool;
require("dotenv").config();

const pool = new Pool({
    user: "postgres",
    database: "exammeter",
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: "5432"
});

module.exports = pool;