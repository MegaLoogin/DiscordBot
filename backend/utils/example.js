require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { createMeeting, getMeetingTranscript } = require('./meetingService');

const app = express();
const port = 8181;

// Middleware для парсинга JSON
app.use(express.json());

// Путь к файлу с токенами
const TOKEN_PATH = path.join(__dirname, 'tokens.json');

// Настройка OAuth 2.0
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'http://localhost:8181/oauth2callback'
);

// Функция для сохранения токенов
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
}

// Функция для загрузки токенов
function loadTokens() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    return tokens;
  }
  return null;
}

// Маршрут для авторизации
app.get('/auth', (req, res) => {
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
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Сохраняем токены
    saveTokens(tokens);
    
    res.send('Авторизация успешна! Теперь вы можете использовать /create-meeting для создания встреч.');
  } catch (error) {
    console.error('Ошибка при получении токена:', error);
    res.status(500).send('Ошибка при авторизации');
  }
});

// Эндпоинт для создания встречи
app.post('/create-meeting', async (req, res) => {
  try {
    const { title, description, startTime, duration, meta } = req.body;

    // Проверяем обязательные параметры
    if (!title || !startTime || !duration) {
      return res.status(400).json({
        error: 'Необходимо указать title, startTime и duration'
      });
    }

    // Создаем встречу
    const meeting = await createMeeting(
      title,
      description || '',
      startTime,
      duration,
      meta || ''
    );

    // Возвращаем информацию о встрече
    res.json({
      success: true,
      meetingUrl: meeting.meetingUrl,
      eventId: meeting.eventId,
      meta: meeting.meta,
      message: 'Встреча создана успешно. После окончания встречи используйте /check для проверки статуса транскрипции.'
    });
  } catch (error) {
    console.error('Ошибка при создании встречи:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Эндпоинт для получения транскрипции
app.get('/get-transcript/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Необходимо указать meetingId'
      });
    }

    const transcript = await getMeetingTranscript(meetingId);
    res.json({
      success: true,
      transcript
    });
  } catch (error) {
    console.error('Ошибка при получении транскрипции:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Эндпоинт для проверки статуса транскрипции
app.post('/check', async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Необходимо указать meetingId'
      });
    }

    // Получаем транскрипцию
    const transcript = await getMeetingTranscript(meetingId);
    
    // Извлекаем метаданные из заголовка
    const [title, meta] = transcript.title.split('|');

    console.log({
      success: true,
      title,
      transcript,
      meta
    });

    res.json({
      status: 'ok'
    });
  } catch (error) {
    console.error('Ошибка при получении транскрипции:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`Для авторизации перейдите по адресу: http://localhost:${port}/auth`);
  console.log(`Для создания встречи отправьте POST запрос на http://localhost:${port}/create-meeting`);
  console.log(`Для получения транскрипции отправьте GET запрос на http://localhost:${port}/get-transcript/:meetingId`);
  console.log(`Для тестирования отправьте POST запрос на http://localhost:${port}/check`);
}); 