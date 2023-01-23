import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Mel, Discord } from 'discord-mel'

class AppCommand extends AbstractCommand
{
	public static readonly enabled: boolean = true

	constructor(id: string, bot: Mel)
	{
		super(id, bot)

		this.name = 'app'

		this.description = this.bot.translator.translate('app.description')

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

	async onCommandInteraction(interaction: Discord.CommandInteraction): Promise<void>
	{
		const user = interaction.user

		interaction.reply(`Hello ${user.username}! Later you'll be able to use this command to login into the 2GETHER application!\nYou'll receive a link like this: \`https://2gether-asso.fr/login?token\``)
	}
}

export default AppCommand
