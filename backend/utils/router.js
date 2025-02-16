const { Router } = require('express');
const { getQueue } = require('./trello');

const router = new Router();
module.exports = router;

router.get('/test', async (req, res) => {
    res.json({"status": "ok"});
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

    await client.channels.cache.get(process.env.FINANCE_CHAN_ID).send(messageText);

    res.json({"status": "ok"});
});

router.post("/sendBudgetAlert", async (req, res) => {
    const { deal } = req.body;
    const { client } = require('../index');

    await client.channels.cache.get(process.env.FINANCE_CHAN_ID).send(`Внимание! Превышение бюджета по ${deal.brand} у ${deal.buyer}! ($${deal.spentBudget} / $${deal.budget}). <@${process.env.BIZDEV_ID}> согласовать увеличение бюджета?`);

    res.json({"status": "ok"});
});