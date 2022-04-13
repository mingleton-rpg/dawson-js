// MODULES ----------------------------------------------------------------------------
/** Discord.JS */
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [
    Intents.FLAGS.GUILDS, 
    Intents.FLAGS.GUILD_VOICE_STATES, 
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES
] });

/** Moment.JS */
const moment = require('moment-timezone');

/** Chance.JS */
const Chance = require('chance');
const chance = new Chance();



// FILES ------------------------------------------------------------------------------
const config = require('./savefiles/config.json');
const itemRarities = require('./savefiles/rarities.json');
const itemTypes = require('./savefiles/types.json');

/* Local modules */
const { router: itemRouter, createItem } = require('./routes/items');



// POSTGRES ---------------------------------------------------------------------------
const { Client: PGCLIENT } = require('pg');
const pgClient = new PGCLIENT({
    user: config.postgres.user,
    host: config.postgres.host,
    database: config.postgres.database,
    password: config.postgres.password,
    port: config.postgres.port,
    ssl: { rejectUnauthorized: false }
});
pgClient.connect();

// EXPRESS ----------------------------------------------------------------------------
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
const corsOptions = { 
    origin: '*',
}


// CORS MIDDLEWARE --------------------------------------------------------------------
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'accept, authorization, content-type, x-requested-with');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});



// COMMANDS ---------------------------------------------------------------------------
const commands = [
    {   // Send
        name: 'send',
        description: 'Sends a Dawson Dollar to the user you @. This action is irreversible.',
        options: [
            { type: 6, name: 'recipient', description: 'The user to send your money to.', required: true },
            { type: 4, name: 'amount', description: 'The amount to send', required: true }
        ]
    },
    {   // Gamble
        name: 'gamble',
        description: 'Gamble for more (or less) money. Has an equal chance to return more or less than you gambled.',
        options: [
            { type: 4, name: 'amount', description: 'The amount to gamble', required: true }
        ]
    },
    {   // Leaderboard
        name: 'leaderboard',
        description: 'Displays a leaderboard of the top users in the server.',
    },
    {   // Inventory
        name: 'inventory', 
        description: 'Check the items in your inventory'
    },
    {   // Account
        name: 'account',
        description: 'Create or check your account information',
        options: [ 
            {
                name: 'create',
                description: 'Creates you a new Dawson RP account with random stats and ඞ100.',
                type: 1
            },
            {
                name: 'view',
                description: 'Retrieves another person\'s account, or yours if left blank',
                type: 1,
                options: [
                    { type: 6, name: 'player', description: 'The player to look up.', required: false }
                ]
            }
        ]
    },
    {   // Help
        name: 'help',
        description: 'Get help on a particular subject',
        options: [
            { 
                name: 'rarity',
                description: 'Find out what rarities are and how they affect your items',
                type: 1
            },
            { 
                name: 'type',
                description: 'Find out what item types there are and how they work',
                type: 1
            }
        ]
    }
];

const rest = new REST({ version: '9' }).setToken(config.bot.discordAPIKey);

