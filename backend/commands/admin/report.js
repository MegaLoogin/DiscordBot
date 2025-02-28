const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const activityTracker = require('../../utils/activityTracker');
const statusTracker = require('../../utils/statusTracker');

function formatHoursAndMinutes(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}ч ${m}м`;
}

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
                `  • Статус онлайн: ${Math.floor(u.statusTime.online)}ч ${Math.round((u.statusTime.online % 1) * 60)}м\n` +
                `  • Статус отошел: ${Math.floor(u.statusTime.away)}ч ${Math.round((u.statusTime.away % 1) * 60)}м`
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