const { Client, Collection, GatewayIntentBits, IntentsBitField } = require("discord.js");
const deployCommands = require('./deploy-commands.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleAPI = require("./utils/gapi.js");
const cron = require('node-cron');

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

const schedule = require('node-schedule');

const CHANNEL_ID = process.env.ACTIVITY_CHAN_ID;
const DATA_FILE = path.join(__dirname, 'volume/user_stats.json');
const CHECK_INTERVAL = 2 * 60 * 1000;

const activityTracker = require('./utils/activityTracker');
const statusTracker = require('./utils/statusTracker');

// Загрузка данных из файла
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE);
      const data = JSON.parse(rawData);

      activityTracker.userTime = new Map(data.userTime.map(([id, entry]) => [
        id, 
        { 
          startTime: entry.startTime ? new Date(entry.startTime) : null,
          totalTime: entry.totalTime 
        }
      ]));

      activityTracker.lastActivity = new Map(data.lastActivity);
      activityTracker.lastNotification = new Map(data.lastNotification);
    }
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
}

// Сохранение данных в файл
function saveData() {
  const data = {
    userTime: Array.from(activityTracker.userTime.entries()).map(([id, entry]) => [
      id,
      {
        startTime: entry.startTime ? entry.startTime.getTime() : null,
        totalTime: entry.totalTime
      }
    ]),
    lastActivity: Array.from(activityTracker.lastActivity.entries()),
    lastNotification: Array.from(activityTracker.lastNotification.entries())
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Остальные функции остаются без изменений
function isWorkingTime(date = new Date()) {
  const day = date.getDay();
  const hour = date.getHours();
  return day >= 1 && day <= 5 && hour >= 10 && hour < 18;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} ч. ${minutes} м.`;
}

async function sendReminder(userId) {
  try {
    const user = await client.users.fetch(userId);
    await user.send('⚠️ Вы не проявляли активности более 4 часов в рабочее время!');
    
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      await channel.send(`**Внимание:** <@${userId}> не активен более 4 часов!`);
    }
    
    activityTracker.lastNotification.set(userId, Date.now());
    saveData();
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
  }
}

client.on('ready', () => {
  console.log(`Бот авторизован как ${client.user.tag}`);
  loadData();

  // Ежедневный отчет
  schedule.scheduleJob('5 17 * * 1-5', async () => {
    if (!activityTracker.isWorkingTime()) return;

    const report = statusTracker.getDailyReport();
    const channel = client.channels.cache.get(CHANNEL_ID);

    if (channel) {
        const embed = {
            title: 'Ежедневная статистика',
            description: report.map((u, i) => 
                `${i + 1}. <@${u.userId}>:\n` +
                `  • Статус онлайн: ${Math.floor(u.online / 60)}ч ${Math.round(u.online % 60)}м\n` +
                `  • Статус отошел: ${Math.floor(u.away / 60)}ч ${Math.round(u.away % 60)}м`
            ).join('\n\n') || 'Нет данных об активности',
            color: 0x0099ff,
            timestamp: new Date().toISOString()
        };
        await channel.send({ embeds: [embed] });
    }

    activityTracker.resetData();
    statusTracker.resetDailyStats();
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
        statusTracker.updateUserStatus(newMember.id, newMember.displayName);
    }
});

(async () => {
	await gapi.authorize();
  await deployCommands();
  // while(true){
    try{
      console.log(await client.login(process.env.DTOKEN));
    }catch(e){
      console.log(e);
    }

    // await new Promise(resolve => setTimeout(resolve, 10000))
  // }
})();

(async () => {
	app.listen(8181, () => console.log("Server started!"));
})();

// Добавить после существующих интервалов
setInterval(() => {
    statusTracker.resetAllStatuses(client);
}, 15000); // Проверка каждую минуту

module.exports = { client, gapi };