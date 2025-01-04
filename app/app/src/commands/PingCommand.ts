import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Mel, Discord } from 'discord-mel'

class PingCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	constructor(id: string, bot: Mel)
	{
		super(id, bot)

		this.name = 'ping'

		this.description = this.bot.translator.translate('ping.description')

		// Legacy commands aliases
		// this.commandAliases.add('ping')

		// Application commands
		this.applicationCommands.add(
			(() => {
				const slashCommand = new SlashCommandBuilder()
				slashCommand.setName(this.name)
				if (this.description)
					slashCommand.setDescription(this.description)

				return slashCommand
			})()
		)
	}

	async onMessage(message: Discord.Message): Promise<void>
	{
		message.reply(this.bot.translator.translate('ping.pong'))
	}

	async onCommandInteraction(interaction: Discord.CommandInteraction): Promise<void>
	{
		interaction.reply(this.bot.translator.translate('ping.pong'))
	}
}

export default PingCommand
