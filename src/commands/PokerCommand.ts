import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Bot, Discord } from 'discord-mel'

class PokerCommand extends AbstractCommand
{
	constructor(bot: Bot)
	{
		super(bot, 'poker')

		this.description = 'Jouez au poker avec vos amis !'

		// Application commands
		this.applicationCommands.push(
			(() => {
				const slashCommand = new SlashCommandBuilder()
				slashCommand.setName(this.name)
				if (this.description)
					slashCommand.setDescription(this.description)

				return slashCommand
			})()
		)
	}

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction): Promise<void>
	{
		if (interaction.member instanceof Discord.GuildMember)
		{
			const voiceChannel = interaction.member.voice.channel
			const textChannel = interaction.channel

			if (!voiceChannel)
			{
				interaction.reply({
					content: 'You must be connected to a voice channel so that I can join you.',
					ephemeral: true,
				})
			}
			else if (!textChannel)
			{
				interaction.reply({
					content: 'Unable to send the invitation link.',
					ephemeral: true,
				})
			}
			else
			{
				this.bot.config.discordTogether
					.createTogetherCode(voiceChannel.id, 'poker')
					.then(async (invite: { code: any }) =>
						{
							const embed = new Discord.MessageEmbed()
							embed.setTitle('Poker')
							embed.setURL(invite.code)
							embed.setColor('#c0c0c0')
							embed.setDescription('Cliquez sur le lien pour rejoindre !')
							if (interaction.guild)
								embed.setFooter(`sur ${interaction.guild.name}`)

							return textChannel.send({
									content: `<${invite.code}>`,
									embeds: [embed],
								})
						})
					.then(() =>
						{
							interaction.reply({
									content: 'Ok.',
									ephemeral: true,
								})
						})
					.catch((error: any) =>
						{
							this.logger.error(error, this.name)

							interaction.reply({
								content: 'An error occurred.',
								ephemeral: true,
							})
						})
			}
		}
	}
}

export default PokerCommand
