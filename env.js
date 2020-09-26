const { resolve } = require('path');
require('dotenv').config({ path: resolve(__dirname, './.env') });

module.exports = {
    DB_OPTIONS: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB
    },
    GOAL_SERVE: {
        token: process.env.GOALSERVE_TOKEN
    }
};