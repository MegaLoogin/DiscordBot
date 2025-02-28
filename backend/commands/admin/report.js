const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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

        const report = statusTracker.getDailyReport();

        if (report.length === 0) {
            await interaction.editReply('Нет данных об активности');
            return;
        }

        const embed = {
            title: 'Текущая статистика',
            description: report.map((u, i) => 
                `${i + 1}. <@${u.userId}>:\n` +
                `  • Статус онлайн: ${Math.floor(u.online / 60)}ч ${Math.round(u.online % 60)}м\n` +
                `  • Статус отошел: ${Math.floor(u.away / 60)}ч ${Math.round(u.away % 60)}м`
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