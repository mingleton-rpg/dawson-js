// MODULES ----------------------------------------------------------------------------
/** Discord.JS */
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MEMBERS] });

/** Moment.JS */
const moment = require('moment-timezone');

/** Chance.JS */
const Chance = require('chance');
const chance = new Chance();



// CONFIG -----------------------------------------------------------------------------
const config = require('./savefiles/config.json');



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



// COMMANDS ---------------------------------------------------------------------------
const commands = [
    {
        name: 'send',
        description: 'Sends a Dawson Dollar to the user you @. This action is irreversible.',
        options: [
            { type: 6, name: 'recipient', description: 'The user to send your money to.', required: true },
            { type: 4, name: 'amount', description: 'The amount to send', required: true }
        ]
    },
    {
        name: 'gamble',
        description: 'Gamble for more (or less) money. Has an equal chance to return more or less than you gambled.',
        options: [
            { type: 4, name: 'amount', description: 'The amount to gamble', required: true }
        ]
    },
    {
        name: 'leaderboard',
        description: 'Displays a leaderboard of the top users in the server.',
    },
    {
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
function returnError(interaction, botInfo, message) { 
    const embed = { 
        title: message,
        color: botInfo.displayColor
    }
    interaction.editReply({ embeds: [ embed ] });
}

function getRandomArbitrary(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}



// VARIABLES ---------------------------------------------------------------------------
var currentAirdrop = {
    prizeMoney: 0
};



// ASYNC - SEND AN AIRDROP -------------------------------------------------------------
/* 
    Has a 0.005% chance of dropping an 'airdrop' between 9am & 9pm Brisbane time. 
    At the moment this just contains a random amount of cash, but will eventually include cards and other valuable items.
*/
(async () => {

    // Check if it's between 9am and 9pm
    const currentHour = moment().tz('Australia/Brisbane').hour();
    if (currentHour >= 9 && currentHour < 21) {

        // Set an interval
        setInterval(async function () {

            // Run a chance check
            if(chance.weighted([true, false], [0.005, 1]) === false) { return; }

            console.log('SENDING AIRDROP --------------------------------------------------------');

            // Get the guild & channel
            const guild = client.guilds.cache.get(config.bot.guildID);
            const channel = await guild.channels.fetch(config.airdrop.channelID);

            // Generate a random prize
            currentAirdrop.prizeMoney = getRandomArbitrary(10, 50);

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
    }
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

        if (interaction.commandName === 'send') {

            await interaction.deferReply();

            const recipient = interaction.options.getMember('recipient', false);
            const dollarAmount = interaction.options.getInteger('amount', false);

            if (dollarAmount <= 0) { returnError(interaction, botInfo, 'Not so fast'); return; }

            // Check if the user has this much money
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ userInfo.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find you'); return; }
            const userAccount = response.rows[0];

            if (dollarAmount > userAccount.dollars) { returnError(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }

            // Deduct from account
            var query = `UPDATE accounts SET dollars = $1 WHERE id = $2;`;
            var params = [ userAccount.dollars - dollarAmount, userInfo.id]
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

            // Get the recipient's balance
            var query = `SELECT * FROM accounts WHERE id = $1;`;
            var params = [ recipient.id ];
            var err, response = await pgClient.query(query, params);
            if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
            if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find the recipient'); return; }
            const recipientAccount = response.rows[0];

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

            await interaction.deferReply();

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

            await interaction.deferReply();
            
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

            await interaction.deferReply();
            var query = `SELECT * FROM accounts WHERE dollars != 100 ORDER BY dollars DESC;`;
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
        } else if (interaction.commandName === 'account') {

            await interaction.deferReply();
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
                    description: 'Your account has been created. You have **ඞ100** (currency), and the stats below. Stats will determine the outcome of particular situations, and will be explained as you do them.',
                    fields: [
                        { name: 'Strength', value: 'value: ' + accountStats.abilities.str, inline: true },
                        { name: 'Dexterity', value: 'value: ' + accountStats.abilities.dex, inline: true },
                        { name: 'Consitution', value: 'value: ' + accountStats.abilities.con, inline: true },
                        { name: 'Wisdom', value: 'value: ' + accountStats.abilities.wis, inline: true },
                        { name: 'Charisma', value: 'value: ' + accountStats.abilities.cha, inline: true }
                    ],
                    footer: { text: 'use /account view to get your account information' }
                }

                await interaction.editReply({ embeds: [ embed ] });

            } else if (interactionSubCommand === 'view') {


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