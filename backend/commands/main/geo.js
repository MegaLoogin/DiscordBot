const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const geos = require("../../utils/geos.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('geo')
        .setDescription('Узнать geo')
        .addStringOption(opt => opt.setName('гео').setDescription('Гео').setRequired(true).setAutocomplete(true)),

    async autocomplete(int){
        const focusedOption = int.options.getFocused(true);
    
        const filtered = geos.filter(v => v.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()) || v.value.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await int.respond(
            filtered.map(c => ({name: c.name, value: c.value})).slice(0, 24)
        );
    },
    async execute(int) {
        await int.deferReply({flags: MessageFlags.Ephemeral});
        const geo = int.options.getString('гео');

        const filtered = geos.filter(v => v.name.toLowerCase().startsWith(geo.toLowerCase()) || v.value.toLowerCase().startsWith(geo.toLowerCase()));
        if(filtered.length > 0){
            await int.editReply({content: filtered.map(v => `${v.name} = ${v.value}`).join('\n'), flags: MessageFlags.Ephemeral} );
        }else{
            await int.editReply({content: `Гео не найдено`, flags: MessageFlags.Ephemeral} );
        }
    },
};