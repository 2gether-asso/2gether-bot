import { SlashCommandBuilder } from '@discordjs/builders'
import { AbstractCommand, Bot, Discord } from 'discord-mel'

import State from '../state/State'

class GiveawayWinsCommand extends AbstractCommand
{
	constructor(bot: Bot)
	{
		super(bot, 'giveawaywins')

		this.description = 'Affiche le nombre de victoire d\'un utilisateur.'

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

		// Rules
		this.guildOnly = true
	}

	protected get state(): State
	{
		return super.state as State
	}

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction): Promise<void>
	{
		const nbWins = this.state.db.giveaways.wins[interaction.user.id]
		const sumWins = Object.values(this.state.db.giveaways.wins)
			.reduce((sum, nbWins) => sum + nbWins, 0)

		interaction.reply({
				content: `Tu as gagné ${nbWins} giveaways sur ${sumWins} !`,
				ephemeral: true,
			})
	}
}

export default GiveawayWinsCommand
