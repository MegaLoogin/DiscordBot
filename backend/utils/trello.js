const trello = require('trello');

const tapi = new trello(process.env.TKEY, process.env.TTOKEN);

module.exports = { 
    async createNewCard(boardName, listName, name, desc, pos, due, labelName){
        try{
            const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
            const boardId = boards.find(v => v.name == boardName).id;
            const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
            const list = lists.find(v => v.name == listName);
            if(!list) throw Error(JSON.stringify(lists));
            const label = (await tapi.getLabelsForBoard(boardId)).find(v => v.name == labelName);
            
            await tapi.addCardWithExtraParams(name, { 
                desc, pos, due, idLabels: label?.id
            }, list.id);
        }catch(e){
            console.log(e, boardName, listName);
        }
    },

    // async getQueue(boardName, listName){
    //     const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
    //     const boardId = boards.find(v => v.name == boardName).id;
    //     const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
    //     const list = lists.find(v => v.name == listName);
    //     const cards = await tapi.getCardsOnList(list.id);
    //     const labels = (await tapi.getLabelsForBoard(boardId)).filter(v => v.name);

    //     return {count: cards.length, urgentCount: cards.filter(v => v.idLabels.includes(labels.find(v => v.name == "Срочно").id)).length};
    // },

    async getQueue(boardName, listName) {
        try{
            const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
            const boardId = boards.find(v => v.name == boardName).id;
            const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
            const list = lists.find(v => v.name == listName);
            if(!list) throw Error(JSON.stringify(lists));
            const cards = await tapi.getCardsOnList(list.id);
            const labels = (await tapi.getLabelsForBoard(boardId)).filter(v => v.name);
        
            // Группировка по именам в скобках
            const nameStats = cards.reduce((acc, card) => {
                // Ищем имя в последних скобках в названии
                const match = card.name.match(/\(([^)]+)\)$/);
                const name = match ? match[1].trim() : 'Без имени';
                
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
        
            // // Преобразуем в массив объектов
            const nameCounts = Object.entries(nameStats)
                .map(([name, count]) => ({name, count}))
                .sort((a, b) => b.count - a.count); // Сортировка по убыванию
        
            return {
                count: cards.length,
                urgentCount: cards.filter(v => v.idLabels.includes(labels.find(v => v.name == "Срочно").id)).length,
                names: nameCounts
            };
        }catch(e){
            console.log(e, listName, boardName);
        }
    },

    async onCardsChange(boardName, listName, onChange){
        try{
            const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
            const boardId = boards.find(v => v.name == boardName).id;
            const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
            const list = lists.find(v => v.name == listName);
            if(!list) throw Error(JSON.stringify(lists));
            let lastCards = await tapi.getCardsOnList(list.id);

            setInterval(async () => {
                const cards = await tapi.getCardsOnList(list.id);
                const compare = findNewCards(cards, lastCards);
                
                lastCards = cards;
                if(compare.length > 0) onChange(compare);
            }, 10_000);
        }catch(e){
            console.log(e, listName, boardName);
        }
    },

    async moveCard(boardName, listName, cardId){
        try{
            const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
            const boardId = boards.find(v => v.name == boardName).id;
            const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
            const list = lists.find(v => v.name == listName);
            if(!list) throw Error(JSON.stringify(lists));
            await tapi.makeRequest('PUT', `/1/cards/${cardId}`, { idList: list.id, idBoard: boardId });
        }catch(e){
            console.log(e, listName, boardName);
        }
    }
};

function findNewCards(currentCards, previousCards) {
    const previousCardIds = new Set(previousCards.map(card => card.id));
  
    return currentCards.filter(card => !previousCardIds.has(card.id));
}