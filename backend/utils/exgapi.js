module.exports = {
    async getSheetByGeo(ss, geo, type){
        const { gapi } = require('..');
        const sheets = await gapi.getSheets(ss);
        let sheet = sheets.find(v => v.properties.title.toLowerCase().split(' ')[1] === geo.toLowerCase());

        if(!sheet){ 
            const sheetTitle = `${type} ${geo}`.toUpperCase();
            const sheetId = await gapi.cloneSheet(ss, 0, sheetTitle);
            return {sheetId, sheetTitle};
        }
        return {sheetId: sheet.properties.sheetId, sheetTitle: sheet.properties.title};
    },

    async addDeal(ss, sheet, data) {
        const { gapi } = require('..');
        await gapi.appendData(ss, sheet.sheetTitle, data);
    }
}