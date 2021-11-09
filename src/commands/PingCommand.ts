import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Bot, Discord } from 'discord-mel'

class PingCommand extends AbstractCommand
{
	constructor(bot: Bot)
	{
		super(bot, 'ping')

		this.description = this.translator.translate('ping.description')
		// this.cooldown = 5
	}

	async onMessage(message: Discord.Message)
	{
		message.reply(this.translator.translate('ping.pong'))
	}

	async onInteraction(interaction: Discord.CommandInteraction)
	{
		interaction.reply(this.translator.translate('ping.pong'))
	}

	getApplicationCommand()
	{
		const slashCommand = new SlashCommandBuilder()
		slashCommand.setName(this.name)
		if (this.description)
			slashCommand.setDescription(this.description)

		return slashCommand
	}
}

export default PingCommand
