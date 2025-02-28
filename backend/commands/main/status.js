const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to change status (admins only)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ChangeNickname),

    async execute(interaction) {
        await interaction.deferReply();
        const status = interaction.options.getString('status');
        const targetUser = interaction.options.getUser('user');
        
        // Если указан пользователь, проверяем права администратора
        if (targetUser && !interaction.member.permissions.has('Administrator')) {
            await interaction.editReply('Только администраторы могут менять статус других пользователей');
            return;
        }

        const member = targetUser ? 
            await interaction.guild.members.fetch(targetUser.id) : 
            interaction.member;

        // Check permissions
        const bot = interaction.guild.members.me;
        if (!bot.permissions.has('ManageNicknames')) {
            await interaction.editReply('У бота нет прав на изменение никнеймов');
            return;
        }

        // Check role hierarchy
        if (member.roles.highest.position >= bot.roles.highest.position) {
            await interaction.editReply('Бот не может изменить никнейм, так как роль пользователя выше роли бота');
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
            await interaction.editReply(
                targetUser ? 
                `Статус пользователя ${member.user.tag} изменен на "${statusMap[status]}"` :
                `Ваш статус изменен на "${statusMap[status]}"`
            );
        } catch (error) {
            console.error(error);
            await interaction.editReply('Произошла ошибка при изменении статуса');
        }
    },
}; 