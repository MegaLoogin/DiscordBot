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