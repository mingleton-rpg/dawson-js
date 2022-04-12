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
(async () => {

    // DROP TABLES
    // var query = 'DROP TABLE IF EXISTS accounts;';
    // var params = [];
    // client.query(query, params, function(err, result) { if (err) { console.log(err); }});

    var query = 'DROP TABLE IF EXISTS items;';
    var params = [];
    client.query(query, params, function(err, result) { if (err) { console.log(err); }});
    
    // CREATE ACCOUNTS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS accounts (id BIGINT, dollars INT DEFAULT 100, hp INT DEFAULT 100, dex INT, con INT, int INT, wis INT, cha INT);';
    var err, result = await client.query(query);
    if (err) { console.log(err); }
    console.log('Created accounts table');

    // CREATE ITEMS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS items (id UUID DEFAULT gen_random_uuid(), owner_id BIGINT, name VARCHAR, item_identifier VARCHAR, type_id INT, rarity_id INT, stack_amount INT, is_equipped BOOLEAN, is_dropped BOOLEAN, attributes JSONB);';
    var err, result = await client.query(query);
    if (err) { console.log(err); }
    console.log('Created items table');
}) ();


// var query = 'DELETE FROM accounts WHERE id = 897735163553918987;';
// var params = [];
// client.query(query, params, function(err, result) { if (err) { console.log(err); }});

// var query = 'ALTER TABLE accounts ADD COLUMN hp INT DEFAULT 100;';
// var params = [];
// client.query(query, params, function(err, result) { if (err) { console.log(err); } console.log('Updated accounts table'); });



// Update existing accounts
// var query = 'SELECT * FROM accounts';
// client.query(query, params, function(err, result) { 

//     for (row of result.rows) {

//         // Generate random stats
//         const accountStats = { 
//             dollars: 100,
//             abilities: {
//                 str: 5 + chance.d12(),
//                 dex: 5 + chance.d12(),
//                 con: 5 + chance.d12(),
//                 int: 5 + chance.d12(),
//                 wis: 5 + chance.d12(),
//                 cha: 5 + chance.d12()
//             }
//         }

//         // Update the server
//         var query = 'UPDATE accounts SET str = $1, dex = $2, con = $3, int = $4, wis = $5, cha = $6 WHERE id = $7;';
//         var params = [ accountStats.abilities.str, accountStats.abilities.dex, accountStats.abilities.con, accountStats.abilities.int, accountStats.abilities.wis, accountStats.abilities.cha, row.id ];
//         client.query(query, params, function(err, result) { if (err) { console.log(err); console.log('a'); }});
//         console.log('e')
//     }
// });