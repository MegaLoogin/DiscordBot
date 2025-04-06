const { SlashCommandBuilder } = require('discord.js');
const { getMeetingTranscript } = require('../../utils/meetingService');
const { splitMessage } = require('../../index');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsummary')
        .setDescription('Получает сводку (summary) по ID встречи')
        .addStringOption(option =>
            option.setName('meetingid')
                .setDescription('ID встречи')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const meetingId = interaction.options.getString('meetingid');

            // Получаем транскрипцию
            const transcript = await getMeetingTranscript(meetingId);
            
            // Извлекаем метаданные из заголовка
            const [title, meta] = transcript.title.split('|');

            // Формируем сообщение
            const message = [
                `**${title}**`,
                '',
                '**Общее описание:**',
                transcript.summary?.overview || 'Нет общего описания',
                '',
                '**Задачи:**',
                ...(transcript.summary?.action_items || ['Нет задач']),
                '',
                '**Краткое содержание:**',
                transcript.summary?.shorthand_bullet || 'Нет краткого содержания'
            ].join('\n');

            // Разбиваем сообщение на части
            const messageParts = splitMessage(message);
            
            // Отправляем первую часть как ответ
            await interaction.editReply(messageParts[0]);
            
            // Отправляем остальные части как последующие сообщения
            for (let i = 1; i < messageParts.length; i++) {
                await interaction.followUp(messageParts[i]);
            }
        } catch (error) {
            console.error('Ошибка при получении сводки:', error);
            await interaction.editReply({
                content: `Произошла ошибка при получении сводки: ${error.message}`,
                ephemeral: true
            });
        }
    }
}; 