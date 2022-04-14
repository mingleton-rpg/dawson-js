/** 
 * A route for handling account related requests
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

// FILES ------------------------------------------------------------------------------
const itemRarities = require('../savefiles/rarities.json');
const itemTypes = require('../savefiles/types.json');
const { getInventory } = require('./items');



// HELPER FUNCTIONS -------------------------------------------------------------------
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);



// ENDPOINTS --------------------------------------------------------------------------
router.get('/:id', async function (req, res) {                          // Get an account by ID
    console.log('Requesting account by ID with params', req.params);
    const pgClient = req.pgClient;

    const userID = req.params.id;
    if (!userID) { res.status(400).send('User ID parameter not supplied.'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await pgClient.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Get inventory information
    const inventory = await getInventory(pgClient, userID);

    // Assemble account object
    const account = { 
        id: userID,
        dollars: userInfo.dollars,
        hp: userInfo.hp,
        inventory: inventory
    }

    // Send to caller
    res.status(200).send(JSON.stringify(account));
});

router.post('/:id/add-hp/:amount', async function (req, res) {          // Add or remove account HP
    console.log('Attempting to modify account HP with params', req.params);
    const pgClient = req.pgClient;

    const userID = req.params.id;
    const healthAmount = parseInt(req.params.amount);
    if (!userID || !healthAmount) { res.status(400).send('User ID & health amount parameters not supplied'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await pgClient.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Calculate the player's new health value
    const userNewHealth = clamp(userInfo.hp + healthAmount, 0, 100);

    // [ TODO ] - Check if the user has died (userNewHealth = 0)

    // Save to server
    var query = 'UPDATE accounts SET hp = $1 WHERE id = $2;';
    var params = [ userNewHealth, userID ];
    var err, result = await pgClient.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    res.status(200).send(JSON.stringify({ hp: userNewHealth }));
});

router.post('/:id/add-dollars/:amount', async function (req, res) {     // Add or remove account dollars
    console.log('Attempting to modify account dollars with params', req.params);
    const pgClient = req.pgClient;

    const userID = req.params.id;
    const dollarsAmount = parseInt(req.params.amount);
    if (!userID || !dollarsAmount) { res.status(400).send('User ID & dollars amount parameters not supplied'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await pgClient.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Calculate the player's new dollars value
    const userNewDollars = userInfo.dollars + dollarsAmount;

    // Save to server
    var query = 'UPDATE accounts SET dollars = $1 WHERE id = $2;';
    var params = [ userNewDollars, userID ];
    var err, result = await pgClient.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    res.status(200).send(JSON.stringify({ dollars: userNewDollars }));
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router
}