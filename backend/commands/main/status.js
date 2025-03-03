const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const STATUS_EMOJIS = {
    'online': '🟢',
    'offline': '🔴',
    'away': '🟡'
};

const MAX_NICKNAME_LENGTH = 32;

const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR) || 8; // Начало рабочего дня
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR) || 17; // Конец рабочего дня

// Функция для разбора никнейма на статус и имя
function parseNickname(nickname) {
    const statusMatch = nickname.match(/^(\p{Emoji})\s*(.+)$/u);
    if (statusMatch) {
        return {
            currentStatus: statusMatch[1],
            baseName: statusMatch[2]
        };
    }
    return {
        currentStatus: null,
        baseName: nickname
    };
}

// Новая функция для изменения статуса пользователя
async function changeUserStatus(member, status) {
    const currentName = member.user.globalName || member.user.username;
    const { baseName } = member.nickname ? 
        parseNickname(member.nickname) : 
        { baseName: currentName };

    // Создаем новый никнейм с новым статусом
    const prefix = `${STATUS_EMOJIS[status]} `;
    const maxNameLength = MAX_NICKNAME_LENGTH - prefix.length;
    const newNick = prefix + baseName.slice(0, maxNameLength);

    try {
        await member.setNickname(newNick);
    } catch (error) {
        console.error(`Ошибка обновления статуса для пользователя ${member.displayName}:`, error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('статус')
        .setDescription('Изменить статус активности')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Ваш статус')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Online', value: 'online' },
                    { name: '🔴 Offline', value: 'offline' },
                    { name: '🟡 Away', value: 'away' },
                )),
        // .addUserOption(option =>
        //     option.setName('user')
        //         .setDescription('Пользователь для изменения статуса (только для администраторов)')
        //         .setRequired(false))
        // .setDefaultMemberPermissions(PermissionFlagsBits.ChangeNickname),

    async execute(interaction) {
        await interaction.deferReply();
        const status = interaction.options.getString('status');
        const targetUser = interaction.options.getUser('user');
        
        // Проверяем, является ли пользователь администратором
        const isAdmin = interaction.member.permissions.has('Administrator');

        // Если не администратор, проверяем рабочее время
        if (!isAdmin) {
            const now = new Date();
            const day = now.getDay();
            const hour = now.getHours();

            // Проверка, является ли текущее время рабочим
            const isWorkingTime = day >= 1 && day <= 5 && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;

            if (!isWorkingTime) {
                await interaction.editReply('Команда доступна только в рабочее время.');
                return;
            }
        }

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
        
        // Получаем текущий никнейм или глобальное имя
        const currentName = member.user.globalName || member.user.username;
        const { baseName } = member.nickname ? 
            parseNickname(member.nickname) : 
            { baseName: currentName };

        // Изменяем статус пользователя
        await changeUserStatus(member, status);

        await interaction.editReply(
            targetUser ? 
            `Статус пользователя ${baseName} изменен на "${STATUS_EMOJIS[status]}"` :
            `Ваш статус изменен на "${STATUS_EMOJIS[status]}"`
        );
    },

    changeUserStatus
}; 