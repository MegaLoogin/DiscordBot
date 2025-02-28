const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getQueue } = require('../../utils/trello.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('Показывает количество задач в очереди дизайнеров'),

    async execute(int) {
        await int.deferReply();
        const queueData = await getQueue(process.env.DESIGN_BOARD, process.env.DESIGN_LIST_REQUESTS);
        
        // Формируем строку с распределением по именам
        const namesList = queueData.names
            .map(item => `• ${item.name}: ${item.count}`)
            .join('\n') || 'Нет данных';
    
        await int.editReply(
            `📊 Очередь дизайнеров:\n` +
            `• Всего задач: ${queueData.count}\n` +
            `• Срочные: ${queueData.urgentCount}\n\n` +
            `👥 Дизайнеры:\n${namesList}`
        );
    }
};