import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Bot, Discord } from 'discord-mel'

class YoutubeCommand extends AbstractCommand
{
	constructor(bot: Bot)
	{
		super(bot, 'youtube')

		this.description = 'Regardez YouTube ensemble !'

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
			const member = interaction.member
			const channel = interaction.channel

			if (!interaction.member.voice.channel)
			{
				interaction.reply({
					content: 'You must be connected to a voice channel so that I can join you.',
					ephemeral: true,
				})
			}
			else if (!channel)
			{
				interaction.reply({
					content: 'Unable to send the invitation link.',
					ephemeral: true,
				})
			}
			else
			{
				this.bot.config.discordTogether
					.createTogetherCode(interaction.member.voice.channel.id, 'youtube')
					.then(async (invite: { code: any }) =>
						{
							const embed = new Discord.MessageEmbed()
							embed.setTitle('YouTube Together')
							embed.setURL(invite.code)
							embed.setColor('#f02020')
							embed.setDescription('Cliquez sur le lien pour rejoindre !')
							if (interaction.guild)
								embed.setFooter(`in ${interaction.guild.name}`)

							return channel.send({
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

export default YoutubeCommand
