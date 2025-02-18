const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { createNewCard, getQueue } = require('../../utils/trello.js');
const geos = require("../../utils/geos.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('оффер')
        .setDescription('Запрос оффера на подключение')
        .addStringOption(opt => opt.setName('команда').setDescription('Выберите в какой команде вы работаете (FB или PUSH)').setRequired(true).setChoices({name: "FB", value: "FB"}, {name: "PUSH", value: "PUSH"}))
        .addStringOption(opt => opt.setName('название').setDescription('Название оффера').setRequired(true))
        .addStringOption(opt => opt.setName('гео').setDescription('Гео').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('детали').setDescription('Детали к офферу (примечание)').setRequired(true)),
    async autocomplete(int){
        const focusedOption = int.options.getFocused(true);
    
        const filtered = geos.filter(v => v.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()) || v.value.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await int.respond(
            filtered.map(c => ({name: c.name, value: c.value})).slice(0, 24)
        );
    },
    async execute(int) {
        await int.deferReply();
        const boardId = int.options.getString('команда') == "FB" ? process.env.BIZDEV_BOARD : process.env.BIZDEV_PUSH_BOARD;
        await createNewCard(boardId, process.env.BIZDEV_LIST_REQUESTS, `${int.options.getString('название')}`, int.options.getString('детали') + `\n <@${int.user.id}>`, "bottom");

        await int.editReply(`<@${process.env.BIZDEV_ID}>: запрос на оффер ${int.options.getString('название')} от <@${int.user.id}>`);
    },
};