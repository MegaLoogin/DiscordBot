const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Путь к файлу с токенами
const TOKEN_PATH = path.join(__dirname, '/backend/volume/tokens.json');

// Настройка OAuth 2.0
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://discrete-quetzal-lucky.ngrok-free.app/oauth2callback'
);

// Функция для загрузки токенов
function loadTokens() {
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    return tokens;
  }
  return null;
}

// Функция для проверки и обновления токенов
async function ensureValidTokens() {
  const tokens = loadTokens();
  
  if (!tokens) {
    throw new Error('Требуется авторизация. Перейдите по адресу: https://discrete-quetzal-lucky.ngrok-free.app/auth');
  }

  oauth2Client.setCredentials(tokens);

  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
      return credentials;
    } catch (error) {
      console.error('Ошибка при обновлении токена:', error);
      throw new Error('Ошибка при обновлении токена');
    }
  }

  return tokens;
}

// Настройка Google Calendar API
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Функция для добавления Fireflies в встречу
async function addFirefliesToMeeting(meetingUrl, title, duration = 60) {
  try {
    console.log('Отправка запроса к Fireflies.ai:', {
      meetingUrl,
      title,
      duration
    });

    const response = await axios.post('https://api.fireflies.ai/graphql', {
      query: `
        mutation AddToLiveMeeting($meetingLink: String!, $title: String, $duration: Int) {
          addToLiveMeeting(
            meeting_link: $meetingLink,
            title: $title,
            duration: $duration
          ) {
            success
          }
        }
      `,
      variables: {
        meetingLink: meetingUrl,
        title: title,
        duration: parseInt(duration)
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`
      }
    });

    console.log('Ответ от Fireflies.ai:', JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error('Ошибки в ответе Fireflies.ai:', JSON.stringify(response.data.errors, null, 2));
      throw new Error(`Ошибка Fireflies.ai: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data;
  } catch (error) {
    console.error('Полная ошибка Fireflies.ai:', {
      message: error.message,
      response: error.response?.data ? JSON.stringify(error.response.data, null, 2) : undefined,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    if (error.response?.data?.errors) {
      throw new Error(`Ошибка Fireflies.ai: ${JSON.stringify(error.response.data.errors)}`);
    }
    
    throw new Error(`Ошибка при добавлении Fireflies: ${error.message}`);
  }
}

// Функция для получения транскрипции
async function getTranscript(meetingId) {
  try {
    const response = await axios.post('https://api.fireflies.ai/graphql', {
      query: `
        query Transcript($meetingId: String!) {
          transcript(id: $meetingId) {
            id
            title
            organizer_email
            participants
            duration
            dateString
            transcript_url
            summary {
                keywords
                action_items
                shorthand_bullet
                overview
            }
            meeting_info {
                fred_joined
                silent_meeting
                summary_status
            }
          }
        }
      `,
      variables: {
        meetingId: meetingId
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении транскрипции:', error);
    throw error;
  }
}

// Функция для ожидания завершения транскрипции
async function waitForTranscript(meetingId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    // const status = await checkTranscriptStatus(meetingId);
    console.log("Try ", i);
    const status = await getTranscript(meetingId);
    console.log("Status: ", status);
    if (status.data?.transcript?.meeting_info?.summary_status === 'processed') {
      return status.data.transcript;
    }else if(status.data?.transcript?.meeting_info?.summary_status === null){
      throw new Error('Транскрипция не найдена');
    }
    // Ждем 2 минуты перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, 120000));
  }
  
  throw new Error('Превышено время ожидания транскрипции');
}

// Функция для создания встречи
async function createMeeting(title, description, startTime, duration, meta = '') {
  try {
    await ensureValidTokens();

    // Разделяем заголовок и метаданные
    const fullTitle = meta ? `${title}|${meta}` : title;

    console.log('Создание встречи с параметрами:', {
      fullTitle,
      meta,
      description,
      startTime,
      duration
    });

    const event = {
      summary: title, // Используем чистый заголовок для Google Meet
      description: description,
      start: {
        dateTime: startTime,
        timeZone: 'Europe/Moscow',
      },
      end: {
        dateTime: new Date(new Date(startTime).getTime() + duration * 60000).toISOString(),
        timeZone: 'Europe/Moscow',
      },
      attendees: [
        { email: 'woblatgbot@gmail.com' }
      ],
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    console.log('Ответ от Google Calendar:', response.data);

    // Добавляем Fireflies в созданную встречу с полным заголовком, включающим мета
    if (response.data.conferenceData?.entryPoints?.[0]?.uri) {
      const meetUrl = response.data.conferenceData.entryPoints[0].uri;
      console.log('URL встречи:', meetUrl);

      const firefliesResponse = await addFirefliesToMeeting(
        meetUrl,
        fullTitle, // Используем полный заголовок с мета для Fireflies
        duration
      );

      console.log('Ответ от Fireflies:', firefliesResponse);
    }

    return {
      meetingUrl: response.data.conferenceData?.entryPoints?.[0]?.uri,
      eventId: response.data.id,
      meta: meta // Возвращаем мета для дальнейшего использования
    };
  } catch (error) {
    console.error('Полная ошибка при создании встречи:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    throw error;
  }
}

// Функция для получения транскрипции после окончания встречи
async function getMeetingTranscript(meetingId) {
  try {
    const transcript = await waitForTranscript(meetingId);
    return transcript;
  } catch (error) {
    console.error('Ошибка при получении транскрипции:', error);
    throw error;
  }
}

module.exports = {
  createMeeting,
  getMeetingTranscript
}; 