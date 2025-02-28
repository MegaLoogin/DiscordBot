const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('статус')
        .setDescription('Изменить статус активности')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Your status')
                .setRequired(true)
                .addChoices(
                    { name: 'Online', value: 'online' },
                    { name: 'Offline', value: 'offline' },
                    { name: 'Away', value: 'away' },
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const status = interaction.options.getString('status');
        const member = interaction.member;
        
        // Check permissions
        const bot = interaction.guild.members.me;
        if (!bot.permissions.has('ManageNicknames')) {
            await interaction.editReply('У бота нет прав на изменение никнеймов');
            return;
        }

        // Check role hierarchy
        if (member.roles.highest.position >= bot.roles.highest.position) {
            await interaction.editReply('Бот не может изменить ваш никнейм, так как ваша роль выше роли бота');
            return;
        }
        
        // Получаем базовый никнейм: если есть серверный ник - используем его, 
        // если нет - используем имя пользователя
        let originalNick = member.nickname || member.user.username;
        // Убираем старый статус из никнейма если он есть
        originalNick = originalNick.replace(/^\[[^\]]+\]\s*\|\s*/, '');

        // Convert English status to Russian for display
        const statusMap = {
            'online': 'онлайн',
            'offline': 'оффлайн',
            'away': 'отошел'
        };

        try {
            await member.setNickname(`[${statusMap[status]}] | ${originalNick}`);
            await interaction.editReply(`Ваш статус изменен на "${statusMap[status]}"`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('Произошла ошибка при изменении статуса');
        }
    },
}; 