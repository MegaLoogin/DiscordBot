const trello = require('trello');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../volume/boards_cache.json');
const CACHE_TTL = 30 * 60 * 1000; // 30 минут в миллисекундах

const tapi = new trello(process.env.TKEY, process.env.TTOKEN);

// Создаем директорию volume, если она не существует
if (!fs.existsSync(path.join(__dirname, '../volume'))) {
    fs.mkdirSync(path.join(__dirname, '../volume'), { recursive: true });
}

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

    async getQueue(boardName, listName) {
        try{
            const boards = (await tapi.getBoards((await tapi.getMember("me")).id));
            const boardId = boards.find(v => v.name == boardName).id;
            const lists = (await tapi.getListsOnBoard(boardId, "id,name"));
            const list = lists.find(v => v.name == listName);
            if(!list) throw Error(JSON.stringify(lists));
            const cards = await tapi.getCardsOnList(list.id);
            const labels = (await tapi.getLabelsForBoard(boardId)).filter(v => v.name);
        
            const nameStats = cards.reduce((acc, card) => {
                const match = card.name.match(/\(([^)]+)\)$/);
                const name = match ? match[1].trim() : 'Без имени';
                
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
        
            const nameCounts = Object.entries(nameStats)
                .map(([name, count]) => ({name, count}))
                .sort((a, b) => b.count - a.count);
        
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
    },

    async getBoardsStats() {
        try {
            // Проверяем существование и актуальность кеша
            if (fs.existsSync(CACHE_FILE)) {
                const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                const now = Date.now();
                
                // Если прошло меньше 30 минут, возвращаем кешированные данные
                if (now - cacheData.timestamp < CACHE_TTL) {
                    return cacheData.stats;
                }
            }

            // Если кеш устарел или отсутствует, получаем новые данные
            const boards = await tapi.getBoards((await tapi.getMember("me")).id);
            const boardGroups = new Map(); // Для группировки досок по спискам

            for (const board of boards) {
                const lists = await tapi.getListsOnBoard(board.id, "id,name");
                if (lists.length < 2) continue;

                const firstListCards = await tapi.getCardsOnList(lists[0].id);
                const secondListCards = await tapi.getCardsOnList(lists[1].id);

                // Создаем ключ группы из названий первых двух списков
                const groupKey = `${lists[0].name}|${lists[1].name}`;
                
                if (!boardGroups.has(groupKey)) {
                    boardGroups.set(groupKey, {
                        listNames: [lists[0].name, lists[1].name],
                        boards: []
                    });
                }

                boardGroups.get(groupKey).boards.push({
                    boardName: board.name,
                    counts: [firstListCards.length, secondListCards.length]
                });
            }

            // Преобразуем Map в массив групп и сортируем доски внутри групп
            const groups = Array.from(boardGroups.entries()).map(([key, value]) => ({
                listNames: value.listNames,
                boards: value.boards.sort((a, b) => {
                    const totalA = a.counts[0] + a.counts[1];
                    const totalB = b.counts[0] + b.counts[1];
                    return totalB - totalA;
                })
            }));

            // Сортируем группы по общему количеству карточек
            groups.sort((a, b) => {
                const totalA = a.boards.reduce((sum, board) => sum + board.counts[0] + board.counts[1], 0);
                const totalB = b.boards.reduce((sum, board) => sum + board.counts[0] + board.counts[1], 0);
                return totalB - totalA;
            });

            // Сохраняем новые данные в кеш
            const cacheData = {
                timestamp: Date.now(),
                stats: groups
            };
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));

            return groups;
        } catch (e) {
            console.error('Ошибка при получении статистики досок:', e);
            
            // В случае ошибки пытаемся вернуть кешированные данные, если они есть
            if (fs.existsSync(CACHE_FILE)) {
                try {
                    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                    return cacheData.stats;
                } catch (cacheError) {
                    console.error('Ошибка при чтении кеша:', cacheError);
                }
            }
            
            // Если не удалось получить данные из кеша, возвращаем пустой массив
            return [];
        }
    }
};

function findNewCards(currentCards, previousCards) {
    const previousCardIds = new Set(previousCards.map(card => card.id));
  
    return currentCards.filter(card => !previousCardIds.has(card.id));
}