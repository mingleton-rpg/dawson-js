/** 
 * The new route for handling item attributes such as rarity and types
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

// FILES ------------------------------------------------------------------------------
const itemRarities = require('../savefiles/rarities.json');
const itemTypes = require('../savefiles/types.json');



// RARITY ENDPOINTS -------------------------------------------------------------------
router.get('/rarity/id/:id', async function (req, res) {        // Get rarity by ID
    console.log('Requesting item rarity by ID with params', req.params);

    const id = req.params.id;
    if (!id) { res.status(400).send('ID parameter not supplied.'); return; }

    // Find the rarity
    const rarity = itemRarities.find(item => item.id == id);
    if (!rarity) { res.status(404).send('A rarity with that ID could not be found.'); return; }

    res.status(200).send(JSON.stringify(rarity));
});

router.get('/rarity/name/:name', async function (req, res) {    // Get rarity by name
    console.log('Requesting item rarity by name with params', req.params);

    const name = req.params.name;
    if (!name) { res.status(400).send('Name parameter not supplied.'); return; }

    // Find the rarity
    const rarity = itemRarities.find(item => item.name === name);
    if (!rarity) { res.status(404).send('A rarity with that name could not be found.'); return; }

    res.status(200).send(JSON.stringify(rarity));
});



// TYPE ENDPOINTS --------------------------------------------------------------------
router.get('/type/id/:id', async function (req, res) {          // Get type by ID
    console.log('Requesting item type by ID with params', req.params);

    const id = req.params.id;
    if (!id) { res.status(400).send('ID parameter not supplied.'); return; }

    // Find the type
    const type = itemTypes.find(item => item.id == id);
    if (!type) { res.status(404).send('A type with that ID could not be found.'); return; }

    res.status(200).send(JSON.stringify(type));
});

router.get('/type/name/:name', async function (req, res) {      // Get type by name
    console.log('Requesting item type by name with params', req.params);

    const name = req.params.name;
    if (!name) { res.status(400).send('Name parameter not supplied.'); return; }

    // Find the type
    const type = itemTypes.find(item => item.name === name);
    if (!type) { res.status(404).send('A type with that name could not be found.'); return; }

    res.status(200).send(JSON.stringify(type));
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router
}