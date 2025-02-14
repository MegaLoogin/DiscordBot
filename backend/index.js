const { Client, Collection, GatewayIntentBits } = require("discord.js");
const deployCommands = require('./deploy-commands.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleAPI = require("./utils/gapi.js");

const express = require('express');
const router = require("./utils/router.js");

const app = express();
app.use(express.json());
app.use(router);

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});
const gapi = new GoogleAPI();

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

(async () => {
	await gapi.authorize();
	// console.log((await gapi.getValues(process.env.SS_ID, "Сегодня!A1:G41")).data.values);
    await deployCommands();
    client.login(process.env.DTOKEN);
})();

(async () => {
	app.listen(8181, () => console.log("Server started!"));
})();

module.exports = { client, gapi };