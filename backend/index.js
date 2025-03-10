const { Client, Collection, GatewayIntentBits } = require("discord.js");
const deployCommands = require('./deploy-commands.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleAPI = require("./utils/gapi.js");

const express = require('express');
const router = require("./utils/router.js");

const app = express();
app.use(express.json());
app.use(router);

const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ]
});
const gapi = new GoogleAPI();

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

const CHANNEL_ID = process.env.ACTIVITY_CHAN_ID;
const CHECK_INTERVAL = 30 * 1000;

const activityTracker = require('./utils/activityTracker');
const statusTracker = require('./utils/statusTracker');
const schedule = require('node-schedule');

const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR) || 8; // Начало рабочего дня
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR) || 17; // Конец рабочего дня


// Остальные функции остаются без изменений
function isWorkingTime(date = new Date()) {
    const day = date.getDay();
    const hour = date.getHours();
    return day >= 1 && day <= 5 && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

async function sendReminder(userId) {
    // Проверяем, является ли пользователь администратором
    if (ADMIN_IDS.includes(userId)) return;

    try {
        const user = await client.users.fetch(userId);
        await user.send('⚠️ Вы не проявляли активности более 4 часов в рабочее время!');

        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            await channel.send(`**Внимание:** <@${userId}> не активен более 4 часов!`);
        }

        activityTracker.lastNotification.set(userId, Date.now());
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
}

async function sendStatusReminder(userId) {
    // Проверяем, является ли пользователь администратором
    if (ADMIN_IDS.includes(userId)) return;

    try {
        const user = await client.users.fetch(userId);
        await user.send('⚠️ Вы не установили статус "онлайн" или "ушел" через 15 минут после начала рабочего дня!');

        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            await channel.send(`**Внимание:** <@${userId}> не установил статус на работе!`);
        }
    } catch (error) {
        console.error('Ошибка отправки уведомления о статусе:', error);
    }
}

client.on('ready', () => {
  console.log(`Бот авторизован как ${client.user.tag}`);

  // Инициализация ников пользователей
  async function initializeUsernames() {
    try {
      const guilds = client.guilds.cache;
      for (const guild of guilds.values()) {
        const members = await guild.members.fetch();
        for (const member of members.values()) {
          if (member.user.bot) continue;
          
          const userId = member.id;
          const username = member.displayName || member.user.username;
          
          // Проверяем и обновляем ники в обоих трекерах
          if (!activityTracker.userNames.has(userId)) {
            console.log(`Инициализация ника для пользователя ${userId}: ${username}`);
            activityTracker.updateUserName(userId, username);
          }
          
          if (!statusTracker.userNames.has(userId)) {
            console.log(`Инициализация ника в статус-трекере для пользователя ${userId}: ${username}`);
            statusTracker.updateUserName(userId, username);
          }
        }
      }
      console.log('Инициализация ников пользователей завершена');
    } catch (error) {
      console.error('Ошибка при инициализации ников пользователей:', error);
    }
  }

  // Запускаем инициализацию ников
  initializeUsernames();

  // Ежедневный отчет
  schedule.scheduleJob(`15 ${WORK_END_HOUR} * * 1-5`, async () => {
    try {
      const statusReport = statusTracker.getDailyReport();
      const activityReport = await activityTracker.getDailyReport(client, ADMIN_IDS);

      // Создаем бэкап перед сбросом данных
      const { createBackup, cleanupOldBackups } = require('./utils/router');
      const backupPath = createBackup();
      console.log(`Создан бэкап данных: ${backupPath}`);
      
      // Очищаем старые бэкапы
      cleanupOldBackups();

      // Объединяем данные
      const report = statusReport.map(status => {
          const activity = activityReport.find(a => a.userId === status.userId) || { time: 0 };
          return {
              ...status,
              activity: activity.time
          };
      });

      const channel = client.channels.cache.get(CHANNEL_ID);

      if (channel) {
          const embed = {
              title: 'Ежедневная статистика',
              description: statusTracker.formatReport(report) || 'Нет данных об активности',
              color: 0x0099ff,
              timestamp: new Date().toISOString()
          };
          await channel.send({ embeds: [embed] });
      }

      // Сброс статусов после отправки отчета
      await statusTracker.resetDailyStats(client);
      activityTracker.resetData();
    } catch (error) {
      console.error('Ошибка при создании ежедневного отчета:', error);
    }
  });

  // Проверка неактивности
  setInterval(() => {
    if (!activityTracker.isWorkingTime()) return;

    client.users.cache.forEach(user => {
        if (activityTracker.checkActivity(user.id, ADMIN_IDS)) {
            sendReminder(user.id);
        }
    });
  }, CHECK_INTERVAL);

  // Вызов функции проверки статусов каждый день в 10:15
  schedule.scheduleJob(`15 ${WORK_START_HOUR} * * 1-5`, async () => {
    client.guilds.cache.forEach(guild => {
        guild.members.fetch().then(members => {
            members.forEach(member => {
                if (!member.user.bot) {
                    const { currentStatus } = statusTracker.parseNickname(member.nickname || member.user.username);
                    if (currentStatus !== '🟢' && currentStatus !== '🟡') {
                        sendStatusReminder(member.id); // Отправляем уведомление
                    }
                }
            });
        });
    });
  });

  // Запланируйте сброс данных перед началом рабочего дня
  schedule.scheduleJob(`55 ${WORK_START_HOUR - 1} * * 1-5`, async () => {
    console.log('Сброс данных активности и статусов перед началом рабочего дня...');
    await statusTracker.resetDailyStats(client); // Сброс статусов
    activityTracker.resetData(); // Сброс данных активности
  });
});

// Отслеживание активности
client.on('messageCreate', message => {
  if (message.author.bot || ADMIN_IDS.includes(message.author.id)) return;
  activityTracker.updateMessageActivity(message.author.id);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.member.id;
  if (ADMIN_IDS.includes(userId)) return;
  if (newState.channelId && !oldState.channelId) {
    activityTracker.updateVoiceActivity(userId);
  }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (!activityTracker.isWorkingTime()) return;
  const member = newPresence.member;
  if (!member || member.user.bot || ADMIN_IDS.includes(member.user.id)) return;
  activityTracker.updatePresence(member.user.id, oldPresence, newPresence);
});

// Добавить обработчик изменения никнейма
client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (oldMember.displayName !== newMember.displayName) {
        const userId = newMember.id;
        const newUsername = newMember.displayName || newMember.user.username;
        
        console.log(`Обновление ника пользователя ${userId}: ${oldMember.displayName} -> ${newUsername}`);
        
        // Обновляем ник в обоих трекерах
        activityTracker.updateUserName(userId, newUsername);
        statusTracker.updateUserName(userId, newUsername);
        
        // Обновляем статус пользователя
        statusTracker.updateUserStatus(userId, newMember.displayName);
    }
});

(async () => {
	await gapi.authorize();
  await deployCommands();
  try{
    console.log(await client.login(process.env.DTOKEN));
  }catch(e){
    console.log(e);
  }
})();

(async () => {
	app.listen(8181, () => console.log("Server started!"));
})();

// Добавить после существующих интервалов
setInterval(() => {
    if (isWorkingTime()) {
        statusTracker.resetAllStatuses(client);
    }
}, 15000); // Проверка каждую минуту


module.exports = { client, gapi };