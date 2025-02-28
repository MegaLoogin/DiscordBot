const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const activityTracker = require('../../utils/activityTracker');
const statusTracker = require('../../utils/statusTracker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('отчет')
        .setDescription('Показать текущий отчет по активности (только для админов)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.editReply('Эта команда доступна только администраторам');
            return;
        }

        const statusReport = statusTracker.getDailyReport();
        const report = await activityTracker.getDailyReport(
            interaction.client, 
            process.env.ADMIN_IDS.split(','),
            statusReport
        );

        if (report.length === 0) {
            await interaction.editReply('Нет данных об активности');
            return;
        }

        const embed = {
            title: 'Текущая статистика',
            description: report.map((u, i) => 
                `${i + 1}. <@${u.userId}>:\n` +
                `  • Активность: ${activityTracker.formatTime(u.time)}\n` +
                `  • Время онлайн: ${u.statusTime.online}ч\n` +
                `  • Время отошел: ${u.statusTime.away}ч\n` +
                `  • Текущий статус: ${u.status}`
            ).join('\n\n'),
            color: 0x0099ff,
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Данные с начала рабочего дня'
            }
        };

        await interaction.editReply({ embeds: [embed] });
    },
}; 