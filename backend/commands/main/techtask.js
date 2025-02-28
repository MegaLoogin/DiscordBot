const { SlashCommandBuilder } = require("discord.js");
const { createNewCard } = require('../../utils/trello.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('техзадача')
		.setDescription('Создает задачу для техов')
        .addStringOption(opt => opt.setName('название').setDescription('Краткое описание задачи').setRequired(true))
        .addStringOption(opt => opt.setName('описание').setDescription('Детали').setRequired(true))
        .addStringOption(opt => opt.setName('приоритет').setDescription('Приоритет (Красный = срочно, Зеленый = стандарт)').setRequired(true).addChoices({ name: "Срочно", value: "Срочно"}, { name: "Стандарт", value: "Стандарт"})),
	async execute(int) {
        await int.deferReply();
        
        await createNewCard(process.env.TECH_BOARD, process.env.TECH_LIST_REQUESTS, int.options.getString('название'), int.options.getString('описание') + `\nfrom [@${int.user.displayName} <@${int.user.id}> ${int.channelId}]`, "bottom", null, int.options.getString('приоритет'));
        await int.editReply(`Новая задача "${int.options.getString('название')}" создана`);
	},
};