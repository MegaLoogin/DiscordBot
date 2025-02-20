const { SlashCommandBuilder } = require("discord.js");
const geos = require("../../utils/geos.json");
const { createNewCard } = require("../../utils/trello");
const { getSheetByGeo, addDeal } = require("../../utils/exgapi");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('сделка')
        .setDescription('Создает сделку в таблице и trello')
        .addSubcommand(subcommand => 
            subcommand
                .setName("cpa")
                .setDescription("Тип сделки CPA")
                .addStringOption(opt => opt.setName('бренд').setDescription('Бренд сделки').setRequired(true))
                .addStringOption(opt => opt.setName('гео').setDescription('Гео сделки').setRequired(true).setAutocomplete(true))
                .addIntegerOption(option => 
                    option
                        .setName('ставка')
                        .setDescription('Ставка сделки в $')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option
                        .setName('cap')
                        .setDescription('CAP')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('источник')
                        .setDescription('Источник')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('kpi')
                        .setDescription('KPI')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('активен')
                        .setDescription('Активен до')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('примечание')
                        .setDescription('Примечание')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand => 
            subcommand
                .setName("spend")
                .setDescription("Тип сделки SPEND")
                .addStringOption(opt => opt.setName('бренд').setDescription('Бренд сделки').setRequired(true))
                .addStringOption(opt => opt.setName('гео').setDescription('Гео сделки').setRequired(true).setAutocomplete(true))
                .addIntegerOption(option => 
                    option
                        .setName('бюджет')
                        .setDescription('Бюджет сделки в $')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('источник')
                        .setDescription('Источник')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option
                        .setName('ставка')
                        .setDescription('Ставка в %')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('kpi')
                        .setDescription('KPI')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('активен')
                        .setDescription('Активен до')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option
                        .setName('примечание')
                        .setDescription('Примечание')
                        .setRequired(false)
                )
        ),

    async autocomplete(int){
        const focusedOption = int.options.getFocused(true);
    
        const filtered = geos.filter(v => v.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()) || v.value.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await int.respond(
            filtered.map(c => ({name: c.name, value: c.value})).slice(0, 24)
        );
    },
    // async execute(int) {
    //     await int.deferReply();

    //     const subcommand = int.options.getSubcommand();
    //     const name = int.options.getString('бренд');
    //     const geo = int.options.getString('гео');
    //     const kpi = int.options.getString('kpi');
    //     const deadline = int.options.getString('активен');
    //     const source = int.options.getString('источник');
    //     const comment = int.options.getString('примечание');

    //     let ss_id = subcommand === "cpa" ? process.env.SS_CPA_ID : process.env.SS_SPEND_ID;

    //     const sheet = await getSheetByGeo(ss_id, geo, subcommand);

    //     if (subcommand === 'cpa') {
    //         const rate = int.options.getInteger('ставка');
    //         const cap = int.options.getInteger('cap');
    //         await createNewCard(process.env.OFFER_BOARD, process.env.DEAL_LIST_NEW, `[${subcommand.toUpperCase()}] ${name} ${geo}`,
    //             `Ставка: $${rate}\nCAP: ${cap}\nKPI: ${kpi}\nСроки: ${deadline}\nПримечание: ${comment}`, "bottom");
    //         await addDeal(ss_id, sheet, [name, geo, rate, source, cap, kpi, deadline, comment]);
    //     } else if (subcommand === 'spend') {
    //         const budget = int.options.getInteger('бюджет');
    //         const rate = int.options.getInteger('ставка');
    //         await createNewCard(process.env.OFFER_BOARD, process.env.DEAL_LIST_NEW, `[${subcommand.toUpperCase()}] ${name} ${geo}`,
    //             `Бюджет: $${budget}\nСтавка: $${rate}\nKPI: ${kpi}\nСроки: ${deadline}\nПримечание: ${comment}`, "bottom");
    //         await addDeal(ss_id, sheet, [name, geo, budget, source, rate, kpi, deadline, comment]);
    //     }

    //     await int.editReply(`Сделка [${subcommand.toUpperCase()}] ${name} ${geo} добавлена`);
    // },
};