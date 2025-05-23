const { Client, Collection, GatewayIntentBits } = require("discord.js");
const deployCommands = require('./deploy-commands.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleAPI = require("./utils/gapi.js");
const { getMeetingTranscript, createMeeting } = require("./utils/meetingService");

const express = require('express');
const { router } = require("./utils/router.js");

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
const { google } = require("googleapis");

const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR) || 9; // Начало рабочего дня
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR) || 19; // Конец рабочего дня

// Путь к файлу с токенами
const TOKEN_PATH = path.join(__dirname, './volume/tokens.json');
const PROCESSED_MEETINGS_PATH = path.join(__dirname, './volume/processed_meetings.json');

// Настройка OAuth 2.0
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://discrete-quetzal-lucky.ngrok-free.app/oauth2callback'
);

// Функция для сохранения токенов
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('Токены сохранены в:', TOKEN_PATH);
}

// Функция для загрузки токенов
function loadTokens() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    return tokens;
  }
  return null;
}

// Функция для загрузки обработанных встреч
function loadProcessedMeetings() {
  if (fs.existsSync(PROCESSED_MEETINGS_PATH)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_MEETINGS_PATH));
    return data;
  }
  return { processedMeetings: [] };
}

// Функция для сохранения обработанных встреч
function saveProcessedMeeting(meetingId) {
  const data = loadProcessedMeetings();
  if (!data.processedMeetings.includes(meetingId)) {
    data.processedMeetings.push(meetingId);
    fs.writeFileSync(PROCESSED_MEETINGS_PATH, JSON.stringify(data, null, 2));
    console.log(`Meeting ID ${meetingId} сохранен в обработанных`);
  }
}

// Маршрут для авторизации
router.get('/auth', (req, res) => {
  const tokens = loadTokens();
  
  if (tokens && tokens.access_token && tokens.refresh_token) {
    res.send('Вы уже авторизованы!');
    return;
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.redirect(url);
});

// Callback маршрут после авторизации
router.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Сохраняем токены
    saveTokens(tokens);
    
    res.send('Авторизация успешна! Теперь вы можете использовать /startmeeting для создания встреч.');
  } catch (error) {
    console.error('Ошибка при получении токена:', error);
    res.status(500).send('Ошибка при авторизации');
  }
});

