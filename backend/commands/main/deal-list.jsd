const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const geos = require("../../utils/geos.json");

async function findByGeo(type, geo){
    const ss = type.toLowerCase() == "cpa" ? process.env.SS_CPA_ID : process.env.SS_SPEND_ID;
    const sheets = await gapi.getSheets(ss);
    const sheet = sheets.find(v => v.properties.title.toLowerCase().split(' ')[1] == geo.toLowerCase());
    if(type.toLowerCase() == "cpa")
        return (await gapi.getValues(ss, sheet.properties.title)).data.values.slice(1).map(v => {return {brand: v[0], rate: v[2], source: v[3], cap: v[4], kpi: v[5], deadline: v[6], comment: v[7], liable: v[8]}});
    else
        return (await gapi.getValues(ss, sheet.properties.title)).data.values.slice(1).map(v => {return {brand: v[0], budget: v[2], source: v[3], rate: v[4], kpi: v[5], deadline: v[6], comment: v[7], liable: v[8]}});
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('сделка-список')
        .setDescription('Показать доступные сделки')
        .addStringOption(opt => opt.setName('гео').setDescription('Гео').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('тип').setDescription('Тип сделки').setRequired(true).addChoices({ name: "СПЕНД", value: "СПЕНД"}, { name: "CPA", value: "CPA"})),

    async autocomplete(int){
        const focusedOption = int.options.getFocused(true);
    
        const filtered = geos.filter(v => v.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()) || v.value.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await int.respond(
            filtered.map(c => ({name: c.name, value: c.value})).slice(0, 24)
        );
    },
    // async execute(int) {
    //     await int.deferReply({flags: MessageFlags.Ephemeral});
    //     const geo = int.options.getString('гео');
    //     const type = int.options.getString('тип');

    //     const deals = await findByGeo(type, geo);
    //     await int.editReply(deals.map(v => `Бренд: ${v.brand}, Ставка: ${v.rate}, Источник: ${v.cap}`))
    // },
};