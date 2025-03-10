const { Router } = require('express');
const { getQueue } = require('./trello');
const statusTracker = require('./statusTracker');
const activityTracker = require('./activityTracker');
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = new Router();
module.exports = router;

router.get('/test', async (req, res) => {
    res.json({"status": "ok"});
});

router.get('/reset-statuses', async (req, res) => {
    const { client } = require('../index');

    try {
        await statusTracker.resetDailyStats(client);
        activityTracker.resetData();
        res.json({"status": "Статусы успешно сброшены"});
    } catch (error) {
        console.error('Ошибка при сбросе статусов:', error);
        res.status(500).json({"status": "Ошибка при сбросе статусов"});
    }
});

router.post('/sendTasksData', async (req, res) => {
    const { todayClosed } = req.body;
    const { client } = require('../index');

    const queueData = await getQueue(process.env.DESIGN_BOARD, process.env.DESIGN_LIST_REQUESTS);
    await client.channels.cache.get(process.env.RESULTS_CHAN_ID).send(`Сегодня закрыто ${todayClosed} задачи. В очереди: ${queueData.count} (${queueData.urgentCount} срочных)`);

    res.json({"status": "ok"});
});

router.post("/sendBudgetData", async (req, res) => {
    const { deals } = req.body;
    const { client } = require('../index');

    const messageText = deals.map(item => `СПЕНД "${item.brand}":  \n    • Израсходовано: $${item.spentBudget} / $${item.budget}  \n    • Цена за FTD: $${item.avgFtdCost.toFixed(2)}`).join('\n\n');

    if(messageText.length > 4) await client.channels.cache.get(process.env.FINANCE_CHAN_ID).send(messageText);

    res.json({"status": "ok"});
});

router.post("/sendBudgetAlert", async (req, res) => {
    const { deal } = req.body;
    const { client } = require('../index');

    await client.channels.cache.get(process.env.FINANCE_CHAN_ID).send(`Внимание! Превышение бюджета по ${deal.brand} у ${deal.buyer}! ($${deal.spentBudget} / $${deal.budget}). <@${process.env.BIZDEV_ID}> согласовать увеличение бюджета?`);

    res.json({"status": "ok"});
});

// Статические файлы
router.use(express.static(path.join(__dirname, '../public')));

// Константы для работы с бэкапами
const BACKUP_DIR = path.join(__dirname, '../volume/backups');
const BACKUP_RETENTION_DAYS = 7;

// Создаем директорию для бэкапов, если она не существует
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Функция для создания бэкапа
function createBackup() {
    const date = new Date();
    const backupFileName = `backup_${date.toISOString().split('T')[0]}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    const backupData = {
        timestamp: date.toISOString(),
        activityData: {
            userTime: Array.from(activityTracker.userTime.entries()),
            lastActivity: Array.from(activityTracker.lastActivity.entries()),
            userNames: Array.from(activityTracker.userNames.entries())
        },
        statusData: {
            statusData: Array.from(statusTracker.statusData.entries()),
            userNames: Array.from(statusTracker.userNames.entries())
        }
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    return backupPath;
}

// Функция для очистки старых бэкапов
function cleanupOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = new Date();

    files.forEach(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

        if (daysOld > BACKUP_RETENTION_DAYS) {
            fs.unlinkSync(filePath);
            console.log(`Удален старый бэкап: ${file}`);
        }
    });
}

// Статические файлы
router.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));

// Редирект с корня на дашборд
// router.get('/', (req, res) => {
//     res.redirect('/dashboard');
// });

// API endpoint для получения списка доступных дат
router.get('/api/stats/available-dates', (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const dates = files
            .filter(file => file.startsWith('backup_'))
            .map(file => file.replace('backup_', '').replace('.json', ''))
            .sort((a, b) => new Date(b) - new Date(a));
        
        res.json(dates);
    } catch (error) {
        console.error('Ошибка при получении списка дат:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// API endpoint для получения статистики за конкретную дату
router.get('/api/stats/:date', (req, res) => {
    try {
        const backupPath = path.join(BACKUP_DIR, `backup_${req.params.date}.json`);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Данные не найдены' });
        }

        const backupData = JSON.parse(fs.readFileSync(backupPath));
        const combinedData = Array.from(new Map(backupData.activityData.userTime).entries())
            .map(([userId, activity]) => {
                const status = new Map(backupData.statusData.statusData).get(userId) || {
                    currentStatus: 'offline',
                    totalTime: { online: 0, away: 0, offline: 0 }
                };
                
                const username = new Map(backupData.activityData.userNames).get(userId) || 
                               new Map(backupData.statusData.userNames).get(userId) || 
                               'Неизвестный пользователь';

                return {
                    userId,
                    username,
                    currentStatus: status.currentStatus || 'offline',
                    statusTime: status.totalTime || { online: 0, away: 0, offline: 0 },
                    activityTime: activity.totalTime || 0,
                    lastActivity: new Map(backupData.activityData.lastActivity).get(userId) || 0
                };
            });

        res.json(combinedData);
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// API endpoint для текущей статистики
router.get('/api/stats', async (req, res) => {
    try {
        const { client } = require('../index');
        const guild = client.guilds.cache.first();
        if (!guild) {
            throw new Error('Сервер Discord не найден');
        }

        // Получаем список всех пользователей
        const members = await guild.members.fetch();
        const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];

        // Формируем данные для каждого пользователя
        const combinedData = Array.from(members.values())
            .filter(member => !member.user.bot && !ADMIN_IDS.includes(member.id))
            .map(member => {
                const userId = member.id;
                const activity = activityTracker.userTime.get(userId) || { startTime: null, totalTime: 0 };
                const status = statusTracker.statusData.get(userId) || {
                    currentStatus: 'offline',
                    totalTime: { online: 0, away: 0, offline: 0 }
                };
                
                const username = member.displayName || member.user.username;

                // Обновляем имена пользователей в трекерах, если они отсутствуют
                if (!activityTracker.userNames.has(userId)) {
                    activityTracker.updateUserName(userId, username);
                }
                if (!statusTracker.userNames.has(userId)) {
                    statusTracker.updateUserName(userId, username);
                }

                return {
                    userId,
                    username,
                    currentStatus: status.currentStatus || 'offline',
                    statusTime: status.totalTime || { online: 0, away: 0, offline: 0 },
                    activityTime: activity.totalTime || 0,
                    lastActivity: activityTracker.lastActivity.get(userId) || 0
                };
            });

        res.json(combinedData);
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// API endpoint для получения статистики досок
router.get('/api/boards', async (req, res) => {
    try {
        const { getBoardsStats } = require('./trello');
        const stats = await getBoardsStats();
        res.json(stats);
    } catch (error) {
        console.error('Ошибка при получении статистики досок:', error);
        res.status(500).json({ 
            error: 'Не удалось получить статистику досок',
            details: error.message 
        });
    }
});