function getTimeWithTimezone(timeZone) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000; // UTC timestamp
  const tzDate = new Date(utc).toLocaleString("en-US", { timeZone }); // Локальное время в нужном поясе

  return new Date(tzDate); // Timestamp с учетом часового пояса
}

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
  schedule.scheduleJob(`15 ${WORK_START_HOUR + 1} * * 1-5`, async () => {
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

  //FB
  console.log("Инициализация FB созвонов");
  schedule.scheduleJob(`50 13 * * 1-5`, async () => {
    console.log("Отправка сообщения о созвоне через 10 минут");
    const channel = client.channels.cache.get(`1336797749592457276`);
    if (channel) {
        await channel.send(`@everyone созвон через 10 минут!`);
    }
  });

  schedule.scheduleJob(`0 14 * * 1-5`, async () => {
    console.log("Создание созвона FB");
    const meeting = await createMeeting(
        `FB daily meeting ${new Date().toLocaleDateString("ru-RU", {day: "numeric", month: "numeric"})}`,
        '', // пустое описание
        new Date().toISOString(),
        90,
        'FB' // пустые метаданные
    );
    
    const channel = client.channels.cache.get(`1336797749592457276`);
    if (channel) {
        await channel.send(`@everyone\n14:00 FB daily meeting\nСсылка: ${meeting.meetingUrl}`);
    }
  });

  //Affilate

  schedule.scheduleJob(`50 12 * * 1-5`, async () => {
    console.log("Отправка сообщения о созвоне через 10 минут");
    const channel = client.channels.cache.get(`1346109741151027220`);
    if (channel) {
        await channel.send(`@everyone созвон через 10 минут!`);
    }
  });

  schedule.scheduleJob(`0 13 * * 1-5`, async () => {
    console.log("Создание созвона Affiliate");
    const meeting = await createMeeting(
        `Affiliate daily meeting ${new Date().toLocaleDateString("ru-RU", {day: "numeric", month: "numeric"})}`,
        '', // пустое описание
        new Date().toISOString(),
        90,
        'Affiliate' // пустые метаданные
    );

    const channel = client.channels.cache.get(`1346109741151027220`);
    if (channel) {
        await channel.send(`@everyone\n13:00 Affilate daily meeting\nСсылка: ${meeting.meetingUrl}`);
    }
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

// Функция для разбиения длинных сообщений
function splitMessage(message, maxLength = 2000) {
    if (message.length <= maxLength) return [message];
    
    const parts = [];
    let currentPart = '';
    
    // Разбиваем по строкам
    const lines = message.split('\n');
    
    for (const line of lines) {
        // Если текущая часть + новая строка превышает лимит, начинаем новую часть
        if ((currentPart + line).length > maxLength) {
            if (currentPart) {
                parts.push(currentPart.trim());
            }
            currentPart = line;
        } else {
            currentPart += (currentPart ? '\n' : '') + line;
        }
    }
    
    // Добавляем последнюю часть
    if (currentPart) {
        parts.push(currentPart.trim());
    }
    
    return parts;
}

// Маршрут для проверки транскрипции
router.post('/api/transcription/check', async (req, res) => {
    try {
        console.log(req.body);
        const { meetingId, eventType } = req.body;
    
        if (!meetingId) {
            return res.status(400).json({
                error: 'Необходимо указать meetingId'
            });
        }

        if(eventType !== 'Transcription completed'){
            return res.status(400).json({
                error: 'Необходимо указать eventType'
            });
        }

        // Проверяем, была ли уже обработана эта встреча
        const processedMeetings = loadProcessedMeetings();
        if (processedMeetings.processedMeetings.includes(meetingId)) {
            console.log(`Meeting ID ${meetingId} уже был обработан ранее`);
            return;
        }

        console.log("Ожидание 5 минут", meetingId);
        await new Promise(resolve => setTimeout(resolve, 300000));

        // Получаем транскрипцию
        const transcript = await getMeetingTranscript(meetingId);
        
        // Извлекаем метаданные из заголовка
        const [title, meta] = transcript.title.split('|');

        console.log('Получена транскрипция:', {
            success: true,
            title,
            transcript,
            meta
        });

        // Отправляем транскрипцию в Discord
        let channelId = process.env.RESULTS_CHAN_ID;

        if(!meta) {
            if(title.includes('FB daily')){
                channelId = `1336797712875520080`;
            }else if(title.includes('Affiliate daily')){
                channelId = `1346109799817019443`;
            }else{
                saveProcessedMeeting(meetingId);
                return;
            }
        }else{
            if(meta.includes('FB')){
                channelId = `1336797712875520080`;
            }else if(meta.includes('Affiliate')){
                channelId = `1346109799817019443`;
            }
        }

        const channel = client.channels.cache.get(channelId);
        if (channel) {
            const message = [
                `**${title}**`,
                '',
                '**Общее описание:**',
                transcript.summary?.overview || 'Нет общего описания',
                '',
                '**Задачи:**',
                transcript.summary?.action_items || 'Нет задач',
                '',
                '**Краткое содержание:**',
                transcript.summary?.shorthand_bullet || 'Нет краткого содержания'
            ].join('\n');

            // Разбиваем сообщение на части и отправляем каждую часть
            const messageParts = splitMessage(message);
            for (const part of messageParts) {
                await channel.send(part);
            }

            // Сохраняем meetingId как обработанный
            saveProcessedMeeting(meetingId);
        }

        res.json({
            status: 'ok',
            transcript
        });
    } catch (error) {
        console.error('Ошибка при получении транскрипции:', error);
        res.status(500).json({
            error: error.message
        });
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


module.exports = { client, gapi, getTimeWithTimezone, splitMessage };