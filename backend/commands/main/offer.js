const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { createNewCard, getQueue } = require('../../utils/trello.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('оффер')
        .setDescription('Создает запрос оффера на подключение')
        .addStringOption(opt => opt.setName('название').setDescription('Название оффера').setRequired(true))
        .addStringOption(opt => opt.setName('тип').setDescription('Тип оффера (спенд/cpa)').setRequired(true).addChoices({ name: "СПЕНД", value: "СПЕНД"}, { name: "CPA", value: "CPA"}))
        .addStringOption(opt => opt.setName('детали').setDescription('Детали к офферу (примичание)').setRequired(true)),
    async execute(int) {
        await int.deferReply();

        await createNewCard(process.env.OFFER_BOARD, process.env.OFFER_LIST_REQUESTS, `[${int.options.getString('тип')}] ${int.options.getString('название')}`, int.options.getString('детали') + `\n<@${int.user.id}>`, "bottom");

        await int.editReply(`<@${process.env.BIZDEV_ID}>: запрос на оффер ${int.options.getString('название')} от <@${int.user.id}>`);
    },
};