// SETUP COMMANDS
(async () => { 
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands('961962697702903858', '618748256028983326'),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();



// ASSISTANT FUNCTIONS -----------------------------------------------------------------
/** Return an error message from the interaction */
function returnError(interaction, botInfo, message) { 
    const embed = { 
        title: message,
        color: botInfo.displayColor
    }
    interaction.editReply({ embeds: [ embed ] });
}

/** Get a random number between the min & max */
function getRandomArbitrary(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

/** Capitalise the first letter of a string */
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}



// VARIABLES ---------------------------------------------------------------------------
var currentAirdrop = {
    prizeMoney: 0
};



// ASYNC - SEND AN AIRDROP -------------------------------------------------------------
/* 
    Has a chance to drop a reward based on the number of users with the role online.
    Equation is curently y = 0.00049x + 0.003. https://www.desmos.com/calculator/gtb2zddoe6
    At the moment this just contains a random amount of cash, but will eventually include cards and other valuable items.
*/
(async () => {

    // Set an interval
    setInterval(async function () {

        // Find out how many people with the dawson-rp role are online
        const guild = client.guilds.cache.get(config.bot.guildID);
        const role = await guild.roles.fetch('962205339728633876');
        
        const roleMembers = role.members.toJSON();
        const onlineRoleMembers = roleMembers.filter(member => {
            return (member.presence && (member.presence.status === 'online' || member.presence.status === 'dnd'));
        });
        console.log(onlineRoleMembers.length, roleMembers.length)

        // Calculate the weighting
        // y = 0.00049x + 0.003
        const weighting = (0.00049 * onlineRoleMembers.length) + 0.0013;
        console.log(weighting);

        // Run a chance check with the calculated weight
        if(chance.weighted([true, false], [weighting, 1]) === false) { return; }

        console.log('SENDING AIRDROP --------------------------------------------------------');

        // Get the channel
        const channel = await guild.channels.fetch(config.airdrop.channelID);

        // Generate a random prize
        currentAirdrop.prizeMoney = getRandomArbitrary(30, 70);

        // Assemble an embed
        const embed = {
            title: '💰 An Airdrop has appeared!',
            description: `The first person to claim this airdrop will receive **ඞ${currentAirdrop.prizeMoney}**!`,
            footer: { text: `This will disappear in ${Math.round(config.airdrop.expirationMs / 60000)} minutes!` }
        }

        const airdropMessage = await channel.send({ 
            embeds: [ embed ], 
            components: [
                { type: 1, components: [
                    { type: 2, label: 'Claim now!', style: 1, custom_id: 'claimAirdrop' }
                ]}
            ]
        });

        // Expire the airdrop
        currentAirdrop.timeout = setTimeout(function () {
            // Clear the prize money - no cheating!
            currentAirdrop.prizeMoney = 0;

            // Delete the message
            if (airdropMessage) { airdropMessage.delete(); }

        }, config.airdrop.expirationMs);
    }, config.airdrop.intervalMs);
})();



// CLIENT EVENTS -----------------------------------------------------------------------
client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    client.user.setPresence({
        activities: [{ 
            name: 'with your finances',
            type: 'PLAYING'
        }],
        status: 'online'
    });

    // const guild = client.guilds.cache.get(config.bot.guildID);
    // guild.members.fetch()
    //     .then(members => { 
    //         for (member of members) { 
    //             query = `INSERT INTO accounts (id, dollars) VALUES (${member[0]}, 100);`;
    //             pgClient.query(query);
    //         }
    //     })
});



