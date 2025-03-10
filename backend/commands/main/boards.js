const { SlashCommandBuilder } = require("discord.js");
const { getBoardsStats } = require('../../utils/trello.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boards')
        .setDescription('Показывает количество карточек в первых двух листах всех досок'),

    async execute(int) {
        await int.deferReply();
        const groups = await getBoardsStats();
        
        if (!Array.isArray(groups) || groups.length === 0) {
            await int.editReply('Не удалось получить статистику по доскам.');
            return;
        }

        // Формируем сообщение для каждой группы
        const message = groups.map(group => {
            const header = `**${group.listNames.join(' | ')}**`;
            
            const boardStats = group.boards.map(board => {
                const total = board.counts[0] + board.counts[1];
                return `• ${board.boardName}:\n  ├ ${group.listNames[0]}: ${board.counts[0]}\n  ├ ${group.listNames[1]}: ${board.counts[1]}\n  └ Всего: ${total}`;
            }).join('\n\n');

            return `${header}\n${boardStats}`;
        }).join('\n\n');

        await int.editReply(message || 'Нет активных досок');
    }
}; 