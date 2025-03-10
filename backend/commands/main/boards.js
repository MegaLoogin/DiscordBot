const { SlashCommandBuilder } = require("discord.js");
const { getBoardsStats } = require('../../utils/trello.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boards')
        .setDescription('Показывает количество карточек в первых двух листах всех досок'),

    async execute(int) {
        await int.deferReply();
        const stats = await getBoardsStats();
        
        if (stats.length === 0) {
            await int.editReply('Не удалось получить статистику по доскам.');
            return;
        }

        const message = stats
            .map(board => `📋 ${board.boardName}:\n• ${board.firstListName}: ${board.firstListCount}\n• ${board.secondListName}: ${board.secondListCount}`)
            .join('\n\n');

        await int.editReply(message);
    }
}; 