/**
 * Handles all endpoints related to item creation, transferral, etc.
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

// FILES ------------------------------------------------------------------------------
const itemRarities = require('../savefiles/rarities.json');
const itemTypes = require('../savefiles/types.json');


function groupArrayOfObjects(list, key) {
    return list.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};



// FUNCTIONS ---------------------------------------------------------------------------
/** Creates an item with the given parameters
 * @param {PGCLIENT} pgClient a registered PostgreSQL object
 * @param {String} name name of the item
 * @param {Int} rarityID ID of the rarity class for that item
 * @param {Int} typeID ID of the type of item
 * @param {String} itemIdentifier item-config-specific identifier, used for stacking
 * @param {Int} amount number of items in this stack. Must be below the item's type's value
 * @param {DiscordID} ownerID Discord-generated ID of the user this item belongs to
 * @param {Object} attributes item and type-specific attributes assigned to this item
 */
async function createItem(pgClient, name, rarityID, typeID, amount, ownerID, attributes) {

    console.log(attributes);

    // Find an item with that type
    const type = itemTypes.find(item => item.id == typeID);
    if (!type) { return [ false, 'Type supplied does not exist' ]; }

    // Check if stackAmount is valid
    if (amount > type.maxStackAmount) { return [ false, 'Stack amount exceeds item type parameters' ]; }

    // Check for item rarity
    const rarity = itemRarities.find(item => item.id == rarityID);
    if (!rarity) { return [ false, 'Rarity supplied does not exist' ]; }

    // Create the item
    var returnIDs = [];
    for (var i = 0; i < amount; i++) {
        var query = 'INSERT INTO items (name, rarity_id, type_id, owner_id, attributes) VALUES ($1, $2, $3, $4, $5) RETURNING id;';
        var params = [ name, rarityID, typeID, ownerID, JSON.stringify(attributes) ];
        console.log(query, params);
        var err, result = await pgClient.query(query, params);
        if (err) { return [ false, 'Error occurred while creating' ]; }

        returnIDs.push(result.rows[0].id);
    }

    return [ true, returnIDs ];
}

/** Transfers ownership of an item from it's original owner to the new owner
 * @param {PGCLIENT} pgClient a registered PostgreSQL object
 * @param {UUID} itemID server-generated ID for the item to transfer
 * @param {DiscordID} newOwnerID Discord-generated ID of the user to transfer this item to
 */
async function transferItem(pgClient, itemID, newOwnerID) { 

    // Check if that item exists
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ itemID ];
    var err, result = await pgClient.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This item does not exist' ]; }
    const itemInfo = result.rows[0];

    // Check if new owner exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ newOwnerID ];
    var err, result = await pgClient.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This user does not exist' ]; }

    var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
    var params = [ newOwnerID, itemID ];
    var err, result = await pgClient.query(query, params);
    if (err) { return [ false, 'An error occurred while transferring item' ]; }

    return [ true, 'Successfully transferred item' ];
}

/** Gets the inventory of any user, stacking items where relevant */
async function getInventory(pgClient, userID) { 

    // Check if new owner exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await pgClient.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This user does not exist' ]; }

    // Get their inventory
    var query = 'SELECT * FROM items WHERE owner_id = $1;';
    var params = [ userID ];
    var err, result = await pgClient.query(query, params);
    if (err) { return [ false, 'An error occurred whilst retrieving user items' ]; }

    // Group items by name
    const itemStacks = groupArrayOfObjects(result.rows, 'name');

    // Create new item objects
    let inventory = [];
    for (item of Object.values(itemStacks)) { 
        console.log(item[0].attributes);

        const itemInfo = {
            id: item[0].id,
            ownerID: item[0].owner_id,
            name: item[0].name,
            type: itemTypes.find(x => x.id == item[0].type_id),
            rarity: itemRarities.find(x => x.id == item[0].rarity_id),
            amount: item.length,
            isEquipped: item[0].is_equipped,
            isDropped: item[0].is_dropped,
            attributes: item[0].attributes
        }

        inventory.push(itemInfo);
    }

    return(inventory);
}


// ENDPOINTS ---------------------------------------------------------------------------
router.get('/:id', async function (req, res) {                   // Get item by ID
    const pgClient = req.pgClient;

    var query = 'SELECT  * FROM items WHERE id = $1;';
    var params = [ req.params.id ];
    var err, result = await pgClient.query(query, params);
    if (err) { res.status(500).send('Internal server error'); }
    if (result.rows.length === 0) { res.status(404).send('Nothing was found'); }

    // Assemble object
    const item = {
        name: result.rows[0].name,
        ownerID: result.rows[0].owner_id,
        rarity: itemRarities.find(item => item.id === result.rows[0].rarity_id),
        type: itemTypes.find(item => item.id === result.rows[0].type_id),
        attributes: result.rows[0].attributes
    }

    res.status(200).send(JSON.stringify(item));
});

router.post('/create/', async function (req, res) {              // Create an item
    const pgClient = req.pgClient;

    const itemInfo = {
        name: req.body.name,
        rarityID: req.body.rarityID,
        typeID: req.body.typeID,
        amount: req.body.amount,
        ownerID: req.body.ownerID,
        attributes: req.body.attributes,
    }

    console.log(itemInfo);

    if (Object.values(itemInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    console.log(req.params);

    const [ success, response ] = await createItem(pgClient, itemInfo.name, itemInfo.rarityID, itemInfo.typeID, itemInfo.amount, itemInfo.ownerID, itemInfo.attributes);

    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    // Return ID
    res.status(200).send(JSON.stringify({ itemIDs: response }));
});

router.post('/transfer/:itemID/:newOwnerID/', async function (req, res) {           // Transfer an item
    const pgClient = req.pgClient;

    const transferInfo = {
        itemID: req.params.itemID,
        newOwnerID: req.params.newOwnerID
    }

    if (Object.values(transferInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    const [ success, response ] = await transferItem(pgClient, transferInfo.itemID, transferInfo.newOwnerID);
    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    res.status(200).send('Item transferred successfully');
});

router.post('/:id/equip/:equip/', async function (req, res) {                       // Equip/de-equip item

    console.log('under construction');

});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router, 
    createItem: createItem,
    transferItem: transferItem,
    getInventory: getInventory,
}