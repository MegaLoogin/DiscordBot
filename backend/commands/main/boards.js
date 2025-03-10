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
            // Создаем заголовок таблицы
            let table = `\`\`\`\n${group.listNames.join(' | ')}\n`;
            table += '─'.repeat(60) + '\n';
            table += `Название доски${' '.repeat(20)}${group.listNames[0].padStart(8)}  ${group.listNames[1].padStart(8)}  Всего\n`;
            table += '─'.repeat(60) + '\n';

            // Добавляем строки с данными
            group.boards.forEach(board => {
                const total = board.counts[0] + board.counts[1];
                const boardName = board.boardName.padEnd(30);
                table += `${boardName}${board.counts[0].toString().padStart(8)}  ${board.counts[1].toString().padStart(8)}  ${total.toString().padStart(5)}\n`;
            });

            table += '\`\`\`';
            return table;
        }).join('\n');

        await int.editReply(message || 'Нет активных досок');
    }
}; 