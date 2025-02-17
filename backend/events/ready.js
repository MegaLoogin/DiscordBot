const { Events } = require('discord.js');
const enableEvents = require('../utils/cardsChanged');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		enableEvents(client);
	},
};