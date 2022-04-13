/**
 * Handles all endpoints related to item creation, rarity & type retrieval, etc.
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

// FILES ------------------------------------------------------------------------------
const itemRarities = require('../savefiles/rarities.json');
const itemTypes = require('../savefiles/types.json');



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
async function createItem(pgClient, name, rarityID, typeID, itemIdentifier, amount, ownerID, attributes) {

    // Find an item with that type
    const type = itemTypes.find(item => item.id == typeID);
    if (!type) { return [ false, 'Type supplied does not exist' ]; }

    // Check if stackAmount is valid
    if (amount > type.maxStackAmount) { return [ false, 'Stack amount exceeds item type parameters' ]; }

    // Check for item rarity
    const rarity = itemRarities.find(item => item.id == rarityID);
    if (!rarity) { return [ false, 'Rarity supplied does not exist' ]; }

    // Create the item
    var query = 'INSERT INTO items (name, rarity_id, type_id, item_identifier, stack_amount, owner_id, attributes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;';
    var params = [ name, rarityID, typeID, itemIdentifier, amount, ownerID, JSON.stringify(attributes) ];
    console.log(query, params);
    var err, result = await pgClient.query(query, params);
    if (err) { return [ false, 'Error occurred while creating' ]; }

    return [ true, result.rows[0].id ];
}

/** Transfers ownership of an item from it's original owner to the new owner
 * @param {PGCLIENT} pgClient a registered PostgreSQL object
 * @param {UUID} itemID server-generated ID for the item to transfer
 * @param {DiscordID} newOwnerID Discord-generated ID of the user to transfer this item to
 * @param {Int} amount the number of items to transfer out of the stack, maxes out at the stack amount
 */
async function transferItem(pgClient, itemID, newOwnerID, amount) { 

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
    const newOwnerInfo = result.rows[0];

    // Check if this user already has the same item & it can be stacked
    var query = 'SELECT * FROM items WHERE item_identifier = $1 AND owner_id = $2;';
    var params = [ itemInfo.item_identifier, newOwnerID ];
    var err, result = await pgClient.query(query, params);
    if (err) { return [ false, 'An error occurred while finding stackable items' ]; }

    if (result.rows.length > 0) {       // A stackable item may already exist
        const stackableItemInfo = result.rows[0];
        const itemType = itemTypes.find(item => item.id == id);

        // Check how many items can be stacked
        if (itemType.maxStackAmount > stackableItemInfo.stack_amount) {     // This item can have more stacked

            // Calc how many items to move 
            const amountToMove = Math.min(amount, amount - (itemType.maxStackAmount - stackableItemInfo.stack_amount));

            // Move the first stack's worth of items
            var query = 'UPDATE items SET stack_amount = $1 WHERE id = $2;';
            var params = [ amountToMove, stackableItemInfo.id ];
            var err, result = await pgClient.query(query, params);
            if (err) { return [ false, 'An error occurred while stacking items' ]; }

            if (amount - amountToMove > 0) {        // There were leftover items

                // Take that amount of the stack & transfer the remainder to the new owner
                var query = 'UPDATE items SET stack_amount = $1, owner_id = $2 WHERE id = $3;';
                var params = [ amount - amountToMove, newOwnerID, itemID ];
                var err, result = await pgClient.query(query, params);
                if (err) { return [ false, 'An error occurred while transferring remaining items' ]; }

                return [ true, 'Successfully stacked & transferred items' ];
            }
        } else {                        // More items can't be stacked; move the existing stack

            var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
            var params = [ newOwnerID, itemID ];
            var err, result = await pgClient.query(query, params);
            if (err) { return [ false, 'An error occurred while transferring item stack' ]; }

            return [ true, 'Successfully stacked & transferred items' ];
        }
    } else {                            // A stackable item does not exist; move the existing stack
        var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
        var params = [ newOwnerID, itemID ];
        var err, result = await pgClient.query(query, params);
        if (err) { return [ false, 'An error occurred while transferring items' ]; }

        return [ true, 'Successfully transferred items' ];
    }
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
        itemIdentifier: result.rows[0].item_identifier,
        rarity: itemRarities.find(item => item.id === result.rows[0].rarity_id),
        type: itemTypes.find(item => item.id === result.rows[0].type_id),
        amount: result.rows[0].amount,
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
        itemIdentifier: req.body.itemIdentifier,
        amount: req.body.amount,
        ownerID: req.body.ownerID,
        attributes: req.body.attributes,
    }

    if (Object.values(itemInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    const [ success, response ] = await createItem(pgClient, itemInfo.name, itemInfo.rarityID, itemInfo.typeID, itemInfo.itemIdentifier, itemInfo.amount, itemInfo.ownerID, itemInfo.attributes);

    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    // Return ID
    res.status(200).send(JSON.stringify({ itemID: response }));
});

router.post('/transfer/', async function (req, res) {           // Transfer an item
    const pgClient = req.pgClient;

    const transferInfo = {
        itemID: req.body.itemID,
        newOwnerID: req.body.newOwnerID,
        amount: req.body.amount
    }

    if (Object.values(transferInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    const [ success, response ] = await transferItem(pgClient, transferInfo.itemID, transferInfo.newOwnerID, transferInfo.amount);
    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    res.status(200).send('Item transferred successfully');
});


// RARITY METHODS ----------------------------------------------------------------------
router.get('/rarities/id/:id', async function (req, res) {      // Get rarity by ID
    console.log('Requesting item rarity by ID with params', req.params);

    const id = req.params.id;
    if (!id) { res.status(400).send('ID parameter not supplied.'); return; }

    // Find the rarity
    const rarity = itemRarities.find(item => item.id == id);
    if (!rarity) { res.status(404).send('A rarity with that ID could not be found.'); return; }

    res.status(200).send(JSON.stringify(rarity));
});

router.get('/rarities/name/:name', async function (req, res) {  // Get rarity by name
    console.log('Requesting item rarity by name with params', req.params);

    const name = req.params.name;
    if (!name) { res.status(400).send('Name parameter not supplied.'); return; }

    // Find the rarity
    const rarity = itemRarities.find(item => item.name === name);
    if (!rarity) { res.status(404).send('A rarity with that name could not be found.'); return; }

    res.status(200).send(JSON.stringify(rarity));
});



// TYPE METHODS ------------------------------------------------------------------------
router.get('/type/id/:id', async function (req, res) {          // Get type by ID
    console.log('Requesting item type by ID with params', req.params);

    const id = req.params.id;
    if (!id) { res.status(400).send('ID parameter not supplied.'); return; }

    // Find the type
    const type = itemTypes.find(item => item.id == id);
    if (!type) { res.status(404).send('A type with that ID could not be found.'); return; }

    res.status(200).send(JSON.stringify(type));
})

router.get('/type/name/:name', async function (req, res) {      // Get type by name
    console.log('Requesting item type by name with params', req.params);

    const name = req.params.name;
    if (!name) { res.status(400).send('Name parameter not supplied.'); return; }

    // Find the type
    const type = itemTypes.find(item => item.name === name);
    if (!type) { res.status(404).send('A type with that name could not be found.'); return; }

    res.status(200).send(JSON.stringify(type));
})



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router, 
    createItem: createItem,
    transferItem: transferItem
}