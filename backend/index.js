const { Client, Collection, GatewayIntentBits } = require("discord.js");
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

const SESSION_TIMEOUT = 15 * 60 * 1000;      // Если активности не было 15 минут, считаем, что сессия завершена
const INACTIVITY_THRESHOLD = 4 * 60 * 60 * 1000; // 4 часа неактивности для отправки предупреждения

function isWorkingHours() {
	const now = new Date();
	const day = now.getDay(); // 0 - воскресенье, 6 - суббота
	const hour = now.getHours();
	// Рабочие дни: понедельник (1) - пятница (5), и время с 10 до 18
	return day >= 1 && day <= 5 && hour >= 10 && hour < 18;
}

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]});
const userActivity = loadActivityData();
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

const ACTIVITY_FILE = path.join(__dirname, 'volume/activityData.json');

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

/**
 * Загружает данные активности из файла.
 */
function loadActivityData() {
	if (fs.existsSync(ACTIVITY_FILE)) {
	  try {
		const data = fs.readFileSync(ACTIVITY_FILE, 'utf8');
		const obj = JSON.parse(data);
		// Преобразуем объект в Map
		return new Map(Object.entries(obj));
	  } catch (err) {
		console.error("Ошибка загрузки данных активности:", err);
		return new Map();
	  }
	}
	return new Map();
  }
  
/**
 * Сохраняет данные активности в файл.
 */
function saveActivityData() {
	const obj = Object.fromEntries(userActivity);
	fs.writeFile(ACTIVITY_FILE, JSON.stringify(obj, null, 2), err => {
		if (err) console.error("Ошибка сохранения данных активности:", err);
	});
}

function recordActivity(user) {
	if (!isWorkingHours()) return; // Если не рабочее время, ничего не делаем
  
	const now = Date.now();
	let record = userActivity.get(user.id);
  
	if (!record) {
	  // Если записи ещё нет – создаём новую
	  record = {
		lastActivity: now,
		sessions: [{ start: now, end: now }],
		notified: false,
		username: user.tag // например, "Артур#1234"
	  };
	  userActivity.set(user.id, record);
	} else {
	  // Обновляем имя (на случай изменения) и время активности
	  record.username = user.tag;
	  if (now - record.lastActivity <= SESSION_TIMEOUT) {
		// Если активность продолжается – обновляем время окончания текущей сессии
		record.sessions[record.sessions.length - 1].end = now;
	  } else {
		// Если пауза больше SESSION_TIMEOUT – начинаем новую сессию
		record.sessions.push({ start: now, end: now });
	  }
	  record.lastActivity = now;
	  record.notified = false; // Сбрасываем флаг предупреждения при любой активности
	}
	saveActivityData();
  }

  client.on('messageCreate', message => {
	if (message.author.bot) return; // Игнорируем сообщения ботов
	recordActivity(message.author);
  });
  
  // При изменении состояния голосового канала
  client.on('voiceStateUpdate', (oldState, newState) => {
	// Игнорируем ботов
	if (newState.member.user.bot) return;
  
	// Любое изменение (вход в голос, выход, переключение) считаем активностью
	recordActivity(newState.member.user);
  });

  client.once('ready', () => {
	console.log(`Бот запущен: ${client.user.tag}`);
  
	// Каждую минуту проверяем, если у пользователя более 4 часов без активности – отправляем предупреждение.
	// Проверка производится только в рабочее время.
	setInterval(() => {
	  if (!isWorkingHours()) return;
	  const now = Date.now();
	  for (const [userId, record] of userActivity.entries()) {
		if (!record.notified && now - record.lastActivity >= INACTIVITY_THRESHOLD) {
			client.channels.cache.find(ch => ch.name === 'активность-логи').send(`Пользователь <@${userId}> давно не проявлял активность`);
		  client.users.fetch(userId)
			.then(user => {
			  user.send("Вы не проявляли активность 4 часа подряд. Пожалуйста, проверьте свою активность.")
				.catch(err => console.error(`Ошибка отправки ЛС пользователю ${user.tag}:`, err));
				console.log(user);
			})
			.catch(err => console.error(`Ошибка получения пользователя ${userId}:`, err));
		  record.notified = true;
		}
	  }
	}, 60 * 1000);
  
	// Планирование ежедневного отчёта в 00:05 (серверное время)
	cron.schedule('5 0 * * *', () => {
	  generateDailyReport();
	});
  });

  async function generateDailyReport() {
	// Поиск канала по имени (убедитесь, что канал существует и бот имеет права на отправку сообщений)
	const logChannel = client.channels.cache.find(ch => ch.name === 'активность-логи');
	if (!logChannel) {
	  console.error("Канал #активность-логи не найден!");
	  return;
	}
	
	const now = Date.now();
	let reportLines = [];
  
	// Проходим по всем пользователям и суммируем длительность сессий за день
	for (const [userId, record] of userActivity.entries()) {
	  // Если пользователь ещё активен, обновляем время окончания текущей сессии
	  if (now - record.lastActivity <= SESSION_TIMEOUT && record.sessions.length) {
		record.sessions[record.sessions.length - 1].end = now;
	  }
	  // Суммируем длительность всех сессий
	  const totalMs = record.sessions.reduce((sum, session) => sum + (session.end - session.start), 0);
	  
	  // Переводим миллисекунды в часы и минуты
	  const totalMinutes = Math.floor(totalMs / 60000);
	  const hours = Math.floor(totalMinutes / 60);
	  const minutes = totalMinutes % 60;
  
	  // Формируем строку отчёта для пользователя
	  reportLines.push(`${record.username}: активен ${hours}ч ${minutes}м`);
	  
	  // Сбрасываем сессии для нового дня
	  record.sessions = [];
	}
	
	const reportMessage = reportLines.length
	  ? reportLines.join('\n')
	  : "Нет данных об активности.";
	
	// Отправляем отчёт в канал
	logChannel.send("**Ежедневный отчёт об активности:**\n" + reportMessage)
	  .catch(err => console.error("Ошибка отправки отчёта:", err));
  }

(async () => {
	await gapi.authorize();
    await deployCommands();
	
    client.login(process.env.DTOKEN);
})();

(async () => {
	app.listen(8181, () => console.log("Server started!"));
})();

module.exports = { client, gapi };