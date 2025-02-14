const { authenticate } = require("@google-cloud/local-auth");
const { google, sheets_v4 } = require("googleapis");
const path = require('path');
const fs = require('fs');
const process = require("process");

module.exports = class GoogleAPI{
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
    TOKEN_PATH = path.join(process.cwd(), 'utils/token.json');
    CREDENTIALS_PATH = path.join(process.cwd(), 'utils/credentials.json');
    client = null;
    /**@type {sheets_v4.Sheets} */
    sheets = null;

    async loadSavedCredentialsIfExist() {
        try {
            const content = fs.readFileSync(this.TOKEN_PATH);
            const credentials = JSON.parse(content);
            return google.auth.fromJSON(credentials);
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    async saveCredentials(client) {
        const content = fs.readFileSync(this.CREDENTIALS_PATH);
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });

        console.log(JSON.stringify(client, null, 4));
        fs.writeFileSync(this.TOKEN_PATH, payload);
    }
  
    async authorize() {
        let client = await this.loadSavedCredentialsIfExist();

        if (client) {
            this.client = client;
            this.sheets = google.sheets({version: 'v4', auth: this.client});
            return client;
        }
        client = await authenticate({
            scopes: this.SCOPES,
            keyfilePath: this.CREDENTIALS_PATH,
        });
        if (client.credentials) {
            await this.saveCredentials(client);
        }
        this.client = client;
        this.sheets = google.sheets({version: 'v4', auth: this.client});
        return client;
    }

    async createSheet(spreadsheetId, title, rowCount, columnCount){
        return (await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{addSheet:{properties:{title, gridProperties: {rowCount, columnCount}}}}]
            }
        })).data.replies[0].addSheet?.properties?.sheetId;
    }

    async getValues(spreadsheetId, range){
        return await this.sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
    }

    async setValues(spreadsheetId, range, values){
        return await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "RAW",
                data: [
                    {values, range}
                ]
            }
        })
    }

    async setValuesG(spreadsheetId, gridRange, values){
        return await this.sheets.spreadsheets.values.batchUpdateByDataFilter({
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: [
                    {values, dataFilter: {gridRange}}
                ]
            }
        })
    }

    async copyValues(spreadsheetId, source, destination){
        return await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        copyPaste: {
                            source,
                            destination,
                            pasteType: "PASTE_NORMAL"
                        }
                    }
                ]
            }
        })
    }

    async getSheets(spreadsheetId){
        return (await this.sheets.spreadsheets.get({
            spreadsheetId
        })).data.sheets
    }

    // async createMeta(spreadsheetId, metadataId=0){
    //     return (await this.sheets.spreadsheets.batchUpdate({
    //         spreadsheetId,
    //         requestBody: {
    //             requests: [
    //                 {
    //                     createDeveloperMetadata: {
    //                         developerMetadata: {
    //                             // location: { locationType: "SPREADSHEET" },
    //                             metadataId,
    //                             metadataKey: "key",
    //                             metadataValue: "value"
    //                         }
    //                     }
    //                 }
    //             ]
    //         }
    //     }))
    // }

    // async saveMeta(spreadsheetId, key, value, metadataId=0){
    //     return (await this.sheets.spreadsheets.batchUpdate({
    //         spreadsheetId,
    //         requestBody: {
    //             requests: [
    //                 {
    //                     updateDeveloperMetadata: {
    //                         developerMetadata: {
    //                             metadataId,
    //                             key,
    //                             value,
    //                             // location: { locationType: "SPREADSHEET" }
    //                         }
    //                     }
    //                 }
    //             ]
    //         }
    //     }))
    // }

    // async loadMeta(spreadsheetId, metadataId=0){
    //     return (await this.sheets.spreadsheets.developerMetadata.get({
    //         spreadsheetId,
    //         metadataId
    //     }));
    // }
}
