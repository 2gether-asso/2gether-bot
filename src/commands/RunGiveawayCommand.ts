import { ApplicationCommandType } from 'discord-api-types'
import { ContextMenuCommandBuilder } from '@discordjs/builders'

import { AbstractCommand, Mel, Discord } from 'discord-mel'
import Collection = Discord.Collection

import State from '../state/State'

class RunGiveawayCommand extends AbstractCommand
{
	constructor(bot: Mel)
	{
		super(bot, 'rungiveaway')

		this.description = 'Execute le tirage au sort.'

		// Legacy commands aliases
		// this.commandAliases.add('rungiveaway')

		// Application commands
		this.applicationCommands.push(
			(() => {
				const applicationCommand = new ContextMenuCommandBuilder()
				applicationCommand.setName(this.name)
				applicationCommand.setType(ApplicationCommandType.Message)

				return applicationCommand
			})()
		)

		this.componentIds.add(`${this.name}:select_emoji`)

		this.guildOnly = true
		this.permissions = ['ADMINISTRATOR']
	}

	protected get state(): State
	{
		return super.state as State
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
						const reaction = (
								args ? repliedTo.reactions.resolve(args)
								     : repliedTo.reactions.cache.first()
							) || undefined
						this.execute(repliedTo, message.channel, message.author, reaction)
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

	async onCommandInteraction(interaction: Discord.BaseCommandInteraction)
	{
		if (!interaction.isContextMenu())
			return

		const channel = interaction.channel
		const repliedToId = interaction?.targetId
		if (channel && repliedToId)
		{
			await channel.messages.fetch(repliedToId)
				.then(repliedTo => repliedTo.fetch())
				.then(repliedTo =>
					{
						if (repliedTo.reactions.cache.size >= 2)
						{
							interaction.reply({
									content: 'Quelle reaction est liée au giveaway ?',
									components: [
										new Discord.MessageActionRow()
											.addComponents(
												new Discord.MessageSelectMenu()
													.setCustomId(`${this.name}:select_emoji`)
													.setPlaceholder('Nothing selected')
													.addOptions(
														repliedTo.reactions.cache.map((reaction, key) =>
															({
																label: reaction.emoji.name || key,
																value: `${repliedToId}:${reaction.emoji.id || key}`
															})
														))
											)
									],
									ephemeral: true,
								})
							this.logger.debug('Prompt for which reaction', `${this.name}:${repliedToId}`)						}
						else
						{
							const reaction = repliedTo.reactions.cache.first()
							this.execute(repliedTo, channel, interaction.user, reaction)
								.then(() =>
									{
										interaction.reply({
												content: 'Done!',
												ephemeral: true,
											})
									})
								.catch(error =>
									{
										interaction.reply({
												content: 'Failed to execute the command.',
												ephemeral: true,
											})
										this.logger.warn(error, `${this.name}:${repliedToId}`)
									})
						}
					})
				.catch(error =>
					{
						interaction.reply({
								content: 'Failed to fetch the giveaway message.',
								ephemeral: true,
							})
						this.logger.warn(error, `${this.name}:${repliedToId}`)
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

	async onComponentInteraction(interaction: Discord.MessageComponentInteraction)
	{
		if (!interaction.isSelectMenu())
			return

		if (interaction.customId === `${this.name}:select_emoji`)
		{
			if (interaction.values.length === 1)
			{
				const channel = interaction.channel
				const [ repliedToId, emojiId ] = interaction.values[0].split(':')
				if (channel && repliedToId)
				{
					await channel.messages.fetch(repliedToId)
						.then(repliedTo => repliedTo.fetch())
						.then(repliedTo =>
							{
								const reaction = repliedTo.reactions.resolve(emojiId) || undefined
								this.logger.debug(`Selected reaction ${reaction?.emoji.name}`, `${this.name}:${repliedToId}`)
								this.execute(repliedTo, channel, interaction.user, reaction)
									.then(() =>
										{
											interaction.update({
													content: 'Done!',
													components: [],
												})
										})
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
				}
				else
				{
					interaction.reply({
							content: 'Please reply to the giveaway message when executing this command.',
							ephemeral: true,
						})
				}
			}
			else
			{
				interaction.reply({
						content: `You must select only one value`,
						ephemeral: true,
					})
			}
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
				  reaction?: Discord.MessageReaction)
	{
		const options = {
			title: 'Une chance sur deux !',
			description: 'Résultats du tirage au sort.',
			color: '#4080c0',
			nbWinners: 1,
		}

		const participants =
			await reaction?.users.fetch()
				.then(users => users.filter(user => !user.bot))
				.catch(() => undefined)
			|| new Collection<string, Discord.User>()

		this.logger.debug(`Trying to draw ${options.nbWinners} winners`, `${this.name}:${repliedTo.id}`)
		const winners = participants.random(options.nbWinners)
		this.logger.info(`${winners.length} winners out of ${participants.size} participants`, `${this.name}:${repliedTo.id}`)

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
						this.state.setState(db =>
						{
							participants.forEach(participant =>
								{
									// Save participations
									const participations = (db.giveaways.participations[participant.id] || 0) + 1
									db.giveaways.participations[participant.id] = participations
									this.logger.debug(`${participant.username} now has ${participations} participations`, `${this.name}:${repliedTo.id}`)
								})

							winners.forEach(winner =>
								{
									// Save wins
									const wins = (db.giveaways.wins[winner.id] || 0) + 1
									db.giveaways.wins[winner.id] = wins
									this.logger.debug(`${winner.username} now has ${wins} wins`, `${this.name}:${repliedTo.id}`)
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
}

export default RunGiveawayCommand
