import { ApplicationCommandType } from 'discord-api-types'
import { ContextMenuCommandBuilder } from '@discordjs/builders'

import { AbstractCommand, Bot, Discord } from 'discord-mel'
import Collection = Discord.Collection

import State from '../state/State'

class RunGiveawayCommand extends AbstractCommand
{
	_state: State

	constructor(bot: Bot)
	{
		super(bot, 'rungiveaway')

		this._state = bot.state as State

		this.description = 'Execute le tirage au sort.'

		this.guildOnly = true
		this.permissions = ['ADMINISTRATOR']

		// this.cooldown = 5
		// this.slash = true
	}

	/**
	 * @param {Discord.Message} message
	 */
	async onMessage(message: Discord.Message, args: string)
	{
		const repliedToId = message.reference?.messageId
		if (repliedToId)
		{
			await message.channel.messages.fetch(repliedToId)
				.then(repliedTo => repliedTo.fetch())
				.then(repliedTo =>
					{
						this.execute(repliedTo, message.channel as any, message.author, args)
							.catch(error =>
								{
									message.reply('Failed to execute the command.')
									this.logger.warn(error, `${this.name}:${repliedToId}`)
								})
					})
				.catch(error =>
					{
						message.reply('Failed to fetch the giveaway message.')
						this.logger.warn(error, `${this.name}:${repliedToId}`)
					})

			// Delete user command
			message.delete()
		}
		else
		{
			message.reply('Please reply to the giveaway message when executing this command.')
		}
	}

	/**
	 * @param {Discord.ContextMenuInteraction} interaction
	 */
	async onInteraction(interaction: Discord.ContextMenuInteraction)
	{
		const channel = interaction.channel
		const repliedToId = interaction?.targetId
		if (channel && repliedToId)
		{
			await channel.messages.fetch(repliedToId)
				.then(repliedTo => repliedTo.fetch())
				.then(repliedTo =>
					{
						this.execute(repliedTo, channel as any, interaction.user)
							.catch(error =>
								{
									interaction.reply({
											content: 'Failed to execute the command.',
											ephemeral: true,
										})
									this.logger.warn(error, `${this.name}:${repliedToId}`)
								})
					})
				.catch(error =>
					{
						interaction.reply({
								content: 'Failed to fetch the giveaway message.',
								ephemeral: true,
							})
						this.logger.warn(error, `${this.name}:${repliedToId}`)
					})

				interaction.reply({
						content: 'Done!',
						ephemeral: true,
					})
		}
		else
		{
			interaction.reply({
					content: 'Please reply to the giveaway message when executing this command.',
					ephemeral: true,
				})
		}
	}

	/**
	 *
	 * @param {Discord.Message} repliedTo
	 * @param {Discord.TextBasedChannels} channel
	 * @param {Discord.User} author
	 */
	async execute(repliedTo: Discord.Message,
	              channel: Discord.TextBasedChannels,
	              author: Discord.User,
	              emoji?: Discord.MessageReactionResolvable)
	{
		const options = {
			title: 'Une chance sur deux !',
			description: 'Résultats du tirage au sort.',
			color: '#4080c0',
			nbWinners: 1,
		}

		const reaction = emoji
			? repliedTo.reactions.resolve(emoji)
			: repliedTo.reactions.cache.first()
		const participants =
			await reaction?.users.fetch()
				.then(users => users.filter(user => !user.bot))
				.catch(() => undefined)
			|| new Collection<string, Discord.User>()

		const winners = ((): Discord.User[] =>
			{
				const unselected = [...participants.values()]

				const wins = this._state.db.giveaways.wins
				const sumWins = Object.values(this._state.db.giveaways.wins)
					.reduce((sum, nbWins) => sum + nbWins, 0)

				if (participants.size <= 0)
				{
					this.logger.debug(`Nobody won`, `${this.name}:${repliedTo.id}`)
					return []
				}
				if (participants.size <= options.nbWinners)
				{
					this.logger.debug(`All participants won`, `${this.name}:${repliedTo.id}`)
					return unselected
				}
				else
				{
					const winners = []
					for (let i = 0; i < options.nbWinners; ++i)
					{
						const winnerIndex = Math.floor(Math.random() * unselected.length)
						const selectedWinner = unselected[winnerIndex]

						if (Math.floor(Math.random() * sumWins) < wins[selectedWinner.id])
						{
							// Redraw
							this.logger.debug(`Redrawing ${selectedWinner.username}`, `${this.name}:${repliedTo.id}`)
							--i
							continue
						}
						else
						{
							// He is a winner
							this.logger.info(`${selectedWinner.username} won`, `${this.name}:${repliedTo.id}`)
							winners.push(...unselected.splice(winnerIndex, 1))
						}
					}

					return winners
				}
			}).call(this)
		this.logger.debug(`${winners.length} winners out of ${participants.size} participants`, `${this.name}:${repliedTo.id}`)

		let content = `Le giveaway`
		if (channel.lastMessageId !== repliedTo.id)
			content += ` **${options.title}**`
		content += ` vient de se terminer`

		if (winners.length > 0)
		{
			const winnersStr = winners.join(`\n`);

			content += ` ! Bravo ${winners.length > 1 ? 'aux gagnants' : 'au gagnant'} !\n${winnersStr}`

			const embed = new Discord.MessageEmbed()
			embed.setTitle(options.title)
			if (options.description)
				embed.setDescription(options.description)
			if (options.color)
				embed.setColor(options.color as Discord.HexColorString)
			embed.addField(winners.length > 1 ? 'Gagnants' : 'Gagnant', winnersStr)
			if (author)
				embed.addField('Pour récupérer votre cadeau :', `Envoyez un message privé à ${author} !`)
			embed.setFooter(participants.size > 1
					? `Merci aux ${participants.size} participants !`
					: `Merci à l'unique participant !`)

			// Announce the giveaway winner!
			channel.send({ content,
					embeds: [embed],
					reply: { messageReference: repliedTo.id }
				})
				.then(() =>
					{
						this._state.setState(db =>
						{
							winners.forEach(winner =>
								{
									const wins = (db.giveaways.wins[winner.id] || 0) + 1
									db.giveaways.wins[winner.id] = wins
									this.logger.debug(`${winner} now has ${wins} wins`, `${this.name}:${repliedTo.id}`)
								})
						})
					})
				.catch(error => this.logger.warn(error, `${this.name}:${repliedTo.id}`))
		}
		else
		{
			content += `, et il n'y a malheureusement eu aucun participant 😅`

			// Announce the lack of a winnner
			channel.send({ content,
					reply: { messageReference: repliedTo.id }
				})
				.catch(error => this.logger.warn(error, `${this.name}:${repliedTo.id}`))
		}
	}

	getApplicationCommand()
	{
		const applicationCommand = new ContextMenuCommandBuilder()
		applicationCommand.setName(this.name)
		applicationCommand.setType(ApplicationCommandType.Message)

		return applicationCommand
	}
}

export default RunGiveawayCommand
