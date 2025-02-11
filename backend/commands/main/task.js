const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { createNewCard } = require('../../utils/trello.js');

const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])(\.\d{4})?$/;

function validateDate(date) {
    const match = date.match(dateRegex);
    if (match) {
        return {
            day: match[1],
            month: match[2],
            year: match[3] ? match[3].slice(1) : undefined
        };
    } else {
        return null;
    }
}

function convertDate(dateString) {
    const parts = dateString.split('.');
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    return formattedDate;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('задача').setNameLocalization('en-US', 'task')
		.setDescription('Создает задачу для дизайнеров')
        .addStringOption(opt => opt.setName('название').setDescription('Краткое описание задачи (например, «Баннер для Facebook»)').setRequired(true))
        .addStringOption(opt => opt.setName('описание').setDescription('Детали от баера (размеры, текст, стиль)').setRequired(true))
        .addStringOption(opt => opt.setName('приоритет').setDescription('Приоритет (Красный = срочно, Зеленый = стандарт)').setRequired(true).addChoices({ name: "Срочно", value: "Срочно"}, { name: "Стандарт", value: "Стандарт"}))
        .addStringOption(opt => opt.setName('дедлайн').setDescription('Дата выполнения').setRequired(true)),
        // .addStringOption(opt => opt.setName('участники').setDescription('Дизайнер').setRequired(true)),
	async execute(int) {
        await int.deferReply();
        const date = validateDate(int.options.getString('дедлайн'));

        if(!date) {
            await int.reply({content: 'Неверный формат даты (дд.мм.гггг или дд.мм). Пример: 02.03 или 02.03.2025', flags: MessageFlags.Ephemeral});
            return;
        }

        let dateString = convertDate(date.year ? int.options.getString('дедлайн') : ( ( ( new Date(`${new Date().getFullYear()}-${date.month}-${date.day}`) - new Date(new Date().toDateString()) ) < 0)? `${date.day}.${date.month}.${new Date().getFullYear() + 1}` : `${date.day}.${date.month}.${new Date().getFullYear()}` ))
        
        await createNewCard(process.env.DESIGN_BOARD, process.env.DESIGN_LIST_REQUESTS, int.options.getString('название'), int.options.getString('описание'), "bottom", dateString, int.options.getString('приоритет'));
        await int.editReply('Задача успешно отправлена дизайнерам!');
	},
};