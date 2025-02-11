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
                desc, pos, due, idLabels: label.id
            }, list.id);
        }catch(e){
            console.log(e);
        }
    }
};