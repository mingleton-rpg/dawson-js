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

/** Chance.JS */
const Chance = require('chance');
const chance = new Chance();


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
// databaseSetup();


var query = 'DELETE FROM accounts WHERE id = 897735163553918987;';
var params = [];
client.query(query, params, function(err, result) { if (err) { console.log(err); }});

// var query = 'ALTER TABLE accounts ADD COLUMN str INT, ADD COLUMN dex INT, ADD COLUMN con INT, ADD COLUMN int INT, ADD COLUMN wis INT, ADD COLUMN cha INT;';
// var params = [];
// client.query(query, params, function(err, result) { if (err) { console.log(err); }});



// Update existing accounts
var query = 'SELECT * FROM accounts';
client.query(query, params, function(err, result) { 

    for (row of result.rows) {

        // Generate random stats
        const accountStats = { 
            dollars: 100,
            abilities: {
                str: 5 + chance.d12(),
                dex: 5 + chance.d12(),
                con: 5 + chance.d12(),
                int: 5 + chance.d12(),
                wis: 5 + chance.d12(),
                cha: 5 + chance.d12()
            }
        }

        // Update the server
        var query = 'UPDATE accounts SET str = $1, dex = $2, con = $3, int = $4, wis = $5, cha = $6 WHERE id = $7;';
        var params = [ accountStats.abilities.str, accountStats.abilities.dex, accountStats.abilities.con, accountStats.abilities.int, accountStats.abilities.wis, accountStats.abilities.cha, row.id ];
        client.query(query, params, function(err, result) { if (err) { console.log(err); console.log('a'); }});
        console.log('e')
    }
});