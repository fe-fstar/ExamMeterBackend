const Pool = require("pg").Pool;
require("dotenv").config();

const pool = new Pool({
    user: "postgres",
    database: "exammeter",
    password: "admin",
    host: "localhost",
    port: "5432"
});

module.exports = pool;