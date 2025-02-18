const trello = require('trello');

const tapi = new trello(process.env.TKEY, process.env.TTOKEN);

module.exports = { 
    async createNewCard(boardName, listName, name, desc, pos, due, labelName){
        const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
        const boardId = boards.find(v => v.name == boardName).id;
        const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
        const list = lists.find(v => v.name == listName);
        const label = (await tapi.getLabelsForBoard(boardId)).find(v => v.name == labelName);

        try{
            await tapi.addCardWithExtraParams(name, { 
                desc, pos, due, idLabels: label?.id
            }, list.id);
        }catch(e){
            console.log(e);
        }
    },

    async getQueue(boardName, listName){
        const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
        const boardId = boards.find(v => v.name == boardName).id;
        const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
        const list = lists.find(v => v.name == listName);
        const cards = await tapi.getCardsOnList(list.id);
        const labels = (await tapi.getLabelsForBoard(boardId)).filter(v => v.name);

        return {count: cards.length, urgentCount: cards.filter(v => v.idLabels.includes(labels.find(v => v.name == "Срочно").id)).length};
    },

    async onCardsChange(boardName, listName, onChange){
        const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
        const boardId = boards.find(v => v.name == boardName).id;
        const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
        const list = lists.find(v => v.name == listName);
        let lastCards = await tapi.getCardsOnList(list.id);

        setInterval(async () => {
            const cards = await tapi.getCardsOnList(list.id);
            const compare = findNewCards(cards, lastCards);
            
            lastCards = cards;
            if(compare.length > 0) onChange(compare);
        }, 3000);
    },

    async moveCard(boardName, listName, cardId){
        const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
        const boardId = boards.find(v => v.name == boardName).id;
        const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
        const list = lists.find(v => v.name == listName);
        await tapi.makeRequest('PUT', `/1/cards/${cardId}`, { idList: list.id, idBoard: boardId });
    }
};

function findNewCards(currentCards, previousCards) {
    const previousCardIds = new Set(previousCards.map(card => card.id));
  
    return currentCards.filter(card => !previousCardIds.has(card.id));
}