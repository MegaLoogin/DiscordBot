const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const statusTracker = require('../../utils/statusTracker');
const activityTracker = require('../../utils/activityTracker');

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
        const activityReport = await activityTracker.getDailyReport(
            interaction.client, 
            process.env.ADMIN_IDS.split(',')
        );

        const report = statusReport.map(status => {
            const activity = activityReport.find(a => a.userId === status.userId) || { time: 0 };
            return {
                ...status,
                activity: activity.time
            };
        });

        if (report.length === 0) {
            await interaction.editReply('Нет данных об активности');
            return;
        }

        const embed = {
            title: 'Текущая статистика',
            description: statusTracker.formatReport(report),
            color: 0x0099ff,
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Данные с начала рабочего дня'
            }
        };

        await interaction.editReply({ embeds: [embed] });
    },
}; 