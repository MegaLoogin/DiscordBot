const { Router } = require('express');
const { getQueue } = require('./trello');
const statusTracker = require('./statusTracker');
const activityTracker = require('./activityTracker');
const express = require('express');
const path = require('path');

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

// API endpoint для получения статистики
router.get('/api/stats', (req, res) => {
    try {
        const activityData = Array.from(activityTracker.userTime.entries());
        const statusData = Array.from(statusTracker.statusData.entries());
        
        const combinedData = activityData.map(([userId, activity]) => {
            const status = statusTracker.statusData.get(userId) || {
                currentStatus: 'offline',
                totalTime: { online: 0, away: 0, offline: 0 }
            };
            
            const username = activityTracker.userNames.get(userId) || 
                           statusTracker.userNames.get(userId) || 
                           'Неизвестный пользователь';

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