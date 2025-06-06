const { SlashCommandBuilder } = require("discord.js");
const { getBoardsStats } = require('../../utils/trello.js');

const MESSAGE_LIMIT = 1900; // Оставляем небольшой запас от лимита в 2000

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

        try {
            let currentMessage = '';
            let isFirstMessage = true;

            for (const group of groups) {
                // Создаем заголовок таблицы
                let table = `\`\`\`\n${group.listNames.join(' | ')}\n`;
                table += '─'.repeat(50) + '\n';

                // Определяем максимальную длину для первой колонки
                const maxBoardLength = Math.max(
                    ...group.boards.map(b => b.boardName.length),
                    'Название доски'.length
                );

                // Форматируем заголовки столбцов с учетом максимальной длины
                const firstColumnWidth = maxBoardLength + 2;
                table += `${'Название доски'.padEnd(firstColumnWidth)}${group.listNames[0].padStart(8)}    ${group.listNames[1].padStart(8)}\n`;
                table += '─'.repeat(50) + '\n';

                // Если новая таблица не поместится в текущее сообщение, отправляем текущее и начинаем новое
                if (currentMessage && (currentMessage.length + table.length > MESSAGE_LIMIT)) {
                    currentMessage += '\`\`\`';
                    if (isFirstMessage) {
                        await int.editReply(currentMessage);
                        isFirstMessage = false;
                    } else {
                        await int.followUp(currentMessage);
                    }
                    currentMessage = table;
                } else {
                    if (currentMessage) currentMessage += '\`\`\`\n' + table;
                    else currentMessage = table;
                }

                // Добавляем строки с данными
                for (const board of group.boards) {
                    const boardName = board.boardName.padEnd(firstColumnWidth);
                    const row = `${boardName}${board.counts[0].toString().padStart(8)}    ${board.counts[1].toString().padStart(8)}\n`;

                    // Если строка не поместится в текущее сообщение, отправляем текущее и начинаем новое
                    if (currentMessage.length + row.length > MESSAGE_LIMIT) {
                        currentMessage += '\`\`\`';
                        if (isFirstMessage) {
                            await int.editReply(currentMessage);
                            isFirstMessage = false;
                        } else {
                            await int.followUp(currentMessage);
                        }
                        // Начинаем новое сообщение с заголовка таблицы
                        currentMessage = table + row;
                    } else {
                        currentMessage += row;
                    }
                }
            }

            // Отправляем последнее сообщение, если оно есть
            if (currentMessage) {
                currentMessage += '\`\`\`';
                if (isFirstMessage) {
                    await int.editReply(currentMessage);
                } else {
                    await int.followUp(currentMessage);
                }
            }
        } catch (error) {
            console.error('Ошибка при отправке статистики:', error);
            await int.editReply('Произошла ошибка при отправке статистики.');
        }
    }
}; 