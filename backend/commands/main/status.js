const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const STATUS_EMOJIS = {
    'online': '🟢',
    'offline': '🔴',
    'away': '🟡'
};

const MAX_NICKNAME_LENGTH = 32;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('статус')
        .setDescription('Изменить статус активности')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Your status')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Online', value: 'online' },
                    { name: '🔴 Offline', value: 'offline' },
                    { name: '🟡 Away', value: 'away' },
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
        
        if (targetUser && !interaction.member.permissions.has('Administrator')) {
            await interaction.editReply('Только администраторы могут менять статус других пользователей');
            return;
        }

        const member = targetUser ? 
            await interaction.guild.members.fetch(targetUser.id) : 
            interaction.member;

        const bot = interaction.guild.members.me;
        if (!bot.permissions.has('ManageNicknames')) {
            await interaction.editReply('У бота нет прав на изменение никнеймов');
            return;
        }

        if (member.roles.highest.position >= bot.roles.highest.position) {
            await interaction.editReply('Бот не может изменить никнейм, так как роль пользователя выше роли бота');
            return;
        }
        
        let originalNick = member.nickname || member.user.globalName || member.user.username;
        originalNick = originalNick.replace(/^[🟢🔴🟡]\s*\|\s*/, '');

        // Создаем новый никнейм и обрезаем его до 32 символов
        const prefix = `${STATUS_EMOJIS[status]} | `;
        const maxNameLength = MAX_NICKNAME_LENGTH - prefix.length;
        const newNick = prefix + originalNick.slice(0, maxNameLength);

        try {
            await member.setNickname(newNick);
            await interaction.editReply(
                targetUser ? 
                `Статус пользователя ${member.displayName} изменен на "${STATUS_EMOJIS[status]}"` :
                `Ваш статус изменен на "${STATUS_EMOJIS[status]}"`
            );
        } catch (error) {
            console.error(error);
            await interaction.editReply('Произошла ошибка при изменении статуса');
        }
    },
}; 