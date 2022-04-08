const config = require('./savefiles/config.json');

const { Client: PGCLIENT } = require('pg');
const client = new PGCLIENT({
    user: config.postgres.user,
    host: config.postgres.host,
    database: config.postgres.database,
    password: config.postgres.password,
    port: config.postgres.port,
    ssl: { rejectUnauthorized: false }
});
client.connect();


// SETUP THE DB --------------------------------------------------
function databaseSetup() {

    var query = 'DROP TABLE IF EXISTS accounts;';
    var params = [];
    client.query(query, params, function(err, result) { if (err) { console.log(err); }});
    
    // CREATE ACCOUNTS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS accounts (id BIGINT, dollars INT);';
    var params = [];
    client.query(query, params, function(err, result) { if (err) { console.log(err); }});
}
databaseSetup();