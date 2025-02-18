const { onCardsChange, moveCard } = require("./trello");

const { DESIGN_BOARD, DESIGN_LIST_WORK, DESIGN_LIST_DONE, DESIGN_CHAN_ID, 
    BIZDEV_BOARD, BIZDEV_PUSH_BOARD, BIZDEV_LIST_WORK, BIZDEV_LIST_DONE, BIZDEV_CHAN_ID, 
    FB_BOARD, FB_LIST_NEW, FB_LIST_BUYERS, FB_TEMPLATE_NAME, FB_LIST_TROUBLE,
    PUSH_BOARD, PUSH_LIST_NEW, PUSH_LIST_BUYERS, PUSH_TEMPLATE_NAME, PUSH_LIST_TROUBLE } = process.env;

module.exports = function (client){
    onCardsChange(DESIGN_BOARD, DESIGN_LIST_WORK, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/from \[\s*(@\S+)\s*(<@\d+>)\s*(\d+)\s*\]/);

            if(match){
                await client.channels.cache.get(match[3]).send(`[Trello] <@${match[2]}> Начата работа над задачей ${card.name}`);
            }else{
                await client.channels.cache.get(DESIGN_CHAN_ID).send(`[Trello] Начата работа над задачей ${card.name}`);
            }
        });
    });

    onCardsChange(DESIGN_BOARD, DESIGN_LIST_DONE, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/from \[\s*(@\S+)\s*(<@\d+>)\s*(\d+)\s*\]/);

            if(match){
                await client.channels.cache.get(match[3]).send(`[Trello] <@${match[2]}> Задача ${card.name} готова!`);
            }else{
                await client.channels.cache.get(DESIGN_CHAN_ID).send(`[Trello] Задача ${card.name} готова!`);
            }
        });
    });

    onCardsChange(BIZDEV_BOARD, BIZDEV_LIST_WORK, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/@([A-Za-z0-9]+)/);

            if(match){
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] <@${match[1]}> Ваш запрос (${card.name}) на этапе подключения`);
            }else{
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] Ваш запрос (${card.name}) на этапе подключения`);
            }
        });
    });

    onCardsChange(BIZDEV_BOARD, BIZDEV_LIST_DONE, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/@([A-Za-z0-9]+)/);

            await moveCard(FB_BOARD, FB_LIST_NEW, card.id);

            if(match){
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] <@${match[1]}> добавлен новый оффер (${card.name})`);
            }else{
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] Добавлен новый оффер (${card.name})`);
            }
        });
    });

    FB_LIST_BUYERS.split(',').forEach(buyerName => {
        onCardsChange(FB_BOARD, buyerName, async dif => {
            dif.forEach(async card => {
                const match = card.desc.match(/@([A-Za-z0-9]+)/);

                await moveCard(buyerName + " " + FB_TEMPLATE_NAME, FB_LIST_NEW, card.id);
    
                if(match){
                    await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] <@${match[1]}> добавлен новый оффер. Проверьте свою доску`);
                }else{
                    await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] Добавлен новый оффер. Проверьте свою доску`);
                }
            });
        });
    });

    FB_LIST_BUYERS.split(',').forEach(buyerName => {
        onCardsChange(buyerName + " " + FB_TEMPLATE_NAME, FB_LIST_TROUBLE, async dif => {
            dif.forEach(async card => {
                await moveCard(BIZDEV_BOARD, FB_LIST_TROUBLE, card.id);
            });
        });
    });
    


    onCardsChange(BIZDEV_PUSH_BOARD, BIZDEV_LIST_DONE, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/@([A-Za-z0-9]+)/);

            await moveCard(PUSH_BOARD, PUSH_LIST_NEW, card.id);

            if(match){
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] <@${match[1]}> добавлен новый оффер (${card.name})`);
            }else{
                await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] Добавлен новый оффер (${card.name})`);
            }
        });
    });

    PUSH_LIST_BUYERS.split(',').forEach(buyerName => {
        onCardsChange(PUSH_BOARD, buyerName, async dif => {
            dif.forEach(async card => {
                const match = card.desc.match(/@([A-Za-z0-9]+)/);

                await moveCard(buyerName + " " + PUSH_TEMPLATE_NAME, PUSH_LIST_NEW, card.id);
    
                if(match){
                    await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] <@${match[1]}> добавлен новый оффер. Проверьте свою доску`);
                }else{
                    await client.channels.cache.get(BIZDEV_CHAN_ID).send(`[Trello] Добавлен новый оффер. Проверьте свою доску`);
                }
            });
        });
    });

    PUSH_LIST_BUYERS.split(',').forEach(buyerName => {
        onCardsChange(buyerName + " " + PUSH_TEMPLATE_NAME, PUSH_LIST_TROUBLE, async dif => {
            dif.forEach(async card => {
                await moveCard(BIZDEV_BOARD, PUSH_LIST_TROUBLE, card.id);
            });
        });
    });



    onCardsChange(TECH_BOARD, TECH_LIST_WORK, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/from \[\s*(@\S+)\s*(<@\d+>)\s*(\d+)\s*\]/);

            if(match){
                await client.channels.cache.get(match[3]).send(`[Trello] <@${match[2]}> Начата работа над задачей ${card.name}`);
            }else{
                await client.channels.cache.get(TECH_CHAN_ID).send(`[Trello] Начата работа над задачей ${card.name}`);
            }
        });
    });

    onCardsChange(TECH_BOARD, TECH_LIST_DONE, async dif => {
        dif.forEach(async card => {
            const match = card.desc.match(/from \[\s*(@\S+)\s*(<@\d+>)\s*(\d+)\s*\]/);

            if(match){
                await client.channels.cache.get(match[3]).send(`[Trello] <@${match[2]}> Задача ${card.name} готова!`);
            }else{
                await client.channels.cache.get(TECH_CHAN_ID).send(`[Trello] Задача ${card.name} готова!`);
            }
        });
    });
}