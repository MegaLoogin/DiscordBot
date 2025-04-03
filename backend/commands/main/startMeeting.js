const { SlashCommandBuilder } = require('discord.js');
const { createMeeting } = require('../../utils/meetingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startmeeting')
        .setDescription('Создает новую Google Meet встречу')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Название встречи')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const title = interaction.options.getString('title');
            const startTime = new Date().toISOString();
            const duration = 60; // 60 минут по умолчанию

            // Создаем встречу
            const meeting = await createMeeting(
                title,
                '', // пустое описание
                startTime,
                duration,
                '' // пустые метаданные
            );

            // Отправляем информацию о встрече
            await interaction.editReply({
                content: `Встреча создана успешно!\nСсылка: ${meeting.meetingUrl}\nID встречи: ${meeting.eventId}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Ошибка при создании встречи:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при создании встречи',
                ephemeral: true
            });
        }
    }
}; 