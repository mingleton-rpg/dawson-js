// MODULES ----------------------------------------------------------------------------
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MEMBERS] });



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
        name: 'balance',
        description: 'Get your Dawson Dollar balance.'
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

    if (!interaction.isCommand()) return;
    console.log('NEW COMMAND ------------------------------------------------------------');
    if (interaction.commandName === 'send') {

        await interaction.deferReply();

        const recipient = interaction.options.getMember('recipient', false);
        const dollarAmount = interaction.options.getInteger('amount', false);

        if (dollarAmount <= 0) { returnError(interaction, botInfo, 'Not so fast'); return; }

        // Check if the user has this much money
        var query = `SELECT * FROM accounts WHERE id = ${userInfo.id};`;
        var err, response = await pgClient.query(query);
        if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
        if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find you'); return; }
        const userAccount = response.rows[0];

        if (dollarAmount > response.rows[0].dollars) { returnError(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }

        // Deduct from account
        var query = `UPDATE accounts SET dollars = ${response.rows[0].dollars - dollarAmount} WHERE id = ${userInfo.id};`;
        var err, response = await pgClient.query(query);
        if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }

        // Get the recipient's balance
        var query = `SELECT * FROM accounts WHERE id = ${recipient.id};`;
        var err, response = await pgClient.query(query);
        if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
        if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find the recipient'); return; }
        const recipientAccount = response.rows[0];

        // Add to recipient's account
        var query = `UPDATE accounts SET dollars = ${recipientAccount.dollars + dollarAmount} WHERE id = ${recipient.id};`;
        var err, response = await pgClient.query(query);
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
        var query = `SELECT * FROM accounts WHERE id = ${userInfo.id};`;
        var err, response = await pgClient.query(query);
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
        var query = `SELECT * FROM accounts WHERE id = ${userInfo.id};`;
        var err, response = await pgClient.query(query);
        if (err) { returnError(interaction, botInfo, 'Internal server error'); return; }
        if (response.rows.length === 0) { returnError(interaction, botInfo, 'Could not find you'); return; }
        const userAccount = response.rows[0];

        if (gambleAmount > response.rows[0].dollars) { returnError(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }

        // Gamble that money
        const finalAmount = getRandomArbitrary(0, gambleAmount * 2);

        // Add return to account
        var query = '';
        if (finalAmount > gambleAmount) { 
            query = `UPDATE accounts SET dollars = ${userAccount.dollars + (finalAmount - gambleAmount)} WHERE id = ${userInfo.id};`;
        } else { 
            query = `UPDATE accounts SET dollars = ${userAccount.dollars - (gambleAmount)} WHERE id = ${userInfo.id};`; 
        }
        
        var err, response = await pgClient.query(query);
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
    }
});



// RUN BOT ----------------------------------------------------------------------------
client.login(config.bot.discordAPIKey);