client.on('interactionCreate', async interaction => {

    // Assemble bot & user information
    const botInfo = { 
        displayColor: interaction.guild.me.displayColor,
    }
    const userInfo = { 
        displayName: interaction.member.displayName,
        id: interaction.member.id,
        guild: interaction.guild,
        isBot: (interaction.member.user.bot)
    }
    console.log('NEW COMMAND ------------------------------------------------------------');

    if (interaction.isCommand()) {              // COMMAND INTERACTIONS
        console.log('COMMAND INTERACTION');
        await interaction.deferReply();

        if (interaction.commandName === 'send') {

            const recipient = interaction.options.getMember('recipient', false);
            const dollarAmount = interaction.options.getInteger('amount', false);

            if (dollarAmount <= 0) { returnError(interaction, botInfo, 'Not so fast'); return; }

            // Check if the user has this much money
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ userInfo.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'It looks like you don\'t have an acount'); return; }
            const userAccount = response.rows[0];

            if (dollarAmount > userAccount.dollars) { returnError(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }


            // Get the recipient's balance
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ recipient.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'The person you\'re trying to send money to doesn\'t have an account'); return; }
            const recipientAccount = response.rows[0];

            // Deduct from account
            var query = `UPDATE accounts SET dollars = $1 WHERE id = $2;`;
            var params = [ userAccount.dollars - dollarAmount, userInfo.id]
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

            // Add to recipient's account
            var query = `UPDATE accounts SET dollars = $1 WHERE id = $2;`;
            var params = [ recipientAccount.dollars + dollarAmount, recipient.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

            const embed = {
                title: 'Sent Dawson Dollars!',
                color: botInfo.displayColor,
                description: `**ඞ${dollarAmount}** were sent to **${recipient.displayName}**! Your balance is now **ඞ${userAccount.dollars - dollarAmount}**`
            }

            await interaction.editReply({ embeds: [ embed ] });

        } else if (interaction.commandName === 'balance') {

            // Get the user's account
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ userInfo.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find you'); return; }
            const userAccount = response.rows[0];

            const embed = { 
                title: `You currently have **ඞ${userAccount.dollars}**`,
                color: botInfo.displayColor,
            }

            await interaction.editReply({ embeds: [ embed ] });

        } else if (interaction.commandName === 'gamble') { 
            
            const gambleAmount = interaction.options.getInteger('amount', false);

            if (gambleAmount < 10) { returnError(interaction, botInfo, 'You need to gamble at least **ඞ10**'); return; }

            // Check if the user has this much money
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ userInfo.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find you'); return; }
            const userAccount = response.rows[0];

            if (gambleAmount > response.rows[0].dollars) { returnError(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }

            // Gamble that money
            const finalAmount = getRandomArbitrary(0, gambleAmount * 2);

            // Add return to account
            var query = '';
            var params = [ ];
            if (finalAmount > gambleAmount) { 
                query = `UPDATE accounts SET dollars = $1 WHERE id = $2;`;
                params = [ userAccount.dollars + (finalAmount - gambleAmount), userInfo.id ];
            } else { 
                query = `UPDATE accounts SET dollars = $1 WHERE id = $2;`; 
                params = [ userAccount.dollars - (gambleAmount), userInfo.id ];
            }
            
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

            if (finalAmount > gambleAmount) { 
                const embed = { 
                    title: `Congratulations! You won **ඞ${finalAmount - gambleAmount}**!`,
                    color: botInfo.displayColor,
                    description: `Depositing **ඞ${finalAmount - gambleAmount}** into your account.`
                }

                await interaction.editReply({ embeds: [ embed ] });
            } else {
                const embed = { 
                    title: `Aw, bummer :( You didn't win anything!`, 
                    color: botInfo.displayColor,
                    description: `Taking **ඞ${gambleAmount}** from your account.`
                }

                await interaction.editReply({ embeds: [ embed ] });
            }
        } else if (interaction.commandName === 'leaderboard') {

            var query = `SELECT * FROM accounts ORDER BY dollars DESC;`;
            var err, response = await pgClient.query(query);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

            let description = '';
            let index = 1;
            for (member of response.rows) { 
                const memberInfo = await userInfo.guild.members.fetch(member.id)
                description += '**' + index + ')** ' + memberInfo.displayName + ', ඞ' + member.dollars + ' \n';
                index += 1;
            }

            console.log(description);
            
            let embed = {
                title: `Current leaderboard`,
                color: botInfo.displayColor,
                description: description
            }

            await interaction.editReply({ embeds: [ embed ] });
        } else if (interaction.commandName === 'inventory') {

            // [ TODO ] - retrieve from server
            const testItems = [
                { 
                    name: 'Javelin', rarity: 
                    { emoji: '🟫', name: 'peasant' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 17 }, 
                        { type: 'speed', value: 3 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: true
                },
                { 
                    name: 'Slingshot', 
                    rarity: { emoji: '🟧', name: 'legendary' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 35 }, 
                        { type: 'speed', value: 91 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Halberd', 
                    rarity: { emoji: '🟦', name: 'epic' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 43 }, 
                        { type: 'speed', value: 18 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Sharp pencil', 
                    rarity: { emoji: '🟨', name: 'Extraordinary' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 16 }, 
                        { type: 'speed', value: 32 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Whip', 
                    rarity: { emoji: '🟨', name: 'Extraordinary' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 30 }, 
                        { type: 'speed', value: 72 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Shortsword', 
                    rarity: { emoji: '⬛️', name: 'Broken' },
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 34 }, 
                        { type: 'speed', value: 12 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Maul', 
                    rarity: { emoji: '⬜️', name: 'Moderately spoiled' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 32 }, 
                        { type: 'speed', value: 13 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Spear', 
                    rarity: { emoji: '🟨', name: 'Extraordinary' }, 
                    type: { emoji: '🗡', name: 'Weapon' },
                    attributes: [ 
                        { type: 'damage', value: 54 }, 
                        { type: 'speed', value: 78 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: false
                },
                { 
                    name: 'Potion of Awareness', 
                    rarity: { emoji: '🟨', name: 'Extraordinary' }, 
                    type: { emoji: '🧪', name: 'Potion' }, 
                    attributes: [
                        { type: 'INT', value: 30 },
                        { type: 'WIS', value: 30 },
                    ],
                    isEquipped: false
                },
                {
                    name: 'Cthulu\'s helmet',
                    rarity: { emoji: '🟦', name: 'epic' }, 
                    type: { emoji: '🛡', name: 'Armour' }, 
                    attributes: [
                        { type: 'position', value: 'helmet' },
                        { type: 'protection', value: 25 },
                        { type: 'durability', value: 20 }
                    ],
                    isEquipped: true
                }
            ]

            // Find equipped armour & weapons
            const equippedWeapon = testItems.find(item => item.isEquipped === true && item.type.name === 'Weapon');
            const equippedArmour = testItems.filter(item => item.isEquipped === true && item.type.name === 'Armour');

            console.log(equippedArmour, equippedWeapon);

            let embed = {
                title: 'Your inventory',
                color: botInfo.displayColor,
                fields: [
                    { name: 'Equipped Weapon: ', value: '', inline: false },
                    { name: 'Equipped Armour', value: '', inline: false }
                ]
            }

            // Get equipped weapon
            let weaponField = embed.fields.find(field => field.name === 'Equipped Weapon: ');
            if (equippedWeapon) { 
                const attributes = equippedWeapon.attributes.reduce(function(acc, cur) { 
                    return acc + cur.type + ': ' + cur.value + ', ';
                }, '');

                weaponField.name += equippedWeapon.type.emoji + ' ' + equippedWeapon.name;
                weaponField.value = equippedWeapon.rarity.emoji + ' ' + equippedWeapon.rarity.name + ' | ' + attributes
            } else {
                weaponField.name += 'Nothing';
                weaponField.value = 'You have no weapons equipped! Find some, then equip them with /equip weapon [weapon id]';
            }

            // Get equipped armour
            let armourField = embed.fields.find(field => field.name === 'Equipped Armour');
            if (equippedArmour.length > 0) { 
                for (item of equippedArmour) { 
                    const attributes = item.attributes.reduce(function(acc, cur) { 
                       return acc + cur.type + ': ' + cur.value + ', ';
                    }, '');

                    armourField.value += item.rarity.emoji + ' ' + item.name + ' | ' + attributes
                }
            }

            // Compose options & get other items
            let selectOptions = [];
            for (item of testItems) { 
                const attributes = item.attributes.reduce(function(acc, cur) {
                    return acc + cur.type + ': ' + cur.value + ', ';
                }, '');

                const option = { 
                    emoji: { name: item.type.emoji },
                    label: item.name,
                    value: item.name,
                    description: item.rarity.emoji + ' ' + item.rarity.name + ' | ' + attributes
                }
                selectOptions.push(option);

                if (item.isEquipped) { continue; }
                const field = { 
                    name: item.type.emoji + ' ' + item.name,
                    value: item.rarity.emoji + ' ' + item.rarity.name + ' | ' + attributes + '\n',
                    inline: false
                }
                embed.fields.push(field);
            }

            // Send message
            await interaction.editReply({ 
                embeds: [ embed ],
                components: [
                    { 
                        type: 1, 
                        components: [
                            {
                                type: 3,
                                customId: 'classSelect1',
                                options: selectOptions,
                                placeholder: 'Choose an item...'
                            }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            { 
                                type: 2,
                                style: 1,
                                label: 'Equip',
                                customId: 'equipItem',
                                disabled: true
                            },
                            { 
                                type: 2,
                                style: 2,
                                label: 'De-equip',
                                customId: 'deEquipItem',
                                disabled: true
                            },
                            { 
                                type: 2,
                                style: 4,
                                label: 'Drop',
                                customId: 'dropItem',
                                disabled: true
                            },
                        ]
                    }
                ]
            });

        } else if (interaction.commandName === 'account') {

            const interactionSubCommand = interaction.options.getSubcommand(false);

            if (interactionSubCommand === 'create') {

                // Check if this user already has an account
                var query = 'SELECT * FROM accounts WHERE id = $1;';
                var params = [ userInfo.id ];
                var err, response = await pgClient.query(query, params);
                if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
                if (response.rows.length > 0) { returnError(interaction, botInfo, 'You already have an account'); return; }

                // Setup random statistics for this account
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

                // Insert this into the DB
                var query = 'INSERT INTO accounts (id, dollars, str, dex, con, int, wis, cha) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);';
                var params = [ userInfo.id, accountStats.dollars, accountStats.abilities.str, accountStats.abilities.dex, accountStats.abilities.con, accountStats.abilities.int, accountStats.abilities.wis, accountStats.abilities.cha ];
                var err, response = await pgClient.query(query, params);
                if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

                // Add the Dawson-RP Role to the user
                const role = await userInfo.guild.roles.fetch(config.bot.roleID);
                await interaction.member.roles.add([config.bot.roleID, role]);

                // Create the embed
                const embed = {
                    title: 'Account created! Welcome to Dawson RP!',
                    color: botInfo.displayColor,
                    description: 'Your account has been created. You have **ඞ100** (currency), **100 HP** and the stats below. Stats will determine the outcome of particular situations, and will be explained as you do them.',
                    fields: [
                        { name: 'Strength', value: 'value: ' + accountStats.abilities.str, inline: true },
                        { name: 'Dexterity', value: 'value: ' + accountStats.abilities.dex, inline: true },
                        { name: 'Constitution', value: 'value: ' + accountStats.abilities.con, inline: true },
                        { name: 'Intelligence', value: 'value: ' + accountStats.abilities.int, inline: true },
                        { name: 'Wisdom', value: 'value: ' + accountStats.abilities.wis, inline: true },
                        { name: 'Charisma', value: 'value: ' + accountStats.abilities.cha, inline: true }
                    ],
                    footer: { text: 'use /account view to get your account information' }
                }

                await interaction.editReply({ embeds: [ embed ] });

            } else if (interactionSubCommand === 'view') {

                const player = interaction.options.getMember('player', false) || interaction.member;

                // Retrieve the user's information
                var query = `SELECT * FROM accounts WHERE id = $1;`;
                var params = [ player.id ]
                var err, response = await pgClient.query(query, params);
                if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
                if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find that player account. Create one with `/account create`'); return; }

                // Create the embed
                const embed = {
                    title: `Statistics for @${player.displayName}`,
                    color: botInfo.displayColor,
                    description: `**@${player.displayName}** has **ඞ${response.rows[0].dollars}** & **${response.rows[0].hp} HP**.`,
                    fields: [
                        { name: 'Strength', value: 'value: ' + response.rows[0].str, inline: true },
                        { name: 'Dexterity', value: 'value: ' + response.rows[0].dex, inline: true },
                        { name: 'Constitution', value: 'value: ' + response.rows[0].con, inline: true },
                        { name: 'Intelligence', value: 'value: ' + response.rows[0].int, inline: true },
                        { name: 'Wisdom', value: 'value: ' + response.rows[0].wis, inline: true },
                        { name: 'Charisma', value: 'value: ' + response.rows[0].cha, inline: true }
                    ]
                }

                await interaction.editReply({ embeds: [ embed ] });
            }
        } else if (interaction.commandName === 'help') { 

            const interactionSubCommand = interaction.options.getSubcommand(false);

            if (interactionSubCommand === 'rarity') {

                const rarityText = itemRarities.reduce(function(acc, cur) { 
                    return acc + ' ' + cur.emojiName + ' ' + capitalize(cur.name) + '\n';
                }, '');

                // Create the embed
                const embed = {
                    title: '<:aldi:963312717542871081> About item rarities • Help',
                    color: botInfo.displayColor,
                    description: 'Every item is assigned a rarity, which can modify how much damage, durability, protection, etc. that item can deal. "Standard" rarity items are default; items lower than that have a reduced stat capacity, and conversely for those with a high rarity rating. The exact stats that rarity will affect on an item depends on the type of item.',
                    fields: [
                        {
                            name: 'Rarity ratings',
                            value: rarityText
                        }
                    ]
                }

                await interaction.editReply({ embeds: [ embed ] });

            } else if (interactionSubCommand === 'type') { 

                const typeText = itemTypes.reduce(function(acc, cur) { 
                    return acc + ' ' + cur.emojiName + ' ' + capitalize(cur.name) + '\n';
                }, '');

                // Create the embed
                const embed = {
                    title: '🗡 About item types • Help',
                    color: botInfo.displayColor,
                    description: 'Items can be categorised into types, with each type affecting what that item can be used for and the stats it can have.',
                    fields: [
                        {
                            name: 'Item types',
                            value: typeText
                        }
                    ]
                }

                await interaction.editReply({ embeds: [ embed ] });

            }

        }

    } else if (interaction.isButton()) {        // BUTTON INTERACTIONS
        console.log('BUTTON INTERACTION');

        // console.log(interaction);
        
        if (interaction.customId === 'claimAirdrop') {

            // Clear the airdrop expiration timeout
            clearTimeout(currentAirdrop.timeout);

            // Add this to the user's account
            var query = 'UPDATE accounts SET dollars = dollars + $1 WHERE id = $2 RETURNING dollars;';
            var params = [ currentAirdrop.prizeMoney, userInfo.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { interaction.update('Something went wrong. Sorry!'); return; }
            const accountBalance = response.rows[0].dollars;

            // Edit the original message
            const embed = { 
                title: `💰 Claimed by @${userInfo.displayName}!`,
                color: botInfo.displayColor,
                description: `Congratulations, **@${userInfo.displayName}**, you've won **ඞ${currentAirdrop.prizeMoney}**! Your balance is now **ඞ${accountBalance}**.`
            }

            await interaction.update({ embeds: [ embed ], components: [] });
        }

    } else {                                    // OTHER
        console.log('Interaction of type ' + interaction.type + ' unaccounted for.');
    }
});



// RUN BOT ----------------------------------------------------------------------------
client.login(config.bot.discordAPIKey);



// API SERVER -------------------------------------------------------------------------

/** Auth middleware */
app.use(async function addMiddleware (req, res, next) { 

    // Check for a valid Discord ID
    const discordID = req.query.discordID || req.body.discordID;
    if (!discordID) { res.status(401).send('Authentication failed: no discordID parameter supplied.'); return; }

    // Check if this user exists within the guild
    const guild = client.guilds.cache.get(config.bot.guildID);
    let thisMember = null;
    try { thisMember = await guild.members.fetch(discordID); }
    catch (err) { res.status(401).send('Authentication failed: discordID parameter is invalid.'); return; }
    if (!thisMember) { res.status(401).send('Authentication failed: discordID parameter does not match any members in the Mingleton guild.'); return; }

    // Attach the pgClient
    req.pgClient = pgClient;

    next();
});

/** Test endpoint */
app.get('/test', cors(corsOptions), async function (req, res) {  
    res.send('Hello World!');
});

/** Routes */
app.use('/items', cors(corsOptions), itemRouter);

/** Run server */
const port = process.env.PORT || config.apiServer.port;
app.listen(port, () => console.log('API server running on port', port));


// [ TEMP ]
// (async () => { 
//     setTimeout(() => { 
//         createItem(pgClient, 'Isaac\'s epic ')
//     }, 3000);
// })();